import React, { useEffect, useState } from 'react'
import { Platform, View, Text, DeviceEventEmitter, StyleSheet, PixelRatio } from 'react-native'

export default function DebugPanel({ visible = true, style, floating = true, position = 'bottom', children }) {
    if (Platform.OS !== 'android' || !visible) return null

    const [last, setLast] = useState(null)

    const containerStyle = floating
        ? (position === 'top' ? styles.floatingTop : styles.floatingBottom)
        : (position === 'top' ? styles.inlineTop : styles.inlineBottom)

    return (
        <View pointerEvents="none" style={[containerStyle, style]}>
            <View style={styles.card}>
                {children}
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
    ,
    text: {
        color: '#fff'
    }
})
