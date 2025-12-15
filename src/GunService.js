import Gun from 'native-gun';

let gun;
try {
    // prefer AsyncStorage if available in React Native environment
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const storageAdapter = {
        async getItem(k) { return await AsyncStorage.getItem(k); },
        async setItem(k, v) { return await AsyncStorage.setItem(k, v); },
        async removeItem(k) { return await AsyncStorage.removeItem(k); },
    };

    gun = Gun({
        // keep peers empty by default; consumers can set via gun.opt({ peers: [...] })
        peers: [],
        // pass storage adapter — native-gun will use shims where appropriate
        localStorage: storageAdapter,
        store: storageAdapter,
        radisk: false,
        web: false,
    });
} catch (e) {
    // fallback to default Gun (no persistent storage)
    gun = Gun();
}

// peer list tracking (in-memory). Use `setPeers` to configure relay peers.
let peers = [];

// configurable chat key (namespace) so callers can switch to a fresh key
let chatKey = 'chat_B_';
// chatKey = chatKey + new Date().getTime();

function setChatKey(key) {
    if (!key) return
    chatKey = String(key)
}

function setPeers(list) {
    peers = Array.isArray(list) ? list.slice() : [];
    try {
        gun.opt({ peers });
    } catch (e) {
        // ignore
    }
}

function getPeers() {
    return peers.slice();
}

// SEA helpers: create a keypair and persist it to AsyncStorage if available
async function createPair() {
    const SEA = Gun.SEA;
    if (!SEA || !SEA.pair) throw new Error('SEA.pair not available');
    const pair = await SEA.pair();
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('sea_pair', JSON.stringify(pair));
    } catch (e) {
        // ignore storage errors
    }
    return pair;
}

async function loadPair() {
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const raw = await AsyncStorage.getItem('sea_pair');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

async function sendMessage({ id, text, author, gifBase64, mime, attachments }) {
    const msg = {
        id: id || Date.now().toString(),
        text,
        author: author || 'anon',
        ts: Date.now(),
    };

    // support legacy single-image fields or new attachments array
    if (attachments && Array.isArray(attachments) && attachments.length) {
        const MAX_ATTACH = 5;
        const attSlice = attachments.slice(0, MAX_ATTACH);
        const hashes = [];

        // Ensure SEA is available
        const SEA = Gun && Gun.SEA;

        for (let a of attSlice) {
            const out = {};
            if (a.gifBase64) out.gifBase64 = a.gifBase64;
            if (a.gifUri) out.gifUri = a.gifUri;
            if (a.mime) out.mime = a.mime;

            try {
                // compute a content-hash (frozen) and store under gun.get('#').get(hash)
                // use a canonical string for hashing and storage
                const payload = JSON.stringify(out);
                let hash;
                if (SEA && SEA.work) {
                    // SEA.work hashes the exact payload string
                    hash = await SEA.work(payload, null, null, { name: 'SHA-256' });
                } else {
                    // fallback: use timestamp-based pseudo-hash
                    hash = String(Date.now()) + Math.random().toString(36).slice(2, 8);
                }

                // store the exact payload string under the content-addressed node
                try {
                    gun.get('#').get(hash).put(payload);
                } catch (e) {
                    // ignore storage errors but continue
                    console.debug('GunService: failed to put attachment node', e);
                }

                hashes.push(hash);
            } catch (e) {
                // on any error, skip this attachment
                console.debug('GunService: attachment hash/store error', e);
            }
        }

        // store attachments as a JSON string so Gun doesn't convert arrays into linked nodes
        try {
            msg.attachments = JSON.stringify(hashes);
        } catch (e) {
            msg.attachments = null;
        }
    } else if (gifBase64) {
        msg.gifBase64 = gifBase64;
        if (mime) msg.mime = mime;
    }

    try {
        gun.get(chatKey).get('messages').set(msg);
    } catch (e) {
        console.debug('GunService: failed to write message', e);
    }

    return msg;
}

function subscribeMessages(cb) {
    // GUN will call cb for each message node; dedupe should be handled by caller
    gun.get(chatKey).get('messages').map().on((data, key) => {
        if (!data) return;
        const base = { ...(data || {}), _key: key };

        // attachments may be stored as a JSON string of hashes or as an array
        let attachmentHashes = null;
        if (typeof base.attachments === 'string') {
            try {
                attachmentHashes = JSON.parse(base.attachments);
            } catch (e) {
                attachmentHashes = null;
            }
        } else if (Array.isArray(base.attachments)) {
            attachmentHashes = base.attachments;
        }

        if (Array.isArray(attachmentHashes) && attachmentHashes.length) {
            const hashes = attachmentHashes.slice(0, 5);

            // helper to dereference a single hash with one retry after delay
            const derefOnce = (h) => new Promise(resolve => {
                let tried = 0;
                const attempt = () => {
                    try {
                        gun.get('#').get(h).once((d) => {
                            // Log the returned data type and length (avoid printing huge payloads)
                            try {
                                let len = 0;
                                if (d == null) {
                                    len = 0;
                                } else if (typeof d === 'string') {
                                    len = d.length;
                                } else {
                                    try { len = JSON.stringify(d).length; } catch (err) { len = -1; }
                                }
                                // (debug logging removed to reduce noise)
                            } catch (e) { }
                            if (d) return resolve(d);
                            tried += 1;
                            if (tried <= 1) {
                                // retry after short delay to allow propagation
                                setTimeout(attempt, 300);
                            } else {
                                resolve(null);
                            }
                        });
                    } catch (e) {
                        resolve(null);
                    }
                };
                attempt();
            });

            const promises = hashes.map(h => derefOnce(h));
            Promise.all(promises).then((resolved) => {
                // resolved items may be stored as canonical JSON strings; parse if needed
                const parsed = resolved.map(r => {
                    if (!r) return null;
                    if (typeof r === 'string') {
                        try { return JSON.parse(r); } catch (e) { return null; }
                    }
                    return r;
                }).filter(Boolean);
                base.attachments = parsed;
                cb(base);
            }).catch(() => cb(base));
            return;
        }

        cb(base);
    });
    // no unsubscribe handle returned (native-gun may provide API for off())
}

// fetch an array of attachment hashes and return parsed attachment objects
async function fetchAttachments(hashes) {
    if (!Array.isArray(hashes) || !hashes.length) return [];
    const list = hashes.slice(0, 5);
    const derefOnce = (h) => new Promise(resolve => {
        let tried = 0;
        const attempt = () => {
            try {
                gun.get('#').get(h).once((d) => {
                    if (d) return resolve(d);
                    tried += 1;
                    if (tried <= 1) setTimeout(attempt, 300);
                    else resolve(null);
                });
            } catch (e) {
                resolve(null);
            }
        };
        attempt();
    });

    const resolved = await Promise.all(list.map(h => derefOnce(h)));
    const parsed = resolved.map(r => {
        if (!r) return null;
        if (typeof r === 'string') {
            try { return JSON.parse(r); } catch (e) { return null; }
        }
        return r;
    }).filter(Boolean);
    return parsed;
}

function putKV(key, value) {
    gun.get('kv').get(key).put({ value, ts: Date.now() });
}

function getKV(key, cb) {
    gun.get('kv').get(key).on((data) => {
        cb(data && data.value);
    });
}

// set a sensible default relay for this user
const defaultPeers = ['https://g2.bmatusiak.us/gun'];
setPeers(defaultPeers);

export default {
    gun,
    sendMessage,
    subscribeMessages,
    fetchAttachments,
    putKV,
    getKV,
    setPeers,
    getPeers,
    createPair,
    loadPair,
    setChatKey,
};
