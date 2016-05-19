# emojione-colr

Project to create a COLR/CPAL-based color OpenType font
from the [EmojiOne](http://emojione.com) collection of emoji images.

Note that the resulting font will **only** be useful on systems that support
layered color TrueType fonts; this includes Windows 8.1 and later,
as well as Mozilla Firefox and other Gecko-based applications running on
any platform.

Systems that do not support such color fonts will show blank glyphs
if they try to use this font.

## Getting started

This project makes use of [grunt-webfont](https://github.com/sapegin/grunt-webfont)
and an additional [node.js](https://nodejs.org/en/) script.
Therefore, installation of Node.js (and its package manager [npm](https://www.npmjs.com/))
is a prerequisite, as is the [Grunt](http://gruntjs.com/) task runner.

The necessary tools can be installed via npm:

    # install the Grunt command processor (if you don't already have it)
    npm install grunt-cli
    
    # install grunt project dependencies from packages.json
    npm install
    
    # additional modules needed by the layerize.js script
    npm install rmdir unzip xmlbuilder

After initially cloning the repository, you will also need to run:

    git submodule init
    git submodule update

to set up and clone the grunt-webfont submodule.

The build process also requires [fontforge](https://fontforge.github.io/)
and the TTX script from the [font-tools](https://github.com/behdad/fonttools/) package
to be installed.

## Building the font

Once the necessary build tools are all in place, simply running

    make

should build the color-emoji font `build/EmojiOne.ttf` from the source SVG files
found in `e1-svg.zip`.
