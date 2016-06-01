#!/usr/bin/env node

'use strict';

var ScreenshotTaker = require('./screenshot_taker').ScreenshotTaker;

var st = new ScreenshotTaker();
st.run()
  .catch(function(e) {
    console.error(e);
  });
