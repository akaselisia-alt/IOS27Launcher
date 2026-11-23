plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ios27.store"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ios27.store"
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
}
