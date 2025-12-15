import React, { useEffect, useState, useRef } from 'react'
import { View, KeyboardAvoidingView, Keyboard, DeviceEventEmitter, PixelRatio, Platform, StyleSheet, Text, NativeModules } from 'react-native'
import DebugPanelView from './DebugPanel.android'

export default function KeyboardAwareView({ children, style }) {
    let enableDebug = false
    if (__DEV__) {
        enableDebug = true
    }
    const [keyboardHeight, setKeyboardHeight] = useState(0)
    const [last, setLast] = useState(null)
    const lastImeFalseTs = useRef(0)

    useEffect(() => {
        // ensure native module starts emitting events
        try {
            const mod = NativeModules.AppCustomInput
            if (mod && typeof mod.startListening === 'function') mod.startListening()
        } catch (e) { }

        // listen for native keyboard height events
        const sub = DeviceEventEmitter.addListener('keyboardHeightChanged', (payload) => {
            try {
                if (!payload) return
                // If the payload explicitly says the IME is not visible, treat height as 0.
                // Otherwise prefer the visible-frame-derived `keyboardVisibleHeight` (catches IME internal panels),
                // falling back to `imeHeightPx` when present.
                let px = 0
                if (payload && payload.imeVisible === false) {
                    // record timestamp of explicit IME hide
                    lastImeFalseTs.current = Date.now()
                    px = 0
                } else if (payload && typeof payload.keyboardVisibleHeight === 'number') {
                    // if we recently saw an explicit IME hide, ignore transient layout events
                    const now = Date.now()
                    if (lastImeFalseTs.current && now - lastImeFalseTs.current < 500) {
                        // ignore this transient event
                        return
                    }
                    px = Number(payload.keyboardVisibleHeight)
                } else if (payload && typeof payload.imeHeightPx === 'number') {
                    px = Number(payload.imeHeightPx)
                } else {
                    px = 0
                }

                const dp = Math.round(px / (PixelRatio.get() || 1))
                setLast({ map: payload, px, dp, ts: Date.now() })

                if (enableDebug) {
                    try {
                        console.debug('KeyboardAwareView: native keyboardHeightChanged', { px, dp, imeHeightPx: payload.imeHeightPx, keyboardVisibleHeight: payload.keyboardVisibleHeight, isFloating: !!payload.isFloating, imeVisible: payload.imeVisible })
                    } catch (e) { }
                }

                // If IME is floating, ignore and treat as 0; otherwise use computed dp.
                const isFloating = !!(payload && payload.isFloating)
                setKeyboardHeight(isFloating ? 0 : dp)
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
            if (enableDebug) {
                try { console.debug('KeyboardAwareView: RN keyboard show', { heightPx: h, dp }) } catch (e) { }
            }
        }
        const hide = () => {
            setKeyboardHeight(0)
            setLast(null)
            // record IME hide time so subsequent global-layout events don't falsely reopen
            lastImeFalseTs.current = Date.now()
            if (enableDebug) {
                try { console.debug('KeyboardAwareView: RN keyboard hide') } catch (e) { }
            }
        }
        const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', show)
        const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide)

        return () => {
            try { sub && sub.remove && sub.remove() } catch (e) { }
            try { showSub.remove(); hideSub.remove() } catch (e) { }
            try {
                const mod = NativeModules.AppCustomInput
                if (mod && typeof mod.stopListening === 'function') mod.stopListening()
            } catch (e) { }
        }
    }, [])

    const px = last ? last.px : null
    const dp = last ? last.dp : null
    const map = last ? last.map : null

    function DebugPanel() {
        if (enableDebug === false) return null
        return (
            <DebugPanelView visible={true} floating={true} position="top" style={styles.debugBar}>
                <Text style={styles.debugTitle}>Keyboard Debug</Text>
                <Text style={styles.debugText}>px: {px != null ? String(px) : '—'}</Text>
                <Text style={styles.debugText}>dp: {dp != null ? String(dp) : '—'}</Text>
                <Text style={styles.debugText}>imeVisible: {map && map.imeVisible != null ? String(map.imeVisible) : '—'}</Text>
                <Text style={styles.debugText}>isFloating: {map && map.isFloating != null ? String(map.isFloating) : '—'}</Text>
                <Text style={styles.debugText}>visibleFrameHeightPx: {map && map.visibleFrameHeightPx != null ? String(map.visibleFrameHeightPx) : '—'}</Text>
            </DebugPanelView>
        )
    }

    return (
        <>
            <DebugPanel />
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
