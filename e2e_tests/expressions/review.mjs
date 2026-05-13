import { escapeForTemplate } from "./shadow-click.mjs";

export function scrollToChunkRefExpr(chunkRef) {
  const target = escapeForTemplate(chunkRef);
  return `
    (function () {
      function normalizeRef(text) {
        return (text || "")
          .replace(/[\\u2010-\\u2015]/g, "-")
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      const wanted = normalizeRef(${target});

      function findVisibleReviewList() {
        const lists = Array.from(document.querySelectorAll("iron-list#reviewlist"));
        for (const list of lists) {
          const rect = list.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (!visible) continue;
          const modeHost = list.closest("ts-review-mode");
          if (modeHost && modeHost.classList.contains("hide")) continue;
          return list;
        }
        return null;
      }

      function findChunkRefInReviewList(reviewList) {
        const cards = reviewList.querySelectorAll("ts-review-card");
        for (const card of cards) {
          const review = card.querySelector("ts-target-review");
          if (!review) continue;
          const heading = review.querySelector("#heading");
          if (!heading) continue;
          const spans = heading.querySelectorAll("span");
          if (!spans.length) continue;
          const headingText = Array.from(spans).map((s) => s.textContent || "").join("");
          const normalized = normalizeRef(headingText);
          if (normalized === wanted || normalized.includes(wanted)) return heading;
        }
        return null;
      }

      const reviewList = findVisibleReviewList();
      if (!reviewList) {
        return { state: "NO_REVIEW_LIST" };
      }

      const match = findChunkRefInReviewList(reviewList);
      if (match) {
        match.scrollIntoView({ block: "center", behavior: "instant" });
        return {
          state: "FOUND",
          listTop: reviewList.scrollTop,
          firstVisibleIndex: reviewList.firstVisibleIndex || 0,
          lastVisibleIndex: reviewList.lastVisibleIndex || 0
        };
      }

      const before = reviewList.scrollTop;
      const maxTop = Math.max(0, reviewList.scrollHeight - reviewList.clientHeight);
      if (before >= maxTop - 2) {
        return {
          state: "END",
          listTop: before,
          maxTop: maxTop,
          firstVisibleIndex: reviewList.firstVisibleIndex || 0,
          lastVisibleIndex: reviewList.lastVisibleIndex || 0
        };
      }

      reviewList.scrollTop = Math.min(
        maxTop,
        before + Math.max(220, reviewList.clientHeight * 0.8)
      );
      return {
        state: "SCROLLED",
        listTopBefore: before,
        listTopAfter: reviewList.scrollTop,
        maxTop: maxTop,
        firstVisibleIndex: reviewList.firstVisibleIndex || 0,
        lastVisibleIndex: reviewList.lastVisibleIndex || 0
      };
    })()
  `;
}

export function findVerseMarkerInChunkExpr(chunkRef, verseNumber) {
  const target = escapeForTemplate(chunkRef);
  const verse = escapeForTemplate(String(verseNumber));
  return `
    (function () {
      function normalizeRef(text) {
        return (text || "")
          .replace(/[\\u2010-\\u2015]/g, "-")
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      const wanted = normalizeRef(${target});
      const wantedVerse = String(${verse}).trim();
      const reviewList = document.querySelector("iron-list#reviewlist");
      if (!reviewList) return "NO_REVIEW_LIST";

      const cards = reviewList.querySelectorAll("ts-review-card");
      for (const card of cards) {
        const review = card.querySelector("ts-target-review");
        if (!review) continue;
        const heading = review.querySelector("#heading");
        if (!heading) continue;
        const spans = heading.querySelectorAll("span");
        if (!spans.length) continue;
        const headingText = Array.from(spans).map((s) => s.textContent || "").join("");
        const normalized = normalizeRef(headingText);
        if (!(normalized === wanted || normalized.includes(wanted))) continue;

        const candidates = review.querySelectorAll("ts-verse-marker #num, div#num.style-scope.ts-verse-marker, #num");
        for (const node of candidates) {
          const rect = node.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          if ((node.textContent || "").trim() === wantedVerse) {
            node.scrollIntoView({ block: "center", behavior: "instant" });
            return "FOUND";
          }
        }
        return "VERSE_NOT_FOUND_IN_CHUNK";
      }

      return "CHUNK_NOT_VISIBLE";
    })()
  `;
}

/**
 * Returns the first **visible** `ts-target-review` that has, as descendants:
 * 1) a `span.style-scope.ts-target-review` whose trimmed text equals `chunkRef`, and
 * 2) under `#textholder` in the same host, an element matching `.style-scope.ts-target-review`
 *    whose `innerHTML` matches `expectedParagraphInnerHtml` after the same light normalization
 *    applied to both (inter-tag whitespace, space after `</sup>`, NBSP to space).
 * The chunk body may be a `<p>` or `<div>` (or other tag) as long as it carries those classes.
 * Returns "OK" or a diagnostic string for CDP polling.
 */
export function findTargetReviewParagraphByChunkRefExpr(chunkRef, expectedParagraphInnerHtml) {
  const chunkTarget = escapeForTemplate(chunkRef);
  const expectedTarget = escapeForTemplate(expectedParagraphInnerHtml);
  return `
    (function () {
      const wanted = ${chunkTarget};
      const expectedInner = ${expectedTarget};

      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function normalizeHtmlForCompare(html) {
        return (html || "")
          .replace(/\\u00a0/g, " ")
          .replace(/>\\s+</g, "><")
          .replace(/<\\/sup>\\s+/g, "</sup>")
          .trim();
      }

      const expectedNorm = normalizeHtmlForCompare(expectedInner);

      function hasChunkRefSpan(review) {
        for (const span of review.querySelectorAll("span")) {
          if (!span.classList.contains("style-scope")) continue;
          if (!span.classList.contains("ts-target-review")) continue;
          if ((span.textContent || "").trim() !== wanted) continue;
          return true;
        }
        return false;
      }

      // First #textholder descendant matching .style-scope.ts-target-review (chunk body: p or div).
      function chunkContentContainer(holder) {
        return holder.querySelector(".style-scope.ts-target-review");
      }

      for (const review of document.querySelectorAll("ts-target-review")) {
        if (!isVisible(review)) continue;
        if (!hasChunkRefSpan(review)) continue;

        const holder = review.querySelector("#textholder");
        if (!holder) continue;

        const container = chunkContentContainer(holder);
        if (!container) continue;

        const got = normalizeHtmlForCompare(container.innerHTML || "");
        if (got !== expectedNorm) return "P_INNER_HTML_MISMATCH";

        return "OK";
      }

      return "NOT_FOUND";
    })()
  `;
}

export function clickEditIconForChunkExpr(chunkRef) {
  const target = escapeForTemplate(chunkRef);
  return `
    (function () {
      function normalizeRef(text) {
        return (text || "")
          .replace(/[\\u2010-\\u2015]/g, "-")
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      const wanted = normalizeRef(${target});
      const reviewList = document.querySelector("iron-list#reviewlist");
      if (!reviewList) return "NO_REVIEW_LIST";

      const cards = reviewList.querySelectorAll("ts-review-card");
      for (const card of cards) {
        const review = card.querySelector("ts-target-review");
        if (!review) continue;
        const heading = review.querySelector("#heading");
        if (!heading) continue;
        const spans = heading.querySelectorAll("span");
        if (!spans.length) continue;
        const headingText = Array.from(spans).map((s) => s.textContent || "").join("");
        const normalized = normalizeRef(headingText);
        if (!(normalized === wanted || normalized.includes(wanted))) continue;

        const icon = review.querySelector("iron-icon[icon='create']");
        if (!icon) return "NO_EDIT_ICON";
        const rect = icon.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return "NO_EDIT_ICON";
        icon.click();
        return "CLICKED";
      }

      return "NOT_FOUND";
    })()
  `;
}

export function setTextboxValueExpr(value) {
  const target = escapeForTemplate(value);
  return `
    (function () {
      function escapeHtml(str) {
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }

      const candidates = Array.from(
        document.querySelectorAll("ts-target-edit #textbox[contenteditable='true']")
      );
      if (!candidates.length) return "NOT_FOUND";

      const textbox = candidates.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!textbox) return "NOT_VISIBLE";

      const newValue = (${target}).trim();
      const newHtml = escapeHtml(newValue);
      const currentHtml = (textbox.innerHTML || "").trim();
      if (currentHtml === newHtml) return "SET";

      textbox.focus();

      // Replace the textbox content with the new value (escaped)
      textbox.innerHTML = newHtml;

      textbox.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: newValue,
        inputType: "insertText"
      }));
      textbox.dispatchEvent(new Event("change", { bubbles: true }));
      textbox.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      return "SET";
    })()
  `;
}

export function textboxContainsExpr(value) {
  const target = escapeForTemplate(value);
  return `
    (function () {
      const candidates = Array.from(
        document.querySelectorAll("ts-target-edit #textbox[contenteditable='true']")
      );
      if (!candidates.length) return "NOT_FOUND";

      const textbox = candidates.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!textbox) return "NOT_VISIBLE";

      const normalizedCurrent = (textbox.textContent || "").replace(/\\s+/g, " ").trim();
      const normalizedTarget = (${target}).replace(/\\s+/g, " ").trim();
      return normalizedCurrent.includes(normalizedTarget) ? "MATCH" : "NO_MATCH";
    })()
  `;
}

export function clickDoneIconExpr() {
  return `
    (function () {
      const icons = Array.from(document.querySelectorAll("ts-target-edit iron-icon[icon='done']"));
      if (!icons.length) return "NOT_FOUND";

      const doneIcon = icons.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!doneIcon) return "NOT_VISIBLE";

      doneIcon.click();
      return "CLICKED";
    })()
  `;
}

export function clickMarkChunkDoneToggleExpr(chunkRef) {
  const target = escapeForTemplate(chunkRef);
  return `
    (function () {
      function normalizeRef(text) {
        return (text || "")
          .replace(/[\\u2010-\\u2015]/g, "-")
          .replace(/\\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      const wanted = normalizeRef(${target});
      const reviewList = document.querySelector("iron-list#reviewlist");
      if (!reviewList) return "NO_REVIEW_LIST";

      const cards = reviewList.querySelectorAll("ts-review-card");
      for (const card of cards) {
        const review = card.querySelector("ts-target-review");
        if (!review) continue;
        const heading = review.querySelector("#heading");
        if (!heading) continue;
        const spans = heading.querySelectorAll("span");
        if (!spans.length) continue;
        const headingText = Array.from(spans).map((s) => s.textContent || "").join("");
        const normalized = normalizeRef(headingText);
        if (!(normalized === wanted || normalized.includes(wanted))) continue;

        const toggle = review.querySelector("paper-toggle-button#toggle");
        if (!toggle) return "NO_TOGGLE";
        const rect = toggle.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return "TOGGLE_NOT_VISIBLE";
        toggle.click();
        return "CLICKED";
      }

      return "CHUNK_NOT_VISIBLE";
    })()
  `;
}

export function clickVisibleDialogConfirmExpr() {
  return `
    (function () {
      const buttons = Array.from(document.querySelectorAll("paper-button[dialog-confirm]"));
      if (!buttons.length) return "NOT_FOUND";

      const visible = buttons.find((btn) => {
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!visible) return "NOT_VISIBLE";

      visible.click();
      return "CLICKED";
    })()
  `;
}
