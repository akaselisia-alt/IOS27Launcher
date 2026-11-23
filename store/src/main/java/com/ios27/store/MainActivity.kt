package com.ios27.store

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import com.ios27.launcher.StoreSupport
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.concurrent.Executors

/** The separate iOS 27 Store app: the same Store screens as inside the launcher, full screen. */
class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val netExecutor = Executors.newFixedThreadPool(2)

    private fun prefs() = getSharedPreferences("account", MODE_PRIVATE)
    private fun serverBase(): String {
        val s = prefs().getString("server", "") ?: ""
        return if (s.isNotEmpty()) s else BuildConfig.DEFAULT_SERVER
    }

    private val storeSupport = StoreSupport(
        this, { webView }, { serverBase() }, { prefs().getString("token", "") ?: "" }
    )

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        webView = WebView(this)
        webView.setBackgroundColor(Color.BLACK)
        setContentView(webView)
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == "file" && url.path?.startsWith("/android_asset/") == true) return false
                if (url.scheme == "https") try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (_: Exception) {}
                return true
            }
        }
        webView.addJavascriptInterface(Bridge(), "Android")
        webView.loadUrl("file:///android_asset/index.html")
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.onBack ? window.onBack() : false") { r ->
                    if (r != "true") { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
                }
            }
        })
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.evaluateJavascript("window.onResumed && window.onResumed()", null)
    }

    private fun readLimited(input: InputStream, max: Int): String {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(8192)
        var total = 0
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            total += n
            if (total > max) throw IllegalStateException("Response too large")
            out.write(buf, 0, n)
        }
        return out.toString("UTF-8")
    }

    inner class Bridge {
        @JavascriptInterface
        fun acctState(): String {
            val p = prefs()
            return JSONObject()
                .put("server", serverBase())
                .put("builtIn", BuildConfig.DEFAULT_SERVER.isNotEmpty())
                .put("id", p.getString("id", "") ?: "")
                .put("signedIn", !p.getString("token", "").isNullOrEmpty())
                .toString()
        }

        @JavascriptInterface
        fun acctSetServer(url: String): String {
            val u = url.trim().trimEnd('/')
            val p = prefs()
            if (u.isEmpty()) {
                if ((p.getString("server", "") ?: "").isNotEmpty()) p.edit().remove("server").remove("token").remove("id").apply()
                return ""
            }
            return try {
                val uri = URI(u)
                if (uri.scheme != "https" || uri.host.isNullOrEmpty() || uri.userInfo != null || u.length > 200 || uri.query != null) {
                    "Use a full https:// address, like https://my-server.example.com"
                } else {
                    if (p.getString("server", "") != u) p.edit().remove("token").remove("id").apply()
                    p.edit().putString("server", u).apply()
                    ""
                }
            } catch (_: Exception) {
                "That address doesn't look right."
            }
        }

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun acctSignOut() { prefs().edit().remove("token").remove("id").apply() }

        @JavascriptInterface fun storeInstalled(pkg: String): String = storeSupport.installed(pkg)
        @JavascriptInterface fun storeOpen(pkg: String) = storeSupport.open(pkg)
        @JavascriptInterface fun storeUninstall(pkg: String) = storeSupport.uninstall(pkg)
        @JavascriptInterface fun storeInstall(id: Int, appId: String, sha: String, pkg: String) = storeSupport.install(id, appId, sha, pkg)
        @JavascriptInterface fun storePick(kind: String) = storeSupport.pick(kind)
        @JavascriptInterface fun storeUpload(id: Int, kind: String, path: String) = storeSupport.upload(id, kind, path)
        @JavascriptInterface fun openUrl(url: String) = storeSupport.openUrl(url)

        @JavascriptInterface
        fun acctRequest(id: Int, method: String, path: String, body: String) {
            netExecutor.execute {
                var status = 0
                var text = ""
                try {
                    val p = prefs()
                    val base = serverBase()
                    if (base.isEmpty()) throw IllegalStateException("No server is set up yet")
                    if (!(path == "/health" || path.startsWith("/api/"))) throw IllegalArgumentException("Bad request")
                    if (method != "GET" && method != "POST" && method != "PUT") throw IllegalArgumentException("Bad request")
                    val c = URL(base + path).openConnection() as HttpURLConnection
                    c.requestMethod = method
                    c.connectTimeout = 15000
                    c.readTimeout = 20000
                    c.instanceFollowRedirects = false
                    c.setRequestProperty("Accept", "application/json")
                    val token = p.getString("token", "") ?: ""
                    val isAuth = path == "/api/login" || path == "/api/register" || path == "/api/recover"
                    if (token.isNotEmpty() && !isAuth) c.setRequestProperty("Authorization", "Bearer $token")
                    if (method != "GET") {
                        c.doOutput = true
                        c.setRequestProperty("Content-Type", "application/json")
                        c.outputStream.use { it.write(body.toByteArray()) }
                    }
                    status = c.responseCode
                    val stream = if (status in 200..299) c.inputStream else c.errorStream
                    text = if (stream != null) stream.use { readLimited(it, 1_000_000) } else ""
                    if (isAuth && status in 200..299) {
                        val j = JSONObject(text)
                        p.edit().putString("token", j.getString("token")).putString("id", j.getString("id")).apply()
                        text = JSONObject().put("id", j.getString("id")).put("recovery", j.optString("recovery", "")).toString()
                    }
                    if (status == 401 && token.isNotEmpty() && !isAuth) p.edit().remove("token").remove("id").apply()
                    if (path == "/api/logout" || (path == "/api/account/delete" && status in 200..299)) p.edit().remove("token").remove("id").apply()
                } catch (e: Exception) {
                    status = 0
                    text = JSONObject().put("error", e.message ?: "No connection").toString()
                }
                val js = "window.onNet(" + id + "," + status + "," + JSONObject.quote(text) + ")"
                runOnUiThread { webView.evaluateJavascript(js, null) }
            }
        }
    }
}
