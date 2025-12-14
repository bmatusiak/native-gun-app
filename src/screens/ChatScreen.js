import React, { useEffect, useState, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    View,
    Text,
    ScrollView,
    TextInput,
    Button,
    StyleSheet,
    Keyboard,
    DeviceEventEmitter,
    Image,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import GunService from '../GunService';
import CustomTextInput from 'app-custom-input';
import * as FileSystem from 'expo-file-system';

export default function ChatScreen() {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const seen = useRef(new Set());
    const scrollRef = useRef(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

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

    // listen for keyboard committed content from native (GIFs/images)
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('keyboardInputContent', async (payload) => {
            if (!payload) return;
            const mime = payload.mime;
            if (payload.gifBase64) {
                // native already provided base64 data — send via Gun
                GunService.sendMessage({ text: '', author: 'mobile', gifBase64: payload.gifBase64, mime });
                return;
            }
            if (!payload.uri) return;
            const uri = payload.uri;
            try {
                // try to read the committed content as base64 and send via Gun
                const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                // send via Gun (this will propagate to peers and trigger subscribeMessages)
                GunService.sendMessage({ text: '', author: 'mobile', gifBase64: b64, mime });
            } catch (e) {
                // if reading fails, fall back to optimistic local display using the content URI
                const gifMsg = { id: Date.now().toString(), text: '', author: 'keyboard', ts: Date.now(), gifUri: uri, mime };
                setMessages((prev) => {
                    const next = [...prev, gifMsg];
                    next.sort((a, b) => (a.ts || 0) - (b.ts || 0));
                    return next;
                });
            }
        });
        return () => sub.remove();
    }, []);

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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    {messages.map((m) => (
                        <View key={m.id || m._key || String(m.ts || Math.random())} style={styles.msg}>
                            <Text style={styles.meta}>{m.author} • {m.ts ? new Date(m.ts).toLocaleTimeString() : ''}</Text>
                            {m.gifBase64 ? (
                                <Image source={{ uri: `data:${m.mime || 'image/gif'};base64,${m.gifBase64}` }} style={styles.gif} />
                            ) : m.gifUri ? (
                                <Image source={{ uri: m.gifUri }} style={styles.gif} />
                            ) : (
                                <Text>{m.text}</Text>
                            )}
                        </View>
                    ))}
                </ScrollView>
            </View>

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
                    <Button title="Send" onPress={send} />
                </View>
                <View style={{ height: keyboardHeight }} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1 },
    scrollContent: { padding: 12, paddingBottom: 24 },
    msg: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
    gif: { width: 200, height: 200, resizeMode: 'cover', marginTop: 8 },
    meta: { fontSize: 12, color: '#666', marginBottom: 4 },
    inputRowWrapper: { borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
    inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingHorizontal: 12 },
    input: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, marginRight: 8, borderRadius: 4, height: 40 },
});

