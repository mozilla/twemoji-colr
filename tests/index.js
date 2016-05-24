'use strict';

var ComparisonTest = function(codePoints) {
  this.codePoints = codePoints;
  this.string = this.codePointsToString(codePoints);
};

ComparisonTest.prototype = {
  FONT_NAME: 'EmojiOne',
  CANVAS_SIZE: 640,
  SVG_SIZE: 64,
  LINE_HEIGHT: 640,

  run: function() {
    return Promise.all([
        this.getSystemRenderingCanvas(),
        this.getEmojiRenderingCanvas(),
        this.getSVGRenderingCanvas()
      ])
      .then(function(values) {
        var systemRenderingCanvas = values[0];
        var emojiRenderingCanvas = values[1];
        var svgRenderingCanvas = values[2];

        var svgDiff =
          this.imageCompare(svgRenderingCanvas, emojiRenderingCanvas);

        values.push(svgDiff);
        return Promise.all(values);
      }.bind(this))
      .then(function(values) {
        var systemRenderingCanvas = values[0];
        var emojiRenderingCanvas = values[1];
        var svgRenderingCanvas = values[2];
        var svgDiff = values[3];

        var result = {
          codePoints: this.codePoints,
          string: this.string,
          systemRenderingCanvas: systemRenderingCanvas,
          emojiRenderingCanvas: emojiRenderingCanvas,
          svgRenderingCanvas: svgRenderingCanvas,
          svgRenderingDiffImg: svgDiff.img,
          isEqualToSystem:
            this.canvasEqual(systemRenderingCanvas, emojiRenderingCanvas),
          svgRenderingMisMatchPercentage: svgDiff.misMatchPercentage,
          emojiRenderingEmpty: this.canvasEmpty(emojiRenderingCanvas),
          svgRenderingEmpty: this.canvasEmpty(svgRenderingCanvas)
        };

        return result;
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

  getCanvas: function() {
    var canvas = document.createElement('canvas', { willReadFrequently: true });
    canvas.width = this.CANVAS_SIZE;
    canvas.height = this.CANVAS_SIZE;

    return canvas;
  },

  getTextCanvasWithFont: function(fontName) {
    var canvas = this.getCanvas();
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

  getSVGRenderingCanvas: function() {
    var svgUrl = '../build/colorGlyphs/u' +
      this.codePoints.filter(function(cp) {
        // Remove zero width joiner.
        return cp !== 0x200d;
      })
      .map(function(cp) {
        var str = cp.toString(16);
        while (str.length < 4) {
          str = '0' + str;
        }
        return str;
      }).join('-') + '.svg';
    return new Promise(function(resolve) {
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
        svgText = '<svg width="' +
          this.SVG_SIZE + 'px" height="' +
          this.SVG_SIZE + 'px" ' +
          svgText.substr(5);
        return 'data:image/svg+xml,' + encodeURIComponent(svgText);
      }.bind(this))
      .then(function(svgDataUrl) {
        if (!svgDataUrl) {
          return;
        }

        return new Promise(function(resolve) {
          var svgImg = new Image();
          svgImg.src = svgDataUrl;
          svgImg.onload = function() {
            resolve(svgImg);
          };
        }.bind(this));
      }.bind(this))
      .then(function(img) {
        var canvas = this.getCanvas();
        if (img) {
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, this.SVG_SIZE, this.SVG_SIZE,
            0, 0, this.CANVAS_SIZE, this.CANVAS_SIZE);
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
          resemble(blobs[0])
            .compareTo(blobs[1])
            .ignoreAntialiasing()
            .onComplete(resolve);
        });
      })
      .then(function(resambleDiffData) {
        var img = new Image();
        img.src = resambleDiffData.getImageDataUrl();

        return {
          misMatchPercentage: resambleDiffData.rawMisMatchPercentage,
          img: img
        }
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
      .getImageData(0, 0, this.CANVAS_SIZE, this.CANVAS_SIZE)
      .data;
  }
};

var TestLoader = function() {
  this.clickableTitleElToResult = new WeakMap();
}

TestLoader.prototype = {
  AUTOEXPEND_REPORTS_LIMIT: 30,

  // In precentage
  MISMATCH_THRESHOLD: 2,

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
    this.expendedReports = 0;

    var codePointsArrPromise;
    if (!arr) {
      codePointsArrPromise = this.loadCodePointsData();
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
              .then(this.reportData.bind(this));
          }.bind(this));
        }.bind(this));

        return p;
      }.bind(this))
      .then(function() {
        if (this.expendedReports > this.AUTOEXPEND_REPORTS_LIMIT) {
          alert('Some report was not expended, in order to prevent ' +
            'content process from freezing!');
        }
      }.bind(this));
  },

  handleEvent: function(evt) {
    evt.target.removeEventListener('click', this);
    evt.target.classList.remove('clickable');
    var result = this.clickableTitleElToResult.get(evt.target);

    this.appendReportDOM(evt.target.parentNode, result);
  },

  reportData: function(result) {
    var reportEl = document.createElement('p');
    var reportTitleEl = document.createElement('span');
    reportTitleEl.className = 'title';

    reportTitleEl.textContent =
      result.codePoints.map(function(cp) {
        var str = cp.toString(16);
        while (str.length < 4) {
          str = '0' + str;
        }
        return 'U+' + str;
      }).join(' ') + ', ' + result.string +
      ', mismatch: ' + result.svgRenderingMisMatchPercentage.toFixed(2) + '%' +
      ', webfont: ' + !result.isEqualToSystem +
      ', rendering: ' + !result.emojiRenderingEmpty +
      ', reference: ' + !result.svgRenderingEmpty;
    reportEl.appendChild(reportTitleEl);

    var pass = (result.svgRenderingMisMatchPercentage < this.MISMATCH_THRESHOLD) &&
      !result.isEqualToSystem &&
      !result.emojiRenderingEmpty &&
      !result.svgRenderingEmpty;

    if (pass) {
      reportEl.classList.add('pass');
    } else {
      reportEl.classList.add('error');
    }

    if (!pass && this.expendedReports <= this.AUTOEXPEND_REPORTS_LIMIT) {
      this.appendReportDOM(reportEl, result);
      this.expendedReports++;
    } else {
      reportTitleEl.addEventListener('click', this);
      reportTitleEl.classList.add('clickable');
      this.clickableTitleElToResult.set(reportTitleEl, result);
    }

    document.body.appendChild(reportEl);
  },

  appendReportDOM: function(reportEl, result) {
    reportEl.appendChild(result.systemRenderingCanvas);
    result.systemRenderingCanvas.title = 'System font rendering on canvas.';
    reportEl.appendChild(result.emojiRenderingCanvas);
    result.emojiRenderingCanvas.title = 'EmojiOne font rendering on canvas.';
    reportEl.appendChild(result.svgRenderingCanvas);
    result.svgRenderingCanvas.title = 'Source SVG rendering on canvas.';
    reportEl.appendChild(result.svgRenderingDiffImg);
    result.svgRenderingDiffImg.title =
      'Diff between source SVG and font rendering on canvas.';
    var ref = document.createElement('span');
    ref.className = 'dom-ref';
    ref.textContent = result.string;
    ref.title = 'EmojiOne HTML rendering.';
    reportEl.appendChild(ref);
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
