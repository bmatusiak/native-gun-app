import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ChatScreen from './src/screens/ChatScreen';
import KVScreen from './src/screens/KVScreen';
import PeersScreen from './src/screens/PeersScreen';

export default function App() {
  const [tab, setTab] = useState('Chat');

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <View style={styles.tabBar}>
          <TouchableOpacity onPress={() => setTab('Chat')} style={[styles.tab, tab === 'Chat' && styles.tabActive]}>
            <Text style={styles.tabText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('KV')} style={[styles.tab, tab === 'KV' && styles.tabActive]}>
            <Text style={styles.tabText}>Key-Value</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('Peers')} style={[styles.tab, tab === 'Peers' && styles.tabActive]}>
            <Text style={styles.tabText}>Peers</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.screen}>
          {tab === 'Chat' ? <ChatScreen /> : tab === 'KV' ? <KVScreen /> : <PeersScreen />}
        </View>

        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    paddingTop: 40,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderColor: '#007aff',
  },
  tabText: {
    fontSize: 16,
  },
  screen: {
    flex: 1,
  },
});
