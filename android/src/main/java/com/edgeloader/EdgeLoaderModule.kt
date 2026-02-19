package com.edgeloader

import com.facebook.react.bridge.ReactApplicationContext

class EdgeLoaderModule(reactContext: ReactApplicationContext) :
  NativeEdgeLoaderSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeEdgeLoaderSpec.NAME
  }
}
