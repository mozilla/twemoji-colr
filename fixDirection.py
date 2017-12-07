import fontforge
import sys
import psMat
import math

fontfile = sys.argv[1]

f = fontforge.open(fontfile)
rotate = psMat.rotate(math.radians(180))
reverse = psMat.scale(-1)

for glyph in f.glyphs():
#    glyph.transform(rotate)
    glyph.transform(reverse)
    glyph.correctDirection()

f.generate(fontfile)
