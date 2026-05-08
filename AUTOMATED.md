1. Verify environment
whoami  # must print: tony-tran
2. Check out develop
cd ~/dev/btt-writer-ai
git fetch origin develop && git checkout develop
3. Install dependencies (interactive prompts required)
pnpm install
pnpm approve-builds
# > a   (select all)
# > y   (approve)
pnpm bower install
4. Launch Electron with the CDP debug port
cd ~/dev/btt-writer-ai
DISPLAY=:0 ./node_modules/.bin/electron src/js/main.js --no-sandbox --remote-debugging-port=9222 > /tmp/btt-debug.log 2>&1 &
Wait a few seconds, then confirm CDP is up:

curl -s http://localhost:9222/json
You should see a JSON response with "title": "BTT Writer" and a webSocketDebuggerUrl.

5. Run the full automation script
Save as /tmp/btt-full.mjs and run with node /tmp/btt-full.mjs:


// btt-full.mjs — full BTT Writer first-run + project creation via CDP
let msgId = 0;
const targets = await (await fetch('http://localhost:9222/json')).json();
const wsUrl = targets.find(t => t.type === 'page').webSocketDebuggerUrl;
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const send = (method, params = {}) => new Promise(res => {
  const id = ++msgId;
  const h = e => { const d = JSON.parse(e.data); if (d.id === id) { ws.removeEventListener('message', h); res(d); } };
  ws.addEventListener('message', h);
  ws.send(JSON.stringify({ id, method, params }));
});
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Click first visible element whose trimmed text exactly matches
const clickByText = (text) => `
  (function() {
    function find(root, out) {
      for (const el of root.querySelectorAll('*')) {
        const rect = el.getBoundingClientRect();
        if (el.textContent.trim() === ${JSON.stringify(text)} && rect.width > 0) out.push(el);
        if (el.shadowRoot) find(el.shadowRoot, out);
      }
    }
    const out = [];
    find(document, out);
    if (!out.length) return 'NOT FOUND: ' + ${JSON.stringify(text)};
    out[0].click();
    return 'clicked: ' + out[0].tagName + ' / ' + out[0].textContent.trim();
  })()
`;
// ── First-run setup ──────────────────────────────────────────────────────────
// Step 1: Click "Create Local User Profile"
console.log('Step 1:', await js(clickByText('Create Local User Profile')));
await sleep(1500);
// Step 2: Enter username
console.log('Step 2:', await js(`
  (function() {
    const input = Array.from(document.querySelectorAll('input'))
      .find(i => i.placeholder === 'Full Name or Pseudonym' && i.getBoundingClientRect().width > 0);
    if (!input) return 'input not found';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Tony (AI)');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return 'set value: ' + input.value;
  })()
`));
await sleep(500);
// Step 3: Click "OK"
console.log('Step 3:', await js(clickByText('OK')));
await sleep(1500);
// Step 4: Click "I Agree"
console.log('Step 4:', await js(clickByText('I Agree')));
await sleep(1500);
// ── Project creation ─────────────────────────────────────────────────────────
// Step 5: Click "Start a new project"  ← note sentence case, NOT all caps
console.log('Step 5:', await js(clickByText('Start a new project')));
await sleep(2000);
// Step 6: Click "Ari"
console.log('Step 6:', await js(clickByText('Ari')));
await sleep(1500);
// Step 7: Click "New Testament"
console.log('Step 7:', await js(clickByText('New Testament')));
await sleep(1500);
// Step 8: Click "Matthew"
console.log('Step 8:', await js(clickByText('Matthew')));
await sleep(4000);
// Step 9: Click the large center image/add button
console.log('Step 9:', await js(`
  (function() {
    function find(root, out) {
      for (const el of root.querySelectorAll('iron-icon, img')) {
        const r = el.getBoundingClientRect();
        if (r.width >= 80 && r.height >= 80 && r.width <= 200) out.push(el);
        if (el.shadowRoot) find(el.shadowRoot, out);
      }
    }
    const out = [];
    find(document, out);
    if (!out.length) return 'NOT FOUND center button';
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let best = out[0], bd = Infinity;
    for (const el of out) {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width/2 - cx, r.top + r.height/2 - cy);
      if (d < bd) { bd = d; best = el; }
    }
    best.click();
    const br = best.getBoundingClientRect();
    return 'clicked: ' + best.tagName + ' at [' + Math.round(br.x) + ',' + Math.round(br.y) + ']';
  })()
`));
await sleep(2500);
// Step 10: Check the "English (en) - Unlocked Literal Bible" checkbox
console.log('Step 10:', await js(`
  (function() {
    function findAll(root, sel, out) {
      for (const el of root.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push(el);
        if (el.shadowRoot) findAll(el.shadowRoot, sel, out);
      }
    }
    // Find the ULB "English" row (shortest text containing "Unlocked Literal Bible")
    function findText(root, needle, out) {
      for (const el of root.querySelectorAll('*')) {
        const t = (el.textContent || '').trim();
        const r = el.getBoundingClientRect();
        if (r.width > 0 && t.includes(needle)) out.push(el);
        if (el.shadowRoot) findText(el.shadowRoot, needle, out);
      }
    }
    const ulbEls = [];
    findText(document, 'Unlocked Literal Bible', ulbEls);
    if (!ulbEls.length) return 'NOT FOUND ULB row';
    ulbEls.sort((a,b) => a.textContent.trim().length - b.textContent.trim().length);
    const ulbRect = ulbEls[0].getBoundingClientRect();
    const cbs = [];
    findAll(document, 'paper-checkbox, input[type="checkbox"]', cbs);
    let best = null, bd = Infinity;
    for (const cb of cbs) {
      const r = cb.getBoundingClientRect();
      const dy = Math.abs(r.top + r.height/2 - (ulbRect.top + ulbRect.height/2));
      if (dy < bd) { bd = dy; best = cb; }
    }
    if (!best) { ulbEls[0].click(); return 'clicked ULB row (no checkbox found)'; }
    best.click();
    return 'checked ULB checkbox (dy=' + Math.round(bd) + ')';
  })()
`));
await sleep(1000);
// Step 11: Click "Confirm"
console.log('Step 11:', await js(clickByText('Confirm')));
await sleep(3000);
ws.close();
console.log('Done — Matthew/Ari project is now open in the translation workspace.');
