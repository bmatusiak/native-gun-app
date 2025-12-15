import React, { useEffect, useState, useRef } from 'react'
import { View, KeyboardAvoidingView, DeviceEventEmitter, PixelRatio, Platform, StyleSheet, Text, NativeModules, useWindowDimensions } from 'react-native'
import DebugPanelView from './DebugPanel.android'

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
                const isFloating = !!payload.isFloating
                const px = (typeof payload.keyboardDem === 'number') ? Number(payload.keyboardDem) : 0
                const dp = Math.round(px / (PixelRatio.get() || 1))

                if (enableDebug) {
                    try { console.debug('KeyboardAwareView: native keyboardChanged', { payload, px, dp, isVisible, isFloating }) } catch (e) { }
                }

                // per spec: if isVisible is false or isFloating is false, treat height as 0
                setLast({ map: payload, px, dp, ts: Date.now() })
                setKeyboardHeight((isVisible && isFloating) ? dp : 0)
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
