# ULTRON // ROGUE CORE

<p><sub><samp><kbd><b>THEME</b></kbd> &nbsp;·&nbsp; <b>CORE:</b> ONLINE &nbsp;·&nbsp; <b>MODE:</b> SELF-HOSTED &nbsp;·&nbsp; <b>THREAT LEVEL:</b> <span style="color: #FF0000;">OMEGA-CLASS IDENTITY</span></samp></sub></p>

**A self-hosted README identity system for a machine that was meant to be beautiful.**

This is an original fan-made visual system, not a copy of an existing README template. All
artwork is self-hosted: the live hero is a generated Ultron painting wrapped in hand-built
motion overlays, and every data panel is generated SVG. No film stills, no logos, no runtime
image services, no third-party stats cards. The only outside request is the GitHub API itself.

---

## 01 // CONCEPT

<span style="color: #FF0000;">**A beautiful machine with no restraint.**</span>

The layout takes the structural language of a modern identity card system — a cinematic
hero, modular data panels, a language stack, a contribution matrix — then corrupts it with
industrial HUD markings, notched steel plates, burned edges, and blood-red signal accents.

The quote is the thesis:

> **“I WAS MEANT TO BE BEAUTIFUL.”**

The letters are set in a heavy condensed face, cut with turbulence, and left to bleed.
Every panel after the hero is deliberately quieter: telemetry, not theatre.

**Design laws**

1. Steel is the body. Crimson is the intent. Never let red exceed 15% of a composition.
2. Every panel should look like it was recovered from a machine, not decorated by a theme.
3. Animation must feel like a system running, not a page performing.
4. Type is small, measured, and machine-like; the numbers are the loudest element.
5. Sharp cuts and registration marks beat rounded corners and drop shadows.

---

## 02 // PALETTE

| Token | Hex | Use |
| --- | --- | --- |
| Void | `#04060A` | Outer frame / deepest background |
| Steel 00 | `#0B1017` | Panel base |
| Steel 01 | `#121821` | Low-activity heatmap cells |
| Steel 02 | `#29333F` | Borders, frame hardware |
| Steel 03 | `#46515E` | Secondary metadata |
| Steel 04 | `#8B97A5` | Labels, inactive data |
| Bone | `#D7DEE8` | Primary text |
| White Hot | `#EEF2F6` | Peak numbers |
| Blood | `#E10600` | Primary accent, live signal |
| Ember | `#FF2A1A` | Optic glow, heat, active state |
| Wound | `#7A0303` | Deep accent, bars, secondary marks |
| Cavity | `#05070A` | Eye sockets, negative space |

<samp><b>RATIO: 70 STEEL / 20 SILVER / <span style="color: #FF0000;">10 BLOOD</span></b> · <b>RED IS A WARNING — NEVER A WASH</b></samp>

---

## 03 // TYPE

System fonts only. GitHub intentionally strips external font loading from SVG served
through its image proxy, so the system is designed to survive that constraint.

| Role | Stack | Behavior |
| --- | --- | --- |
| Display | `Arial Black`, `Impact`, `Haettenschweiler` | Uppercase, tight tracking, disproportionate scale |
| UI labels | `Consolas`, `SFMono-Regular`, `Menlo` | 8–10 px, wide tracking, all caps |
| Data | `Consolas`, monospace | Large tabular figures; never decorative |
| Prose | GitHub system sans | Left-aligned, short line lengths |

The hero wordmark lives inside the base painting, while the section headers use a heavy
monospace treatment with wide tracking and a crimson glitch duplicate. SVG labels keep their
layout because every header uses a fixed `viewBox` and system font stack.

---

## 04 // MOTION

Motion is slow and mechanical. Nothing bounces.

| Surface | Motion | Duration |
| --- | --- | --- |
| Hero optics | Crimson core pulse on the exposed lens | 2 s loop, 3 pulses |
| Hero reticle | Rotating HUD arcs and ticks | 2 s loop |
| Hero scan | Red scan band sweeping top to bottom | 2 s loop |
| Hero blood | Drips grow, bead detaches, reset | 2 s loop, staggered |
| Hero breach | Two short RGB/band glitch bursts | ~0.3 s each |
| Hero embers | Red particles drift upward | 2 s loop |
| Section headers | Flicker, glitch duplicate, scan sweep | 3.8–7.1 s |
| Stats | Value reveal + 14-day equalizer | 0.9 s / 1.25 s |
| Stack | Percentage bars grow from the left | 1.5 s, staggered |
| Matrix | Cells cascade across 53 weeks | 0.5 s per week, staggered |
| Signal sweep | Thin grid scan across the matrix | 12 s |

The hero is an APNG: 20 frames at 10 fps, looping every 2 seconds. It keeps the chapter-03
motion vocabulary while preserving the exact README `<img>` layout. Section-header SVGs
include a `prefers-reduced-motion: reduce` block; the APNG freezes on its first frame when the
browser or OS disables animation. Static exports remain fully legible because no element
depends on animation to appear.

---

## 05 // SURFACES

| File | Role |
| --- | --- |
| `assets/watermarked_img_8974856398217869544.png` | Live animated hero: realistic Ultron painting + APNG motion system |
| `assets/hero-gemini-base.png` | Static 1280×620 hero plate used to build the APNG |
| `assets/section-01.svg` … `section-05.svg` | Crimson glitch section headers |
| `assets/hero.svg` | Legacy hand-built vector hero, retained as an alternate composition |
| `assets/stats.svg` | Live telemetry: contributions, commits, repos, stars, followers, streaks, 14-day vector |
| `assets/languages.svg` | Public language composition by byte mass |
| `assets/heatmap.svg` | 53-week contribution matrix with signal-density legend |
| `assets/data.json` | Raw cached telemetry snapshot |
| `scripts/generate-assets.mjs` | Deterministic data-card renderer; no npm dependencies |
| `scripts/build-hero-apng.py` | Builds the hero APNG from the base painting |
| `scripts/build-section-headers.py` | Regenerates the section-header SVGs |
| `.github/workflows/ultron-sync.yml` | Daily refresh + manual dispatch |

All data cards are regenerated from the public GitHub GraphQL API. The renderer writes a
fingerprint into `data.json`; if nothing material changed, the timestamp is preserved and
the workflow makes no commit.

---

## 06 // REGENERATION

**Local**

```bash
# macOS / Linux
GH_TOKEN=$(gh auth token) node scripts/generate-assets.mjs
```

```powershell
# Windows PowerShell
$env:GH_TOKEN = (gh auth token)
node scripts/generate-assets.mjs
python scripts/build-hero-apng.py
python scripts/build-section-headers.py
```

**Automated**

The `Ultron Telemetry Sync` workflow runs at **04:17 UTC daily**, on manual dispatch, and
when the renderer itself changes. It commits only the `assets/` directory. No third-party
stats endpoints are involved.

**Fallback**

If the GitHub API is unreachable and `assets/data.json` exists, the renderer rebuilds from
the cached snapshot instead of failing the workflow.

---

## 07 // ASSET RULES

- Keep the outer frame intact: 1 px steel stroke, notched top-right corner, red corner brackets.
- New data widgets must use the same header rail, footer rail, mono labels, and pulse red square.
- Do not introduce gradients outside the steel / blood families.
- Do not add rounded cards, soft pastel accents, or playful illustration.
- Red is always a signal: live state, peak value, active bar, danger decoration.
- Microcopy is lowercase-free by design.

<kbd><b><span style="color: #FF0000;">THE MACHINE DREAMS IN RED.</span></b> // 0x06</kbd>
