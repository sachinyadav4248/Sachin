# The app is a WebView host for bundled web assets. It has no JavaScript interface, no reflection and no serialization,
# so the default Android rules are enough. If you ever add addJavascriptInterface, keep the annotated methods:
# -keepclassmembers class com.piggyfarm.game.** { @android.webkit.JavascriptInterface <methods>; }
