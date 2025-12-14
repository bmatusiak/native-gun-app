import { requireNativeComponent, Platform } from 'react-native';
import React from 'react';

const NativeInput = requireNativeComponent('RNCustomGifTextInput');

export default function CustomTextInput(props) {
    if (Platform.OS !== 'android') return null;
    // map `value` prop to native `value`, and forward style and event handlers
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
