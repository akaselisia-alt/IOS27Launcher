package com.ios27.launcher

/** full = our own full-bleed icon pack. Icons themselves are loaded on demand, not kept in memory. */
data class AppInfo(val name: String, val pkg: String, val full: Boolean = false)
