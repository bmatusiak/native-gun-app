import React, { useEffect, useState } from 'react'
import { View, KeyboardAvoidingView, Keyboard, DeviceEventEmitter, PixelRatio, Platform, StyleSheet, Text } from 'react-native'
import DebugPanel from './DebugPanel.android'

export default function KeyboardAwareView({ children, style }) {
    const [keyboardHeight, setKeyboardHeight] = useState(0)
    const [last, setLast] = useState(null)

    useEffect(() => {
        // listen for native keyboard height events
        const sub = DeviceEventEmitter.addListener('keyboardHeightChanged', (payload) => {
            try {
                if (!payload) return
                const px = (payload && typeof payload.imeHeightPx === 'number')
                    ? Number(payload.imeHeightPx)
                    : (payload && typeof payload.keyboardVisibleHeight === 'number')
                        ? Number(payload.keyboardVisibleHeight)
                        : 0

                const dp = Math.round(px / (PixelRatio.get() || 1))
                setLast({ map: payload, px, dp, ts: Date.now() })

                if (payload.imeHeightPx != null) {
                    const isFloating = !!payload.isFloating
                    setKeyboardHeight(isFloating ? 0 : dp)
                } else {
                    setKeyboardHeight(dp)
                }
            } catch (e) {
                // ignore
            }
        })

        // fallback to RN Keyboard events
        const show = (e) => {
            const h = e && e.endCoordinates ? e.endCoordinates.height : 0
            const dp = Math.round(h / (PixelRatio.get() || 1))
            setKeyboardHeight(dp)
            setLast({ map: null, px: h, dp, ts: Date.now() })
        }
        const hide = () => {
            setKeyboardHeight(0)
            setLast(null)
        }
        const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', show)
        const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide)

        return () => {
            try { sub && sub.remove && sub.remove() } catch (e) { }
            try { showSub.remove(); hideSub.remove() } catch (e) { }
        }
    }, [])

    const px = last ? last.px : null
    const dp = last ? last.dp : null
    const map = last ? last.map : null

    return (
        <>
            <DebugPanel visible={true} floating={true} position="top" style={styles.debugBar}>
                <Text style={styles.debugTitle}>Keyboard Debug</Text>
                <Text style={styles.debugText}>px: {px != null ? String(px) : '—'}</Text>
                <Text style={styles.debugText}>dp: {dp != null ? String(dp) : '—'}</Text>
                <Text style={styles.debugText}>imeVisible: {map && map.imeVisible != null ? String(map.imeVisible) : '—'}</Text>
                <Text style={styles.debugText}>isFloating: {map && map.isFloating != null ? String(map.isFloating) : '—'}</Text>
                <Text style={styles.debugText}>visibleFrameHeightPx: {map && map.visibleFrameHeightPx != null ? String(map.visibleFrameHeightPx) : '—'}</Text>
            </DebugPanel>
            <KeyboardAvoidingView style={[styles.container, style]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={[styles.content, { paddingBottom: keyboardHeight }]}>
                    {children}
                </View>
            </KeyboardAvoidingView>
        </>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1 },
    debugBar: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    debugText: { color: '#fff', fontSize: 11 },
    debugTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
})
