package com.bmatusiak.myapp

import android.os.Build
import android.os.Bundle
import android.view.View

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

import androidx.core.view.ViewCompat
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.ContentInfoCompat
import androidx.core.view.inputmethod.EditorInfoCompat
import com.facebook.react.ReactRootView
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)

    try {
      // attach a listener to receive rich input (images/GIFs) from keyboards
      val root: View? = findViewById(android.R.id.content)
      root?.let { v ->
        ViewCompat.setOnReceiveContentListener(v, arrayOf("*/*"), OnReceiveContentListener { view, payload ->
          try {
            val clip = payload.clip
            if (clip != null && clip.itemCount > 0) {
              val item = clip.getItemAt(0)
              val uri = item.uri
              val mime = uri?.let { view.context.contentResolver.getType(it) }
              val reactContext = (application as? MainApplication)?.reactNativeHost?.reactInstanceManager?.currentReactContext
              reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("keyboardInputContent", Arguments.createMap().apply {
                  putString("uri", uri?.toString())
                  putString("mime", mime)
                })
            }
          } catch (e: Exception) {
            // ignore
          }
          // indicate we've handled the content
          null
        })
      }
    } catch (e: Exception) {
      // ignore if APIs unavailable
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled
      ) {
        override fun createRootView(): ReactRootView {
          val root = object : ReactRootView(this@MainActivity) {
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

          try {
            ViewCompat.setOnReceiveContentListener(
              root,
              arrayOf("image/*", "image/gif", "image/webp"),
              OnReceiveContentListener { view, payload ->
                try {
                  val clip = payload.clip
                  if (clip != null && clip.itemCount > 0) {
                    val item = clip.getItemAt(0)
                    val uri = item.uri
                    val mime = uri?.let { view.context.contentResolver.getType(it) }
                    val reactContext = (application as? MainApplication)?.reactNativeHost?.reactInstanceManager?.currentReactContext
                    reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                      ?.emit("keyboardInputContent", Arguments.createMap().apply {
                        putString("uri", uri?.toString())
                        putString("mime", mime)
                      })
                  }
                } catch (e: Exception) {
                  // ignore
                }
                null
              }
            )
          } catch (e: Exception) {
            // ignore
          }

          return root
        }
      }
    )
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
