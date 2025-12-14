package com.appcustominput

import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.NativeModule
import com.facebook.react.uimanager.ViewManager
import android.app.Activity
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.OnReceiveContentListener
import android.content.ClipData
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.InputStream
import android.util.Log
import com.facebook.react.modules.core.DeviceEventManagerModule

class AppCustomInputModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private var lastContent: Map<String, Any?>? = null
  private var listening = false

  override fun getName(): String = "AppCustomInput"

  @ReactMethod
  fun startListening() {
    if (listening) return
    val activity: Activity? = reactApplicationContext.currentActivity
    if (activity == null) {
      Log.w("AppCustomInput", "no current activity to attach listener")
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
              Log.w("AppCustomInput", "failed to read content: ${e.message}")
            }

            val map = HashMap<String, Any?>()
            map["uri"] = uri?.toString()
            map["mime"] = mime
            map["gifBase64"] = b64
            lastContent = map
            try {
              reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("keyboardInputContent", map)
            } catch (e: Exception) {
              Log.w("AppCustomInput", "failed to emit event: ${e.message}")
            }
          }
        } catch (e: Exception) {
          Log.w("AppCustomInput", "receive content error: ${e.message}")
        }
        null
      })
      listening = true
    } catch (e: Exception) {
      Log.w("AppCustomInput", "setOnReceiveContentListener failed: ${e.message}")
    }
  }

  @ReactMethod
  fun getLastContent(promise: Promise) {
    promise.resolve(lastContent)
  }
}
