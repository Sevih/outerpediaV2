"""Extract individual atlas tiles for both 4x4 (Dungeon bubbles) and 8x8
(stars) layouts so we can visually verify which tiles contain the actual
bubble/star sprites."""
from PIL import Image
import os

ATLAS = 'public/images/fx/T_FX_Atlas_01.png'
OUT_DIR = 'tmp/atlas_tiles'
os.makedirs(OUT_DIR, exist_ok=True)

img = Image.open(ATLAS)
W, H = img.size

for tilesX, tilesY, prefix in [(4, 4, 'b4x4'), (8, 8, 's8x8')]:
    tw, th = W // tilesX, H // tilesY
    for ty in range(tilesY):
        for tx in range(tilesX):
            box = (tx * tw, ty * th, (tx + 1) * tw, (ty + 1) * th)
            tile = img.crop(box)
            # Skip fully transparent tiles
            alpha = tile.split()[-1]
            extrema = alpha.getextrema()
            if extrema[1] == 0:
                continue
            # Frame index in Unity convention "frame 0 = bottom-left, going right then up"
            # For a tile at PNG (tx, ty) — PNG ty=0 is TOP. After flipY in Three.js,
            # this becomes UV row (tilesY - 1 - ty) from bottom. Frame at this UV row
            # = (tilesY - 1 - ty) × tilesX + tx.
            uv_row_from_bottom = tilesY - 1 - ty
            unity_frame = uv_row_from_bottom * tilesX + tx
            out = os.path.join(OUT_DIR, f'{prefix}_png_t{tx}-{ty}_unity_f{unity_frame}_a{extrema[1]:03d}.png')
            tile.save(out)

# List
files = sorted(os.listdir(OUT_DIR))
for f in files:
    print(f)
