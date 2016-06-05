'use strict';

var path = require('path');
var childProcess = require('child_process');
var slimerjs = require('slimerjs');
var HttpServer = require('http-server');
var rmdir = require('rmdir');
var fs = require('fs');

var LayerInfoService = require('../utils/layer_info_service').LayerInfoService;

var ScreenshotTaker = function() {
};

ScreenshotTaker.prototype = {
  HTTP_SERVER_OPTIONS: Object.freeze({
    host: '127.0.0.1',
    port: 8282 + Math.floor(Math.random() * 10),
    protocol: 'http',
    root: path.join(__dirname, '..', '..')
  }),

  SCREENSHOT_DEST_DIR: path.join(__dirname, 'results'),
  COLOR_GLYPHS_DIR: path.join(__dirname, '..', '..', 'build', 'colorGlyphs'),
  SHOTLIST_FILENAME: 'shots.json',

  run: function() {
    return Promise.all([
        this.startHttpServer(),
        this.preparingDestDir()
      ])
      .then(this.runSlimerJS.bind(this))
      .then(this.stopHttpServer.bind(this),
        function(e) {
          this.stopHttpServer();
          throw e;
        }.bind(this));
  },

  startHttpServer: function() {
    var options = this.HTTP_SERVER_OPTIONS;
    this.server = HttpServer.createServer(options);
    return new Promise(function(resolve) {
      console.log(
        'Starting HTTP server on port ' + this.HTTP_SERVER_OPTIONS.port + '...');
      this.server.listen(options.port, options.host, resolve);
    }.bind(this));
  },

  stopHttpServer: function() {
    this.server.close();
  },

  preparingDestDir: function() {
    return new Promise(function(resolve) {
        console.log(
          'Preparing destination directory and get the codepoint list...');
        rmdir(this.SCREENSHOT_DEST_DIR, resolve);
      }.bind(this))
      .then(function() {
        fs.mkdirSync(this.SCREENSHOT_DEST_DIR);
        return LayerInfoService.getCodePointsArr();
      }.bind(this))
      .then(function(codePointsArr) {
        return codePointsArr.map(function(arr) {
          return {
            codePoints: arr,
            str: (function(codePoints) {
                var string = String.fromCodePoint.apply(String, codePoints);
                if (codePoints.length === 1 && codePoints[0] < 0xffff) {
                  // Force Emoji style w/ VS16
                  string += '\ufe0f';
                }

                return string;
              })(arr),
            fileName: 'u' + arr.filter(function(cp) {
                // Remove zero width joiner and VS16.
                return cp !== 0x200d && cp !== 0xfe0f;
              })
              .map(function(cp) {
                var str = cp.toString(16);
                while (str.length < 4) {
                  str = '0' + str;
                }
                return str;
              }).join('-')
          };
        })
      }.bind(this))
      .then(function(codePointsData) {
        console.log('Test(s) to run: ' + codePointsData.length);
        fs.writeFileSync(
          path.join(this.SCREENSHOT_DEST_DIR, this.SHOTLIST_FILENAME),
          JSON.stringify(codePointsData, null, 2));
      }.bind(this));
  },

  runSlimerJS: function() {
    return new Promise(function(resolve, reject) {
      console.log('Starting SlimerJS...');
      var binPath = slimerjs.path;
      var childArgs = [
        path.join(__dirname, 'slimerjs-script.js'),
        this.HTTP_SERVER_OPTIONS.port,
        this.COLOR_GLYPHS_DIR,
        this.SCREENSHOT_DEST_DIR,
      ];

      var cp = childProcess.execFile(binPath, childArgs);
      cp.stdout.on('data', process.stdout.write.bind(process.stdout));
      cp.stderr.on('data', process.stderr.write.bind(process.stdout));
      cp.on('close', function(code) {
        if (!code) {
          resolve(code);
        } else {
          reject(code);
        }
      });
    }.bind(this));
  }
}

exports.ScreenshotTaker = ScreenshotTaker;
