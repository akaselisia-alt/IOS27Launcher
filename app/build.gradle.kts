plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ios27.launcher"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ios27.launcher"
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        // Your account server, baked into the APK. Set the LAUNCHER_SERVER repository variable (https://...).
        val server = (System.getenv("LAUNCHER_SERVER") ?: "").trim().trimEnd('/')
        require(server.isEmpty() || server.startsWith("https://")) { "LAUNCHER_SERVER must start with https://" }
        buildConfigField("String", "DEFAULT_SERVER", "\"" + server.replace("\"", "") + "\"")
    }

    buildFeatures {
        buildConfig = true
    }

    // "standard" = the stable launcher. "ai" = same launcher plus an on-device AI engine (needs Android 8+).
    flavorDimensions += "engine"
    productFlavors {
        create("standard") {
            dimension = "engine"
        }
        create("ai") {
            dimension = "engine"
            minSdk = 26
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Debug-key signed so the release APK also installs when sideloaded
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    // No ABI/density splits are configured, so one universal APK is produced.

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// The AI engine is compiled only into the "ai" variant, so a problem there can never break the standard APK.
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    if (name.contains("Ai")) {
        compilerOptions.freeCompilerArgs.add("-Xskip-metadata-version-check")
    }
}

dependencies {
    add("aiImplementation", "com.google.ai.edge.litertlm:litertlm-android:latest.release")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
}
