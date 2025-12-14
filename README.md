
# Running the app

This project provides convenient npm scripts that wrap Expo commands.

- Start the development build and Metro bundler (recommended):

```bash
npm start
```

- Build and install the Android development build (no bundler):

```bash
npm run android
```

- Start Expo dev client bundler only (used by `npm start`):

```bash
npm run bundler
```

- Stream Android logs (filters React Native and app logs):

```bash
npm run android:logcat
```

Notes:
- `npm run android` uses Expo's `run:android` to build and install the dev build; avoid calling Gradle directly.
- Use `npm start` to run both the native build (via `npm run android`) and the Metro bundler together.
