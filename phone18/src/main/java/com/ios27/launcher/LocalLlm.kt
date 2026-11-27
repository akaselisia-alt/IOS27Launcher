package com.ios27.launcher

/** The standard APK has no AI engine. The "AI" APK replaces this file with a real one. */
object LocalLlm {
    const val BUILT = false

    fun generate(modelPath: String, prompt: String): String =
        throw UnsupportedOperationException("This APK has no AI engine. Install IOS27Launcher-AI.apk.")

    fun release() {}
}
