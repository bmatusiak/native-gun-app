

import CustomTextInput from './src/CustomTextInput.android'

// Export the native-backed component only. The component handles starting
// the native listener internally on mount, and the app should continue to
// use DeviceEventEmitter or other mechanisms to receive `keyboardInputContent`.
export default CustomTextInput