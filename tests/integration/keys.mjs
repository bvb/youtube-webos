// Presses remote keys in the app on the TV as trusted key events, so they take
// the same path as the real remote (including YouTube's re-dispatch of color keys).
// Usage: node keys.mjs <key> [<key> ...]
//   keys: up down left right enter back red green yellow blue, or a numeric keyCode

import { connect } from './cdp.mjs';

const KEYS = {
  left: 37,
  up: 38,
  right: 39,
  down: 40,
  enter: 13,
  back: 461,
  red: 403,
  green: 404,
  yellow: 405,
  blue: 406
};

const names = process.argv.slice(2);
if (!names.length) {
  console.error(
    `Usage: node keys.mjs <key> [<key> ...]  keys: ${Object.keys(KEYS).join(' ')} or a keyCode`
  );
  process.exit(2);
}

const codes = names.map((name) => {
  const code = KEYS[name] ?? Number(name);
  if (!Number.isInteger(code)) throw new Error(`Unknown key: ${name}`);
  return code;
});

const tv = await connect();

async function dispatch(type, code) {
  const { error } = await tv.send('Input.dispatchKeyEvent', {
    type,
    windowsVirtualKeyCode: code,
    nativeVirtualKeyCode: code
  });
  if (error) throw new Error(`${type} ${code}: ${error.message}`);
}

async function press(code) {
  await dispatch('rawKeyDown', code);
  await dispatch('keyUp', code);
  // Give the app time to react before the next key.
  await new Promise((resolve) => setTimeout(resolve, 400));
}

try {
  for (const [i, code] of codes.entries()) {
    // eslint-disable-next-line no-await-in-loop -- presses must happen in order
    await press(code);
    console.log('pressed', names[i], code);
  }
} finally {
  tv.close();
}
