import React, { useEffect, useState, useRef } from 'react';
import { Platform, View, Text, ScrollView, TextInput, Button, StyleSheet, Keyboard, DeviceEventEmitter, Image, KeyboardAvoidingView } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import GunService from '../GunService';
import CustomTextInput, { KeyboardDebugPanel } from 'app-custom-input';
import * as FileSystem from 'expo-file-system';

export default function ChatScreen() {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const seen = useRef(new Set());
    const scrollRef = useRef(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [preview, setPreview] = useState(null);
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

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('keyboardInputContent', async (payload) => {
            if (!payload) return;
            // console.log('keyboardInputContent payload', payload);
            if (payload.keyboardVisibleHeight != null) {
                const h = Number(payload.keyboardVisibleHeight) || 0;
                setKeyboardHeight(h);
            }
            const mime = payload.mime;
            if (payload.gifBase64) {
                setPreview({ gifBase64: payload.gifBase64, mime });
                return;
            }
            if (!payload.uri) return;
            const uri = payload.uri;
            try {
                const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                setPreview({ gifBase64: b64, mime });
            } catch (e) {
                setPreview({ gifUri: uri, mime });
            }
        });
        return () => sub.remove();
    }, []);

    // listen to native global-layout / insets emitted keyboard height changes (covers IME panels)
    useEffect(() => {
        const hsub = DeviceEventEmitter.addListener('keyboardHeightChanged', (payload) => {
            if (!payload) return;
            // Prefer WindowInsets-provided IME height when available
            if (payload.imeHeightPx != null) {
                const imeH = Number(payload.imeHeightPx) || 0;
                const isFloating = !!payload.isFloating;
                // if IME is floating, don't push the input
                setKeyboardHeight(isFloating ? 0 : imeH);
                return;
            }
            // fallback to previous keyboardVisibleHeight field
            if (payload.keyboardVisibleHeight != null) {
                const h = Number(payload.keyboardVisibleHeight) || 0;
                setKeyboardHeight(h);
            }
        });
        return () => hsub.remove();
    }, []);

    // also listen to RN keyboard events for regular keyboard open/close
    useEffect(() => {
        const show = (e) => setKeyboardHeight(e.endCoordinates ? e.endCoordinates.height : 0);
        const hide = () => setKeyboardHeight(0);
        const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', show);
        const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide);
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollToEnd({ animated: true });
    }, [messages]);

    const send = () => {
        const body = (text || '').trim();
        if (!body) return;
        const msg = GunService.sendMessage({ text: body, author: 'mobile' });
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
    };

    const sendPreview = () => {
        const bodyText = (text || '').trim();
        const attachments = preview.gifBase64
            ? [{ gifBase64: preview.gifBase64, mime: preview.mime }]
            : preview.gifUri
                ? [{ gifUri: preview.gifUri, mime: preview.mime }]
                : [];
        GunService.sendMessage({ text: bodyText, author: 'mobile', attachments });
        setPreview(null);
        setText('');
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardDebugPanel visible={true} floating={true} position="top" style={styles.debugBar} />

            <KeyboardAvoidingView
                style={styles.content}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {messages.map((m) => {
                        const key = m.id || m._key || String(m.ts || Math.random());
                        const attachments = (m.attachments && m.attachments.length)
                            ? m.attachments
                            : (m.gifBase64 || m.gifUri)
                                ? [{ gifBase64: m.gifBase64, gifUri: m.gifUri, mime: m.mime }]
                                : [];
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
                    <View style={styles.inputRow}>
                        {Platform.OS === 'android' ? (
                            <CustomTextInput
                                style={styles.input}
                                value={text}
                                onChangeText={setText}
                                placeholder="Message"
                                returnKeyType="send"
                                onSubmitEditing={send}
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

                        {preview ? (
                            <View style={styles.previewContainer}>
                                {preview.gifBase64 ? (
                                    <Image source={{ uri: `data:${preview.mime || 'image/gif'};base64,${preview.gifBase64}` }} style={styles.preview} />
                                ) : preview.gifUri ? (
                                    <Image source={{ uri: preview.gifUri }} style={styles.preview} />
                                ) : null}
                                <View style={styles.previewButtons}>
                                    <Button title="Send" onPress={sendPreview} />
                                    <Button title="Cancel" onPress={() => setPreview(null)} />
                                </View>
                            </View>
                        ) : (
                            <Button title="Send" onPress={send} />
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, position: 'relative' },
    content: { flex: 1 },
    scrollContent: { padding: 12, paddingBottom: 24 },
    msg: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
    gif: { width: 200, height: 200, resizeMode: 'cover', marginTop: 8 },
    meta: { fontSize: 12, color: '#666', marginBottom: 4 },
    inputRowWrapper: { borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff', zIndex: 50, elevation: 10, width: '100%' },
    inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingHorizontal: 12 },
    input: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, marginRight: 8, borderRadius: 4, height: 40 },
    previewContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    preview: { width: 80, height: 80, resizeMode: 'cover', borderRadius: 6, marginRight: 8 },
    previewButtons: { flexDirection: 'column', justifyContent: 'space-between', height: 80 },
    attachmentsHorizontal: { marginTop: 8 },
    attachmentImage: { width: 140, height: 140, resizeMode: 'cover', marginRight: 8, borderRadius: 6 },
    caption: { marginTop: 6, color: '#222' },
    debugBar: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    debugText: { color: '#fff', fontSize: 11 },
});

