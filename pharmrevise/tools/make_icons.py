"""Draws the launcher icon (green rounded square, white capsule + cross) at every density."""
import os
import sys

from PIL import Image, ImageDraw

SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def draw(size):
    s = size * 4  # supersample, then downscale for smooth edges
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=(15, 110, 90, 255))
    # capsule, tilted look via two halves
    cx, cy = s * 0.5, s * 0.5
    w, h = s * 0.62, s * 0.26
    box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
    d.rounded_rectangle(box, radius=int(h / 2), fill=(255, 255, 255, 255))
    d.rounded_rectangle([cx, box[1], box[2], box[3]], radius=int(h / 2), fill=(244, 185, 66, 255))
    d.rectangle([cx, box[1], cx + h / 2, box[3]], fill=(244, 185, 66, 255))
    # small cross, top-right
    c = s * 0.11
    px, py = s * 0.76, s * 0.2
    t = c * 0.36
    d.rectangle([px - t, py - c, px + t, py + c], fill=(255, 255, 255, 255))
    d.rectangle([px - c, py - t, px + c, py + t], fill=(255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def main(res_dir):
    for density, size in SIZES.items():
        out = os.path.join(res_dir, "mipmap-" + density)
        os.makedirs(out, exist_ok=True)
        draw(size).save(os.path.join(out, "ic_launcher.png"))
    draw(192).save(os.path.join(res_dir, "..", "..", "app", "icon-192.png"))


if __name__ == "__main__":
    main(sys.argv[1])
