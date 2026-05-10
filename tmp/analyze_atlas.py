"""Verify the actual sprite layout of T_FX_Atlas_01: do sprites fit within
4x4 / 8x8 cells, or do they span multiple cells? Compute alpha fill ratio
per cell at multiple grid resolutions to disambiguate."""
from PIL import Image

img = Image.open('public/images/fx/T_FX_Atlas_01.png')
W, H = img.size
print(f'Atlas {W}x{H} {img.mode}')


def count_visible(box):
    sub = img.crop(box)
    alpha = list(sub.split()[-1].getdata())
    return sum(1 for a in alpha if a > 16), len(alpha)


def analyze_grid(tilesX, tilesY):
    tw, th = W // tilesX, H // tilesY
    print(f'\n--- Grid {tilesX}x{tilesY} (cell {tw}x{th}) ---')
    for ty in range(tilesY):
        row = []
        for tx in range(tilesX):
            box = (tx * tw, ty * th, (tx + 1) * tw, (ty + 1) * th)
            visible, total = count_visible(box)
            pct = visible * 100 // total
            row.append(f'{pct:3d}%')
        print(f'  PNG row {ty}: ' + ' '.join(row))


for n in [2, 4, 8]:
    analyze_grid(n, n)
