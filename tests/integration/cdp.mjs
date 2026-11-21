/**
 * Minimal DevTools-protocol client for the app's YouTube page on a webOS TV
 * in developer mode. The inspector is only up while the app is running.
 */

export const INSPECT_HOST = process.env.TV_INSPECT ?? '192.168.1.71:9998';

export async function connect() {
  const res = await fetch(`http://${INSPECT_HOST}/json/list`);
  const targets = await res.json();
  const page = targets.find(
    (t) => t.type === 'page' && /youtube\.com\/tv/.test(t.url)
  );
  if (!page) {
    throw new Error(
      `No YouTube TV page on ${INSPECT_HOST}. Targets: ${targets.map((t) => t.url).join(', ')}`
    );
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let lastId = 0;
  const pending = new Map();
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    const resolve = pending.get(data.id);
    if (!resolve) return;
    pending.delete(data.id);
    resolve(data);
  };

  /** Sends a protocol command and resolves with the raw response. */
  function send(method, params) {
    const id = ++lastId;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evaluates an expression in the page and resolves with its value. */
  async function evaluate(expression) {
    const { error, result } = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (error) throw new Error(`Protocol error: ${error.message}`);
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text
      );
    }
    return result.result.value;
  }

  return { send, evaluate, close: () => ws.close() };
}
