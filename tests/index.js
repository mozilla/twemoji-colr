'use strict';

var ComparisonTest = function(codePoints) {
  this.codePoints = codePoints;
  this.string = this.codePointsToString(codePoints);
};

ComparisonTest.prototype = {
  FONT_NAME: 'EmojiOne',
  CANVAS_SIZE: 180,
  // Depend on font -- this is a guess since EmojiOne was not drawn ...
  LINE_HEIGHT: 210,

  run: function() {
    var systemRenderingCanvas = this.getSystemRenderingCanvas();
    var emojiRenderingCanvas = this.getEmojiRenderingCanvas();

    var result = {
      codePoints: this.codePoints,
      string: this.string,
      systemRenderingCanvas: systemRenderingCanvas,
      emojiRenderingCanvas: emojiRenderingCanvas,
      equal: this.canvasEqual(systemRenderingCanvas, emojiRenderingCanvas),
      emojiRenderingEmpty: this.canvasEmpty(emojiRenderingCanvas)
    };

    if (!result.equal) {
      return Promise.resolve(result);
    } else {
      return Promise.reject(result);
    }
  },

  codePointsToString: function(codePoints) {
    var string = String.fromCodePoint.apply(String, codePoints);
    if (codePoints.length === 1 && codePoints[0] < 0xffff) {
      // Force Emoji style w/ VS16
      string += '\ufe0f';
    }

    return string;
  },

  getTextCanvasWithFont: function(fontName) {
    var canvas = document.createElement('canvas', { willReadFrequently: true });
    canvas.width = this.CANVAS_SIZE;
    canvas.height = this.CANVAS_SIZE;

    var ctx = canvas.getContext('2d');
    ctx.font = this.CANVAS_SIZE + 'px ' + fontName;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'center';
    ctx.fillText(this.string, this.CANVAS_SIZE / 2, this.LINE_HEIGHT);

    return canvas;
  },

  getSystemRenderingCanvas: function() {
    return this.getTextCanvasWithFont();
  },

  getEmojiRenderingCanvas: function() {
    return this.getTextCanvasWithFont(this.FONT_NAME);
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
      .getImageData(0, 0, this.CANVAS_SIZE, this.CANVAS_SIZE)
      .data;
  }
};

var TestLoader = function() {
}

TestLoader.prototype = {
  REPORT_LIMIT: 30,

  loadCodePointsData: function() {
    return new Promise(function(resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '../build/codepoints.js', true);
        xhr.responseType = 'json';
        xhr.send();
        xhr.onloadend = function() {
          resolve(xhr.response);
        };
      })
      .then(function(glyphToCodePoints) {
        var codePointsArr = [];
        for (var glyphId in glyphToCodePoints) {
          if (/_layer/.test(glyphId)) {
            continue;
          }

          var codePoints = glyphId.substr(1).split('_')
            .map(function(cpStr) {
              return parseInt(cpStr, 16);
            });

          codePointsArr.push(codePoints);
        }

        return codePointsArr;
      });
  },

  run: function(arr) {
    this.reported = 0;

    var codePointsArrPromise;
    if (!arr) {
      codePointsArrPromise = this.loadCodePointsData();
    } else {
      codePointsArrPromise = Promise.resolve(arr);
    }
    return codePointsArrPromise
      .then(function(codePointsArr) {
        var p = Promise.resolve();

        codePointsArr.forEach(function(codePoints) {
          p = p.then(function() {
            var comparisonTest = new ComparisonTest(codePoints);
            return comparisonTest.run()
              .then(this.reportData.bind(this),
                this.reportData.bind(this));
          }.bind(this));
        }.bind(this));

        return p;
      }.bind(this))
      .then(function() {
        if (this.reported > this.REPORT_LIMIT) {
          alert('Error report was over ' +
            this.REPORT_LIMIT + '; truncated in order to prevent ' +
            'content process from freezing!');
        }
      }.bind(this));
  },

  reportData: function(result) {
    var reportEl = document.createElement('p');
    var span = document.createElement('span');
    span.className = 'title';

    span.textContent =
      result.codePoints.map(function(cp) {
        return 'U+' + cp.toString(16);
      }) + ', ' + result.string +
      ', equal: ' + result.equal +
      ', empty: ' + result.emojiRenderingEmpty;
    reportEl.appendChild(span);
    if (!result.equal && !result.emojiRenderingEmpty) {
      reportEl.classList.add('pass');
    } else {
      reportEl.classList.add('error');

      if (this.reported < this.REPORT_LIMIT) {
        reportEl.appendChild(result.systemRenderingCanvas);
        reportEl.appendChild(result.emojiRenderingCanvas);
        var ref = document.createElement('span');
        ref.className = 'dom-ref';
        ref.textContent = result.string;
        reportEl.appendChild(ref);

        var svgRef = new Image();
        svgRef.src = '../build/colorGlyphs/u' +
          result.codePoints.map(function(cp) {
            var str = cp.toString(16);
            while (str.length < 4) {
              str += '0' + str;
            }
            return str;
          }).join('-') + '.svg';
        svgRef.className = 'svg-ref';
        reportEl.appendChild(svgRef);
      }
    }

    this.reported++;
    document.body.appendChild(reportEl);
  }
};

function start(arr) {
  (new TestLoader())
    .run(arr)
    .catch(function(e) {
      alert('Open JS Console to see error: ' + e.toString());
      console.error(e);
    });
}
