# Debug signing key (NOT a secret)

`piggyfarm-debug.p12` is a throw-away key with the public, well-known Android debug credentials
(`android` / `androiddebugkey` / `android`). It exists only so every CI-built **debug** APK
(`com.piggyfarm.game.debug`) is signed with the *same* key – then a new debug build installs over the old one
without "App not installed / package conflicts" and without losing the save file.

* It signs **debug** builds only. The Play Store **release** key is separate, private, and comes from the
  `PIGGY_KEYSTORE_*` repository secrets – never put it in git.
* Anyone can sign an APK with this key, which is fine for a sideloaded test build and exactly as safe as the default
  `~/.android/debug.keystore` every Android developer already has.
