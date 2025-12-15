import React, { useEffect, useState } from 'react';
import { Platform, requireNativeComponent, NativeModules, DeviceEventEmitter, PixelRatio } from 'react-native';

const NativeInput = requireNativeComponent('RNCustomGifTextInput');

export default function CustomTextInput(props) {
    if (Platform.OS !== 'android') return null;
    const { value, onChangeText, style, onKeyboardHeightChanged, applyNativeMargin = true, ...rest } = props;
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        try {
            const mod = NativeModules.AppCustomInput
            if (mod && typeof mod.startListening === 'function') mod.startListening()
        } catch (e) { }

        let lastEmitted = 0
        const sub = DeviceEventEmitter.addListener('keyboardHeightChanged', (map) => {
            try {
                // Prefer IME inset height when available
                const px = (map && (typeof map.imeHeightPx === 'number') && map.imeHeightPx) ||
                    (map && (typeof map.keyboardVisibleHeight === 'number') && map.keyboardVisibleHeight) || 0;

                const isFloating = !!(map && map.isFloating)
                const imeVisible = !!(map && map.imeVisible)

                // Ignore floating IME (overlay keyboards) and invisible IME
                if (isFloating || (map && map.imeHeightPx === 0 && !imeVisible)) {
                    if (keyboardHeight !== 0) setKeyboardHeight(0)
                    if (typeof onKeyboardHeightChanged === 'function') onKeyboardHeightChanged(0, map)
                    return
                }

                // Convert from raw pixels to layout (dp) units used by RN styles
                const density = PixelRatio.get() || 1
                const dp = Math.round(px / density)

                // Debounce small/rapid duplicate updates (50ms)
                const now = Date.now()
                if (now - lastEmitted < 50 && Math.abs(dp - keyboardHeight) < 4) return
                lastEmitted = now

                setKeyboardHeight(dp)
                if (typeof onKeyboardHeightChanged === 'function') onKeyboardHeightChanged(dp, map)
            } catch (e) { }
        })

        return () => {
            try {
                sub && sub.remove && sub.remove()
            } catch (e) { }
            try {
                const mod = NativeModules.AppCustomInput
                if (mod && typeof mod.stopListening === 'function') mod.stopListening()
            } catch (e) { }
        }
    }, [])

    return (
        <NativeInput
            value={value}
            style={[style, applyNativeMargin ? { marginBottom: keyboardHeight || 0 } : null]}
            {...rest}
            onChange={(e) => {
                const txt = e && e.nativeEvent && e.nativeEvent.text;
                if (typeof onChangeText === 'function') onChangeText(txt);
            }}
        />
    );
}
