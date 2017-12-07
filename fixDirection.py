import fontforge
import sys
import psMat
import math

fontfile = sys.argv[1]

f = fontforge.open(fontfile)
flip = psMat.scale(1.25,-1.25)
align = psMat.translate(0,600)

for glyph in f.glyphs():
    glyph.transform(flip)
    glyph.transform(align)
    glyph.correctDirection()

f.generate(fontfile)
