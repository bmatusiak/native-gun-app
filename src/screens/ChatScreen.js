import React, { useEffect, useState, useRef } from 'react';
import { Platform, View, Text, ScrollView, TextInput, Button, StyleSheet, Image, DeviceEventEmitter, TouchableOpacity } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import GunService from '../GunService';
import CustomTextInput, { KeyboardAwareView } from 'app-custom-input';
import * as FileSystem from 'expo-file-system';

export default function ChatScreen() {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const seen = useRef(new Set());
    const scrollRef = useRef(null);

    const [preview, setPreview] = useState([]);
    const hiddenInputRef = useRef(null);

    useEffect(() => {
        const onMsg = (msg) => {
            if (!msg) return;
            const id = msg.id || msg._key || String(msg.ts || '');
            if (!id || seen.current.has(id)) return;
            seen.current.add(id);
            setMessages((prev) => {
                const next = [...prev, msg];
                next.sort((a, b) => (a.ts || 0) - (b.ts || 0));
                return next;
            });
        };

        GunService.subscribeMessages(onMsg);
    }, []);

    // Resolve attachment-hash messages that arrived as raw hash lists
    const resolving = useRef(new Set());
    useEffect(() => {
        let mounted = true;
        (async () => {
            for (let m of messages) {
                const key = m._key || m.id || String(m.ts || '');
                if (resolving.current.has(key)) continue;
                // attachments may be a JSON string of hashes
                let hashes = null;
                if (typeof m.attachments === 'string') {
                    try { hashes = JSON.parse(m.attachments); } catch (e) { hashes = null; }
                } else if (Array.isArray(m.attachments) && m.attachments.length && typeof m.attachments[0] === 'string') {
                    hashes = m.attachments;
                }
                if (Array.isArray(hashes) && hashes.length) {
                    resolving.current.add(key);
                    try {
                        const resolved = await GunService.fetchAttachments(hashes);
                        if (!mounted) return;
                        if (resolved && resolved.length) {
                            setMessages(prev => prev.map(pm => {
                                const pmKey = pm._key || pm.id || String(pm.ts || '');
                                if (pmKey !== key) return pm;
                                return { ...pm, attachments: resolved };
                            }));
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        })();
        return () => { mounted = false; };
    }, [messages]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('keyboardInputContent', async (payload) => {
            if (!payload) return;
            // limit attachments to max 5
            const MAX_ATTACH = 5
            if ((preview && preview.length >= MAX_ATTACH)) return
            const mime = payload.mime;
            if (payload.gifBase64) {
                setPreview(prev => [...prev, { gifBase64: payload.gifBase64, mime }]);
                return;
            }
            if (!payload.uri) return;
            const uri = payload.uri;
            try {
                const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                setPreview(prev => [...prev, { gifBase64: b64, mime }]);
            } catch (e) {
                setPreview(prev => [...prev, { gifUri: uri, mime }]);
            }
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollToEnd({ animated: true });
    }, [messages]);



    const send = () => {
        const body = (text || '').trim();
        if (!body) return;
        (async () => {
            const msg = await GunService.sendMessage({ text: body, author: 'mobile' });
            setText('');
            const id = msg.id || msg._key || String(msg.ts || '');
            if (id && !seen.current.has(id)) {
                seen.current.add(id);
                setMessages((prev) => {
                    const next = [...prev, msg];
                    next.sort((a, b) => (a.ts || 0) - (b.ts || 0));
                    return next;
                });
            }
        })();
    };

    const sendPreview = () => {
        const bodyText = (text || '').trim();
        const attachments = (preview || []).map(p => (
            p.gifBase64 ? { gifBase64: p.gifBase64, mime: p.mime } : p.gifUri ? { gifUri: p.gifUri, mime: p.mime } : null
        )).filter(Boolean);
        (async () => {
            const msg = await GunService.sendMessage({ text: bodyText, author: 'mobile', attachments });
            // clear preview and input after send
            setPreview([]);
            setText('');
            const id = msg.id || msg._key || String(msg.ts || '');
            if (id && !seen.current.has(id)) {
                seen.current.add(id);
                setMessages((prev) => {
                    const next = [...prev, msg];
                    next.sort((a, b) => (a.ts || 0) - (b.ts || 0));
                    return next;
                });
            }
        })();
    };

    const removePreviewAt = (index) => {
        setPreview(prev => prev.filter((_, i) => i !== index));
    }

    return (
        <View style={styles.container}>
            <KeyboardAwareView>
                <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {messages.map((m) => {
                        const key = m.id || m._key || String(m.ts || Math.random());
                        // normalize attachments from several storage shapes
                        function parseAttachments(msg) {
                            try {
                                if (!msg) return []
                                if (Array.isArray(msg.attachments)) return msg.attachments
                                if (msg.attachments && typeof msg.attachments === 'object') {
                                    // object map: values may be stored as nodes
                                    return Object.keys(msg.attachments).map(k => {
                                        const v = msg.attachments[k]
                                        // unwrap possible nested nodes
                                        if (v && typeof v === 'object') {
                                            if (v.gifBase64 || v.gifUri || v.mime) return v
                                            // some GUN nodes may wrap value under a '_' or '#', try common unwraps
                                            if (v._ && (v._.gifBase64 || v._.gifUri)) return v._
                                            if (v['#'] && typeof v['#'] === 'object') return v['#']
                                            return v
                                        }
                                        return null
                                    }).filter(Boolean)
                                }
                                if (msg.gifBase64 || msg.gifUri) return [{ gifBase64: msg.gifBase64, gifUri: msg.gifUri, mime: msg.mime }]
                            } catch (e) {
                                // parse error ignored
                            }
                            return []
                        }
                        const attachments = parseAttachments(m)
                        // debug info removed
                        return (
                            <View key={key} style={styles.msg}>
                                <Text style={styles.meta}>{m.author} • {m.ts ? new Date(m.ts).toLocaleTimeString() : ''}</Text>
                                {attachments.length === 0 ? (
                                    <Text>{m.text}</Text>
                                ) : attachments.length === 1 ? (
                                    <View>
                                        {attachments[0].gifBase64 ? (
                                            <Image source={{ uri: `data:${attachments[0].mime || 'image/gif'};base64,${attachments[0].gifBase64}` }} style={styles.gif} />
                                        ) : attachments[0].gifUri ? (
                                            <Image source={{ uri: attachments[0].gifUri }} style={styles.gif} />
                                        ) : null}
                                        {m.text && String(m.text).trim() ? (
                                            <Text style={styles.caption}>{m.text}</Text>
                                        ) : null}
                                    </View>
                                ) : (
                                    <View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsHorizontal}>
                                            {attachments.map((a, i) => (
                                                a.gifBase64 ? (
                                                    <Image key={i} source={{ uri: `data:${a.mime || 'image/gif'};base64,${a.gifBase64}` }} style={styles.attachmentImage} />
                                                ) : a.gifUri ? (
                                                    <Image key={i} source={{ uri: a.gifUri }} style={styles.attachmentImage} />
                                                ) : null
                                            ))}
                                        </ScrollView>
                                        {m.text && String(m.text).trim() ? (
                                            <Text style={styles.caption}>{m.text}</Text>
                                        ) : null}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>

                <View style={styles.inputRowWrapper}>
                    {preview && preview.length > 0 ? (
                        <View style={styles.previewBarContainer}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewBar}>
                                {preview.map((p, i) => (
                                    <View key={i} style={styles.previewItem}>
                                        {p.gifBase64 ? (
                                            <Image source={{ uri: `data:${p.mime || 'image/gif'};base64,${p.gifBase64}` }} style={styles.previewImage} />
                                        ) : p.gifUri ? (
                                            <Image source={{ uri: p.gifUri }} style={styles.previewImage} />
                                        ) : null}
                                        <TouchableOpacity style={styles.removeButton} onPress={() => removePreviewAt(i)}>
                                            <Text style={styles.removeButtonText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    ) : null}

                    <View style={styles.inputRow}>
                        {Platform.OS === 'android' ? (
                            <CustomTextInput
                                style={styles.input}
                                value={text}
                                onChangeText={setText}
                                placeholder="Message"
                                returnKeyType="send"
                                onSubmitEditing={send}
                                applyNativeMargin={false}
                            />
                        ) : (
                            <TextInput
                                style={styles.input}
                                value={text}
                                onChangeText={setText}
                                placeholder="Message"
                                returnKeyType="send"
                                onSubmitEditing={send}
                            />
                        )}

                        {/* Hidden JS TextInput kept for future use, not focused by default */}
                        <TextInput ref={hiddenInputRef} style={{ height: 0, width: 0, opacity: 0 }} />

                        <Button title="Send" onPress={preview && preview.length > 0 ? sendPreview : send} />
                    </View>
                </View>
            </KeyboardAwareView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, position: 'relative' },
    // content: { flex: 1 },
    scrollContent: { padding: 12, paddingBottom: 24, flexGrow: 1, justifyContent: 'flex-end' },
    msg: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
    gif: { width: 200, height: 200, resizeMode: 'cover', marginTop: 8 },
    meta: { fontSize: 12, color: '#666', marginBottom: 4 },
    inputRowWrapper: { borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff', zIndex: 50, elevation: 10, width: '100%' },
    inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingHorizontal: 12 },
    input: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, marginRight: 8, borderRadius: 4, height: 40 },
    previewBarContainer: { borderTopWidth: 1, borderColor: '#eee', paddingVertical: 8, backgroundColor: '#fff' },
    previewBar: { paddingHorizontal: 12, alignItems: 'center' },
    previewItem: { marginRight: 8, position: 'relative' },
    previewImage: { width: 80, height: 80, resizeMode: 'cover', borderRadius: 6 },
    removeButton: { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
    removeButtonText: { color: '#fff', fontSize: 12, lineHeight: 14 },
    previewButtons: { flexDirection: 'column', justifyContent: 'space-between', height: 80 },
    attachmentsHorizontal: { marginTop: 8 },
    attachmentImage: { width: 140, height: 140, resizeMode: 'cover', marginRight: 8, borderRadius: 6 },
    caption: { marginTop: 6, color: '#222' }
});

