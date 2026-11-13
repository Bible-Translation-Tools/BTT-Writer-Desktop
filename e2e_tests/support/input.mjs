/**
 * Trusted input through CDP. Unlike element.click() / dispatchEvent() inside the page, these run the
 * browser's default actions: the caret moves, focus changes, blur fires.
 */

const KEY_CODES = { ArrowUp: 38, ArrowDown: 40 };

/** Press and release a key (`send` comes from withCdpSession). */
export async function pressKey(send, key) {
  const code = KEY_CODES[key];
  if (!code) throw new Error(`pressKey: unsupported key ${key}`);
  const params = { key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...params });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...params });
}

/** Left-click at viewport coordinates (CSS pixels). */
export async function clickAt(send, x, y) {
  const params = { x, y, button: "left", clickCount: 1 };
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...params });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...params });
}

/** Type text at the caret as real input (fires the editor's input event). */
export async function typeText(send, text) {
  await send("Input.insertText", { text });
}
