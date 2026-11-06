# Piggy Farm signaling server (PeerJS)

Online play (Star Rush / Dash Race, Quick Play, room codes) uses WebRTC. Phones need a small **signaling server** only to find each other and swap connection details; after that, game traffic goes phone to phone. By default the game uses the free public PeerJS server, which is best effort (no uptime promise, shared with everyone). This folder is your own copy so a launch does not depend on it.

* Stateless and tiny: nothing is stored, no accounts. Rooms live in memory.
* **Run exactly one instance.** Rooms are kept in memory, so two instances would split players into separate worlds.
* **It must be reachable over HTTPS/WSS.** The Android app blocks cleartext traffic.

## Check it locally

```bash
cd piggyfarm-peer-server
npm ci
npm test            # health, CORS allow/deny, real WebSocket handshake, "id taken" (what Quick Play relies on)
npm start           # http://localhost:9000/healthz
```

Optional end-to-end check with two real browser pages and the game's own lobby (create room, join by code, start, Quick Play):

```bash
npm i --no-save playwright && npx playwright install chromium
node test/e2e/lobby.e2e.js ../piggyfarm-android/app/src/main/assets/www
```

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `9000` | Listen port (the Docker image uses `8080`) |
| `ALLOWED_ORIGINS` | `https://appassets.androidplatform.net` | Comma list of browser origins allowed by CORS. That is the origin the Android app serves the game from. Add your site if you also host the web build; `*` allows any. |
| `PEER_PATH` | `/` | Mount path. Must match `path` in `PIGGY_PEER`. |
| `PEER_KEY` | `peerjs` | API key. Must match `key` in `PIGGY_PEER` if you change it. |
| `MAX_PEERS` | `2000` | Concurrent connected players |
| `TRUST_PROXY` | `1` | Set `0` only if the server is exposed without a proxy |

## Deploy

### Option A: Fly.io (recommended: always-on, TLS included)

```bash
cd piggyfarm-peer-server
fly auth login
# edit `app` in fly.toml to a free name, and primary_region to the one nearest your players
fly launch --copy-config --no-deploy
fly deploy
fly scale count 1                  # keep exactly one machine
curl https://<your-app>.fly.dev/healthz     # {"ok":true,...}
```

### Option B: Render

Push the repo, create a **Blueprint** from `piggyfarm-peer-server/render.yaml`. The free plan sleeps when idle and takes about a minute to wake, which makes "Create room" look broken, so use `starter` or above.

### Option C: Your own VPS (Docker + Caddy for automatic HTTPS)

```bash
docker build -t piggyfarm-peer piggyfarm-peer-server
docker run -d --restart=always --name peer -p 127.0.0.1:8080:8080 piggyfarm-peer
```

`/etc/caddy/Caddyfile` (Caddy gets the certificate and proxies WebSockets by itself):

```
peer.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

## Point the game at it

In `piggyfarm-android/app/src/main/assets/www/index.html`, replace `window.PIGGY_PEER = null;` with:

```js
window.PIGGY_PEER = { host: 'peer.example.com', port: 443, path: '/', secure: true };
```

Then raise `versionCode` in `piggyfarm-android/app/build.gradle.kts` and push; CI builds the new AAB. A unit test fails the build if you set a non-`secure` server.

## Phones behind strict networks (TURN)

Most pairs connect directly through STUN. Some mobile carriers and corporate Wi-Fi block that, and then the match stays at "Joining…". The PeerJS client already falls back to PeerJS's public STUN/TURN servers, which are also best effort. For a wide launch, run your own TURN (for example [coturn](https://github.com/coturn/coturn)) and add it. **A custom `config` replaces the defaults, so keep a STUN entry too:**

```js
window.PIGGY_PEER = {
  host: 'peer.example.com', port: 443, path: '/', secure: true,
  config: { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:turn.example.com:3478', username: 'piggy', credential: '<secret>' },
  ] },
};
```

A TURN credential in a shipped app can be extracted by anyone, so use short-lived credentials from a small token endpoint once usage grows, or accept that the relay can be abused and watch its bandwidth.

## Two-phone test on the deployed server

1. `curl https://peer.example.com/healthz` returns `{"ok":true,...}`, and `curl -i https://peer.example.com/peerjs/id -H "Origin: https://appassets.androidplatform.net"` returns an id and an `access-control-allow-origin` header.
2. Install the app on two phones on different networks (one on Wi-Fi, one on mobile data). Phone A: **Play online > Create room**. Phone B: enter the code > **Join**. Start the match and watch for the other pig and name tag.
3. Repeat with **Quick Play** on both.
