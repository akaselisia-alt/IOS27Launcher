package com.ios27.launcher

import android.graphics.drawable.Drawable

/** full = our own full-bleed icon pack (no padding needed). */
data class AppInfo(val name: String, val pkg: String, val icon: Drawable, val full: Boolean = false)
