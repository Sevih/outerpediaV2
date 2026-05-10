"""Generate a debug image of T_FX_Atlas_01 with the 8×8 grid overlaid and
each tile labelled with both its PNG-row index and its Unity bottom-up
frame number, so we can visually identify which frames contain stars."""
from PIL import Image, ImageDraw, ImageFont

img = Image.open('public/images/fx/T_FX_Atlas_01.png').convert('RGBA')
W, H = img.size

# Composite onto a dark background so transparent areas are clearly empty.
bg = Image.new('RGBA', (W, H), (40, 40, 40, 255))
bg.alpha_composite(img)
out = bg.copy()
draw = ImageDraw.Draw(out)

# Grid 8×8 with frame numbers (Unity bottom-up convention: frame 0 at bottom-left)
TILES = 8
cw, ch = W // TILES, H // TILES
font = None
try:
    font = ImageFont.truetype('arial.ttf', 28)
except Exception:
    font = ImageFont.load_default()

for png_row in range(TILES):
    for png_col in range(TILES):
        x0, y0 = png_col * cw, png_row * ch
        x1, y1 = x0 + cw, y0 + ch
        # Yellow grid lines
        draw.rectangle([x0, y0, x1, y1], outline=(255, 230, 0, 255), width=2)
        # Unity bottom-up frame: bottom row is frame 0..7, top row is frame 56..63
        # PNG row 0 = top of file = UV row tilesY-1 = bottom-up frame_y = TILES-1
        unity_frame_y = TILES - 1 - png_row
        unity_frame = unity_frame_y * TILES + png_col
        label = f'#{unity_frame}\n({png_col},{png_row})'
        draw.multiline_text((x0 + 8, y0 + 8), label, fill=(255, 255, 255, 255), font=font)

out_path = 'public/images/fx/_debug_atlas_8x8.png'
out.save(out_path)
print(f'Wrote {out_path}')

# Also do 4×4 grid
out4 = bg.copy()
draw = ImageDraw.Draw(out4)
TILES = 4
cw, ch = W // TILES, H // TILES
for png_row in range(TILES):
    for png_col in range(TILES):
        x0, y0 = png_col * cw, png_row * ch
        x1, y1 = x0 + cw, y0 + ch
        draw.rectangle([x0, y0, x1, y1], outline=(0, 255, 200, 255), width=3)
        unity_frame_y = TILES - 1 - png_row
        unity_frame = unity_frame_y * TILES + png_col
        label = f'#{unity_frame}\n({png_col},{png_row})'
        draw.multiline_text((x0 + 16, y0 + 16), label, fill=(255, 255, 255, 255), font=font)

out_path4 = 'public/images/fx/_debug_atlas_4x4.png'
out4.save(out_path4)
print(f'Wrote {out_path4}')
