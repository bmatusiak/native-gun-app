import React, { useEffect, useState } from 'react'
import { Platform, View, Text, DeviceEventEmitter, StyleSheet, PixelRatio } from 'react-native'

export default function KeyboardDebugPanel({ visible = true, style, floating = true, position = 'bottom' }) {
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

    const px = last ? last.px : null
    const dp = last ? last.dp : null
    const map = last ? last.map : null

    const containerStyle = floating
        ? (position === 'top' ? styles.floatingTop : styles.floatingBottom)
        : (position === 'top' ? styles.inlineTop : styles.inlineBottom)

    return (
        <View pointerEvents="none" style={[containerStyle, style]}>
            <View style={styles.card}>
                <Text style={styles.title}>Keyboard Debug</Text>
                <Text>px: {px != null ? String(px) : '—'}</Text>
                <Text>dp: {dp != null ? String(dp) : '—'}</Text>
                <Text>imeVisible: {map && map.imeVisible != null ? String(map.imeVisible) : '—'}</Text>
                <Text>isFloating: {map && map.isFloating != null ? String(map.isFloating) : '—'}</Text>
                <Text>visibleFrameHeightPx: {map && map.visibleFrameHeightPx != null ? String(map.visibleFrameHeightPx) : '—'}</Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    floatingBottom: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        zIndex: 9999,
    },
    floatingTop: {
        position: 'absolute',
        right: 8,
        top: 8,
        zIndex: 9999,
    },
    inlineBottom: {
        alignSelf: 'flex-end',
        marginRight: 8,
        marginBottom: 8,
    },
    inlineTop: {
        alignSelf: 'flex-end',
        marginRight: 8,
        marginTop: 8,
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
