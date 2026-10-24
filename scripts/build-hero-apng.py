#!/usr/bin/env python3
"""
Build the animated Ultron hero from the Gemini-generated base art.

The source art is a static, realistic Ultron banner. This script keeps that
painting intact and adds the Rogue Core motion system on top: HUD arcs,
scanline sweep, crimson optic pulse, animated blood runs, drifting embers and
short mechanical glitch bursts. Output is an APNG so the README can keep using
a normal <img> tag (and its exact width/alignment) while still animating.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SOURCE = ASSETS / "hero-gemini-base.png"
OUTPUT = ASSETS / "watermarked_img_8974856398217869544.png"

W, H = 1280, 620
OUT_W, OUT_H = 1152, 558
FRAMES = 20
FPS = 10
DURATION_MS = round(1000 / FPS)


def rgba(size: tuple[int, int] = (W, H), color=(0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", size, color)


def compose(frame: Image.Image, layer: Image.Image) -> Image.Image:
    return Image.alpha_composite(frame, layer)


def make_vignette() -> Image.Image:
    mask = Image.radial_gradient("L").resize((W, H), Image.Resampling.BILINEAR)
    alpha = mask.point(lambda value: int(value * 0.48))
    vignette = rgba()
    vignette.putalpha(alpha)
    return vignette


def make_scanlines() -> Image.Image:
    layer = rgba()
    draw = ImageDraw.Draw(layer)
    for y in range(0, H, 3):
        draw.line((0, y, W, y), fill=(0, 0, 0, 9))
    for y in range(1, H, 9):
        draw.line((0, y, W, y), fill=(255, 42, 26, 3))
    return layer


def make_scan_strip() -> Image.Image:
    strip = rgba((W, 170))
    draw = ImageDraw.Draw(strip)
    for y in range(170):
        distance = abs(y - 84) / 84
        alpha = int(max(0.0, 1.0 - distance) ** 2 * 24)
        draw.line((0, y, W, y), fill=(185, 8, 8, alpha))
    draw.line((0, 82, W, 82), fill=(255, 62, 42, 105))
    draw.line((0, 83, W, 83), fill=(255, 146, 130, 78))
    draw.line((0, 85, W, 85), fill=(120, 2, 2, 52))
    return strip


def make_ember_sprite(radius: int = 7) -> Image.Image:
    size = radius * 2 + 1
    sprite = rgba((size, size))
    draw = ImageDraw.Draw(sprite)
    cx = cy = radius
    for step in range(radius, 0, -1):
        alpha = int(190 * (1 - step / (radius + 0.5)) ** 1.7) + 5
        draw.ellipse((cx - step, cy - step, cx + step, cy + step), fill=(255, 55, 38, alpha))
    draw.ellipse((cx - 1, cy - 1, cx + 1, cy + 1), fill=(255, 205, 196, 235))
    return sprite


def make_optic_glow() -> Image.Image:
    size = 220
    glow = rgba((size, size))
    draw = ImageDraw.Draw(glow)
    cx = cy = size // 2
    for radius in range(108, 0, -2):
        t = 1.0 - radius / 110.0
        alpha = int(135 * t**2.2)
        draw.ellipse(
            (cx - radius, cy - radius, cx + radius, cy + radius),
            fill=(255, 26, 16, alpha),
        )
    draw.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=(255, 84, 62, 170))
    draw.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=(255, 228, 218, 235))
    return glow


def lowered_alpha(image: Image.Image, factor: float) -> Image.Image:
    copy = image.copy()
    alpha = copy.getchannel("A").point(lambda value: int(value * factor))
    copy.putalpha(alpha)
    return copy


def draw_hud_arcs(angle: float) -> Image.Image:
    layer = rgba()
    draw = ImageDraw.Draw(layer)
    cx, cy = 969, 306
    for radius, offset, alpha, width in ((251, 0, 46, 1), (273, 180, 22, 1)):
        box = (cx - radius, cy - radius, cx + radius, cy + radius)
        for segment in range(0, 360, 30):
            start = angle + offset + segment
            draw.arc(box, start=start, end=start + 13, fill=(220, 25, 18, alpha), width=width)
        for tick in range(0, 360, 30):
            theta = math.radians(angle + offset + tick)
            inner = radius - 5
            outer = radius + 5
            draw.line(
                (
                    cx + math.cos(theta) * inner,
                    cy + math.sin(theta) * inner,
                    cx + math.cos(theta) * outer,
                    cy + math.sin(theta) * outer,
                ),
                fill=(255, 42, 26, alpha + 12),
                width=1,
            )
    draw.arc((cx - 251, cy - 251, cx + 251, cy + 251), start=angle + 206, end=angle + 262, fill=(255, 58, 42, 82), width=2)
    return layer


def draw_blood(frame_index: int) -> Image.Image:
    layer = rgba()
    draw = ImageDraw.Draw(layer)
    # x, top, max length, phase (seconds), width
    runs = (
        (118, 386, 118, 0.0, 4),
        (187, 397, 92, 1.4, 3),
        (268, 404, 132, 2.4, 5),
        (374, 391, 88, 0.7, 3),
        (495, 396, 110, 1.9, 4),
        (617, 389, 126, 0.3, 4),
        (707, 386, 86, 2.8, 3),
        (746, 393, 104, 2.1, 3),
    )
    t = (frame_index / FRAMES) * 2.0
    for x, top, maximum, phase, width in runs:
        local = (t + phase) % 2.0
        if local < 1.42:
            grow = 0.18 + 0.82 * min(1.0, local / 1.42)
            length = maximum * grow
            alpha = 185 if local < 1.25 else int(185 * max(0.0, (1.42 - local) / 0.17))
            draw.line((x, top, x, top + length), fill=(177, 7, 7, alpha), width=width)
            draw.line((x + 1, top + 10, x + 1, top + length), fill=(255, 47, 34, int(alpha * 0.42)), width=1)
            bead_r = width + 1
            draw.ellipse(
                (x - bead_r, top + length - bead_r, x + bead_r, top + length + bead_r),
                fill=(211, 9, 9, min(255, alpha + 20)),
            )
            draw.ellipse((x - 1, top + length - 1, x + 1, top + length + 1), fill=(255, 128, 110, 140))
        elif local < 1.86:
            # A bead lets go and falls away from the run.
            fall = (local - 1.42) / 0.44
            y = top + maximum + fall * 26
            alpha = int(210 * (1 - fall))
            radius = max(1, width - 1)
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(214, 8, 8, alpha))
    return layer


def draw_embers(frame_index: int) -> Image.Image:
    layer = rgba()
    rng = random.Random(0x06A1)
    t = frame_index / FRAMES
    for index in range(30):
        base_x = rng.uniform(520, 1250) if index > 9 else rng.uniform(260, 1000)
        base_y = rng.uniform(120, 590)
        phase = rng.random()
        speed = rng.uniform(0.55, 1.45)
        size = rng.choice((3, 3, 4, 4, 5, 6, 7))
        rise = ((t * speed + phase) % 1.0) * 150
        x = base_x + math.sin((t + phase) * math.tau * 1.3) * 6
        y = base_y - rise
        fade = math.sin(((t * speed + phase) % 1.0) * math.pi)
        if fade <= 0.04:
            continue
        sprite = make_ember_sprite(size)
        sprite = lowered_alpha(sprite, min(1.0, fade * 1.3))
        layer.alpha_composite(sprite, (int(x - size), int(y - size)))
    return layer


def apply_glitch(frame: Image.Image, strength: int, seed: int) -> Image.Image:
    if strength <= 0:
        return frame
    rng = random.Random(seed)
    out = frame.copy()
    for _ in range(rng.randint(4, 7)):
        if rng.random() < 0.55:
            y0 = rng.randint(245, 405)
        else:
            y0 = rng.randint(80, 540)
        band_h = rng.randint(2, 16)
        y1 = min(H, y0 + band_h)
        dx = rng.randint(-strength, strength)
        if dx == 0:
            continue
        band = out.crop((0, y0, W, y1))
        shifted = Image.new("RGB", band.size, (3, 5, 8))
        shifted.paste(band, (dx, 0))
        out.paste(shifted, (0, y0))
        draw = ImageDraw.Draw(out)
        if rng.random() < 0.5:
            draw.line((0, y0, W, y0), fill=(255, 34, 24), width=1)
        if rng.random() < 0.35:
            draw.line((0, y1 - 1, W, y1 - 1), fill=(255, 160, 144), width=1)
    if strength >= 6:
        r, g, b = out.split()
        r = ImageChops.offset(r, max(1, strength // 3), 0)
        b = ImageChops.offset(b, -max(1, strength // 3), 0)
        out = Image.merge("RGB", (r, g, b))
    return out


def build() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing source art: {SOURCE}")

    art = Image.open(SOURCE).convert("RGB")
    if art.size != (W, H):
        art = art.resize((W, H), Image.Resampling.LANCZOS)

    vignette = make_vignette()
    scanlines = make_scanlines()
    scan_strip = make_scan_strip()
    optic_glow = make_optic_glow()

    # Bake static texture into the base so every APNG frame is cheaper to encode.
    baked = art.convert("RGBA")
    noise = Image.effect_noise((W, H), 20).convert("RGB")
    grain = Image.blend(Image.new("RGB", (W, H), (128, 128, 128)), noise, 0.16)
    grain = ImageEnhance.Color(grain).enhance(0.1)
    grain_rgba = grain.convert("RGBA")
    grain_rgba.putalpha(12)
    baked = compose(baked, grain_rgba)
    baked = compose(baked, scanlines)
    baked = compose(baked, vignette)
    baked_base = baked.convert("RGB").convert("RGBA")

    frames: list[Image.Image] = []
    for index in range(FRAMES):
        phase = index / FRAMES
        frame = baked_base.copy()

        # Optic pulse: the exposed lens catches the core light.
        pulse = 0.42 + 0.28 * (0.5 + 0.5 * math.sin(phase * math.tau * 3.0 - 0.7))
        glow = lowered_alpha(optic_glow, pulse)
        frame.alpha_composite(glow, (1020 - glow.width // 2, 341 - glow.height // 2))

        # HUD geometry rotates at two speeds.
        frame = compose(frame, draw_hud_arcs(phase * 360.0))

        # Embers and blood sit above the painting but below the scanline.
        frame = compose(frame, draw_embers(index))
        frame = compose(frame, draw_blood(index))

        scan_y = int(-170 + phase * (H + 340))
        scan = scan_strip.copy()
        frame.alpha_composite(scan, (0, scan_y))

        # Two short mechanical failures per loop.
        glitch = 0
        if index in (4, 5, 6):
            glitch = 8 if index == 5 else 4
        elif index in (14, 15):
            glitch = 5
        elif index == 18:
            glitch = 3
        frame = apply_glitch(frame.convert("RGB"), glitch, 0x06 + index)
        frames.append(frame.resize((OUT_W, OUT_H), Image.Resampling.LANCZOS))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    # A shared palette keeps the APNG small while preserving the steel/red range.
    palette_source = Image.new("RGB", (640, 620), (5, 7, 10))
    palette_source.paste(frames[0].resize((320, 310), Image.Resampling.LANCZOS), (0, 0))
    palette_source.paste(frames[5].resize((320, 310), Image.Resampling.LANCZOS), (320, 0))
    palette_source.paste(frames[15].resize((320, 310), Image.Resampling.LANCZOS), (0, 310))
    chart = Image.new("RGB", (320, 310), (0, 0, 0))
    cd = ImageDraw.Draw(chart)
    for n in range(32):
        cd.rectangle((n * 10, 0, n * 10 + 10, 80), fill=(min(255, n * 8), 4, 4))
        cd.rectangle((n * 10, 80, n * 10 + 10, 160), fill=(0, 0, min(255, n * 8)))
        cd.rectangle((n * 10, 160, n * 10 + 10, 240), fill=(0, 0, min(255, n * 8)))
        cd.rectangle((n * 10, 240, n * 10 + 10, 310), fill=(min(255, n * 8), min(255, n * 8), min(255, n * 8)))
    palette_source.paste(chart, (320, 310))
    palette = palette_source.quantize(colors=256, method=Image.Quantize.MEDIANCUT)

    pal = palette_source.quantize(colors=192, method=Image.Quantize.MEDIANCUT)
    pframes = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    preview = ROOT / "preview/hero-apng-final.png"
    pframes[0].save(preview, save_all=True, append_images=pframes[1:], duration=DURATION_MS, loop=0, optimize=True, compress_level=9)
    print(f"preview {preview.name}: {preview.stat().st_size / 1024 / 1024:.2f} MB with 192 colors")

    pframes[0].save(
        OUTPUT,
        save_all=True,
        append_images=pframes[1:],
        duration=DURATION_MS,
        loop=0,
        optimize=True,
        compress_level=9,
    )
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024 / 1024:.2f} MB, {len(frames)} frames, {FPS} fps)")


if __name__ == "__main__":
    build()
