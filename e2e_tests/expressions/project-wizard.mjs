import { escapeForTemplate } from "./shadow-click.mjs";

export function clickCenterAddButtonExpr() {
  return `
    (function () {
      function collect(root, out) {
        for (const el of root.querySelectorAll("iron-icon, img")) {
          const rect = el.getBoundingClientRect();
          if (
            rect.width >= 80 &&
            rect.height >= 80 &&
            rect.width <= 200 &&
            rect.height <= 200
          ) {
            out.push(el);
          }
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
      }
      const out = [];
      collect(document, out);
      if (!out.length) return "NOT_FOUND";
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      let best = out[0];
      let bestDistance = Infinity;
      for (const el of out) {
        const rect = el.getBoundingClientRect();
        const distance = Math.hypot(
          rect.left + rect.width / 2 - cx,
          rect.top + rect.height / 2 - cy
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          best = el;
        }
      }
      best.click();
      return "CLICKED";
    })()
  `;
}

export function clickTopRightNewProjectFabExpr() {
  return `
    (function () {
      function collect(root, out) {
        for (const el of root.querySelectorAll("paper-fab[icon='add']")) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) out.push(el);
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
      }

      const out = [];
      collect(document, out);
      if (!out.length) return "NOT_FOUND";

      // Choose the add button nearest the top-right corner.
      let best = out[0];
      let bestDistance = Infinity;
      for (const el of out) {
        const rect = el.getBoundingClientRect();
        const dx = window.innerWidth - (rect.left + rect.width / 2);
        const dy = rect.top + rect.height / 2;
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = el;
        }
      }

      best.click();
      return "CLICKED";
    })()
  `;
}

export function selectUlbResourceExpr() {
  return `
    (function () {
      function collectText(root, needle, out) {
        for (const el of root.querySelectorAll("*")) {
          const text = (el.textContent || "").trim();
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && text.includes(needle)) out.push(el);
          if (el.shadowRoot) collectText(el.shadowRoot, needle, out);
        }
      }
      function collectCheckboxes(root, out) {
        for (const el of root.querySelectorAll('paper-checkbox, input[type="checkbox"]')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) out.push(el);
          if (el.shadowRoot) collectCheckboxes(el.shadowRoot, out);
        }
      }
      const rows = [];
      collectText(document, "Unlocked Literal Bible", rows);
      if (!rows.length) return "NOT_FOUND";
      rows.sort((a, b) => a.textContent.trim().length - b.textContent.trim().length);
      const rowRect = rows[0].getBoundingClientRect();

      const checkboxes = [];
      collectCheckboxes(document, checkboxes);
      let best = null;
      let bestDistance = Infinity;
      for (const cb of checkboxes) {
        const rect = cb.getBoundingClientRect();
        const deltaY = Math.abs(
          rect.top + rect.height / 2 - (rowRect.top + rowRect.height / 2)
        );
        if (deltaY < bestDistance) {
          bestDistance = deltaY;
          best = cb;
        }
      }

      if (!best) {
        rows[0].click();
        return "CLICKED";
      }

      best.click();
      return "CLICKED";
    })()
  `;
}

export function clickBookInListExpr(bookName) {
  const target = escapeForTemplate(bookName);
  return `
    (function () {
      function collectVisibleExactText(root, text, out) {
        for (const el of root.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (visible && (el.textContent || "").trim() === text) out.push(el);
          if (el.shadowRoot) collectVisibleExactText(el.shadowRoot, text, out);
        }
      }

      function findScrollableIronList(root) {
        const lists = root.querySelectorAll("iron-list#list, iron-list");
        for (const list of lists) {
          if (list.scrollHeight > list.clientHeight) return list;
        }
        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findScrollableIronList(el.shadowRoot);
          if (nested) return nested;
        }
        return null;
      }

      const matches = [];
      collectVisibleExactText(document, ${target}, matches);
      if (matches.length) {
        matches[0].click();
        return "CLICKED";
      }

      const list = findScrollableIronList(document);
      if (!list) return "NOT_FOUND";

      const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
      if (list.scrollTop >= maxTop - 2) return "END";

      list.scrollTop = Math.min(maxTop, list.scrollTop + Math.max(120, list.clientHeight * 0.8));
      return "SCROLLED";
    })()
  `;
}
