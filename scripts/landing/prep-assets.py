"""Optimise generated landing art into public/images/landing/.
Usage: python3 -I scripts/landing/prep-assets.py <incoming-dir>
 - lp-prop-*.png / lp-cloud-*.png : RGBA, require alpha extrema (0,255), trim to bbox + 4%, cap width, WebP
 - lp-hero-plate-*.png / lp-map-plate.png / lp-*-plate*.png : RGB plates, Lanczos x1.5, light unsharp, WebP
"""
import sys, glob, os
import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1]
OUT = "public/images/landing"
os.makedirs(OUT, exist_ok=True)

def save(im, name, q=86):
    p = f"{OUT}/{name}.webp"
    im.save(p, quality=q, method=6)
    print(f"{name:28s} {im.size}  {os.path.getsize(p)//1024} KB")

for f in sorted(glob.glob(f"{SRC}/lp-*.png")):
    base = os.path.basename(f)[3:-4]
    im = Image.open(f)
    if base.startswith(("prop-", "cloud-")):
        im = im.convert("RGBA")
        ext = im.getchannel("A").getextrema()
        if ext[0] != 0 or ext[1] < 250:
            print(f"!! {base}: alpha extrema {ext} (not real alpha), skipped")
            continue
        a = np.asarray(im.getchannel("A"))
        ys, xs = np.where(a > 8)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        padx, pady = int((x1 - x0) * 0.04), int((y1 - y0) * 0.04)
        im = im.crop((max(x0 - padx, 0), max(y0 - pady, 0), min(x1 + padx, im.width), min(y1 + pady, im.height)))
        cap = 1400 if base.startswith("cloud-") else 900
        if im.width > cap:
            im = im.resize((cap, round(im.height * cap / im.width)), Image.LANCZOS)
        save(im, base)
    else:
        im = im.convert("RGB")
        im = im.resize((round(im.width * 1.5), round(im.height * 1.5)), Image.LANCZOS)
        im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
        save(im, base, 84)
