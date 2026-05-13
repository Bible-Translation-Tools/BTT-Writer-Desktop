/**
 * First `ts-source-chunk` whose `#textholder` (div) contains the needle.
 * Resolves `#textholder` via `el.querySelector("#textholder")` on each chunk (no shadowRoot).
 * See src/elements/ts-translate/ts-source/ts-source-chunk.html and the review-card DOM.
 * Returns "OK" or "NOT_FOUND" for CDP polling.
 */
export function firstSourceChunkTextholderContainsExpr(expectedSubstring) {
  const needle = JSON.stringify(expectedSubstring);
  return `
    (function () {
      function findFirstChunkTextholder(root, needle) {
        for (const el of root.querySelectorAll("ts-source-chunk")) {
          const holder = el.querySelector("#textholder");
          if (!holder || holder.localName !== "div") continue;
          if (!(holder.textContent || "").includes(needle)) continue;
          return { chunk: el, holder };
        }
        return null;
      }

      const pair = findFirstChunkTextholder(document, ${needle});
      if (!pair) return "NOT_FOUND";

      return "OK";
    })()
  `;
}
