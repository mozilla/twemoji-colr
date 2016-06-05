'use strict';

var LayerInfoService = {
  // path relative to ./tests/
  URL: '../build/layer_info.json',
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
      .then(function(layerInfo) {
        this.codePointsArr = [];
        this.map = new Map();

        if (!layerInfo) {
          throw new Error(
            'LayerInfoService: Failed to load glyph layer information.');
          return;
        }
        for (var cp in layerInfo) {
          var codePoints = cp
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

          this.map.set(codePointsStr, {
            layers: layerInfo[cp].length,
            fileNames: layerInfo[cp]
          });

          this.codePointsArr.push(codePoints);
        }
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
  exports.LayerInfoService = LayerInfoService;
}
