package com.ios27.launcher

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.provider.Settings
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

/**
 * Everything the Store screens need from Android: download + verify + install an APK, uninstall, open an app,
 * pick files and upload them to the store server. Shared by the launcher and the separate Store app.
 * The sign-in token never reaches the web page: it is read here from [token] when a request is made.
 */
class StoreSupport(
    private val act: AppCompatActivity,
    private val web: () -> WebView,
    private val base: () -> String,
    private val token: () -> String
) {
    private val exec = Executors.newFixedThreadPool(2)
    private val picked = HashMap<String, Uri>()
    private val sizes = HashMap<String, Long>()
    private var pickKind = ""
    private val actionInstall = "com.ios27.STORE_INSTALL_RESULT." + act.packageName
    private var receiverReady = false

    private val picker = act.registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@registerForActivityResult
        var name = "file"
        var size = -1L
        try {
            act.contentResolver.query(uri, null, null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val si = c.getColumnIndex(OpenableColumns.SIZE)
                    if (ni >= 0) name = c.getString(ni) ?: name
                    if (si >= 0 && !c.isNull(si)) size = c.getLong(si)
                }
            }
        } catch (_: Exception) {
        }
        picked[pickKind] = uri
        sizes[pickKind] = size
        js("window.onStorePicked(" + JSONObject.quote(pickKind) + "," + JSONObject.quote(name) + "," + (if (size < 0) 0 else size) + ")")
    }

    private fun js(code: String) = act.runOnUiThread { web().evaluateJavascript(code, null) }
    private fun progress(id: Int, state: String, pct: Int, text: String = "") =
        js("window.onStoreProgress($id,'$state',$pct,${JSONObject.quote(text)})")
    private fun upProgress(id: Int, state: String, pct: Int, text: String = "") =
        js("window.onStoreUpload($id,'$state',$pct,${JSONObject.quote(text)})")
    private fun toast(t: String) = act.runOnUiThread { Toast.makeText(act, t, Toast.LENGTH_LONG).show() }

    fun installed(pkg: String): String = try {
        act.packageManager.getPackageInfo(pkg, 0).versionName ?: "1"
    } catch (_: Exception) {
        ""
    }

    fun open(pkg: String) {
        act.runOnUiThread {
            val i = act.packageManager.getLaunchIntentForPackage(pkg)
            if (i != null) act.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) else toast("Can't open that app")
        }
    }

    fun uninstall(pkg: String) {
        if (!Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$").matches(pkg)) return
        act.runOnUiThread {
            try {
                act.startActivity(Intent(Intent.ACTION_DELETE, Uri.parse("package:$pkg")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (_: Exception) {
                toast("Can't uninstall that app")
            }
        }
    }

    /** Opens a payment page in the browser (https only). */
    fun openUrl(url: String) {
        if (!url.startsWith("https://")) return
        act.runOnUiThread {
            try {
                act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (_: Exception) {
                toast("No browser found")
            }
        }
    }

    fun pick(kind: String) {
        if (kind != "apk" && kind != "image") return
        pickKind = kind
        act.runOnUiThread { picker.launch(if (kind == "image") arrayOf("image/*") else arrayOf("*/*")) }
    }

    /* ---------- install ---------- */

    fun install(id: Int, appId: String, sha: String, pkg: String) {
        if (!Regex("^[0-9a-f]{16}$").matches(appId)) { progress(id, "error", 0, "Bad app"); return }
        if (base().isEmpty()) { progress(id, "error", 0, "No store server"); return }
        if (Build.VERSION.SDK_INT >= 26 && !act.packageManager.canRequestPackageInstalls()) {
            progress(id, "permission", 0)
            act.runOnUiThread {
                toast("Allow this app to install apps, then tap Get again")
                act.startActivity(
                    Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
            return
        }
        ensureReceiver()
        exec.execute {
            val dir = File(act.cacheDir, "store").apply { mkdirs() }
            val file = File(dir, "$appId.apk")
            try {
                val c = URL(base() + "/api/store/apps/$appId/download").openConnection() as HttpURLConnection
                c.connectTimeout = 15000
                c.readTimeout = 30000
                c.instanceFollowRedirects = false
                val t = token()
                if (t.isNotEmpty()) c.setRequestProperty("Authorization", "Bearer $t")
                val code = c.responseCode
                if (code != 200) {
                    val msg = try { JSONObject(c.errorStream?.bufferedReader()?.readText() ?: "{}").optString("error") } catch (_: Exception) { "" }
                    progress(id, "error", 0, if (msg.isNotEmpty()) msg else "Download failed ($code)")
                    return@execute
                }
                val total = c.contentLengthLong
                val md = MessageDigest.getInstance("SHA-256")
                var done = 0L
                var last = -1
                c.inputStream.use { input ->
                    file.outputStream().use { out ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            md.update(buf, 0, n)
                            done += n
                            if (total > 0) {
                                val p = (done * 100 / total).toInt()
                                if (p != last) { last = p; progress(id, "download", p) }
                            }
                        }
                    }
                }
                val got = md.digest().joinToString("") { "%02x".format(it) }
                if (sha.isNotEmpty() && !got.equals(sha, ignoreCase = true)) {
                    file.delete()
                    progress(id, "error", 0, "The file doesn't match what the store published. Install cancelled.")
                    return@execute
                }
                progress(id, "install", 100)
                commit(id, file, pkg)
            } catch (e: Exception) {
                file.delete()
                progress(id, "error", 0, e.message ?: "Download failed")
            }
        }
    }

    private fun commit(id: Int, file: File, pkg: String) {
        val pi = act.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setAppPackageName(pkg)       // Android refuses the install if the APK's real package name is different
        val sid = pi.createSession(params)
        pi.openSession(sid).use { s ->
            file.inputStream().use { input -> s.openWrite("app", 0, file.length()).use { out -> input.copyTo(out); s.fsync(out) } }
            val intent = Intent(actionInstall).setPackage(act.packageName).putExtra("rid", id).putExtra("path", file.absolutePath)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
            s.commit(PendingIntent.getBroadcast(act, sid, intent, flags).intentSender)
        }
    }

    private fun ensureReceiver() {
        if (receiverReady) return
        receiverReady = true
        val r = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val rid = intent.getIntExtra("rid", 0)
                when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)) {
                    PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                        @Suppress("DEPRECATION")
                        val i = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                        if (i != null) try { act.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) {}
                    }
                    PackageInstaller.STATUS_SUCCESS -> {
                        intent.getStringExtra("path")?.let { File(it).delete() }
                        progress(rid, "done", 100)
                    }
                    else -> {
                        intent.getStringExtra("path")?.let { File(it).delete() }
                        val m = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "Install failed"
                        progress(rid, "error", 0, if (m.contains("INSTALL_FAILED_ABORTED") || m.contains("Aborted")) "Install cancelled." else m)
                    }
                }
            }
        }
        ContextCompat.registerReceiver(act, r, IntentFilter(actionInstall), ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    /* ---------- upload (developers) ---------- */

    fun upload(id: Int, kind: String, path: String) {
        val ok = Regex("^/api/store/apps/[0-9a-f]{16}/(apk|icon)(\\?versionName=[A-Za-z0-9_.%+-]{0,60})?$").matches(path)
        val uri = picked[kind]
        if (!ok || uri == null || base().isEmpty() || (kind == "apk") != path.contains("/apk")) { upProgress(id, "error", 0, "Choose a file first"); return }
        val size = sizes[kind] ?: -1L
        exec.execute {
            try {
                val c = URL(base() + path).openConnection() as HttpURLConnection
                c.requestMethod = "PUT"
                c.doOutput = true
                c.connectTimeout = 15000
                c.readTimeout = 10 * 60 * 1000
                c.instanceFollowRedirects = false
                c.setRequestProperty("Authorization", "Bearer " + token())
                c.setRequestProperty("Content-Type", "application/octet-stream")
                if (size > 0) c.setFixedLengthStreamingMode(size) else c.setChunkedStreamingMode(64 * 1024)
                var sent = 0L
                var last = -1
                act.contentResolver.openInputStream(uri)!!.use { input ->
                    c.outputStream.use { out ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            sent += n
                            if (size > 0) {
                                val p = (sent * 100 / size).toInt()
                                if (p != last) { last = p; upProgress(id, "progress", p) }
                            }
                        }
                    }
                }
                val code = c.responseCode
                val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.readText() ?: ""
                if (code in 200..299) upProgress(id, "done", 100)
                else upProgress(id, "error", 0, try { JSONObject(text).optString("error", "Upload failed ($code)") } catch (_: Exception) { "Upload failed ($code)" })
            } catch (e: Exception) {
                upProgress(id, "error", 0, e.message ?: "Upload failed")
            }
        }
    }
}
