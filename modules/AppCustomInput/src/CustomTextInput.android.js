import React from 'react';
import { Platform, requireNativeComponent } from 'react-native';

const NativeInput = requireNativeComponent('RNCustomGifTextInput');

export default function CustomTextInput(props) {
    if (Platform.OS !== 'android') return null;
    const { value, onChangeText, style, ...rest } = props;

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
