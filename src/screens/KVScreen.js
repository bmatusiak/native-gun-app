import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import GunService from '../GunService';

export default function KVScreen() {
    const [key, setKey] = useState('');
    const [value, setValue] = useState('');
    const [fetched, setFetched] = useState('');

    function put() {
        if (!key) return;
        GunService.putKV(key, value);
        setValue('');
    }

    function get() {
        if (!key) return;
        GunService.getKV(key, (v) => {
            setFetched(String(v));
        });
    }

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Key</Text>
            <TextInput style={styles.input} value={key} onChangeText={setKey} placeholder="key" />

            <Text style={styles.label}>Value</Text>
            <TextInput style={styles.input} value={value} onChangeText={setValue} placeholder="value" />

            <View style={styles.row}>
                <Button title="Put" onPress={put} />
                <Button title="Get" onPress={get} />
            </View>

            <Text style={styles.result}>Fetched: {fetched}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 12 },
    label: { marginTop: 8 },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 4, marginTop: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    result: { marginTop: 16, color: '#333' },
});
