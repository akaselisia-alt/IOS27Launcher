package com.ios27.launcher

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Base64
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var drawer: RecyclerView
    private lateinit var search: EditText
    private lateinit var adapter: AppAdapter

    @Volatile
    private var apps: List<AppInfo> = emptyList()
    private val iconCache = ConcurrentHashMap<String, String>()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        drawer = findViewById(R.id.appDrawer)
        search = findViewById(R.id.searchBar)

        // Drawer
        adapter = AppAdapter(emptyList()) { launch(it) }
        drawer.layoutManager = GridLayoutManager(this, 4)
        drawer.adapter = adapter

        // Home screen = your index.html, loaded from the app's own assets only
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
                // Anything else opens outside the launcher, never inside the WebView
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                }
                return true
            }
        }
        webView.addJavascriptInterface(Bridge(), "Android")
        webView.loadUrl("file:///android_asset/index.html")

        // Search
        search.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                val q = s?.toString().orEmpty()
                adapter.filter(q)
                if (q.isNotBlank()) drawer.visibility = View.VISIBLE
            }

            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })
        search.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                adapter.first()?.let { launch(it) }
                true
            } else false
        }

        findViewById<Button>(R.id.btnDrawer).setOnClickListener {
            setDrawerVisible(drawer.visibility != View.VISIBLE)
        }

        // Back: close drawer, then WebView history, otherwise stay on the home screen
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    drawer.visibility == View.VISIBLE -> setDrawerVisible(false)
                    webView.canGoBack() -> webView.goBack()
                    else -> Unit
                }
            }
        })
    }

    override fun onResume() {
        super.onResume()
        loadApps()
    }

    // Home button pressed while the launcher is already running
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.hasCategory(Intent.CATEGORY_HOME)) {
            setDrawerVisible(false)
            webView.evaluateJavascript("window.onHome && window.onHome()", null)
        }
    }

    private fun setDrawerVisible(visible: Boolean) {
        drawer.visibility = if (visible) View.VISIBLE else View.GONE
        if (!visible) {
            search.setText("")
            search.clearFocus()
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            imm.hideSoftInputFromWindow(search.windowToken, 0)
        }
    }

    private fun launch(app: AppInfo) = launchPackage(app.pkg, app.name)

    private fun launchPackage(pkg: String, label: String) {
        val intent = packageManager.getLaunchIntentForPackage(pkg)
        if (intent != null) {
            try {
                startActivity(intent)
            } catch (_: Exception) {
                Toast.makeText(this, "Can't open $label", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(this, "Can't open $label", Toast.LENGTH_SHORT).show()
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
                    AppInfo(it.loadLabel(pm).toString(), pkg, customIcon(pkg) ?: it.loadIcon(pm))
                }
                .sortedBy { it.name.lowercase() }
            runOnUiThread {
                if (!isFinishing && !isDestroyed) {
                    apps = list
                    iconCache.clear()
                    adapter.submit(list)
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

    /** Functions your index.html can call as Android.getApps(), Android.getIcon(pkg), Android.openApp(pkg). */
    inner class Bridge {
        @JavascriptInterface
        fun getApps(): String {
            val arr = JSONArray()
            for (a in apps) arr.put(JSONObject().put("name", a.name).put("pkg", a.pkg))
            return arr.toString()
        }

        @JavascriptInterface
        fun getIcon(pkg: String): String {
            iconCache[pkg]?.let { return it }
            val app = apps.firstOrNull { it.pkg == pkg } ?: return ""
            return try {
                val size = 96
                val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                val d = app.icon.constantState?.newDrawable()?.mutate() ?: app.icon
                d.setBounds(0, 0, size, size)
                d.draw(Canvas(bmp))
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
            runOnUiThread { launchPackage(pkg, pkg) }
        }
    }
}
