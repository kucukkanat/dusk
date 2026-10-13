"""Generate iOS launch images (apple-touch-startup-image) for Dusk.

Run: python3 scripts/splash.py  — writes public/splash/*.png and prints the <link> tags for index.html.
"""
from pathlib import Path
from PIL import Image, ImageDraw

# (css width, css height, device pixel ratio), portrait
DEVICES = [
    (440, 956, 3), (402, 874, 3), (420, 912, 3), (430, 932, 3), (393, 852, 3), (428, 926, 3), (390, 844, 3),
    (375, 812, 3), (414, 896, 3), (414, 896, 2), (414, 736, 3), (375, 667, 2), (320, 568, 2),
    (1032, 1376, 2), (834, 1210, 2), (1024, 1366, 2), (834, 1194, 2), (820, 1180, 2), (834, 1112, 2), (810, 1080, 2), (768, 1024, 2), (744, 1133, 2),
]
THEMES = {"dark": "#14151a", "light": "#f2f0ea"}
BANDS = [(0.0, "#bcaedb"), (0.46, "#efb99c"), (0.62, "#9cc6c2")]
OUT = Path(__file__).resolve().parent.parent / "public" / "splash"


def disc(d: int) -> Image.Image:
    ss = 4
    big = Image.new("RGBA", (d * ss, d * ss))
    draw = ImageDraw.Draw(big)
    for i, (start, color) in enumerate(BANDS):
        end = BANDS[i + 1][0] if i + 1 < len(BANDS) else 1.0
        draw.rectangle([0, round(start * d * ss), d * ss, round(end * d * ss)], fill=color)
    mask = Image.new("L", big.size, 0)
    ImageDraw.Draw(mask).ellipse([0, 0, d * ss - 1, d * ss - 1], fill=255)
    big.putalpha(mask)
    return big.resize((d, d), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
links = []
for w, h, r in DEVICES:
    logo = disc(96 * r)
    for theme, bg in THEMES.items():
        name = f"{theme}-{w * r}x{h * r}.png"
        img = Image.new("RGB", (w * r, h * r), bg)
        img.paste(logo, ((w * r - logo.width) // 2, (h * r - logo.height) // 2), logo)
        img.save(OUT / name, optimize=True)
        links.append(
            f'<link rel="apple-touch-startup-image" href="./splash/{name}" media="(device-width: {w}px) and (device-height: {h}px) '
            f'and (-webkit-device-pixel-ratio: {r}) and (orientation: portrait) and (prefers-color-scheme: {theme})">'
        )
print("\n".join(links))
