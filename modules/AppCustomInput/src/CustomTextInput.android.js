import React, { useEffect } from 'react';
import { Platform, requireNativeComponent, NativeModules } from 'react-native';

const NativeInput = requireNativeComponent('RNCustomGifTextInput');

export default function CustomTextInput(props) {
    if (Platform.OS !== 'android') return null;
    const { value, onChangeText, style, ...rest } = props;

    useEffect(() => {
        try {
            const mod = NativeModules.AppCustomInput
            if (mod && typeof mod.startListening === 'function') mod.startListening()
        } catch (e) { }
    }, [])

    return (
        <NativeInput
            value={value}
            style={style}
            {...rest}
            onChange={(e) => {
                const txt = e && e.nativeEvent && e.nativeEvent.text;
                if (typeof onChangeText === 'function') onChangeText(txt);
            }}
        />
    );
}
