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
