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
  private var lastImeVisible: Boolean = false
  private var lastEmittedKbHeight: Int = -1
  private var lastEmitTs: Long = 0
  private var lastEmittedKey: String? = null
  private var lastInsetsEmitTs: Long = 0

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
            val prevImeVisible = lastImeVisible
            val rect = Rect()
            v.getWindowVisibleDisplayFrame(rect)
            val visibleHeight = rect.height()
            val totalHeight = v.height
            val isFloating = imeVisible && (imeHeight <= (totalHeight * 0.15).toInt() || visibleHeight == totalHeight)
            val map: WritableMap = Arguments.createMap()
            map.putBoolean("imeVisible", imeVisible)
            map.putInt("imeHeightPx", imeHeight)
            // compute visible keyboard height as totalHeight - visibleFrameHeight (fallback)
            val kbHeight = if (totalHeight > visibleHeight) totalHeight - visibleHeight else 0
            // if IME is not visible according to insets, prefer reporting 0 visible height
            val reportedKbHeight = if (!imeVisible) 0 else kbHeight
            map.putInt("keyboardVisibleHeight", reportedKbHeight)
            map.putInt("visibleFrameHeightPx", visibleHeight)
            map.putBoolean("isFloating", isFloating)
            try {
              // Per spec: emit concise payload with keys: isVisible, isFloating, keyboardDem
              val now = System.currentTimeMillis()
              val isFloatingAdj = imeVisible && (imeHeight <= (totalHeight * 0.15).toInt() || visibleHeight == totalHeight)
              val keyboardDem = if (imeVisible && !isFloatingAdj) reportedKbHeight else 0
              val key = "${imeVisible}:${isFloatingAdj}:${keyboardDem}"
              if (key == lastEmittedKey && now - lastEmitTs < 700) {
                // skip duplicate
              } else {
                // determine event type using previous IME visibility
                val eventType = when {
                  imeVisible && !prevImeVisible -> "show"
                  !imeVisible && prevImeVisible -> "hide"
                  imeVisible && lastEmittedKbHeight != keyboardDem -> "resize"
                  else -> if (imeVisible) "resize" else "hide"
                }
                val out: WritableMap = Arguments.createMap()
                out.putString("event", eventType)
                out.putBoolean("isVisible", imeVisible)
                out.putBoolean("isFloating", isFloatingAdj)
                out.putInt("keyboardDem", keyboardDem)
                reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("keyboardChanged", out)
                // record that an insets-based emit occurred
                lastInsetsEmitTs = now
                lastEmittedKbHeight = keyboardDem
                lastEmitTs = now
                lastEmittedKey = key
                // update lastImeVisible to current state so next event calc works
                lastImeVisible = imeVisible
              }
            } catch (e: Exception) {
              AppCustomInputDebug.w("AppCustomInput", "failed to emit keyboard event from insets: ${e.message}")
            }
          } catch (e: Exception) {}
          insets
        }
        hasInsetsListener = true
        observedRoot = root
      }
    } catch (e: Exception) {
      AppCustomInputDebug.w("AppCustomInput", "insets listener attach failed: ${e.message}")
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
            var kbHeight = if (totalHeight > visibleHeight) totalHeight - visibleHeight else 0
            // if the insets listener recently reported IME not visible, suppress transient global-layout kbHeight
            if (!lastImeVisible) {
              kbHeight = 0
            }
            // derive isFloating similarly to insets path (small IME or full-screen visible frame)
            val isFloating = lastImeVisible && (kbHeight <= (totalHeight * 0.15).toInt() || visibleHeight == totalHeight)

            // Per spec: only emit concise payload with keys: isVisible, isFloating, keyboardDem
            val keyboardDem = if (lastImeVisible && !isFloating) kbHeight else 0

            val map: WritableMap = Arguments.createMap()
            map.putBoolean("isVisible", lastImeVisible)
            map.putBoolean("isFloating", isFloating)
            map.putInt("keyboardDem", keyboardDem)

            try {
              val now = System.currentTimeMillis()
              // if insets emitted very recently, prefer insets and skip global-layout emit
              if (now - lastInsetsEmitTs < 300) {
                return@OnGlobalLayoutListener
              }
              val key = "${lastImeVisible}:${isFloating}:${keyboardDem}"
              if (key == lastEmittedKey && now - lastEmitTs < 700) {
                // skip duplicate global-layout emit
              } else {
                // determine event type for global-layout path
                val eventType = when {
                  lastImeVisible && !lastEmittedKey?.startsWith("true")!! -> "show"
                  !lastImeVisible && lastEmittedKey?.startsWith("true")!! -> "hide"
                  lastEmittedKbHeight != keyboardDem -> "resize"
                  else -> if (lastImeVisible) "resize" else "hide"
                }
                map.putString("event", eventType)
                reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("keyboardChanged", map)
                lastEmittedKbHeight = keyboardDem
                lastEmitTs = now
                lastEmittedKey = key
                // update lastImeVisible already represents current state
              }
            } catch (e: Exception) {
              AppCustomInputDebug.w("AppCustomInput", "failed to emit keyboard event: ${e.message}")
            }
          } catch (e: Exception) {}
        }
        root.viewTreeObserver.addOnGlobalLayoutListener(globalLayoutListener)
        observedRoot = root
      }
    } catch (e: Exception) {
      AppCustomInputDebug.w("AppCustomInput", "global layout listener attach failed: ${e.message}")
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
              AppCustomInputDebug.w("AppCustomInput", "failed to read content: ${e.message}")
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
              AppCustomInputDebug.w("AppCustomInput", "failed to emit event: ${e.message}")
            }
          }
        } catch (e: Exception) {
          AppCustomInputDebug.w("AppCustomInput", "receive content error: ${e.message}")
        }
        null
      })
      listening = true
    } catch (e: Exception) {
      AppCustomInputDebug.w("AppCustomInput", "setOnReceiveContentListener failed: ${e.message}")
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
        AppCustomInputDebug.w("AppCustomInput", "remove global layout listener failed: ${e.message}")
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
