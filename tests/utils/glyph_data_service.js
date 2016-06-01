'use strict';

var GlyphDataService = {
  // path relative to ./tests/
  URL: '../build/codepoints.js',
  codePointsArr: null,
  map: null,

  _initPromise: null,
  init: function() {
    var p = new Promise(function(resolve) {
        if (typeof XMLHttpRequest === 'function') {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', this.URL, true);
          xhr.responseType = 'json';
          xhr.send();
          xhr.onloadend = function() {
            resolve(xhr.response);
          };
        } else {
          // Assume running in Node.js
          var path = require('path');
          var fs = require('fs');
          var filePath = path.join(__dirname, '..', this.URL);

          resolve(JSON.parse(fs.readFileSync(filePath)));
        }
      }.bind(this))
      .then(function(glyphToCodePoints) {
        this.codePointsArr = [];
        this.map = new Map();

        var zwjCodePointsStrArr = [];

        if (!glyphToCodePoints) {
          throw new Error(
            'EmojiInfoService: Failed to load glyph information.');
          return;
        }
        for (var glyphId in glyphToCodePoints) {
          var codePoints = glyphId
            .replace(/_layer\d+$/, '')
            .substr(1)
            .split(/[\-_]/)
            .map(function(cpStr) {
              return parseInt(cpStr, 16);
            });
          var codePointsStr = codePoints.map(function(cp) {
            var str = cp.toString(16).toUpperCase();
            while (str.length < 4) {
              str = '0' + str;
            }
            return 'U+' + str;
          }).join(' ');

          var info = this.map.get(codePointsStr);
          if (!info) {
            this.map.set(codePointsStr, {
              layers: 1,
              fileNames: [glyphId]
            });
          } else {
            info.layers++;
            info.fileNames.push(glyphId);
          }

          if (!/_layer/.test(glyphId)) {
            this.codePointsArr.push(codePoints);

            if (codePoints.length > 1 &&
                codePoints.indexOf(0x200d) !== -1) {
              zwjCodePointsStrArr.push(codePointsStr);
            }
          }
        }

        zwjCodePointsStrArr.forEach(function(codePointsStr) {
          // Merge the two layer info collected.
          var noZWJInfo = this.map.get(codePointsStr.replace(/ U\+200D/g, ''));
          var zwjInfo = this.map.get(codePointsStr);
          zwjInfo.layers += noZWJInfo.layers;
          zwjInfo.fileNames = noZWJInfo.fileNames.concat(zwjInfo.fileNames);
          this.map.delete(codePointsStr.replace(/ U\+200D/g, ''));
        }.bind(this));
      }.bind(this));

    this._initPromise = p;
    return p;
  },

  getCodePointsArr: function() {
    var p = Promise.resolve();
    if (!this.codePointsArr) {
      p = this.init();
    }
    return p.then(function() {
      return this.codePointsArr;
    }.bind(this));
  },

  getInfo: function(codePoints) {
    var p = Promise.resolve();
    if (!this.map) {
      p = this.init();
    }
    return p.then(function() {
      var codePointsStr = codePoints.map(function(cp) {
        var str = cp.toString(16).toUpperCase();
        while (str.length < 4) {
          str = '0' + str;
        }
        return 'U+' + str;
      }).join(' ');

      return this.map.get(codePointsStr);
    }.bind(this));
  }
};

if (typeof exports === 'object') {
  exports.GlyphDataService = GlyphDataService;
}
