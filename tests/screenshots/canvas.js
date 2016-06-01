'use strict';

// XXX Assuming our Web font is loaded after 2 sec,
// since there is no way to detect it (we can't detect change -- the same
// font might be in the Firefox we are running on).
setTimeout(function() {
  document.body.classList.add('loaded');
}, 2000);
