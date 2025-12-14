package com.bmatusiak.myapp

import com.facebook.react.views.textinput.ReactTextInputManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class CustomTextInputManager : ReactTextInputManager() {

  override fun getName(): String = "RNCustomGifTextInput"

  override fun createViewInstance(reactContext: ThemedReactContext): CustomReactEditText {
    return CustomReactEditText(reactContext)
  }

  @ReactProp(name = "value")
  fun setValue(view: CustomReactEditText, value: String?) {
    if (value == null) return
    if (view.text.toString() != value) {
      view.setText(value)
      view.setSelection(value.length)
    }
  }
}
