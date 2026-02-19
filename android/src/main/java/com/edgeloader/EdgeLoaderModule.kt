package com.edgeloader

import android.app.Activity
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = EdgeLoaderModule.NAME)
class EdgeLoaderModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return NAME
  }

  @ReactMethod
  fun getCutouts(promise: Promise) {
    // DÜZELTME 1: Aktiviteyi doğrudan context üzerinden alıyoruz
    val activity = reactApplicationContext.currentActivity

    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity bulunamadı")
      return
    }

    // Android 9 (API 28) öncesi kontrolü
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      promise.resolve(WritableNativeArray())
      return
    }

    // DÜZELTME 2: runOnUiThread'i güvenli hale getiriyoruz
    activity.runOnUiThread(Runnable {
      try {
        val window = activity.window
        if (window == null) {
            promise.resolve(WritableNativeArray())
            return@Runnable
        }

        val decorView = window.decorView
        val rootWindowInsets = decorView.rootWindowInsets

        if (rootWindowInsets == null) {
          promise.resolve(WritableNativeArray())
          return@Runnable
        }

        val displayCutout = rootWindowInsets.displayCutout

        if (displayCutout == null) {
          promise.resolve(WritableNativeArray())
          return@Runnable
        }

        val result = WritableNativeArray()

        // DÜZELTME 3: boundingRects listesini güvenli bir şekilde döngüye alıyoruz
        val rects = displayCutout.boundingRects
        for (rect in rects) {
          val map = WritableNativeMap()
          
          map.putDouble("x", rect.left.toDouble())
          map.putDouble("y", rect.top.toDouble())
          map.putDouble("width", rect.width().toDouble())
          map.putDouble("height", rect.height().toDouble())
          
          map.putString("gravity", if (rect.top < 100) "TOP" else "BOTTOM")

          result.pushMap(map)
        }

        promise.resolve(result)

      } catch (e: Exception) {
        promise.reject("ERROR", e.message)
      }
    })
  }

  companion object {
    const val NAME = "EdgeLoader"
  }
}