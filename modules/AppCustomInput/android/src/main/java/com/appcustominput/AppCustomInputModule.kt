package com.appcustominput

import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.app.Activity
import android.view.View
import android.content.ClipData
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.ViewCompat
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.InputStream
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

class AppCustomInputModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private var lastContent: WritableMap? = null
  private var listening = false
  private var observedRoot: View? = null

  override fun getName(): String = "AppCustomInput"

  @ReactMethod
  fun startListening() {
    if (listening) return
    AppCustomInputDebug.init(reactApplicationContext)
    val activity: Activity? = reactApplicationContext.currentActivity
    if (activity == null) {
      AppCustomInputDebug.w("AppCustomInput", "no current activity to attach listener")
      return
    }
    val root: View = activity.window.decorView

    try {
      ViewCompat.setOnReceiveContentListener(root, arrayOf("image/*", "image/gif", "image/webp"), OnReceiveContentListener { view, payload ->
        try {
          val clip: ClipData? = payload.clip
          if (clip != null && clip.itemCount > 0) {
            val item = clip.getItemAt(0)
            val uri = item.uri
            var b64: String? = null
            var mime: String? = null
            try {
              mime = uri?.let { view.context.contentResolver.getType(it) }
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
              AppCustomInputDebug.w("AppCustomInput", "failed to read content: ${e.message}")
            }

            val map: WritableMap = Arguments.createMap()
            map.putString("uri", uri?.toString())
            if (mime != null) map.putString("mime", mime)
            if (b64 != null) map.putString("gifBase64", b64)
            lastContent = map
            try {
              reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("keyboardInputContent", map)
            } catch (e: Exception) {
              AppCustomInputDebug.w("AppCustomInput", "failed to emit event: ${e.message}")
            }
          }
        } catch (e: Exception) {
          AppCustomInputDebug.w("AppCustomInput", "receive content error: ${e.message}")
        }
        null
      })
      observedRoot = root
      listening = true
    } catch (e: Exception) {
      AppCustomInputDebug.w("AppCustomInput", "setOnReceiveContentListener failed: ${e.message}")
    }
  }

  @ReactMethod
  fun stopListening() {
    try {
      observedRoot?.let { r ->
        try { ViewCompat.setOnReceiveContentListener(r, null, null) } catch (e: Exception) {}
      }
    } catch (e: Exception) {
      AppCustomInputDebug.w("AppCustomInput", "remove receive content listener failed: ${e.message}")
    }
    observedRoot = null
    listening = false
  }

  @ReactMethod
  fun getLastContent(promise: Promise) {
    promise.resolve(lastContent)
  }
}
