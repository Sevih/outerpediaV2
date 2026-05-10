"""Determine the *actual* sprite cell size in the atlas by comparing pixels
between adjacent 128-px cells. If each 256-px sprite was duplicated into 4
sub-cells of 128 px, all 4 sub-cells should be pixel-identical."""
from PIL import Image, ImageChops

img = Image.open('public/images/fx/T_FX_Atlas_01.png')
W, H = img.size
print(f'Atlas {W}x{H}')


def cells_identical(box1, box2):
    a = img.crop(box1)
    b = img.crop(box2)
    diff = ImageChops.difference(a, b)
    return diff.getbbox() is None  # None = perfectly identical


# Compare pairs of 128×128 cells assumed to be sub-cells of one 256×256 sprite.
# If sprites are 256×256, then cells (2tx, 2ty) and (2tx+1, 2ty) should match
# (left vs right within same sprite). Same for (2tx, 2ty) vs (2tx, 2ty+1).
print('\nFor 8x8 grid, check if 2x2 sub-cells of each 256×256 sprite are identical:')
for big_y in range(4):
    for big_x in range(4):
        # 4 sub-cells of this 256×256 sprite, in 8×8 indexing:
        sub_x = big_x * 2
        sub_y = big_y * 2
        cells = [
            (sub_x * 128, sub_y * 128, (sub_x + 1) * 128, (sub_y + 1) * 128),       # TL
            ((sub_x + 1) * 128, sub_y * 128, (sub_x + 2) * 128, (sub_y + 1) * 128), # TR
            (sub_x * 128, (sub_y + 1) * 128, (sub_x + 1) * 128, (sub_y + 2) * 128), # BL
            ((sub_x + 1) * 128, (sub_y + 1) * 128, (sub_x + 2) * 128, (sub_y + 2) * 128),# BR
        ]
        tl_tr = cells_identical(cells[0], cells[1])
        tl_bl = cells_identical(cells[0], cells[2])
        tl_br = cells_identical(cells[0], cells[3])
        print(f'  Sprite ({big_x},{big_y}): TL=TR={tl_tr} TL=BL={tl_bl} TL=BR={tl_br}')

# If sub-cells are NOT identical, the sprite truly is 128×128 (full 8×8 grid)
# and the user's "quarter circles" must come from somewhere else.
print('\nQuick visual: print whether each 256x256 sprite area contains "circle-ish" content')
print('by checking if alpha forms a roughly circular blob (high in middle, low at corners).')
for big_y in range(4):
    for big_x in range(4):
        box = (big_x * 256, big_y * 256, (big_x + 1) * 256, (big_y + 1) * 256)
        cell = img.crop(box)
        alpha = cell.split()[-1]
        # Center vs corners
        center = alpha.getpixel((128, 128))
        corners = [alpha.getpixel((0, 0)), alpha.getpixel((255, 0)), alpha.getpixel((0, 255)), alpha.getpixel((255, 255))]
        avg_corner = sum(corners) // 4
        is_circle = center > 50 and avg_corner < 20
        print(f'  Sprite ({big_x},{big_y}) 256x256: center_a={center:3d} avg_corner_a={avg_corner:3d} {"CIRCLE-ISH" if is_circle else ""}')
