package com.edgeloader

import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = EdgeLoaderModule.NAME)
class EdgeLoaderModule(reactContext: ReactApplicationContext) :
  NativeEdgeLoaderSpec(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  override fun getCutouts(promise: Promise) {
    val activity = reactApplicationContext.currentActivity

    if (activity == null) {
      promise.resolve(WritableNativeArray())
      return
    }

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      promise.resolve(WritableNativeArray())
      return
    }

    activity.runOnUiThread {
      try {
        val window = activity.window
        if (window == null) {
          promise.resolve(WritableNativeArray())
          return@runOnUiThread
        }

        val rootWindowInsets = window.decorView.rootWindowInsets
        if (rootWindowInsets == null) {
          promise.resolve(WritableNativeArray())
          return@runOnUiThread
        }

        val displayCutout = rootWindowInsets.displayCutout
        if (displayCutout == null) {
          promise.resolve(WritableNativeArray())
          return@runOnUiThread
        }

        val result = WritableNativeArray()
        val screenHeight = reactApplicationContext.resources.displayMetrics.heightPixels

        for (rect in displayCutout.boundingRects) {
          val map = WritableNativeMap()

          map.putDouble("x", rect.left.toDouble())
          map.putDouble("y", rect.top.toDouble())
          map.putDouble("width", rect.width().toDouble())
          map.putDouble("height", rect.height().toDouble())

          // Oransal gravity eşiği
          map.putString("gravity", if (rect.top < screenHeight * 0.15) "TOP" else "BOTTOM")

          // Cutout tipini boyut geometrisinden tespit et (DIP cinsinden karşılaştır)
          val density = reactApplicationContext.resources.displayMetrics.density
          val wDip = rect.width() / density
          val hDip = rect.height() / density
          val aspectRatio = if (hDip > 0f) wDip / hDip else 1f
          val cutoutType = when {
            // Notch: çok geniş ve ince (en/boy oranı > 2.5)
            aspectRatio > 2.5f -> "notch"
            // Punch hole / teardrop: küçük alan (DIP < 80 her iki boyut)
            wDip < 80f && hDip < 80f -> "punch_hole"
            // Teardrop: orta büyüklükte, kare benzeri
            else -> "teardrop"
          }
          map.putString("type", cutoutType)

          result.pushMap(map)
        }

        promise.resolve(result)

      } catch (e: Exception) {
        promise.reject("ERROR", e.message)
      }
    }
  }

  @ReactMethod
  override fun getModelID(promise: Promise) {
    promise.resolve("")
  }

  companion object {
    const val NAME = "EdgeLoader"
  }
}
