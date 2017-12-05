import fontforge
import sys
import psMat

fontfile = sys.argv[1]

f = fontforge.open(fontfile)
identity = psMat.identity()
matrix = psMat.inverse(identity)

for glyph in f.glyphs():
    glyph.transform(matrix)

f.generate(fontfile)
