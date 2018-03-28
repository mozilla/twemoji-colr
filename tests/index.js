'use strict';

var LayerInfoService = {
  URL: '../build/layer_info.json',
  codePointsArr: null,
  map: null,

  _initPromise: null,
  init: function() {
    var p = new Promise(function(resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', this.URL, true);
        xhr.responseType = 'json';
        xhr.send();
        xhr.onloadend = function() {
          resolve(xhr.response);
        };
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

var ComparisonTest = function(codePoints) {
  this.codePoints = codePoints;
  this.string = this.codePointsToString(codePoints);
  this.retested = false;
};

ComparisonTest.prototype = {
  FONT_NAME: 'Twemoji Mozilla',
  CANVAS_SIZE: 480,
  SVG_SIZE: 64,

  // To reduce false negative while maintain test speed,
  // only re-test stuff when the mismatch is between these thresholds.
  RETEST_THRESHOLD: 1,
  RETEST_UPPER_THRESHOLD: 4,
  // XXX: Bigger canvas size will shifts Twemoji rendering position on
  // Ubuntu for unknown reasons.
  RETEST_CANVAS_SIZE: 960,

  run: function() {
    return Promise.all([
        this.runCanvases()
          .then(this.runSVGImageCompare.bind(this))
          .then(this.runCanvasesCompare.bind(this)),
        this.runGetLayerInfo()
      ])
      .then(function() {
        return this;
      }.bind(this));
  },

  runCanvases: function() {
    return Promise.all([
        this.getSystemRenderingCanvas(),
        this.getEmojiRenderingCanvas(),
        this.getSVGRenderingCanvas()
      ])
      .then(function(values) {
        this.systemRenderingCanvas = values[0];
        this.emojiRenderingCanvas = values[1];
        this.svgRenderingCanvas = values[2];
      }.bind(this));
  },

  runSVGImageCompare: function() {
    return this.imageCompare(this.svgRenderingCanvas, this.emojiRenderingCanvas)
      .then(function(resambleDiffData) {
        var mismatch = resambleDiffData.rawMisMatchPercentage;
        if (mismatch > this.RETEST_THRESHOLD &&
          mismatch < this.RETEST_UPPER_THRESHOLD) {
            this.retested = true;
            return Promise.all([
                this.getSystemRenderingCanvas(this.RETEST_CANVAS_SIZE),
                this.getEmojiRenderingCanvas(this.RETEST_CANVAS_SIZE),
                this.getSVGRenderingCanvas(this.RETEST_CANVAS_SIZE)
              ])
              .then(function(values) {
                this.systemRenderingCanvas = values[0];
                this.emojiRenderingCanvas = values[1];
                this.svgRenderingCanvas = values[2];
              }.bind(this))
              .then(function() {
                return this.imageCompare(this.svgRenderingCanvas,
                  this.emojiRenderingCanvas);
              }.bind(this));
          }

          return resambleDiffData;
      }.bind(this))
      .then(function(resambleDiffData) {
        this.diffData = resambleDiffData;
      }.bind(this));
  },

  runCanvasesCompare: function() {
    this.isEqualToSystem = this.canvasEqual(
      this.systemRenderingCanvas, this.emojiRenderingCanvas);
    this.emojiRenderingEmpty =
      this.canvasEmpty(this.emojiRenderingCanvas);
    this.svgRenderingEmpty =
      this.canvasEmpty(this.svgRenderingCanvas);
  },

  runGetLayerInfo: function() {
    return LayerInfoService.getInfo(this.codePoints)
      .then(function(layerInfo) {
        this.layerInfo = layerInfo;
      }.bind(this));
  },

  codePointsToString: function(codePoints) {
    var string = String.fromCodePoint.apply(String, codePoints);
    if (codePoints.length === 1 && codePoints[0] < 0xffff) {
      // Force Emoji style w/ VS16
      string += '\ufe0f';
    }

    return string;
  },

  getEmptyCanvas: function(size) {
    size = size || this.CANVAS_SIZE;
    var canvas = document.createElement('canvas', { willReadFrequently: true });
    canvas.width = size;
    canvas.height = size;

    return canvas;
  },

  getTextCanvasWithFont: function(fontName, size) {
    size = size || this.CANVAS_SIZE;
    var canvas = this.getEmptyCanvas(size);
    var ctx = canvas.getContext('2d');
    ctx.font = size + 'px ' + fontName;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'center';
    ctx.fillText(this.string, size / 2, size);

    return canvas;
  },

  getSystemRenderingCanvas: function(size) {
    return this.getTextCanvasWithFont(undefined, size);
  },

  getEmojiRenderingCanvas: function(size) {
    return this.getTextCanvasWithFont(this.FONT_NAME, size);
  },

  getSVGRawImg: function() {
    if (this.svgRawImgPromise) {
      return this.svgRawImgPromise;
    }
    
    var prevCp;
    var beforePrevCp;
    var codePointsArray = this.codePoints;
    var cpEnd = codePointsArray.length - 1;

    var svgUrl = this.svgUrl = '../build/colorGlyphs/u' +
      this.codePoints.map(function(cp) {
        var str = cp.toString(16);
        return str;
      }).join('-') + '.svg';

    var domParser = new DOMParser();

    var p = this.svgRawImgPromise = new Promise(function(resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', svgUrl, true);
        xhr.responseType = 'text';
        xhr.send();
        xhr.onloadend = function() {
          resolve(xhr.response);
        };
      })
      .then(function(svgText) {
        
        if (svgText.substr(0, 5) !== '<svg ') {
          return;
        }

        // Gecko bug 700533. I love my job.
        var doc = domParser.parseFromString(svgText, 'image/svg+xml');
        var hasWidth = !!doc.rootElement.getAttribute('width');
        if (!hasWidth) {
          doc.rootElement.setAttribute('width', this.SVG_SIZE);
          doc.rootElement.setAttribute('height', this.SVG_SIZE);
          svgText = doc.rootElement.outerHTML;
        }
        return 'data:image/svg+xml,' + encodeURIComponent(svgText);
      }.bind(this))
      .then(function(svgDataUrl) {
        
        if (!svgDataUrl) {
          return;
        }

        this.svgDataUrl = svgDataUrl;

        return new Promise(function(resolve) {
          var svgImg = new Image();
          svgImg.src = svgDataUrl;
          svgImg.onload = function() {
            resolve(svgImg);
          };
        }.bind(this));
      }.bind(this));

    return p;
  },

  getSVGRenderingCanvas: function(size) {
    size = size || this.CANVAS_SIZE;
    return this.getSVGRawImg()
      .then(function(img) {
        var canvas = this.getEmptyCanvas(size);
        if (img) {
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, this.SVG_SIZE, this.SVG_SIZE,
            0, 0, size, size);
        }

        return canvas;
      }.bind(this));
  },

  canvasEqual: function(aCanvas, bCanvas) {
    var aImageDataArr = this.getImageDataArray(aCanvas);
    var bImageDataArr = this.getImageDataArray(bCanvas);

    for (var i = 0; i < aImageDataArr.length; i++) {
      if (aImageDataArr[i] !== bImageDataArr[i]) {
        return false;
      }
    }

    return true;
  },

  imageCompare: function(aCanvas, bCanvas) {
    return Promise.all([
        new Promise(function(res) { aCanvas.toBlob(res) }),
        new Promise(function(res) { bCanvas.toBlob(res) })
      ])
      .then(function(blobs) {
        return new Promise(function(resolve) {
          var options = {
            output: {
              errorColor: {
                red: 255,
                green: 0,
                blue: 255
              },
              largeImageThreshold: 0,
              outputDiff: true
            }
          };
          resemble(blobs[0])
            .compareTo(blobs[1])
            .ignoreAntialiasing()
            .onComplete(resolve);
        });
      });
  },

  canvasEmpty: function(canvas) {
    var imageDataArr = this.getImageDataArray(canvas);

    for (var i = 0; i < imageDataArr.length; i++) {
      if (imageDataArr[i]) {
        return false;
      }
    }

    return true;
  },

  getImageDataArray: function(canvas) {
    return canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height)
      .data;
  }
};

var TestLoader = function() {
}

TestLoader.prototype = {
  run: function(arr) {
    this.testRunReport = new TestRunReport();
    document.body.appendChild(this.testRunReport.render());

    var codePointsArrPromise;
    if (!arr) {
      codePointsArrPromise = LayerInfoService.getCodePointsArr();
    } else {
      codePointsArrPromise = Promise.resolve(arr);
    }
    return codePointsArrPromise
      .then(function(codePointsArr) {
        var p = Promise.resolve();

        codePointsArr.forEach(function(codePoints, i) {
          p = p.then(function() {
            var comparisonTest = new ComparisonTest(codePoints);
            return comparisonTest.run()
              .then(this.testRunReport.appendResult.bind(this.testRunReport));
          }.bind(this));
        }.bind(this));

        return p;
      }.bind(this))
      .then(function() {
        this.testRunReport.reportFinish();
      }.bind(this),
      function(e) {
        this.testRunReport.reportFinish();
        throw e;
      }.bind(this));
  }
};

function start(arr) {
  if (typeof arr === 'string') {
    arr = arr.split(',').map(function(str) {
      return str.split(' ')
        .map(function(numStr) {
          return numStr = numStr.trim();
        })
        .filter(function(numStr) {
          return (numStr !== '');
        })
        .map(function(numStr) {
        if (numStr.substr(0, 2) === 'U+') {
          numStr = numStr.substr(2);
        }
        return parseInt(numStr, 16);
      });
    });
  }

  (new TestLoader())
    .run(arr)
    .catch(function(e) {
      alert(e.toString() + '\n\n' + e.stack);
      console.error(e);
    });
}

function changeHashAndStart(str) {
  var hashStr = decodeURIComponent(document.location.hash.substr(1));
  if (str === hashStr) {
    start(str);
  } else {
    // trigger a hashchange
    document.location.hash = '#' + str;
  }
}

if (document.location.hash) {
  document.getElementById('codepoints').value =
    decodeURIComponent(document.location.hash.substr(1));
}
window.addEventListener('hashchange', function() {
  var str = decodeURIComponent(document.location.hash.substr(1));
  if (str) {
    start(str);
  }
});

document.body.classList.toggle('hide-passed',
  document.getElementById('hide-passed').checked);
