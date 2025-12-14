package com.bmatusiak.myapp

import android.text.Editable
import android.text.TextWatcher
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import com.facebook.react.bridge.Arguments
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.facebook.react.views.textinput.ReactEditText
import androidx.core.view.inputmethod.EditorInfoCompat
import androidx.core.view.ViewCompat
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.ContentInfoCompat
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.InputStream

class CustomReactEditText(context: ThemedReactContext) : ReactEditText(context) {

  init {
    // remove default Android EditText background (underline) so RN styles control appearance
    try {
      this.background = null
    } catch (e: Exception) {
      // ignore on older platforms
    }
    this.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
      override fun afterTextChanged(s: Editable?) {
        try {
          val reactContext = context
          val evt = Arguments.createMap()
          evt.putString("text", s?.toString())
          reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, "topChange", evt)
        } catch (e: Exception) {
          // ignore
        }
      }
    })

    // listen for IME committed content (images/GIFs) directly on this view
    try {
      ViewCompat.setOnReceiveContentListener(this, arrayOf("image/*", "image/gif", "image/webp"), OnReceiveContentListener { view, payload ->
        try {
          val clip = payload.clip
          if (clip != null && clip.itemCount > 0) {
            val item = clip.getItemAt(0)
            val uri = item.uri
            val mime = uri?.let { view.context.contentResolver.getType(it) }
            var b64: String? = null
            try {
              val `is`: InputStream? = uri?.let { view.context.contentResolver.openInputStream(it) }
              if (`is` != null) {
                val bos = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                var read: Int
                while (`is`.read(buffer).also { read = it } != -1) {
                  bos.write(buffer, 0, read)
                }
                val bytes = bos.toByteArray()
                b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                `is`.close()
                bos.close()
              }
            } catch (e: Exception) {
              // reading to base64 failed; fall back to URI-only
              b64 = null
            }

            val reactContext = context
            val map = Arguments.createMap()
            uri?.toString()?.let { map.putString("uri", it) }
            mime?.let { map.putString("mime", it) }
            b64?.let { map.putString("gifBase64", it) }
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
              .emit("keyboardInputContent", map)
          }
        } catch (e: Exception) {
          // ignore
        }
        null
      })
    } catch (e: Exception) {
      // ignore if API missing
    }
  }

  override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
    val ic = super.onCreateInputConnection(outAttrs)
    try {
      EditorInfoCompat.setContentMimeTypes(outAttrs, arrayOf("image/*", "image/gif", "image/webp"))
    } catch (e: Exception) {
      // ignore
    }
    return ic
  }
}
