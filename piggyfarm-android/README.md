# Piggy Farm: Android app (Gradle project)

A real Gradle/Kotlin Android project that wraps the v5.2 web game (`app/src/main/assets/www`) in a full-screen WebView and builds a **Play-ready AAB** in CI. v5.1 was the prebuilt `PiggyFarm-v5_1.apk`; v5.2 adds the kid-friendly content below.

## What's new in v5.2 (versionCode 7)

* **6 new worlds** (20 in total, one every 10 levels): Coral Reef (bouncy floor), Dino Valley (breezy wind), Fairy Garden (low gravity), Carnival Fun (party mode), Rainy Day (slippery), Crystal Cave (speedy).
* **5 new grumpy-cute villains** that never look scary: Grumpy Cupcake (sprinkle shots, stompable), Snowball Sam (lobs snowballs with a red landing ring), Jack-in-the-Box (hides until it pops out), Buzzy Bee (figure-eights and swoops), Wind-up Robot (marches, winds up, punches).
* **2 new bosses**: Cupcake Queen (level 40) and Big Jack (level 70).
* **2 new missions**: *Surprise Gifts* (hopping gift boxes) and *Lost Chicks* (lead the chicks home to the red ring).
* **New world rules**: wind drift, trampoline floor, party mode (confetti, x1.5 win coins).
* **Animation polish**: pop-in "boop" for enemies, victory dance, cheering sheep, popping win stars, idle "Oink?" hop.
* **Shop**: 6 new hats (pirate, bunny, flower crown, ducky, cupcake, unicorn) and 4 new skins.
* Source files: `ch_extra.js` (new characters, bosses 10/11, hats) and `game.js` (AI, worlds, missions).

Why this exists: the prebuilt v5.1 APK targets API 28, and Google Play only accepts new apps and updates that target a recent API level. This project targets API 36 and is built from source, so it can be uploaded.

## Status (read this first)

* **Builds green on GitHub Actions** (unit tests, lint, debug APK, release AAB + APK). It has **not been run on a phone yet**; see the device checklist below. Library versions are in `gradle/libs.versions.toml`.
* The **native Kotlin rewrite** (`:game-core`, `:net`, native renderer) from the v6 package is not part of this project. This app ships the web game that the store listing and promo kit describe.
* **No keystore exists.** You create it (below). Without it, release outputs are unsigned.

## Build locally

```bash
./gradlew testDebugUnitTest assembleDebug          # debug APK -> app/build/outputs/apk/debug/
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Needs JDK 17 and the Android SDK (platform 36). Android Studio does both.

## Build on GitHub

`.github/workflows/piggyfarm-android.yml` runs on every push to `main` or `piggyfarm-android`:
unit tests, lint, debug APK, release bundle (AAB) and release APK. Download them from the run's **Artifacts**.

## Signing for Google Play

1. Create an upload key **on your own computer** and back it up (password manager + offline copy):
   ```bash
   keytool -genkeypair -v -keystore piggyfarm-release.jks -alias piggyfarm -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 piggyfarm-release.jks > piggyfarm-release.jks.b64     # macOS: base64 -i piggyfarm-release.jks
   ```
2. Repository **Settings > Secrets and variables > Actions**, add: `PIGGY_KEYSTORE_BASE64` (the b64 text), `PIGGY_KEYSTORE_PASSWORD`, `PIGGY_KEY_ALIAS`, `PIGGY_KEY_PASSWORD`.
3. Re-run the workflow: the AAB is now signed. Upload it in Play Console with **Play App Signing** on (the key you made is then only the upload key and can be reset).

Never commit `*.jks`; `.gitignore` already blocks it.

## What the app does

* Serves the game from `https://appassets.androidplatform.net/assets/www/` (WebViewAssetLoader), so `localStorage` (the save game) has a normal web origin; file access is off, cleartext is off.
* Full-screen, notch-aware, immersive; `fullSensor` orientation; press Back twice to exit.
* Pauses the game loop and audio when the app is in the background.
* Permissions: `INTERNET` (online play through the public PeerJS server) and `VIBRATE`. Nothing else.

## Before you publish (device checklist: not done yet)

- [ ] Install the debug APK on a real phone and play levels 1, 5 (dash) and a boss level; check touch, audio, vibration and rotation.
- [ ] Check the save survives closing the app (`localStorage`).
- [ ] Try Star Rush and Dash Race between two phones. The public PeerJS server is best effort; for a wide launch deploy your own from [`../piggyfarm-peer-server`](../piggyfarm-peer-server/README.md) (Fly.io, Render or a VPS) and set `window.PIGGY_PEER` in `index.html`.
- [ ] Play Console: Data safety form (network use), content rating, and the Families Policy decision if the game targets children.
- [ ] Confirm the target-API deadline shown in Play Console and bump `targetSdk` if it moved.

## Updating the game

Replace the files in `app/src/main/assets/www`, raise `versionCode` in `app/build.gradle.kts`, push. The unit test fails if `index.html` references a script that is not bundled.
