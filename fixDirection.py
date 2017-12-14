import fontforge
import sys
import psMat
import math

fontfile = sys.argv[1]

f = fontforge.open(fontfile)

flip = psMat.scale(1,-1)		
align = psMat.translate(0,500)

for glyph in f.glyphs():
    glyph.transform(flip)
    glyph.transform(align)
    glyph.correctDirection()

f.generate(fontfile)
