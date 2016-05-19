var fs         = require('fs'),
    rmdir      = require('rmdir'),
    unzip      = require('unzip'),
    xmlbuilder = require('xmlbuilder'),
    xml2js     = require('xml2js');

var sourceZip = process.argv[2];
var targetDir = process.argv[3];
var fontName = process.argv[4];

if (fontName == undefined) {
    console.error("### Missing font name.");
    console.error("### Usage: node " + process.argv[1] + " source-SVGs.zip build-dir font-name");
    return;
}

var components = {};
// maps svg-data -> glyphName

var chars = [];
// unicode -> components[]
//              color
//              glyphName

var ligatures = [];
// [unicode1, unicode2] -> components[]

var colors = [];
var colorToId = {};

var curry = function(f) {
    var parameters = Array.prototype.slice.call(arguments, 1);
    return function() {
        return f.apply(this, parameters.concat(
            Array.prototype.slice.call(arguments, 0)
        ));
    };
};

var addToXML = function(xml, p) {
    if (p["#name"] == "g") {
        var g = xml.ele("g", p['$']);
        if (p['$$']) {
            p['$$'].forEach(curry(addToXML, g));
        }
    } else {
        xml.ele(p["#name"], p['$']);
    }
};

var codepoints = [];

function expandColor(c) {
    if (c.substr(0, 1) == '#' && c.length == 4) {
        c = '#' + c.substr(1, 1) + c.substr(1, 1)
                + c.substr(2, 1) + c.substr(2, 1)
                + c.substr(3, 1) + c.substr(3, 1);
    }
    return c;
}

function hexByte(b) {
    var s = b.toString(16);
    if (s.length < 2) {
        s = "0" + s;
    } else if (s.length > 2) { // shouldn't happen
        s = s.substr(s.length - 2, 2);
    }
    return s;
}

function processFile(fileName, data) {
    // strip svg/ directory prefix and .svg extension off the name
    var baseName = fileName.replace(".svg", "").replace("svg/", "");

    // split name of glyph that corresponds to multi-char ligature
    var unicodes = baseName.split("-");
    if (unicodes.length > 1 && parseInt(unicodes[0], 16) < 0x0080 &&
        (chars.length == 0 || chars[chars.length - 1].unicode != unicodes[0])) {
        // skip colored ligatures for basic ASCII symbols (digits etc) for now
        // (TODO: consider whether we want to to support these)
        console.log("skipping " + fileName);
        return;
    }

    var parser = new xml2js.Parser({preserveChildrenOrder: true,
                                    explicitChildren: true,
                                    explicitArray: true});
    parser.parseString(data, function (err, result) {
        var paths = [];
        var defs = {};
        var urlColor = {};

        var addToPaths = function(defaultColor, elems) {
            elems.forEach(function (e) {
                if (e['#name'] == 'defs') {
                    e['$$'].forEach(function (def) {
                        if (def['#name'] == 'linearGradient') {
                            var stops = [];
                            var id = '#' + def['$']['id'];
                            def['$$'].forEach(function (defChild) {
                                if (defChild['#name'] == "stop") {
                                    stops.push(expandColor(defChild['$']['stop-color']));
                                }
                            });
                            var stopCount = stops.length;
                            var r = 0, g = 0, b = 0;
                            if (stopCount > 0) {
                                stops.forEach(function (stop) {
                                    r = r + parseInt(stop.substr(1, 2), 16);
                                    g = g + parseInt(stop.substr(3, 2), 16);
                                    b = b + parseInt(stop.substr(5, 2), 16);
                                });
                                r = Math.round(r / stopCount);
                                g = Math.round(g / stopCount);
                                b = Math.round(b / stopCount);
                            }
                            var color = "#" + hexByte(r) + hexByte(g) + hexByte(b);
                            urlColor[id] = color;
                        }
                    });
                    return;
                }
                if (e['$'] == undefined) {
                    return;
                }
                var color = e['$']['fill'];
                var strokeColor = e['$']['stroke'];
                if (color == undefined || color == 'none') {
                    color = strokeColor;
                } else if (strokeColor != undefined && strokeColor != 'none' && strokeColor != color) {
                    // TODO: figure out what to do about stroke/fill mismatch
                    console.log('### ' + baseName + ': color mismatch: ' + color + ' != ' + strokeColor);
                } else if (color == undefined || color == 'none') {
                    console.log('### ' + baseName + ': no color: ' + color);
                } else if (color.substr(0, 3) == "url") {
                    var id = color.substr(4, color.length - 5);
                    if (urlColor[id] == undefined) {
                        console.log('### ' + baseName + ': no mapping for ' + color);
                    } else {
                        color = urlColor[id];
                    }
                }
                if (color == '#fff' || color == 'none') {
                    e['$']['fill'] = '#ffffff';
                } else {
                    e['$']['fill'] = '#000000';
                }
                if (color == undefined) {
                    color = defaultColor;
                } else {
                    color = expandColor(color);
                }
                if (e['#name'] == 'g') {
                    if (e['$$'] != undefined) {
                        addToPaths(color, e['$$']);
                    }
                } else {
                    var i = paths.length - 1;
                    if (i >= 0 && paths[i].color == color) {
                        paths[i].paths.push(e);
                    } else {
                        paths.push({color: color, paths: [e]});
                    }
                }
            });
        };

        addToPaths("#000000", result['svg']['$$']);

        var layerIndex = 0;
        var layers = [];
        paths.forEach(function(path) {
            var svg = xmlbuilder.create("svg");
            for (var i in result['svg']['$']) {
                svg.att(i, result['svg']['$'][i]);
            }

            path.paths.forEach(curry(addToXML, svg));
            var svgString = svg.toString();

            // see if there's an already-defined component that matches this shape
            var glyphName = components[svgString];

            // if not, create a new component glyph for this layer
            if (glyphName == undefined) {
                glyphName = baseName + "_layer" + layerIndex;
                components[svgString] = glyphName;
                codepoints.push('"u' + glyphName + '": -1');
                fs.writeFileSync(targetDir + "/glyphs/u" + glyphName + ".svg", svgString);
            }

            // add to the glyph's list of color layers
            layers.push({color: path.color, glyphName: glyphName});

            // if we haven't seen this color before, add it to the palette
            if (colorToId[path.color] == undefined) {
                colorToId[path.color] = colors.length;
                colors.push(path.color);
            }
            layerIndex = layerIndex + 1;
        });

        if (unicodes.length == 1) {
            // simple character (single codepoint)
            chars.push({unicode: unicodes[0], components: layers});
        } else {
            // ligatures: if not a Regional-Indicator pair, insert ZWJ between components
            if (unicodes.length > 2 || (unicodes[1] < 0x1F3FB || unicodes[1] > 0x1F3FF)) {
                unicodes = unicodes.join(",200d,").split(",");
            }
            ligatures.push({unicodes: unicodes, components: layers});
            // create the placeholder glyph for the ligature (to be mapped to a set of color layers)
            fs.writeFileSync(targetDir + "/glyphs/u" + unicodes.join("_") + ".svg",
                             '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" enable-background="new 0 0 64 64"></svg>');
            codepoints.push('"u' + unicodes.join("_") + '": -1');
        }
        unicodes.forEach(function(u) {
            // make sure we have a placeholder glyph for the individual character, or for each component of the ligature
            fs.writeFileSync(targetDir + "/glyphs/u" + u + ".svg",
                             '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" enable-background="new 0 0 64 64"></svg>');
            codepoints.push('"u' + u + '": ' + parseInt(u, 16));
        });
    });
}

var zipReader = fs.createReadStream(sourceZip);

zipReader.on('end', function () {
    // After we've processed all the source SVGs, we'll generate the auxiliary
    // files needed for OpenType font creation.

    var ttFont = xmlbuilder.create("ttFont");
    ttFont.att("sfntVersion", "\\x00\\x01\\x00\\x00");
    ttFont.att("ttLibVersion", "3.0");

    // COLR table records the color layers that make up each colored glyph
    var COLR = ttFont.ele("COLR");
    COLR.ele("version", {value: 0});
    chars.forEach(function(ch) {
        var colorGlyph = COLR.ele("ColorGlyph", {name: "u" + ch.unicode});
        ch.components.forEach(function(cmp) {
            colorGlyph.ele("layer", {colorID: colorToId[cmp.color], name: "u" + cmp.glyphName});
        });
    });
    ligatures.forEach(function(lig) {
        var colorGlyph = COLR.ele("ColorGlyph", {name: "u" + lig.unicodes.join("_")});
        lig.components.forEach(function(cmp) {
            colorGlyph.ele("layer", {colorID: colorToId[cmp.color], name: "u" + cmp.glyphName});
        });
    });

    // CPAL table maps color index values to RGB colors
    var CPAL = ttFont.ele("CPAL");
    CPAL.ele("version", {value: 0});
    CPAL.ele("numPaletteEntries", {value: colors.length});
    var palette = CPAL.ele("palette", {index: 0});
    var index = 0;
    colors.forEach(function(c) {
        if (c.substr(0, 3) == "url") {
            console.log("unexpected color: " + c);
            c = "#000000ff";
        } else {
            c = c + "ff";
        }
        palette.ele("color", {index: index, value: c});
        index = index + 1;
    });

    // GSUB table implements the ligature rules for Regional Indicator pairs and emoji-ZWJ sequences
    var GSUB = ttFont.ele("GSUB");
    GSUB.ele("Version", {value: "1.0"});

    var scriptRecord = GSUB.ele("ScriptList").ele("ScriptRecord", {index: 0});
    scriptRecord.ele("ScriptTag", {value: "DFLT"});

    var defaultLangSys = scriptRecord.ele("Script").ele("DefaultLangSys");
    defaultLangSys.ele("ReqFeatureIndex", {value: 65535});
    defaultLangSys.ele("FeatureIndex", {index: 0, value: 0});

    var featureRecord = GSUB.ele("FeatureList").ele("FeatureRecord", {index: 0});
    featureRecord.ele("FeatureTag", {value: "liga"});
    featureRecord.ele("Feature").ele("LookupListIndex", {index: 0, value: 0});

    var lookup = GSUB.ele("LookupList").ele("Lookup", {index: 0});
    lookup.ele("LookupType", {value: 4});
    lookup.ele("LookupFlag", {value: 0});
    var ligatureSubst = lookup.ele("LigatureSubst", {index: 0, Format: 1});
    var ligatureSets = {};
    var ligatureSetKeys = [];
    ligatures.forEach(function(lig) {
        var startGlyph = "u" + lig.unicodes[0];
        var components = "u" + lig.unicodes.slice(1).join(",u");
        var glyphName = "u" + lig.unicodes.join("_");
        if (ligatureSets[startGlyph] == undefined) {
            ligatureSetKeys.push(startGlyph);
            ligatureSets[startGlyph] = [];
        }
        ligatureSets[startGlyph].push({components: components, glyph: glyphName});
    });
    ligatureSetKeys.sort();
    ligatureSetKeys.forEach(function(glyph) {
        var ligatureSet = ligatureSubst.ele("LigatureSet", {glyph: glyph});
        var set = ligatureSets[glyph];
        set.forEach(function(lig) {
            ligatureSet.ele("Ligature", {components: lig.components, glyph: lig.glyph});
        });
    });

    var ttx = fs.createWriteStream(targetDir + "/" + fontName + ".ttx");
    ttx.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    ttx.write(ttFont.toString());
    ttx.end();

    // Write out the codepoints file to control character code assignments by grunt-webfont
    fs.writeFileSync(targetDir + "/codepoints.js", "{\n" + codepoints.join(",\n") + "\n}\n");
});

// Delete and re-create target directory, to remove any pre-existing junk
rmdir(targetDir, function() {
    fs.mkdirSync(targetDir);
    fs.mkdirSync(targetDir + "/glyphs");

    // Finally, we're ready to process the images from the source archive:
    zipReader.pipe(unzip.Parse()).on('entry', function (e) {
        var data = "";
        var fileName = e.path;
        if (e.type == 'File') {
            e.on("data", function (c) {
                data += c.toString();
            });
            e.on("end", function () {
                processFile(fileName, data);
            });
        } else {
            e.autodrain();
        }
    });
});
