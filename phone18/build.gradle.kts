plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    // The sources share the launcher's package name; the installed app has its own id, so both can live on one phone.
    namespace = "com.ios27.launcher"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ios27.phone18"
        minSdk = 21
        targetSdk = 34
        val run = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toIntOrNull() ?: 1
        versionCode = run
        versionName = "1.0.$run"
        val server = (System.getenv("LAUNCHER_SERVER") ?: "").trim().trimEnd('/')
        require(server.isEmpty() || server.startsWith("https://")) { "LAUNCHER_SERVER must start with https://" }
        buildConfigField("String", "DEFAULT_SERVER", "\"" + server.replace("\"", "") + "\"")
    }
    buildFeatures { buildConfig = true }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
}
