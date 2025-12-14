import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native';
import GunService from '../GunService';

export default function PeersScreen() {
    const [peerInput, setPeerInput] = useState('https://gun-manhattan.herokuapp.com/gun');
    const [peers, setPeers] = useState(GunService.getPeers());
    const [pair, setPair] = useState(null);

    useEffect(() => {
        (async () => {
            const loaded = await GunService.loadPair();
            setPair(loaded);
        })();
    }, []);

    function addPeer() {
        if (!peerInput) return;
        const next = Array.from(new Set([...peers, peerInput]));
        GunService.setPeers(next);
        setPeers(next);
        setPeerInput('');
    }

    async function createIdentity() {
        try {
            const p = await GunService.createPair();
            setPair(p);
        } catch (e) {
            console.warn('createPair failed', e);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Peers</Text>
            <FlatList
                data={peers}
                keyExtractor={(i) => i}
                renderItem={({ item }) => <Text style={styles.peer}>{item}</Text>}
                ListEmptyComponent={<Text style={styles.empty}>No peers configured</Text>}
            />

            <TextInput style={styles.input} placeholder="peer url" value={peerInput} onChangeText={setPeerInput} />
            <Button title="Add Peer" onPress={addPeer} />

            <View style={{ height: 20 }} />
            <Text style={styles.heading}>SEA Identity</Text>
            {pair ? (
                <View>
                    <Text>pub: {pair.pub}</Text>
                </View>
            ) : (
                <Button title="Create Identity (SEA.pair)" onPress={createIdentity} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 12 },
    heading: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    peer: { padding: 8, borderBottomWidth: 1, borderColor: '#eee' },
    empty: { color: '#666', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 8, marginTop: 8, marginBottom: 8 },
});
