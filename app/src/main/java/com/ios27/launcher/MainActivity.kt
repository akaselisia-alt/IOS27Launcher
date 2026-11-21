package com.ios27.launcher

import android.accessibilityservice.AccessibilityService
import android.annotation.SuppressLint
import android.app.AppOpsManager
import android.app.NotificationManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.os.Process
import android.speech.RecognizerIntent
import android.view.View
import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.Drawable
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.provider.AlarmClock
import android.provider.OpenableColumns
import java.io.File
import java.util.concurrent.Executors
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @Volatile
    private var apps: List<AppInfo> = emptyList()
    private val iconCache = ConcurrentHashMap<String, String>()
    private var torchOn = false
    private var wasScreenOff = false
    private val llmExecutor = Executors.newSingleThreadExecutor()

    private fun modelFile() = File(filesDir, "model.litertlm")

    private val pickModel =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) Thread { importModel(uri) }.start()
        }

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            wasScreenOff = true
        }
    }

    private val speech =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
            val t = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
            if (t != null) webView.evaluateJavascript("window.onSpeech(" + JSONObject.quote(t) + ")", null)
        }

    private val pickImage =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri != null) Thread { loadWallpaper(uri) }.start()
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Keep the real status bar and nav bar readable: white icons on a light scrim
        window.statusBarColor = Color.parseColor("#55000000")
        window.navigationBarColor = Color.parseColor("#55000000")
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        webView = findViewById(R.id.webView)
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        ContextCompat.registerReceiver(
            this, screenReceiver, IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED
        )
        webView.setBackgroundColor(Color.TRANSPARENT)
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false      // android_asset/ is still readable
            allowContentAccess = false
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == "file" && url.path?.startsWith("/android_asset/") == true) return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                }
                return true
            }
        }
        webView.addJavascriptInterface(Bridge(), "Android")
        webView.loadUrl("file:///android_asset/index.html")

        // Back closes whichever panel is open; otherwise it stays on the home screen
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.onBack ? window.onBack() : false", null)
            }
        })
    }

    override fun onResume() {
        super.onResume()
        loadApps()
        applyRefreshRate()
        webView.evaluateJavascript("window.onResumed && window.onResumed()", null)
        if (wasScreenOff) {
            wasScreenOff = false
            webView.evaluateJavascript("window.onWake && window.onWake()", null)
        }
    }

    override fun onDestroy() {
        try {
            unregisterReceiver(screenReceiver)
        } catch (_: Exception) {
        }
        try {
            LocalLlm.release()
        } catch (_: Throwable) {
        }
        super.onDestroy()
    }

    /** Ask the display for its highest refresh rate (90/120/144 Hz where the phone has it). */
    /** Highest refresh rate this screen offers at its current resolution (e.g. 120 Hz). */
    @Suppress("DEPRECATION")
    private fun bestMode(): android.view.Display.Mode? {
        if (Build.VERSION.SDK_INT < 23) return null
        val d = windowManager.defaultDisplay
        val cur = d.mode
        return d.supportedModes
            .filter { it.physicalWidth == cur.physicalWidth && it.physicalHeight == cur.physicalHeight }
            .maxByOrNull { it.refreshRate }
    }

    /** Ask Android to run the launcher at the screen's top refresh rate. */
    private fun applyRefreshRate() {
        try {
            val best = bestMode() ?: return
            val lp = window.attributes
            lp.preferredDisplayModeId = best.modeId
            lp.preferredRefreshRate = best.refreshRate
            window.attributes = lp
        } catch (_: Exception) {
        }
    }

    /** Copies the model file you pick into the app's private storage (llama-style models are large, so this shows progress). */
    private fun importModel(uri: Uri) {
        fun js(code: String) = runOnUiThread { webView.evaluateJavascript(code, null) }
        val tmp = File(filesDir, "model.tmp")
        try {
            var name = "model.litertlm"
            var total = 0L
            contentResolver.query(uri, null, null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (ni >= 0) name = c.getString(ni) ?: name
                    val si = c.getColumnIndex(OpenableColumns.SIZE)
                    if (si >= 0 && !c.isNull(si)) total = c.getLong(si)
                }
            }
            var done = 0L
            var lastPct = -1
            contentResolver.openInputStream(uri)?.use { input ->
                tmp.outputStream().use { out ->
                    val buf = ByteArray(1 shl 20)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        done += n
                        if (total > 0) {
                            val pct = (done * 100 / total).toInt()
                            if (pct != lastPct) {
                                lastPct = pct
                                js("window.onModelProgress($pct)")
                            }
                        }
                    }
                }
            } ?: throw IllegalStateException("Couldn't open that file")
            LocalLlm.release()
            val dest = modelFile()
            if (dest.exists()) dest.delete()
            if (!tmp.renameTo(dest)) throw IllegalStateException("Couldn't save the model")
            getSharedPreferences("llm", MODE_PRIVATE).edit().putString("name", name).apply()
            js("window.onModelReady(" + JSONObject.quote(name) + ")")
        } catch (t: Throwable) {
            tmp.delete()
            js("window.onModelError(" + JSONObject.quote(t.message ?: "Import failed") + ")")
        }
    }

    private fun hasUsageAccess(): Boolean {
        val ops = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        @Suppress("DEPRECATION")
        val mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.hasCategory(Intent.CATEGORY_HOME)) {
            webView.evaluateJavascript("window.onHome && window.onHome()", null)
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    private fun launchPackage(pkg: String) {
        val intent = packageManager.getLaunchIntentForPackage(pkg)
        if (intent == null) {
            toast("Can't open that app")
            return
        }
        try {
            startActivity(intent)
        } catch (_: Exception) {
            toast("Can't open that app")
        }
    }

    private fun loadApps() {
        Thread {
            val pm = packageManager
            val query = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val list = pm.queryIntentActivities(query, 0)
                .filter { it.activityInfo.packageName != packageName }
                .distinctBy { it.activityInfo.packageName }
                .map {
                    val pkg = it.activityInfo.packageName
                    val custom = customIcon(pkg)
                    AppInfo(it.loadLabel(pm).toString(), pkg, custom ?: it.loadIcon(pm), custom != null)
                }
                .sortedBy { it.name.lowercase() }
            runOnUiThread {
                if (!isFinishing && !isDestroyed) {
                    apps = list
                    iconCache.clear()
                    webView.evaluateJavascript("window.onAppsChanged && window.onAppsChanged()", null)
                }
            }
        }.start()
    }

    // Original icon pack (no third-party logos). Unlisted apps keep their own icon.
    private fun customIcon(pkg: String): Drawable? {
        val res = when (pkg) {
            "com.whatsapp", "com.whatsapp.w4b" -> R.drawable.ic_chat
            "com.zhiliaoapp.musically", "com.ss.android.ugc.trill" -> R.drawable.ic_clips
            "com.instagram.android" -> R.drawable.ic_social
            "com.google.android.youtube" -> R.drawable.ic_video
            "com.spotify.music" -> R.drawable.ic_music
            "com.google.android.apps.messaging", "com.samsung.android.messaging" -> R.drawable.ic_messages
            "com.google.android.dialer", "com.samsung.android.dialer", "com.android.dialer" -> R.drawable.ic_phone
            "com.google.android.apps.photos", "com.sec.android.gallery3d" -> R.drawable.ic_photos
            "com.google.android.apps.maps" -> R.drawable.ic_maps
            "com.sec.android.app.camera", "com.google.android.GoogleCamera",
            "com.android.camera", "com.android.camera2" -> R.drawable.ic_camera
            "com.android.settings" -> R.drawable.ic_settings
            "com.google.android.gm" -> R.drawable.ic_mail
            "com.google.android.calendar", "com.samsung.android.calendar" -> R.drawable.ic_calendar
            "com.google.android.calculator", "com.sec.android.app.popupcalculator",
            "com.android.calculator2" -> R.drawable.ic_calculator
            else -> return null
        }
        return ContextCompat.getDrawable(this, res)
    }

    private fun loadWallpaper(uri: Uri) {
        try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            var sample = 1
            while (bounds.outWidth / sample > 1400 || bounds.outHeight / sample > 2400) sample *= 2
            val opts = BitmapFactory.Options().apply { inSampleSize = sample }
            val bmp = contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
            if (bmp == null) {
                runOnUiThread { toast("Couldn't load that image") }
                return
            }
            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 80, out)
            val data = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            runOnUiThread { webView.evaluateJavascript("window.onWallpaper(" + JSONObject.quote(data) + ")", null) }
        } catch (_: Exception) {
            runOnUiThread { toast("Couldn't load that image") }
        }
    }

    private fun canWrite(): Boolean =
        if (Build.VERSION.SDK_INT >= 23) Settings.System.canWrite(this) else true

    private fun requestWrite() {
        toast("Allow \"Modify system settings\" for this launcher, then try again")
        try {
            startActivity(
                Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:$packageName"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: Exception) {
        }
    }

    private fun setTorchMode(on: Boolean) {
        try {
            val cm = getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val id = cm.cameraIdList.firstOrNull {
                cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            }
            if (id == null) {
                toast("No torch on this phone")
                return
            }
            cm.setTorchMode(id, on)
            torchOn = on
        } catch (_: Exception) {
            toast("Torch not available")
        }
    }

    private fun globalAction(name: String): Boolean {
        val svc = ControlService.instance ?: return false
        val action = when (name) {
            "notifications" -> AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS
            "quick" -> AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS
            "power" -> AccessibilityService.GLOBAL_ACTION_POWER_DIALOG
            "recents" -> AccessibilityService.GLOBAL_ACTION_RECENTS
            "lock" -> if (Build.VERSION.SDK_INT >= 28) AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN else return false
            "shot" -> if (Build.VERSION.SDK_INT >= 28) AccessibilityService.GLOBAL_ACTION_TAKE_SCREENSHOT else return false
            else -> return false
        }
        return svc.performGlobalAction(action)
    }

    @SuppressLint("WrongConstant")
    private fun expandPanel(method: String) {
        try {
            val sb = getSystemService("statusbar")
            Class.forName("android.app.StatusBarManager").getMethod(method).invoke(sb)
        } catch (_: Exception) {
            toast("Swipe down from the very top of the screen")
        }
    }

    /** What index.html can call: Android.getApps(), getIcon(pkg), openApp(pkg) and the Control Center helpers. */
    inner class Bridge {
        @JavascriptInterface
        fun getApps(): String {
            val arr = JSONArray()
            for (a in apps) arr.put(JSONObject().put("name", a.name).put("pkg", a.pkg))
            return arr.toString()
        }

        @SuppressLint("NewApi")
        @JavascriptInterface
        fun getIcon(pkg: String): String {
            iconCache[pkg]?.let { return it }
            val app = apps.firstOrNull { it.pkg == pkg } ?: return ""
            return try {
                val size = 120
                val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                val c = Canvas(bmp)
                val d = app.icon.constantState?.newDrawable()?.mutate() ?: app.icon
                if (Build.VERSION.SDK_INT >= 26 && d is AdaptiveIconDrawable) {
                    // Draw both layers edge-to-edge so the icon fills the glass tile (the launcher applies the shape)
                    val k = size / 72f
                    val off = (-18 * k).toInt()
                    val full = (108 * k).toInt()
                    d.background?.let { it.setBounds(off, off, off + full, off + full); it.draw(c) }
                    d.foreground?.let { it.setBounds(off, off, off + full, off + full); it.draw(c) }
                } else if (app.full) {
                    d.setBounds(0, 0, size, size)
                    d.draw(c)
                } else {
                    // Old-style icon: sit it on a soft light glass tile
                    val p = Paint(Paint.ANTI_ALIAS_FLAG)
                    p.shader = LinearGradient(
                        0f, 0f, 0f, size.toFloat(),
                        Color.parseColor("#F6F7FB"), Color.parseColor("#D5D9E4"), Shader.TileMode.CLAMP
                    )
                    c.drawRect(0f, 0f, size.toFloat(), size.toFloat(), p)
                    val inset = (size * 0.14f).toInt()
                    d.setBounds(inset, inset, size - inset, size - inset)
                    d.draw(c)
                }
                val out = ByteArrayOutputStream()
                bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
                val uri = "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                iconCache[pkg] = uri
                uri
            } catch (_: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun openApp(pkg: String) {
            runOnUiThread { launchPackage(pkg) }
        }

        @JavascriptInterface
        fun pickWallpaper() {
            runOnUiThread { pickImage.launch("image/*") }
        }

        @JavascriptInterface
        fun openNotifications() {
            runOnUiThread { if (!this@MainActivity.globalAction("notifications")) expandPanel("expandNotificationsPanel") }
        }

        @JavascriptInterface
        fun openQuickSettings() {
            runOnUiThread { if (!this@MainActivity.globalAction("quick")) expandPanel("expandSettingsPanel") }
        }

        /** Returns "ok", or "need:a11y" when Full Control isn't switched on yet. */
        @JavascriptInterface
        fun globalAction(name: String): String {
            return if (this@MainActivity.globalAction(name)) "ok" else "need:a11y"
        }

        @JavascriptInterface
        fun openAccessibilitySettings() {
            runOnUiThread {
                toast("Find \"iOS 27 Launcher\" and switch it on")
                try {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun getStates(): String {
            val o = JSONObject()
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            try {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                o.put("wifi", wm.isWifiEnabled)
            } catch (_: Exception) {
            }
            try {
                @Suppress("DEPRECATION")
                o.put("bt", BluetoothAdapter.getDefaultAdapter()?.isEnabled == true)
            } catch (_: Exception) {
            }
            o.put("torch", torchOn)
            o.put("a11y", ControlService.instance != null)
            o.put("usage", hasUsageAccess())
            o.put("write", canWrite())
            o.put("silent", am.ringerMode != AudioManager.RINGER_MODE_NORMAL)
            if (Build.VERSION.SDK_INT >= 23) {
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                o.put("dnd", nm.currentInterruptionFilter in 2..4)
            }
            try {
                o.put("rotate", Settings.System.getInt(contentResolver, Settings.System.ACCELEROMETER_ROTATION, 1) == 1)
                o.put("brightness", Settings.System.getInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128) * 100 / 255)
            } catch (_: Exception) {
            }
            val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
            o.put("volume", am.getStreamVolume(AudioManager.STREAM_MUSIC) * 100 / max)
            return o.toString()
        }

        /** torch, dnd, rotate, silent. Returns "ok" or "need:write" / "need:dnd". */
        @JavascriptInterface
        fun toggle(name: String): String {
            runOnUiThread {
                when (name) {
                    "torch" -> setTorchMode(!torchOn)
                    "silent" -> {
                        val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                        am.ringerMode = if (am.ringerMode == AudioManager.RINGER_MODE_NORMAL)
                            AudioManager.RINGER_MODE_VIBRATE else AudioManager.RINGER_MODE_NORMAL
                    }
                    "rotate" -> {
                        if (!canWrite()) requestWrite() else {
                            val on = Settings.System.getInt(contentResolver, Settings.System.ACCELEROMETER_ROTATION, 1) == 1
                            Settings.System.putInt(contentResolver, Settings.System.ACCELEROMETER_ROTATION, if (on) 0 else 1)
                        }
                    }
                    "dnd" -> {
                        if (Build.VERSION.SDK_INT >= 23) {
                            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                            if (!nm.isNotificationPolicyAccessGranted) {
                                toast("Allow Do Not Disturb access for this launcher, then try again")
                                try {
                                    startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                                } catch (_: Exception) {
                                }
                            } else {
                                val on = nm.currentInterruptionFilter in 2..4
                                nm.setInterruptionFilter(
                                    if (on) NotificationManager.INTERRUPTION_FILTER_ALL
                                    else NotificationManager.INTERRUPTION_FILTER_PRIORITY
                                )
                            }
                        }
                    }
                }
            }
            return "ok"
        }

        @JavascriptInterface
        fun setBrightness(percent: Int) {
            runOnUiThread {
                if (!canWrite()) {
                    requestWrite()
                } else {
                    Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
                    Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, (percent.coerceIn(1, 100) * 255 / 100))
                }
            }
        }

        @JavascriptInterface
        fun setVolume(percent: Int) {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            am.setStreamVolume(AudioManager.STREAM_MUSIC, percent.coerceIn(0, 100) * max / 100, 0)
        }

        @JavascriptInterface
        fun media(key: String) {
            val code = when (key) {
                "play" -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
                "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
                "prev" -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
                else -> return
            }
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
            am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
        }

        @JavascriptInterface
        fun shortcut(name: String) {
            runOnUiThread {
                val intent = when (name) {
                    "wifi", "data" ->
                        if (Build.VERSION.SDK_INT >= 29) Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY)
                        else Intent(if (name == "wifi") Settings.ACTION_WIFI_SETTINGS else Settings.ACTION_DATA_ROAMING_SETTINGS)
                    "bt" -> Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                    "air" -> Intent(Settings.ACTION_AIRPLANE_MODE_SETTINGS)
                    "display" -> Intent(Settings.ACTION_DISPLAY_SETTINGS)
                    "location" -> Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                    "hotspot" -> Intent().setClassName("com.android.settings", "com.android.settings.TetherSettings")
                    "saver" -> Intent("android.settings.BATTERY_SAVER_SETTINGS")
                    "nfc" -> Intent(Settings.ACTION_NFC_SETTINGS)
                    "settings" -> Intent(Settings.ACTION_SETTINGS)
                    "camera" -> Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
                    "calc" -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALCULATOR)
                    "clock" -> Intent(AlarmClock.ACTION_SHOW_ALARMS)
                    else -> return@runOnUiThread
                }
                try {
                    startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                    toast("Not available on this phone")
                }
            }
        }

        /** Recently used apps (last 24h), newest first. Needs Usage access. */
        @JavascriptInterface
        fun getRecents(): String {
            val out = JSONArray()
            if (!hasUsageAccess()) return out.toString()
            try {
                val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                val now = System.currentTimeMillis()
                val ev = usm.queryEvents(now - 24L * 3600L * 1000L, now)
                val last = LinkedHashMap<String, Long>()
                val e = UsageEvents.Event()
                while (ev.hasNextEvent()) {
                    ev.getNextEvent(e)
                    if (e.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) last[e.packageName] = e.timeStamp
                }
                val known = apps.associateBy { it.pkg }
                for ((pkg, _) in last.entries.sortedByDescending { it.value }) {
                    val a = known[pkg] ?: continue
                    out.put(JSONObject().put("name", a.name).put("pkg", pkg))
                    if (out.length() >= 12) break
                }
            } catch (_: Exception) {
            }
            return out.toString()
        }

        @JavascriptInterface
        fun requestUsageAccess() {
            runOnUiThread {
                toast("Find \"iOS 27 Launcher\" and allow usage access")
                try {
                    startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun listen() {
            runOnUiThread {
                try {
                    speech.launch(
                        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    )
                } catch (_: Exception) {
                    toast("Voice input isn't available on this phone")
                }
            }
        }

        /** Safe phone actions for the assistant: dial, sms, url, search, maps, alarm, timer. They open the app; you confirm. */
        @JavascriptInterface
        fun act(kind: String, a: String, b: String) {
            runOnUiThread {
                try {
                    val intent = when (kind) {
                        "dial" -> Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", a.replace(Regex("[^0-9+*#]"), ""), null))
                        "sms" -> Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(a.replace(Regex("[^0-9+]"), ""))))
                            .putExtra("sms_body", b)
                        "url" -> Intent(Intent.ACTION_VIEW, Uri.parse(if (a.startsWith("http://") || a.startsWith("https://")) a else "https://$a"))
                        "search" -> Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(a)))
                        "maps" -> Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(a)))
                        "alarm" -> {
                            val hm = a.split(":")
                            Intent(AlarmClock.ACTION_SET_ALARM)
                                .putExtra(AlarmClock.EXTRA_HOUR, hm[0].toInt())
                                .putExtra(AlarmClock.EXTRA_MINUTES, hm.getOrNull(1)?.toInt() ?: 0)
                                .putExtra(AlarmClock.EXTRA_MESSAGE, b)
                                .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                        }
                        "timer" -> Intent(AlarmClock.ACTION_SET_TIMER)
                            .putExtra(AlarmClock.EXTRA_LENGTH, a.toInt())
                            .putExtra(AlarmClock.EXTRA_MESSAGE, b)
                            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                        else -> return@runOnUiThread
                    }
                    startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                    toast("Couldn't do that on this phone")
                }
            }
        }

        @JavascriptInterface
        fun getHz(): Int = Math.round(bestMode()?.refreshRate ?: 60f)

        @JavascriptInterface
        fun getBattery(): Int {
            val bm = getSystemService(Context.BATTERY_SERVICE) as android.os.BatteryManager
            return bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY)
        }

        @JavascriptInterface
        fun llmStatus(): String {
            val f = modelFile()
            return JSONObject()
                .put("built", LocalLlm.BUILT)
                .put("installed", f.exists())
                .put("name", getSharedPreferences("llm", MODE_PRIVATE).getString("name", "") ?: "")
                .put("mb", f.length() / 1048576L)
                .toString()
        }

        @JavascriptInterface
        fun llmPick() {
            runOnUiThread {
                try {
                    pickModel.launch(arrayOf("*/*"))
                } catch (_: Exception) {
                    toast("No file picker available")
                }
            }
        }

        @JavascriptInterface
        fun llmRemove() {
            llmExecutor.execute {
                try {
                    LocalLlm.release()
                } catch (_: Throwable) {
                }
                modelFile().delete()
                runOnUiThread { webView.evaluateJavascript("window.onModelRemoved()", null) }
            }
        }

        /** Runs the imported model on the phone (no internet) and returns the text through window.onLocal. */
        @JavascriptInterface
        fun llmAsk(id: Int, prompt: String) {
            llmExecutor.execute {
                var text = ""
                var err = ""
                try {
                    text = LocalLlm.generate(modelFile().absolutePath, prompt)
                } catch (t: Throwable) {
                    err = t.message ?: t.javaClass.simpleName
                }
                val js = "window.onLocal(" + id + "," + JSONObject.quote(text) + "," + JSONObject.quote(err) + ")"
                runOnUiThread { webView.evaluateJavascript(js, null) }
            }
        }
    }
}
