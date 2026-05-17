# Custom Expo Dev Client Guide

## What is a Custom Dev Client?
A **custom Expo dev client** is a version of the Expo Go app that is built specifically for your project, including any custom native modules (like `react-native-voice`). Unlike the standard Expo Go app, which only supports the APIs included by default, a custom dev client lets you use any React Native or Expo module, even those that require native code.

## Why Do We Need It?
- **Expo Go** does **not** support custom native modules (like speech-to-text with `react-native-voice`).
- To use features like **voice input (speech-to-text)**, you must add native code to your app.
- A custom dev client allows you to develop and test your app with these features, just like you would with Expo Go, but with full native support.

## What Will It Be Used For?
- **Speech-to-Text (STT):** Using `react-native-voice` to transcribe user speech.
- **Text-to-Speech (TTS):** Using `expo-speech` to have the bot speak replies.
- **Testing and development:** You can still use fast refresh, debugging, and all the usual Expo developer tools.

---

## Prerequisites
- **Expo account:** [Sign up here](https://expo.dev/)
- **EAS CLI installed:** `npm install -g eas-cli`
- **Apple Developer account** (for iOS builds)
- **Android device or emulator** (for Android builds)
- **Your app code** with `react-native-voice` and `expo-speech` installed

---

## Step-by-Step: Building and Using a Custom Dev Client

### 1. Install EAS CLI
```
npm install -g eas-cli
```

### 2. Configure EAS for Your Project
```
eas build:configure
```
This sets up your project for EAS builds and creates an `eas.json` file.

### 3. Install Native Dependencies
```
npm install react-native-voice
```
You already have `expo-speech` for TTS.

### 4. Update Your Code (if needed)
- Make sure you use `expo-speech` for TTS and `react-native-voice` for STT.
- Test and tweak your code as needed after building.

### 5. Build the Custom Dev Client
#### For Android:
```
eas build --profile development --platform android
```
#### For iOS:
```
eas build --profile development --platform ios
```
- You'll get a download link for the APK (Android) or an `.ipa`/TestFlight link (iOS).

### 6. Install the Custom Dev Client
- Download and install the APK on your Android device, or use TestFlight for iOS.

### 7. Start the Metro Bundler
```
npx expo start --dev-client
```
- This will show a QR code in your terminal or browser.

### 8. Launch Your App
- Open the custom dev client on your device.
- Scan the QR code from the Metro bundler.
- Your app will load, with full support for voice features!

---

## Tips & Notes
- You only need to rebuild the custom dev client if you add or change native dependencies.
- For JavaScript-only changes, just reload the app as usual.
- Both your computer and device must be on the same Wi-Fi network.

---

## References
- [Expo: Using custom native code](https://docs.expo.dev/development/introduction/)
- [react-native-voice setup](https://github.com/react-native-voice/voice#installation)
- [EAS Build docs](https://docs.expo.dev/build/introduction/) 