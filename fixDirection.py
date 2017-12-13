import fontforge
import sys
import psMat
import math

fontfile = sys.argv[1]

f = fontforge.open(fontfile)

for glyph in f.glyphs():
    glyph.correctDirection()

f.generate(fontfile)
