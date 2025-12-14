package com.appcustominput

import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.NativeModule
import com.facebook.react.uimanager.ViewManager
import android.app.Activity
import android.view.View
import androidx.core.view.WindowInsetsCompat
import android.graphics.Rect
import android.view.ViewTreeObserver
import android.content.ClipData
import androidx.core.view.OnReceiveContentListener
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.InputStream
import android.util.Log
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

class AppCustomInputModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private var lastContent: WritableMap? = null
  private var listening = false
  private var globalLayoutListener: ViewTreeObserver.OnGlobalLayoutListener? = null
  private var observedRoot: View? = null
  private var hasInsetsListener = false

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
    // attach WindowInsets listener to read IME insets when available
      try {
      if (!hasInsetsListener) {
        // use View.setOnApplyWindowInsetsListener to avoid ambiguous imports
        root.setOnApplyWindowInsetsListener { v, insets ->
          try {
            val compat = WindowInsetsCompat.toWindowInsetsCompat(insets)
            val imeVisible = compat.isVisible(WindowInsetsCompat.Type.ime())
            val imeInsets = compat.getInsets(WindowInsetsCompat.Type.ime())
            val imeHeight = imeInsets.bottom
            val rect = Rect()
            v.getWindowVisibleDisplayFrame(rect)
            val visibleHeight = rect.height()
            val totalHeight = v.height
            val isFloating = imeVisible && (imeHeight <= (totalHeight * 0.15).toInt() || visibleHeight == totalHeight)
            val map: WritableMap = Arguments.createMap()
            map.putBoolean("imeVisible", imeVisible)
            map.putInt("imeHeightPx", imeHeight)
            map.putInt("visibleFrameHeightPx", visibleHeight)
            map.putBoolean("isFloating", isFloating)
            try {
              reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("keyboardHeightChanged", map)
            } catch (e: Exception) {
              Log.w("AppCustomInput", "failed to emit keyboardHeightChanged from insets: ${e.message}")
            }
          } catch (e: Exception) {}
          insets
        }
        hasInsetsListener = true
        observedRoot = root
      }
    } catch (e: Exception) {
      Log.w("AppCustomInput", "insets listener attach failed: ${e.message}")
    }
    // attach a global layout listener to observe window visible changes (IME, GIF panel, etc.)
    try {
      if (globalLayoutListener == null) {
        globalLayoutListener = ViewTreeObserver.OnGlobalLayoutListener {
          try {
            val rect = Rect()
            root.getWindowVisibleDisplayFrame(rect)
            val visibleHeight = rect.height()
            val totalHeight = root.height
            val kbHeight = if (totalHeight > visibleHeight) totalHeight - visibleHeight else 0
            val map: WritableMap = Arguments.createMap()
            map.putInt("keyboardVisibleHeight", kbHeight)
            try {
              reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("keyboardHeightChanged", map)
            } catch (e: Exception) {
              Log.w("AppCustomInput", "failed to emit keyboardHeightChanged: ${e.message}")
            }
          } catch (e: Exception) {}
        }
        root.viewTreeObserver.addOnGlobalLayoutListener(globalLayoutListener)
        observedRoot = root
      }
    } catch (e: Exception) {
      Log.w("AppCustomInput", "global layout listener attach failed: ${e.message}")
    }
      try {
      androidx.core.view.ViewCompat.setOnReceiveContentListener(root, arrayOf("image/*", "image/gif", "image/webp"), androidx.core.view.OnReceiveContentListener { view, payload ->
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

            val map: WritableMap = Arguments.createMap()
            map.putString("uri", uri?.toString())
            if (mime != null) map.putString("mime", mime)
            if (b64 != null) map.putString("gifBase64", b64)
            // compute visible keyboard/inset height
            try {
              val rect = Rect()
              activity.window.decorView.getWindowVisibleDisplayFrame(rect)
              val visibleHeight = rect.height()
              val totalHeight = root.height
              val kbHeight = if (totalHeight > visibleHeight) totalHeight - visibleHeight else 0
              map.putInt("keyboardVisibleHeight", kbHeight)
            } catch (e: Exception) {
              // ignore
            }
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
  fun stopListening() {
    try {
      observedRoot?.let { r ->
        globalLayoutListener?.let { l ->
          r.viewTreeObserver.removeOnGlobalLayoutListener(l)
        }
        if (hasInsetsListener) {
          try { r.setOnApplyWindowInsetsListener(null) } catch (e: Exception) {}
        }
      }
    } catch (e: Exception) {
      Log.w("AppCustomInput", "remove global layout listener failed: ${e.message}")
    }
    globalLayoutListener = null
    observedRoot = null
    hasInsetsListener = false
  }

  @ReactMethod
  fun getLastContent(promise: Promise) {
    promise.resolve(lastContent)
  }
}
