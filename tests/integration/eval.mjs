// Evaluates JavaScript in the app's YouTube page on the TV and prints the result.
// Usage: node eval.mjs <snippet-file>
//        node eval.mjs -e '<expression>'

import { readFileSync } from 'node:fs';

import { connect } from './cdp.mjs';

const [arg, inline] = process.argv.slice(2);
if (!arg || (arg === '-e' && !inline)) {
  console.error("Usage: node eval.mjs <snippet-file> | -e '<expression>'");
  process.exit(2);
}

const expression = arg === '-e' ? inline : readFileSync(arg, 'utf8');

const tv = await connect();
try {
  const value = await tv.evaluate(expression);
  console.log(
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  );
} finally {
  tv.close();
}
