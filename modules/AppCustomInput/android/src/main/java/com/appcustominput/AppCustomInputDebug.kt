package com.appcustominput

import android.content.Context
import android.util.Log
import android.content.pm.ApplicationInfo

object AppCustomInputDebug {
  private var enabled: Boolean = false
  private const val DEFAULT_TAG = "ReactNativeApp"

  fun init(context: Context) {
    try {
      enabled = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    } catch (e: Exception) {
      enabled = false
    }
  }

  fun w(tag: String, msg: String?) {
    if (enabled) Log.w(DEFAULT_TAG, (tag + ": " ) + (msg ?: ""))
  }

  fun w(tag: String, msg: String?, thr: Throwable?) {
    if (enabled) Log.w(DEFAULT_TAG, (tag + ": " ) + (msg ?: ""), thr)
  }

  fun d(tag: String, msg: String?) {
    if (enabled) Log.d(DEFAULT_TAG, (tag + ": " ) + (msg ?: ""))
  }

  fun e(tag: String, msg: String?) {
    if (enabled) Log.e(DEFAULT_TAG, (tag + ": " ) + (msg ?: ""))
  }
}
