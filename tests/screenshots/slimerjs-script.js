'use strict';

var system = require('system');
var webpage = require('webpage');
var fs = require('fs');

var ScreenshotSlimerJSRunner = function() {
  this.port = system.args[2];
  this.destDir = system.args[1];
  console.log('Taking screenshot and saving it into: ' +
    this.destDir);
};

ScreenshotSlimerJSRunner.prototype = {
  SHOTLIST_FILENAME: 'shots.json',
  SCREENSHOT_SIZE: 320,

  run: function() {
    return Promise.all([
        this.loadPage(),
        this.getShotList()
      ])
      .then(this.takeScreenshots.bind(this));
  },

  loadPage: function() {
    console.log('Loading canvas.html...');
    var URL = 'http://localhost:' + this.port + '/tests/screenshots/canvas.html';
    var page = this.page = webpage.create();
    return page.open(URL)
      .then(function() {
        return new Promise(function(resolve, reject) {
          var rejectTimer = setTimeout(
            reject.bind(null, 'Page load timeout.'), 20000);

          var checkLoaded = function() {
            var loaded = page.evaluate(function() {
              return document.body.classList.contains('loaded');
            });

            if (loaded) {
              resolve();
              clearTimeout(rejectTimer);
            } else {
              setTimeout(checkLoaded, 100);
            }
          };

          checkLoaded();
        });

      });
  },

  getShotList: function() {
    this.list =
      JSON.parse(fs.read(fs.join(this.destDir, this.SHOTLIST_FILENAME), 'r'));
  },

  takeScreenshots: function() {
    this.page.viewportSize = {
      width: this.SCREENSHOT_SIZE,
      height: this.SCREENSHOT_SIZE
    };
    this.page.evaluate(function(size) {
      document.body.style.fontSize =
        document.body.style.lineHeight = size + 'px';
    }, this.SCREENSHOT_SIZE);

    var p = Promise.resolve();
    this.list.forEach(function(data, i) {
      if (data.str.substr(0, 1) === '\u200d') {
        p = p
          .then(function() {
            console.log('Skipping screenshot of lonely ZWJ (' +
              (i + 1) + '/' + this.list.length + ').');
          }.bind(this));
        return;
      }

      p = p
        .then(function() {
          console.log('Taking screenshot (' +
            (i + 1) + '/' + this.list.length + '): ' + data.fileName);
          this.page.evaluate(function(str) {
            document.body.textContent = str;
          }, data.str);
        }.bind(this))
        .then(function() {
          var destFilePath = fs.join(this.destDir, data.fileName + '.png');
          this.page.render(destFilePath);
        }.bind(this));
    }.bind(this));

    return p;
  }
};

(new ScreenshotSlimerJSRunner())
  .run()
  .then(null, function(e) {
    console.error(e);
  })
  .then(function() {
    slimer.exit();
  });