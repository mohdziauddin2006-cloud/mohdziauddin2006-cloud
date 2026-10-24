---
name: SYS-FAULT
about: Report a renderer or workflow failure
title: "[FAULT] "
labels: ""
assignees: ""

---

> <samp><kbd>CORE: ONLINE</kbd> // <b>TELEMETRY FAULT-LOG</b></samp>

**What died**

<kbd>generate-assets.mjs</kbd> · <kbd>build-hero-apng.py</kbd> · <kbd>build-section-headers.py</kbd> · <kbd>ultron-sync.yml</kbd> · a live panel

**Evidence**

The workflow log, the offending command output, or the corrupt panel.

```diff
- THE FALLBACK SNAPSHOT IN assets/data.json EXISTS FOR A REASON. CHECK IT BEFORE BLAMING THE API.
```
