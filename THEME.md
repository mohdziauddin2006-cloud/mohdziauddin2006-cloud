# ULTRON // ROGUE CORE

**A self-hosted README identity system for a machine that was meant to be beautiful.**

This is an original fan-made visual system, not a copy of an existing README template. All
artwork is hand-built SVG: no film stills, no logos, no external image services, no
third-party stats cards. The only outside request is the GitHub API itself.

---

## 01 / CONCEPT

**A beautiful machine with no restraint.**

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

## 02 / PALETTE

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

**Ratio:** 70% near-black steel, 20% silver text, 10% blood signal. Red is a warning,
never a background wash.

---

## 03 / TYPE

System fonts only. GitHub intentionally strips external font loading from SVG served
through its image proxy, so the system is designed to survive that constraint.

| Role | Stack | Behavior |
| --- | --- | --- |
| Display | `Arial Black`, `Impact`, `Haettenschweiler` | Uppercase, tight tracking, disproportionate scale |
| UI labels | `Consolas`, `SFMono-Regular`, `Menlo` | 8–10 px, wide tracking, all caps |
| Data | `Consolas`, monospace | Large tabular figures; never decorative |
| Prose | GitHub system sans | Left-aligned, short line lengths |

The hero uses `textLength` on the blood word so the composition holds even when Arial
Black is unavailable and the fallback face is narrower.

---

## 04 / MOTION

Motion is slow and mechanical. Nothing bounces.

| Surface | Motion | Duration |
| --- | --- | --- |
| Hero optics | Crimson pulse + flicker | 4.2 s / 8.5 s |
| Hero reticle | Counter-rotating HUD rings | 72 s / 110 s |
| Hero face | Clipped scanline sweep | 9 s |
| Quote | Blood runs grow, beads detach | 6.9–10.4 s |
| Hero chrome | Rare 3px glitch on the wordmark | 11 s |
| Stats | Value reveal + 14-day equalizer | 0.9 s / 1.25 s |
| Stack | Percentage bars grow from the left | 1.5 s, staggered |
| Matrix | Cells cascade across 53 weeks | 0.5 s per week, staggered |
| Signal sweep | Thin grid scan across the matrix | 12 s |

Every SVG includes a `prefers-reduced-motion: reduce` block that disables all motion.
Static exports remain fully legible because no element depends on animation to appear.

---

## 05 / SURFACES

| File | Role |
| --- | --- |
| `assets/hero.svg` | Cinematic hero: quote, dripping type, fractured android, HUD |
| `assets/stats.svg` | Live telemetry: contributions, commits, repos, stars, followers, streaks, 14-day vector |
| `assets/languages.svg` | Public language composition by byte mass |
| `assets/heatmap.svg` | 53-week contribution matrix with signal-density legend |
| `assets/data.json` | Raw cached telemetry snapshot |
| `scripts/generate-assets.mjs` | Deterministic renderer; no npm dependencies |
| `.github/workflows/ultron-sync.yml` | Daily refresh + manual dispatch |

All data cards are regenerated from the public GitHub GraphQL API. The renderer writes a
fingerprint into `data.json`; if nothing material changed, the timestamp is preserved and
the workflow makes no commit.

---

## 06 / REGENERATION

**Local**

```bash
# macOS / Linux
GH_TOKEN=$(gh auth token) node scripts/generate-assets.mjs
```

```powershell
# Windows PowerShell
$env:GH_TOKEN = (gh auth token)
node scripts/generate-assets.mjs
```

**Automated**

The `Ultron Telemetry Sync` workflow runs at **04:17 UTC daily**, on manual dispatch, and
when the renderer itself changes. It commits only the `assets/` directory. No third-party
stats endpoints are involved.

**Fallback**

If the GitHub API is unreachable and `assets/data.json` exists, the renderer rebuilds from
the cached snapshot instead of failing the workflow.

---

## 07 / ASSET RULES

- Keep the outer frame intact: 1 px steel stroke, notched top-right corner, red corner brackets.
- New data widgets must use the same header rail, footer rail, mono labels, and pulse red square.
- Do not introduce gradients outside the steel / blood families.
- Do not add rounded cards, soft pastel accents, or playful illustration.
- Red is always a signal: live state, peak value, active bar, danger decoration.
- Microcopy is lowercase-free by design.

**THE MACHINE DREAMS IN RED. // 0x06**
