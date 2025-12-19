import React, { useEffect, useState, useRef } from 'react'
import { View, KeyboardAvoidingView, DeviceEventEmitter, PixelRatio, Platform, StyleSheet, Text, NativeModules, useWindowDimensions } from 'react-native'
import DebugPanelView from './DebugPanel.android'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

export default function KeyboardAwareView({ children, style }) {
    let enableDebug = false
    if (__DEV__) {
        enableDebug = true
    }
    const [keyboardHeight, setKeyboardHeight] = useState(0)
    const [last, setLast] = useState(null)

    useEffect(() => {
        // ensure native module starts emitting events
        try {
            const mod = NativeModules.AppCustomInput
            if (mod && typeof mod.startListening === 'function') mod.startListening()
        } catch (e) { }

        // listen for single unified native event 'keyboardChanged'
        const sub = DeviceEventEmitter.addListener('keyboardChanged', (payload) => {
            try {
                if (!payload) return
                const isVisible = !!payload.isVisible
                const isFloating = !!payload.isFloating// this is sepcial,, its a floating view, should have X/Y coords and W/H
                const px = (typeof payload.keyboardDem === 'number') ? Number(payload.keyboardDem) : 0
                const dp = Math.round(px / (PixelRatio.get() || 1))

                if (enableDebug) {
                    try { console.debug('KeyboardAwareView: native keyboardChanged', { payload, px, dp, isVisible, isFloating, event: payload && payload.event ? payload.event : null }) } catch (e) { }
                }

                // determine whether layout should be pushed.
                // floating keyboards should NOT push layout (they overlay), only non-floating visible keyboards do.
                const shouldPush = isVisible && !isFloating
                setLast({ map: payload, px, dp, isFloating, isVisible, ts: Date.now() })

                // cap keyboard height to a sensible fraction of screen height so large values don't collapse the layout
                const winDp = (dims && dims.height) ? Math.round(dims.height) : null
                let safeDp = dp
                if (winDp != null) {
                    const maxAllowed = Math.round(winDp * 0.9)
                    if (safeDp > maxAllowed) safeDp = maxAllowed
                }
                setKeyboardHeight(shouldPush ? safeDp : 0)
            } catch (e) {
                // ignore
            }
        })

        return () => {
            try { sub && sub.remove && sub.remove() } catch (e) { }
            try {
                const mod = NativeModules.AppCustomInput
                if (mod && typeof mod.stopListening === 'function') mod.stopListening()
            } catch (e) { }
        }
    }, [])

    const px = last ? last.px : null
    const dp = last ? last.dp : null
    const map = last ? last.map : null
    const dims = useWindowDimensions()
    const screenPxW = Math.round((dims && dims.width ? dims.width : 0) * (PixelRatio.get() || 1))
    const screenPxH = Math.round((dims && dims.height ? dims.height : 0) * (PixelRatio.get() || 1))
    const insets = useSafeAreaInsets()
    const bottomPad = Math.max(keyboardHeight || 0, (insets && insets.bottom) ? insets.bottom : 0)

    function DebugPanel() {
        if (enableDebug === false) return null
        return (
            <DebugPanelView visible={true} floating={true} position="top" style={styles.debugBar}>
                <Text style={styles.debugTitle}>Keyboard Debug</Text>
                <Text style={styles.debugText}>px: {px != null ? String(px) : '—'}</Text>
                <Text style={styles.debugText}>dp: {dp != null ? String(dp) : '—'}</Text>
                <Text style={styles.debugText}>isVisible: {map && map.isVisible != null ? String(map.isVisible) : '—'}</Text>
                <Text style={styles.debugText}>isFloating: {map && map.isFloating != null ? String(map.isFloating) : '—'}</Text>
                <Text style={styles.debugText}>Screen W: {screenPxW} px</Text>
                <Text style={styles.debugText}>Screen H: {screenPxH} px</Text>
                <Text style={styles.debugText}>keyboardDem px: {map && map.keyboardDem != null ? String(map.keyboardDem) : '—'}</Text>
                <Text style={styles.debugText}>keyboardHeight: {keyboardHeight}</Text>
            </DebugPanelView>
        )
    }

    return (
        <>
            <DebugPanel />
            {/* <KeyboardAvoidingView style={[styles.container, style]} behavior={'height'}> */}
            <SafeAreaView edges={["left", "right", "top"]} style={[styles.content, { paddingBottom: bottomPad }, style]}>
                {children}
            </SafeAreaView>
            {/* </KeyboardAvoidingView> */}
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
