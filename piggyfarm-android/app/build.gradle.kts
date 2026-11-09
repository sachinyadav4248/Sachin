import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// Release signing comes from environment variables (CI secrets or your own shell), never from files in git.
// Without them `assembleRelease` / `bundleRelease` still build, but the output is UNSIGNED and cannot be uploaded to Play.
val keystorePath: String? = System.getenv("PIGGY_KEYSTORE_PATH")

android {
    namespace = "com.piggyfarm.game"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.piggyfarm.game"
        minSdk = 24
        targetSdk = 36          // Google Play requires a recent target API for new apps and updates; re-check the deadline in Play Console.
        versionCode = 8         // 5.2.0 was versionCode 7
        versionName = "5.3.0"
    }

    signingConfigs {
        // Throw-away debug key with the public Android debug credentials (see app/debug-signing/README.md): it keeps every
        // CI-built debug APK installable over the previous one. The release key below is separate and never in git.
        create("piggyDebug") {
            storeFile = file("debug-signing/piggyfarm-debug.p12")
            storeType = "pkcs12"
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("PIGGY_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("PIGGY_KEY_ALIAS")
                keyPassword = System.getenv("PIGGY_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"      // installs next to the release app
            signingConfig = signingConfigs.getByName("piggyDebug")
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        // Report, but do not fail the build yet: the first runs on CI decide which warnings are real.
        abortOnError = false
        checkReleaseBuilds = false
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)

    testImplementation(libs.junit)
}
