/* global window */
// Records key events (capture phase) into window.__keylog. Install once, press
// keys, then read the log:
//   node eval.mjs -e 'window.__keylog.join("\n")'
// Shows both the raw webOS key and YouTube's re-dispatched event, e.g.
// GREEN 404 (charCode 0) followed by 172 (charCode 172).
// Runs raw in the TV page (no Babel): keep it to ES2015.
(() => {
  if (window.__keylog) {
    window.__keylog.length = 0;
    return 'key log cleared';
  }

  window.__keylog = [];
  ['keydown', 'keypress', 'keyup'].forEach((type) => {
    window.addEventListener(
      type,
      (evt) => {
        window.__keylog.push(
          `${type} key=${evt.key} keyCode=${evt.keyCode} charCode=${evt.charCode}`
        );
      },
      true
    );
  });
  return 'key logger installed';
})();
