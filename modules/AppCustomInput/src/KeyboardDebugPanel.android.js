import React, { useEffect, useState } from 'react'
import { Platform, View, Text, DeviceEventEmitter, StyleSheet, PixelRatio } from 'react-native'

export default function KeyboardDebugPanel({ visible = true, style }) {
    if (Platform.OS !== 'android' || !visible) return null

    const [last, setLast] = useState(null)

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('keyboardHeightChanged', (map) => {
            try {
                const px = (map && (typeof map.imeHeightPx === 'number') && map.imeHeightPx) ||
                    (map && (typeof map.keyboardVisibleHeight === 'number') && map.keyboardVisibleHeight) || 0
                const dp = Math.round((PixelRatio.get() || 1) ? px / PixelRatio.get() : px)
                setLast({ map, px, dp, ts: Date.now() })
            } catch (e) {
                // ignore
            }
        })
        return () => { try { sub && sub.remove && sub.remove() } catch (e) { } }
    }, [])

    if (!last) return null

    return (
        <View pointerEvents="none" style={[styles.container, style]}>
            <View style={styles.card}>
                <Text style={styles.title}>Keyboard Debug</Text>
                <Text>px: {String(last.px)}</Text>
                <Text>dp: {String(last.dp)}</Text>
                <Text>imeVisible: {String(last.map && last.map.imeVisible)}</Text>
                <Text>isFloating: {String(last.map && last.map.isFloating)}</Text>
                <Text>visibleFrameHeightPx: {String(last.map && last.map.visibleFrameHeightPx)}</Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        zIndex: 9999,
    },
    card: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 8,
        borderRadius: 6,
    },
    title: {
        color: '#fff',
        fontWeight: '600',
        marginBottom: 4,
    }
})
