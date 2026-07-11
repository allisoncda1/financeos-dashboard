---
name: FinanceOS logo asset prep
description: How the FinanceOS brand SVGs behave and the reliable recipe to turn them into clean web logo PNGs
---

# FinanceOS brand logo asset prep

The source brand files (`financeos-logo.svg`, `financeos-icon.svg`, AI-generated / C2PA) are 948×948 squares with heavy padding AND an opaque white background that comes from **two** sources: a `<rect fill="#ffffff">` *and* embedded `<image>` rasters. Removing only the rect and rasterizing with `-background none` still yields an **opaque white** PNG.

**Reliable recipe (ImageMagick `magick` is available; rsvg-convert/inkscape are not):**
1. Rasterize at density ~400 (quality is capped by the embedded raster anyway), `-trim +repage` to drop padding.
2. Key out the background: `-fuzz ~12% -transparent white` → true transparency (also hollows the icon's O-ring, which is fine).
3. For a dark-surface variant, recolor while preserving alpha: `-alpha on -channel RGB -evaluate set 100% +channel PNG32:out.png`. Do NOT use `-colorize` — it drops the alpha and produces a solid block.
4. Verify transparency by compositing over magenta (fringe) and over the real bg color; `identify -format '%[opaque]'` should be `False`.

**Why a white variant exists:** the sidebar background is `#1B3A2C` (dark green). The green brand mark is nearly invisible on it, so `FinanceOSLogo` variant `sidebar` uses a white-recolored lockup (`financeos-lockup-light.png`). `full`/`home`/`login` use the green lockup on light backgrounds.

**Asset path convention (whole repo):** logo/entity image `src` is written root-relative (e.g. `/branding/...`, `/logos/...`) with **no** `import.meta.env.BASE_URL` prefix — `EntityLogo` renders `src={logoPath}` directly. Works because the artifact is served at base `/`. Match this convention rather than mixing BASE_URL prefixes.
