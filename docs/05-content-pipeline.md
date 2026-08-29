# Phase 5 — Content Pipeline and Asset Specification

Nothing in this phase is built. This is the specification the art and audio work is
commissioned against, and the budget it has to fit inside.

## 1. The budget decides the style

The performance budget from the charter — 60 FPS on a 4 GB device, ≤ 120 draw calls, ≤ 100k
triangles on screen — is not a constraint the art has to work around. It is the reason the
art looks the way it does. Low-poly stylised models with flat, bright colours and no
per-object textures happen to be both the genre's visual language and the cheapest thing to
draw. That alignment is worth protecting: any proposal that breaks it costs frame rate on
the devices most of the audience owns.

## 2. Models

| Asset | Triangles | Notes |
| --- | --- | --- |
| Player and staff | ≤ 2,000 | One shared rig so animations are interchangeable |
| Customer | ≤ 1,200 | Colour variation by material property, not by mesh |
| Car | ≤ 1,500 | Four silhouettes, recoloured |
| Station | ≤ 800 | Includes its animated part |
| Prop / decor | ≤ 500 | |
| Food item | ≤ 200 | Seen in stacks of up to twenty, so this one is load-bearing |

One material per location atlas, 1024–2048, ASTC 6x6. No per-object textures, no
transparency in the shop view, no real-time shadows beyond a blob under each character.
Customers and cars are GPU-instanced, which is the single biggest saving available and the
reason their meshes must be shared rather than varied.

## 3. Animation

Sold on motion, not detail. The models are simple, so the animation carries the feel.

- **Player:** idle, run, carry-idle, carry-run, serve, restock. Carry variants offset the
  arms; the stack itself is procedural and wobbles with movement.
- **Staff:** work loop per station type, serve, idle, sleep.
- **Customer:** walk, queue-bob, happy, angry, leave.
- **Stations:** a production loop and a one-shot "ready" pop each.
- **Cash:** an arc, a bounce, and a fly-to-HUD.

Everything squashes and stretches. A station compresses as it produces; boxes wobble on the
stack; cash overshoots and settles. This is where the tactility lives.

## 4. UI

Chunky and readable at 4 cm. Minimum tap target 48 dp, minimum body text 16 sp. Nine-slice
panels so nothing stretches. Icons carry a shape as well as a colour, because
[requirement N-11](01-requirements.md) forbids conveying state by colour alone — and because
roughly one man in twelve cannot reliably tell the red patience bar from the green one.

Layout is built for a 1.4× string-length expansion and for CJK line breaking. No text is
baked into any texture.

## 5. Audio

Four sounds carry the whole game and are worth commissioning rather than buying: the cash
chime, the oven sizzle, the box pop, and the level-up stinger. Everything else can come from
a library.

Mixer groups Music, SFX and UI. Feedback ducks music 3 dB for 200 ms. One warm loop per
location, short and quiet enough to survive repetition.

**Every audio cue has a visual twin.** Most sessions are silent — the primary persona plays
muted on a bus — so audio may reinforce information and may never be the only carrier of it.

## 6. Generating assets

AI-generated assets are permitted under [`IP-GUARDRAILS.md`](../IP-GUARDRAILS.md) and are not
exempt from it. Record the tool, the prompt and the licence, and confirm the terms grant
commercial rights to the output.

**A prompt that names an existing game, studio or character is prohibited.** It is the single
most likely way to produce infringing output by accident, and "in the style of" a named
product is exactly the phrasing that does it. Describe the qualities wanted instead:

> Low-poly stylised 3D pizza oven, chunky rounded forms, flat bright colours, warm orange
> and cream palette, no text, no branding, three-quarter view, neutral grey background,
> game asset, clean topology.

The chef mascot is defined by its own silhouette and palette, recorded here once it is
designed, and must not converge on another game's mascot. That is a check somebody performs
and signs off, not an intention.

## 7. Definition of Done — Phase 5

- [x] Polygon, texture and material budgets set per asset class
- [x] Animation list enumerated per actor
- [x] UI legibility and accessibility minimums fixed
- [x] Audio direction set, with the mute requirement stated
- [x] Asset-generation rules aligned with the IP guardrails
- [ ] Any asset actually produced — none exists
- [ ] Mascot design and silhouette sign-off
