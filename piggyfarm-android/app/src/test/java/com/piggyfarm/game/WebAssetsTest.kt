package com.piggyfarm.game

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Guards the bundled web game: a missing or renamed script would only show up as a black screen on a phone. */
class WebAssetsTest {
    // Gradle runs unit tests with the module directory (app/) as the working directory.
    private val www = File("src/main/assets/www")
    private val html get() = File(www, "index.html").readText()

    @Test
    fun indexHtmlIsBundled() {
        assertTrue("index.html missing in ${www.absolutePath}", File(www, "index.html").isFile)
    }

    @Test
    fun everyScriptReferencedByIndexIsBundledAndLocal() {
        val scripts = Regex("""<script[^>]+src=["']([^"']+)["']""").findAll(html).map { it.groupValues[1] }.toList()
        assertTrue("index.html should reference the game scripts", scripts.size >= 8)
        for (src in scripts) {
            assertFalse("remote script would break offline play and the app's origin rules: $src", src.startsWith("http") || src.startsWith("//"))
            assertTrue("script referenced but not bundled: $src", File(www, src).isFile)
        }
    }

    @Test
    fun customPeerServerMustBeSecure() {
        // The manifest forbids cleartext traffic, so a self-hosted signaling server set in index.html must use TLS.
        val code = html.replace(Regex("""/\*[\s\S]*?\*/"""), "") // the example in index.html's comment must not count
        val cfg = Regex("""PIGGY_PEER\s*=\s*\{[\s\S]*?\};""").find(code)?.value ?: return // null = public PeerJS server
        assertTrue("window.PIGGY_PEER needs secure: true (https/wss): $cfg", Regex("""secure\s*:\s*true""").containsMatchIn(cfg))
    }

    @Test
    fun gameDoesNotNeedFileUrls() {
        // The app serves assets over https://appassets.androidplatform.net, with file access disabled.
        assertFalse(File(www, "game.js").readText().contains("file://"))
    }
}
