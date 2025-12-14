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

function sendMessage({ id, text, author, gifBase64, mime, attachments }) {
    const msg = {
        id: id || Date.now().toString(),
        text,
        author: author || 'anon',
        ts: Date.now(),
    };
    // support legacy single-image fields or new attachments array
    if (attachments && Array.isArray(attachments) && attachments.length) {
        msg.attachments = attachments;
    } else if (gifBase64) {
        msg.gifBase64 = gifBase64;
        if (mime) msg.mime = mime;
    }
    gun.get('chat').get('messages').set(msg);
    return msg;
}

function subscribeMessages(cb) {
    // GUN will call cb for each message node; dedupe should be handled by caller
    gun.get('chat').get('messages').map().on((data, key) => {
        if (!data) return;
        cb({ ...(data || {}), _key: key });
    });
    // no unsubscribe handle returned (native-gun may provide API for off())
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
    putKV,
    getKV,
    setPeers,
    getPeers,
    createPair,
    loadPair,
};
