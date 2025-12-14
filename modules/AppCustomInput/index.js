

import CustomTextInput from './src/CustomTextInput.android'
import KeyboardDebugPanel from './src/KeyboardDebugPanel.android'

// Default export is the native-backed input. The debug panel is exported
// as a named export so the app can mount it conditionally (separate UI).
export { KeyboardDebugPanel }
export default CustomTextInput