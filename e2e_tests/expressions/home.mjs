import { escapeForTemplate } from "./shadow-click.mjs";

/**
 * Returns whether the home route/scene is active and showing home content.
 * With projects, ts-home shows #list (not #welcome, which is only for an empty project list).
 */
export function welcomeHomeVisibleExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function homeContentVisible(home) {
        const root = home.shadowRoot || home;
        const contentSelectors = ["#list", "#welcome", "#main"];
        for (const selector of contentSelectors) {
          const el = root.querySelector(selector);
          if (isVisible(el)) return true;
        }
        return false;
      }

      const pages = document.querySelector("neon-animated-pages");
      const route = pages && pages.selected;
      if (route && route !== "home") {
        return "WRONG_ROUTE:" + route;
      }

      const home =
        document.querySelector("ts-home#home") ||
        document.querySelector('ts-home[data-route="home"]');
      if (!home) return "NOT_FOUND";

      if (!isVisible(home)) return "HOME_HIDDEN";

      if (homeContentVisible(home)) return "VISIBLE";

      const root = home.shadowRoot || home;
      if (root.querySelector("#list")) return "LIST_HIDDEN";
      if (root.querySelector("#welcome")) return "HIDDEN";
      return "NO_HOME_CONTENT";
    })()
  `;
}

/** Returns FOUND when a visible ts-home project list span.bigspan shows the book name. */
export function homeProjectBookVisibleExpr(bookName) {
  const book = escapeForTemplate(bookName);
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function findBookInHome(home) {
        const root = home.shadowRoot || home;
        for (const span of root.querySelectorAll("span.bigspan")) {
          if ((span.textContent || "").trim() !== ${book}) continue;
          if (!isVisible(span)) continue;
          return "FOUND";
        }
        return "NOT_FOUND";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home && findBookInHome(home) === "FOUND") return "FOUND";

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested === "FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns ABSENT when no visible span.bigspan shows the book name on the home project list. */
export function homeProjectBookLabelAbsentExpr(bookName) {
  const book = escapeForTemplate(bookName);
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function findBookLabelInHome(home) {
        const root = home.shadowRoot || home;
        for (const span of root.querySelectorAll("span.bigspan")) {
          if ((span.textContent || "").trim() !== ${book}) continue;
          if (!isVisible(span)) continue;
          return "STILL_VISIBLE";
        }
        return "ABSENT";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const result = findBookLabelInHome(home);
          if (result === "STILL_VISIBLE") return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested === "STILL_VISIBLE") return nested;
        }
        return "ABSENT";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks the project row details icon (iron-icon.info) on the home project list. */
export function clickProjectInfoIconExpr(bookName) {
  const book = escapeForTemplate(bookName);
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function rowMatches(row) {
        const text = (row.textContent || "").replace(/\\s+/g, " ").trim();
        return text.includes(${book});
      }

      function clickInfoInHome(home) {
        const root = home.shadowRoot || home;
        const rows = root.querySelectorAll(".row");
        for (const row of rows) {
          if (!rowMatches(row)) continue;
          const icon = row.querySelector('iron-icon.info[icon="info"]');
          if (icon && isVisible(icon)) {
            icon.click();
            return "CLICKED";
          }
          return "ICON_NOT_VISIBLE";
        }
        return "ROW_NOT_FOUND";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const result = clickInfoInHome(home);
          if (result !== "ROW_NOT_FOUND") return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns whether ts-home paper-dialog#info is open with visible ts-project-info. */
export function projectInfoDialogVisibleExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const homeRoot = home.shadowRoot || home;
          const dialog = homeRoot.querySelector("paper-dialog#info");
          if (dialog && dialogOpen(dialog)) {
            const info = dialog.querySelector("ts-project-info");
            if (info && isVisible(info)) return "VISIBLE";
            return "INFO_HIDDEN";
          }
          if (dialog) return "CLOSED";
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks Upload/Export (file-upload) in the open ts-project-info dialog. */
export function clickProjectInfoUploadExportExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickUploadIcon(info) {
        const icon = info.querySelector('iron-icon[icon="file-upload"]');
        if (!icon) return "NO_ICON";
        if (!isVisible(icon)) return "NOT_VISIBLE";
        icon.click();
        return "CLICKED";
      }

      function findInRoot(root) {
        for (const info of root.querySelectorAll("ts-project-info")) {
          const result = clickUploadIcon(info);
          if (result === "CLICKED" || result === "NOT_VISIBLE") return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND" && nested !== "NO_ICON") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks Print in the open ts-project-info dialog. */
export function clickProjectInfoPrintExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickPrintIcon(info) {
        const icon = info.querySelector('iron-icon[icon="print"]');
        if (!icon) return "NO_ICON";
        if (icon.classList.contains("hide")) return "HIDDEN";
        if (!isVisible(icon)) return "NOT_VISIBLE";
        icon.click();
        return "CLICKED";
      }

      function findInRoot(root) {
        for (const info of root.querySelectorAll("ts-project-info")) {
          const result = clickPrintIcon(info);
          if (result === "CLICKED" || result === "NOT_VISIBLE" || result === "HIDDEN") return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND" && nested !== "NO_ICON") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns whether print options dialog is open with visible "Print/Export to PDF Options" h2. */
export function printOptionsDialogVisibleExpr() {
  const title = escapeForTemplate("Print/Export to PDF Options");
  return `
    (function () {
      const expectedTitle = ${title};

      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function checkPrintOptions(options) {
        if (!options || !isVisible(options)) return "OPTIONS_HIDDEN";

        const heading = options.querySelector("#header h2");
        if (!heading) return "NO_TITLE";

        const titleText = (heading.textContent || "").replace(/\\s+/g, " ").trim();
        if (titleText !== expectedTitle) return "TITLE_MISMATCH";

        if (!isVisible(heading)) return "TITLE_HIDDEN";
        return "VISIBLE";
      }

      function findInRoot(root) {
        const dialog = root.querySelector("paper-dialog#print");
        if (dialog && dialogOpen(dialog)) {
          const options = dialog.querySelector("ts-print-options");
          const result = checkPrintOptions(options);
          if (result !== "OPTIONS_HIDDEN" || !options) return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks Cancel (paper-button[dialog-dismiss]) in ts-print-options. */
export function clickPrintOptionsCancelExpr() {
  const label = escapeForTemplate("Cancel");
  return `
    (function () {
      const wanted = ${label};

      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickCancelInOptions(options) {
        const dismiss = options.querySelector('paper-button[dialog-dismiss]');
        if (dismiss && isVisible(dismiss)) {
          dismiss.click();
          return "CLICKED";
        }

        for (const btn of options.querySelectorAll("paper-button")) {
          const text = (btn.textContent || "").replace(/\\s+/g, " ").trim();
          if (text !== wanted) continue;
          if (!isVisible(btn)) continue;
          btn.click();
          return "CLICKED";
        }
        return "NOT_FOUND";
      }

      function findInRoot(root) {
        for (const options of root.querySelectorAll("ts-print-options")) {
          const result = clickCancelInOptions(options);
          if (result === "CLICKED") return result;
        }

        const dialog = root.querySelector("paper-dialog#print");
        if (dialog) {
          const options = dialog.querySelector("ts-print-options");
          if (options) {
            const result = clickCancelInOptions(options);
            if (result !== "NOT_FOUND") return result;
          }
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns DISMISSED when print options dialog is no longer open/visible. */
export function printOptionsDialogDismissedExpr() {
  const title = escapeForTemplate("Print/Export to PDF Options");
  return `
    (function () {
      const expectedTitle = ${title};

      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function titleStillVisibleInRoot(root) {
        for (const options of root.querySelectorAll("ts-print-options")) {
          const heading = options.querySelector("#header h2");
          if (!heading) continue;
          const titleText = (heading.textContent || "").replace(/\\s+/g, " ").trim();
          if (titleText !== expectedTitle) continue;
          if (isVisible(heading)) return true;
        }
        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          if (titleStillVisibleInRoot(el.shadowRoot)) return true;
        }
        return false;
      }

      function dialogStillOpenInRoot(root) {
        const dialog = root.querySelector("paper-dialog#print");
        if (dialog && dialogOpen(dialog)) return true;
        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          if (dialogStillOpenInRoot(el.shadowRoot)) return true;
        }
        return false;
      }

      if (dialogStillOpenInRoot(document)) return "STILL_OPEN";
      if (titleStillVisibleInRoot(document)) return "STILL_OPEN";
      return "DISMISSED";
    })()
  `;
}

/** Returns whether export options dialog is open with visible "Upload/Export Options" h2. */
export function exportOptionsDialogVisibleExpr() {
  const title = escapeForTemplate("Upload/Export Options");
  return `
    (function () {
      const expectedTitle = ${title};

      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function checkExportOptions(options) {
        if (!options || !isVisible(options)) return "OPTIONS_HIDDEN";

        const heading =
          options.querySelector("#header h2") || options.querySelector("h2");
        if (!heading) return "NO_TITLE";

        const titleText = (heading.textContent || "").replace(/\\s+/g, " ").trim();
        if (titleText !== expectedTitle) return "TITLE_MISMATCH";

        if (!isVisible(heading)) return "TITLE_HIDDEN";
        return "VISIBLE";
      }

      function findInRoot(root) {
        const dialog = root.querySelector("paper-dialog#export");
        if (dialog && dialogOpen(dialog)) {
          const options = dialog.querySelector("ts-export-options");
          const result = checkExportOptions(options);
          if (result !== "OPTIONS_HIDDEN" || !options) return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks Cancel (paper-button[dialog-dismiss]) in ts-export-options. */
export function clickExportOptionsCancelExpr() {
  const label = escapeForTemplate("Cancel");
  return `
    (function () {
      const wanted = ${label};

      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickCancelInOptions(options) {
        const dismiss = options.querySelector('paper-button[dialog-dismiss]');
        if (dismiss && isVisible(dismiss)) {
          dismiss.click();
          return "CLICKED";
        }

        for (const btn of options.querySelectorAll("paper-button")) {
          const text = (btn.textContent || "").replace(/\\s+/g, " ").trim();
          if (text !== wanted) continue;
          if (!isVisible(btn)) continue;
          btn.click();
          return "CLICKED";
        }
        return "NOT_FOUND";
      }

      function findInRoot(root) {
        for (const options of root.querySelectorAll("ts-export-options")) {
          const result = clickCancelInOptions(options);
          if (result === "CLICKED") return result;
        }

        const dialog = root.querySelector("paper-dialog#export");
        if (dialog) {
          const options = dialog.querySelector("ts-export-options");
          if (options) {
            const result = clickCancelInOptions(options);
            if (result !== "NOT_FOUND") return result;
          }
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns DISMISSED when export options dialog is no longer open/visible. */
export function exportOptionsDialogDismissedExpr() {
  const title = escapeForTemplate("Upload/Export Options");
  return `
    (function () {
      const expectedTitle = ${title};

      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function titleStillVisibleInRoot(root) {
        for (const options of root.querySelectorAll("ts-export-options")) {
          const heading = options.querySelector("#header h2") || options.querySelector("h2");
          if (!heading) continue;
          const titleText = (heading.textContent || "").replace(/\\s+/g, " ").trim();
          if (titleText !== expectedTitle) continue;
          if (isVisible(heading)) return true;
        }
        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          if (titleStillVisibleInRoot(el.shadowRoot)) return true;
        }
        return false;
      }

      function dialogStillOpenInRoot(root) {
        const dialog = root.querySelector("paper-dialog#export");
        if (dialog && dialogOpen(dialog)) return true;
        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          if (dialogStillOpenInRoot(el.shadowRoot)) return true;
        }
        return false;
      }

      if (dialogStillOpenInRoot(document)) return "STILL_OPEN";
      if (titleStillVisibleInRoot(document)) return "STILL_OPEN";
      return "DISMISSED";
    })()
  `;
}

/** Clicks Delete in the open ts-project-info dialog. */
export function clickProjectInfoDeleteExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickDeleteIcon(info) {
        const icon = info.querySelector('iron-icon[icon="delete"]');
        if (!icon) return "NO_ICON";
        if (!isVisible(icon)) return "NOT_VISIBLE";
        icon.click();
        return "CLICKED";
      }

      function findInRoot(root) {
        for (const info of root.querySelectorAll("ts-project-info")) {
          const result = clickDeleteIcon(info);
          if (result === "CLICKED" || result === "NOT_VISIBLE") return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND" && nested !== "NO_ICON") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns VISIBLE when ts-home paper-dialog#delete confirm dialog is open. */
export function deleteProjectDialogVisibleExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const homeRoot = home.shadowRoot || home;
          const dialog = homeRoot.querySelector("paper-dialog#delete");
          if (dialog && dialogOpen(dialog)) {
            const heading = dialog.querySelector("h2");
            if (heading && isVisible(heading)) return "VISIBLE";
            return "NO_TITLE";
          }
          if (dialog) return "CLOSED";
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks Confirm (deleteproject) in ts-home paper-dialog#delete. */
export function clickDeleteProjectConfirmExpr() {
  const label = escapeForTemplate("Confirm");
  return `
    (function () {
      const wanted = ${label};

      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickConfirmInDialog(dialog) {
        const confirmBtn = dialog.querySelector('paper-button[on-tap="deleteproject"]');
        if (confirmBtn && isVisible(confirmBtn)) {
          confirmBtn.click();
          return "CLICKED";
        }

        for (const btn of dialog.querySelectorAll("paper-button")) {
          const text = (btn.textContent || "").replace(/\\s+/g, " ").trim();
          if (text !== wanted) continue;
          if (!isVisible(btn)) continue;
          btn.click();
          return "CLICKED";
        }
        return "NOT_FOUND";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const homeRoot = home.shadowRoot || home;
          const dialog = homeRoot.querySelector("paper-dialog#delete");
          if (dialog) {
            const result = clickConfirmInDialog(dialog);
            if (result !== "NOT_FOUND") return result;
          }
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns DISMISSED when ts-home paper-dialog#delete is no longer open. */
export function deleteProjectDialogDismissedExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function dialogStillOpenInRoot(root) {
        const dialog = root.querySelector("paper-dialog#delete");
        if (dialog && dialogOpen(dialog)) return true;
        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          if (dialogStillOpenInRoot(el.shadowRoot)) return true;
        }
        return false;
      }

      if (dialogStillOpenInRoot(document)) return "STILL_OPEN";
      return "DISMISSED";
    })()
  `;
}

/** Clicks Review (done-all) in the open ts-project-info dialog. */
export function clickProjectInfoReviewExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickReviewIcon(info) {
        const icon = info.querySelector('iron-icon[icon="done-all"]');
        if (!icon) return "NO_ICON";
        if (!isVisible(icon)) return "NOT_VISIBLE";
        icon.click();
        return "CLICKED";
      }

      function findInRoot(root) {
        for (const info of root.querySelectorAll("ts-project-info")) {
          const result = clickReviewIcon(info);
          if (result === "CLICKED" || result === "NOT_VISIBLE") return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND" && nested !== "NO_ICON") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks arrow-back in ts-review header to return to the translate view. */
export function clickReviewBackArrowExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickBackInReview(review) {
        const icon = review.querySelector('#title iron-icon[icon="arrow-back"]');
        if (!icon) return "NO_ICON";
        if (!isVisible(icon)) return "NOT_VISIBLE";
        icon.click();
        return "CLICKED";
      }

      function findInRoot(root) {
        const review =
          root.querySelector('ts-review[data-route="review"]') ||
          root.querySelector("ts-review");
        if (review) {
          const result = clickBackInReview(review);
          if (result === "CLICKED" || result === "NOT_VISIBLE") return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND" && nested !== "NO_ICON") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns VISIBLE when dashboard review route (ts-review) is showing. */
export function reviewProjectScreenVisibleExpr() {
  const title = escapeForTemplate("Review Project");
  return `
    (function () {
      const expectedTitle = ${title};

      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      const pages = document.querySelector("neon-animated-pages");
      const route = pages && pages.selected;
      if (route && route !== "review") {
        return "WRONG_ROUTE:" + route;
      }

      function checkReviewInRoot(root) {
        const review =
          root.querySelector('ts-review[data-route="review"]') ||
          root.querySelector("ts-review");
        if (!review || !isVisible(review)) return null;

        const titleBar = review.querySelector("#title");
        if (!titleBar || !isVisible(titleBar)) return "NO_TITLE";

        const titleText = (titleBar.textContent || "").replace(/\\s+/g, " ").trim();
        if (!titleText.includes(expectedTitle)) return "TITLE_MISMATCH";

        return "VISIBLE";
      }

      function findInRoot(root) {
        const result = checkReviewInRoot(root);
        if (result) return result;

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns OPEN when ts-home-sidebar paper-menu-button#menu dropdown is open. */
export function homeSidebarMenuOpenExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function isMenuOpen(menuButton) {
        if (menuButton.opened === true) return true;

        const dropdown =
          menuButton.querySelector("#dropdown") ||
          (menuButton.shadowRoot && menuButton.shadowRoot.querySelector("#dropdown"));
        if (dropdown) {
          if (dropdown.getAttribute("aria-hidden") === "false") return true;
          const style = getComputedStyle(dropdown);
          if (style.display !== "none" && style.visibility !== "hidden") return true;
        }

        const settingsItem = menuButton.querySelector("paper-item[on-tap='settings']");
        if (settingsItem && isVisible(settingsItem)) return true;

        return false;
      }

      function findInRoot(root) {
        const sidebar = root.querySelector("ts-home-sidebar");
        if (sidebar) {
          const sidebarRoot = sidebar.shadowRoot || sidebar;
          const menuButton = sidebarRoot.querySelector("paper-menu-button#menu");
          if (menuButton) return isMenuOpen(menuButton) ? "OPEN" : "CLOSED";
          return "NO_MENU";
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks iron-icon#menuicon on ts-home-sidebar (more-vert dropdown trigger). */
export function clickHomeSidebarMenuIconExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickInSidebar(sidebar) {
        const sidebarRoot = sidebar.shadowRoot || sidebar;
        const menuButton = sidebarRoot.querySelector("paper-menu-button#menu");
        if (menuButton) {
          if (menuButton.opened === true) return "CLICKED";
          if (typeof menuButton.open === "function") {
            menuButton.open();
            return "CLICKED";
          }
          const icon =
            sidebarRoot.querySelector("iron-icon#menuicon.dropdown-trigger") ||
            sidebarRoot.querySelector("#menuicon");
          if (icon && isVisible(icon)) {
            icon.click();
            return "CLICKED";
          }
          if (typeof menuButton.toggle === "function") {
            menuButton.toggle();
            return "CLICKED";
          }
          menuButton.click();
          return "CLICKED";
        }
        return "NO_MENU";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const homeRoot = home.shadowRoot || home;
          const sidebar = homeRoot.querySelector("ts-home-sidebar");
          if (sidebar) {
            const result = clickInSidebar(sidebar);
            if (result !== "NO_MENU") return result;
          }
        }

        const sidebar = root.querySelector("ts-home-sidebar");
        if (sidebar) return clickInSidebar(sidebar);

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks the Update menu item icon (iron-icon[icon='maps:local-library']) in ts-home-sidebar. */
export function clickHomeSidebarUpdateIconExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickUpdateInSidebar(sidebar) {
        const sidebarRoot = sidebar.shadowRoot || sidebar;
        const menuButton = sidebarRoot.querySelector("paper-menu-button#menu");
        const searchRoot = menuButton || sidebarRoot;

        const icon =
          searchRoot.querySelector('iron-icon.smallicon[icon="maps:local-library"]') ||
          searchRoot.querySelector('iron-icon[icon="maps:local-library"]');
        if (icon && isVisible(icon)) {
          icon.click();
          return "CLICKED";
        }

        const item =
          searchRoot.querySelector("paper-item[on-tap='update']") ||
          (icon && icon.closest("paper-item"));
        if (item && isVisible(item)) {
          item.click();
          return "CLICKED";
        }

        return icon ? "NOT_VISIBLE" : "ITEM_NOT_FOUND";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const homeRoot = home.shadowRoot || home;
          const sidebar = homeRoot.querySelector("ts-home-sidebar");
          if (sidebar) {
            const result = clickUpdateInSidebar(sidebar);
            if (result !== "ITEM_NOT_FOUND") return result;
          }
        }

        const sidebar = root.querySelector("ts-home-sidebar");
        if (sidebar) return clickUpdateInSidebar(sidebar);

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns VISIBLE when paper-dialog#update shows ts-update-options with "Update Options" title. */
export function updateOptionsDialogVisibleExpr() {
  const title = escapeForTemplate("Update Options");
  return `
    (function () {
      const expectedTitle = ${title};

      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function checkUpdateOptions(options) {
        if (!options || !isVisible(options)) return "OPTIONS_HIDDEN";

        const heading =
          options.querySelector("#header h2") || options.querySelector("h2");
        if (!heading) return "NO_TITLE";

        const titleText = (heading.textContent || "").replace(/\\s+/g, " ").trim();
        if (titleText !== expectedTitle) return "TITLE_MISMATCH";

        if (!isVisible(heading)) return "TITLE_HIDDEN";
        return "VISIBLE";
      }

      function findInRoot(root) {
        const dialog = root.querySelector("paper-dialog#update");
        if (dialog && dialogOpen(dialog)) {
          const options = dialog.querySelector("ts-update-options");
          const result = checkUpdateOptions(options);
          if (result !== "OPTIONS_HIDDEN") return result;
          return "NO_OPTIONS";
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks Cancel (paper-button[dialog-dismiss]) in ts-update-options. */
export function clickUpdateOptionsCancelExpr() {
  const label = escapeForTemplate("Cancel");
  return `
    (function () {
      const wanted = ${label};

      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickCancelInOptions(options) {
        const dismiss = options.querySelector('paper-button[dialog-dismiss]');
        if (dismiss && isVisible(dismiss)) {
          dismiss.click();
          return "CLICKED";
        }

        for (const btn of options.querySelectorAll("paper-button")) {
          const text = (btn.textContent || "").replace(/\\s+/g, " ").trim();
          if (text !== wanted) continue;
          if (!isVisible(btn)) continue;
          btn.click();
          return "CLICKED";
        }
        return "NOT_FOUND";
      }

      function findInRoot(root) {
        for (const options of root.querySelectorAll("ts-update-options")) {
          const result = clickCancelInOptions(options);
          if (result === "CLICKED") return result;
        }

        const dialog = root.querySelector("paper-dialog#update");
        if (dialog) {
          const options = dialog.querySelector("ts-update-options");
          if (options) {
            const result = clickCancelInOptions(options);
            if (result !== "NOT_FOUND") return result;
          }
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks the Import menu item icon (iron-icon[icon='file-download']) in ts-home-sidebar. */
export function clickHomeSidebarImportIconExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickImportInSidebar(sidebar) {
        const sidebarRoot = sidebar.shadowRoot || sidebar;
        const menuButton = sidebarRoot.querySelector("paper-menu-button#menu");
        const searchRoot = menuButton || sidebarRoot;

        const icon =
          searchRoot.querySelector('iron-icon.smallicon[icon="file-download"]') ||
          searchRoot.querySelector('iron-icon[icon="file-download"]');
        if (icon && isVisible(icon)) {
          icon.click();
          return "CLICKED";
        }

        const item =
          searchRoot.querySelector("paper-item[on-tap='importmenu']") ||
          (icon && icon.closest("paper-item"));
        if (item && isVisible(item)) {
          item.click();
          return "CLICKED";
        }

        return icon ? "NOT_VISIBLE" : "ITEM_NOT_FOUND";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const homeRoot = home.shadowRoot || home;
          const sidebar = homeRoot.querySelector("ts-home-sidebar");
          if (sidebar) {
            const result = clickImportInSidebar(sidebar);
            if (result !== "ITEM_NOT_FOUND") return result;
          }
        }

        const sidebar = root.querySelector("ts-home-sidebar");
        if (sidebar) return clickImportInSidebar(sidebar);

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns VISIBLE when paper-dialog#import shows ts-import-options with "Import Options" title. */
export function importOptionsDialogVisibleExpr() {
  const title = escapeForTemplate("Import Options");
  return `
    (function () {
      const expectedTitle = ${title};

      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function checkImportOptions(options) {
        if (!options || !isVisible(options)) return "OPTIONS_HIDDEN";

        const heading =
          options.querySelector("#header h2") || options.querySelector("h2");
        if (!heading) return "NO_TITLE";

        const titleText = (heading.textContent || "").replace(/\\s+/g, " ").trim();
        if (titleText !== expectedTitle) return "TITLE_MISMATCH";

        if (!isVisible(heading)) return "TITLE_HIDDEN";
        return "VISIBLE";
      }

      function findInRoot(root) {
        const dialog = root.querySelector("paper-dialog#import");
        if (dialog && dialogOpen(dialog)) {
          const options = dialog.querySelector("ts-import-options");
          const result = checkImportOptions(options);
          if (result !== "OPTIONS_HIDDEN") return result;
          return "NO_OPTIONS";
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks Cancel (paper-button[dialog-dismiss]) in ts-import-options. */
export function clickImportOptionsCancelExpr() {
  const label = escapeForTemplate("Cancel");
  return `
    (function () {
      const wanted = ${label};

      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickCancelInOptions(options) {
        const dismiss = options.querySelector('paper-button[dialog-dismiss]');
        if (dismiss && isVisible(dismiss)) {
          dismiss.click();
          return "CLICKED";
        }

        for (const btn of options.querySelectorAll("paper-button")) {
          const text = (btn.textContent || "").replace(/\\s+/g, " ").trim();
          if (text !== wanted) continue;
          if (!isVisible(btn)) continue;
          btn.click();
          return "CLICKED";
        }
        return "NOT_FOUND";
      }

      function findInRoot(root) {
        for (const options of root.querySelectorAll("ts-import-options")) {
          const result = clickCancelInOptions(options);
          if (result === "CLICKED") return result;
        }

        const dialog = root.querySelector("paper-dialog#import");
        if (dialog) {
          const options = dialog.querySelector("ts-import-options");
          if (options) {
            const result = clickCancelInOptions(options);
            if (result !== "NOT_FOUND") return result;
          }
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks the Feedback menu item icon (iron-icon[icon='announcement']) in ts-home-sidebar. */
export function clickHomeSidebarFeedbackIconExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickFeedbackInSidebar(sidebar) {
        const sidebarRoot = sidebar.shadowRoot || sidebar;
        const menuButton = sidebarRoot.querySelector("paper-menu-button#menu");
        const searchRoot = menuButton || sidebarRoot;

        const icon =
          searchRoot.querySelector('iron-icon.smallicon[icon="announcement"]') ||
          searchRoot.querySelector('iron-icon[icon="announcement"]');
        if (icon && isVisible(icon)) {
          icon.click();
          return "CLICKED";
        }

        const item =
          searchRoot.querySelector("paper-item[on-tap='feedback']") ||
          (icon && icon.closest("paper-item"));
        if (item && isVisible(item)) {
          item.click();
          return "CLICKED";
        }

        return icon ? "NOT_VISIBLE" : "ITEM_NOT_FOUND";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const homeRoot = home.shadowRoot || home;
          const sidebar = homeRoot.querySelector("ts-home-sidebar");
          if (sidebar) {
            const result = clickFeedbackInSidebar(sidebar);
            if (result !== "ITEM_NOT_FOUND") return result;
          }
        }

        const sidebar = root.querySelector("ts-home-sidebar");
        if (sidebar) return clickFeedbackInSidebar(sidebar);

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns VISIBLE when paper-dialog#feedback shows ts-feedback with "Feedback" title. */
export function feedbackDialogVisibleExpr() {
  const title = escapeForTemplate("Feedback");
  return `
    (function () {
      const expectedTitle = ${title};

      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function dialogOpen(dialog) {
        if (dialog.opened === true) return true;
        if (dialog.getAttribute("aria-hidden") === "false") return true;
        return isVisible(dialog);
      }

      function checkFeedback(feedback) {
        if (!feedback || !isVisible(feedback)) return "FEEDBACK_HIDDEN";

        const heading =
          feedback.querySelector("#header h2") || feedback.querySelector("h2");
        if (!heading) return "NO_TITLE";

        const titleText = (heading.textContent || "").replace(/\\s+/g, " ").trim();
        if (titleText !== expectedTitle) return "TITLE_MISMATCH";

        if (!isVisible(heading)) return "TITLE_HIDDEN";
        return "VISIBLE";
      }

      function findInRoot(root) {
        const dialog = root.querySelector("paper-dialog#feedback");
        if (dialog && dialogOpen(dialog)) {
          const feedback = dialog.querySelector("ts-feedback");
          const result = checkFeedback(feedback);
          if (result !== "FEEDBACK_HIDDEN") return result;
          return "NO_FEEDBACK";
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks Cancel (paper-button[on-tap='close']) in ts-feedback. */
export function clickFeedbackCancelExpr() {
  const label = escapeForTemplate("Cancel");
  return `
    (function () {
      const wanted = ${label};

      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickCancelInFeedback(feedback) {
        const closeBtn = feedback.querySelector("paper-button[on-tap='close']");
        if (closeBtn && isVisible(closeBtn)) {
          closeBtn.click();
          return "CLICKED";
        }

        for (const btn of feedback.querySelectorAll("paper-button")) {
          const text = (btn.textContent || "").replace(/\\s+/g, " ").trim();
          if (text !== wanted) continue;
          if (!isVisible(btn)) continue;
          btn.click();
          return "CLICKED";
        }
        return "NOT_FOUND";
      }

      function findInRoot(root) {
        for (const feedback of root.querySelectorAll("ts-feedback")) {
          const result = clickCancelInFeedback(feedback);
          if (result === "CLICKED") return result;
        }

        const dialog = root.querySelector("paper-dialog#feedback");
        if (dialog) {
          const feedback = dialog.querySelector("ts-feedback");
          if (feedback) {
            const result = clickCancelInFeedback(feedback);
            if (result !== "NOT_FOUND") return result;
          }
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks the Settings menu item icon (iron-icon[icon='settings']) in ts-home-sidebar. */
export function clickHomeSidebarSettingsIconExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickSettingsInSidebar(sidebar) {
        const sidebarRoot = sidebar.shadowRoot || sidebar;
        const menuButton = sidebarRoot.querySelector("paper-menu-button#menu");
        const searchRoot = menuButton || sidebarRoot;

        const icon =
          searchRoot.querySelector('iron-icon.smallicon[icon="settings"]') ||
          searchRoot.querySelector('iron-icon[icon="settings"]');
        if (icon && isVisible(icon)) {
          icon.click();
          return "CLICKED";
        }

        const item =
          searchRoot.querySelector("paper-item[on-tap='settings']") ||
          (icon && icon.closest("paper-item"));
        if (item && isVisible(item)) {
          item.click();
          return "CLICKED";
        }

        return icon ? "NOT_VISIBLE" : "ITEM_NOT_FOUND";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const homeRoot = home.shadowRoot || home;
          const sidebar = homeRoot.querySelector("ts-home-sidebar");
          if (sidebar) {
            const result = clickSettingsInSidebar(sidebar);
            if (result !== "ITEM_NOT_FOUND") return result;
          }
        }

        const sidebar = root.querySelector("ts-home-sidebar");
        if (sidebar) return clickSettingsInSidebar(sidebar);

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Returns VISIBLE when dashboard settings route (ts-settings) is showing. */
export function settingsScreenVisibleExpr() {
  const title = escapeForTemplate("Settings");
  return `
    (function () {
      const expectedTitle = ${title};

      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      const pages = document.querySelector("neon-animated-pages");
      const route = pages && pages.selected;
      if (route && route !== "settings") {
        return "WRONG_ROUTE:" + route;
      }

      function checkSettingsInRoot(root) {
        const settings =
          root.querySelector('ts-settings[data-route="settings"]') ||
          root.querySelector("ts-settings");
        if (!settings || !isVisible(settings)) return null;

        const heading = settings.querySelector(".heading");
        if (!heading || !isVisible(heading)) return "NO_HEADING";

        const titleText = (heading.textContent || "").replace(/\\s+/g, " ").trim();
        if (!titleText.includes(expectedTitle)) return "TITLE_MISMATCH";

        return "VISIBLE";
      }

      function findInRoot(root) {
        const result = checkSettingsInRoot(root);
        if (result) return result;

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks arrow-back in ts-settings header to return to the previous route. */
export function clickSettingsBackArrowExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickBackInSettings(settings) {
        const icon =
          settings.querySelector('.heading iron-icon[icon="arrow-back"]') ||
          settings.querySelector('iron-icon.click[icon="arrow-back"]');
        if (!icon) return "NO_ICON";
        if (!isVisible(icon)) return "NOT_VISIBLE";
        icon.click();
        return "CLICKED";
      }

      function findInRoot(root) {
        const settings =
          root.querySelector('ts-settings[data-route="settings"]') ||
          root.querySelector("ts-settings");
        if (settings) {
          const result = clickBackInSettings(settings);
          if (result === "CLICKED" || result === "NOT_VISIBLE") return result;
        }

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND" && nested !== "NO_ICON") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}

/** Clicks the Logout menu item icon (iron-icon[icon='perm-identity']) in ts-home-sidebar. */
export function clickHomeSidebarLogoutIconExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function clickLogoutInSidebar(sidebar) {
        const sidebarRoot = sidebar.shadowRoot || sidebar;
        const menuButton = sidebarRoot.querySelector("paper-menu-button#menu");
        const searchRoot = menuButton || sidebarRoot;

        const icon =
          searchRoot.querySelector('iron-icon.smallicon[icon="perm-identity"]') ||
          searchRoot.querySelector('iron-icon[icon="perm-identity"]');
        if (icon && isVisible(icon)) {
          icon.click();
          return "CLICKED";
        }

        const item =
          searchRoot.querySelector("paper-item[on-tap='logout']") ||
          (icon && icon.closest("paper-item"));
        if (item && isVisible(item)) {
          item.click();
          return "CLICKED";
        }

        return icon ? "NOT_VISIBLE" : "ITEM_NOT_FOUND";
      }

      function findInRoot(root) {
        const home =
          root.querySelector("ts-home#home") || root.querySelector('ts-home[data-route="home"]');
        if (home) {
          const homeRoot = home.shadowRoot || home;
          const sidebar = homeRoot.querySelector("ts-home-sidebar");
          if (sidebar) {
            const result = clickLogoutInSidebar(sidebar);
            if (result !== "ITEM_NOT_FOUND") return result;
          }
        }

        const sidebar = root.querySelector("ts-home-sidebar");
        if (sidebar) return clickLogoutInSidebar(sidebar);

        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = findInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return findInRoot(document);
    })()
  `;
}
