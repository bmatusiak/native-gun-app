# Native GUN Example (Expo)

This small Expo example demonstrates using `native-gun` in a React Native app with:

- Realtime chat (`/chat/messages`)
- Simple key-value store (`/kv/{key}`)
- Peers management + SEA keypair creation

Quick start

1. Install dependencies (run in `my-app`):

```bash
npm install native-gun @react-native-async-storage/async-storage
npx expo start
```

2. Open the app in Expo Go or a simulator.

Notes

- `native-gun` includes React Native shims; no additional random-value polyfill is required.
- Persistent storage uses `@react-native-async-storage/async-storage` when available.
- To configure a default relay, open `src/GunService.js` and call `setPeers([...])` or use the `Peers` tab.

Files of interest

- `App.js` — tab navigation
- `src/GunService.js` — Gun init, peers and basic SEA helpers
- `src/screens/ChatScreen.js` — chat UI
- `src/screens/KVScreen.js` — key/value UI
- `src/screens/PeersScreen.js` — add peers and create SEA identity

If you want, I can wire automatic relay defaults, add signed messages with SEA, or persist user profiles next.
