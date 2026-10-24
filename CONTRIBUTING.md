# ▓ CONTRIBUTING // ULTRON ROGUE CORE ▓

> <samp><kbd>CORE: ONLINE</kbd> // <b>THIS IS A MIRROR, NOT A FACTORY</b></samp>

This repository is a self-hosted identity system: generated SVG panels, an APNG hero, and a daily GitHub Actions refresh. There is no product here to contribute to — the useful surface is the profile it renders.

## 01 // HOW IT HEALS ITSELF

The <kbd>Ultron Telemetry Sync</kbd> workflow regenerates every data panel daily (04:17 UTC + manual dispatch) and commits only `assets/`. Hand-edits to generated files are overwritten by the machine on schedule. The machine does not negotiate.

## 02 // DIRECTIVE: LOCAL REGENERATION

```diff
- NEVER HAND-EDIT GENERATED SVGs. REGENERATE THEM AND LET THE RENDERER THINK.
```

```bash
GH_TOKEN=$(gh auth token) node scripts/generate-assets.mjs
python scripts/build-hero-apng.py
python scripts/build-section-headers.py
```

## 03 // FILING

- **<kbd>SYS-FAULT</kbd>** — renderer failures, workflow stalls, panel corruption. Bring logs.
- **<kbd>AESTHETIC DIRECTIVE</kbd>** — theme proposals live in `THEME.md`; proposals that break its design laws (70/20/10 steel-silver-blood ratio, no gradients outside the families, no rounded cards) are denied on arrival.
