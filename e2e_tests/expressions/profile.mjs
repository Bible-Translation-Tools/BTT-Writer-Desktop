import { escapeForTemplate } from "./shadow-click.mjs";

/** English labels for profile e2e (app must run with English UI). */
export const SERVER_LOGIN_OPTION_TITLE = "Login to your Server Account";
export const USERNAME_LABEL = "Username";
export const PASSWORD_LABEL = "Password";
export const LOGIN_FAILED_TITLE = "Login Failed";
export const BAD_LOGIN_USERNAME_MESSAGE = "Incorrect Username";
export const BAD_LOGIN_PASSWORD_MESSAGE = "Incorrect Password";
export const PROFILE_NAME_PLACEHOLDER = "Full Name or Pseudonym";

/**
 * Clicks the server-login row in ts-options-menu (div.option with on-tap="login").
 * Targets the option container, not only the inner span.optiontitle.
 */
export function clickServerLoginOptionExpr() {
  const title = escapeForTemplate(SERVER_LOGIN_OPTION_TITLE);
  return `
    (function () {
      var TITLE = ${title};

      function findOptionContainer(titleEl) {
        var node = titleEl;
        while (node) {
          if (node.classList && node.classList.contains("option")) return node;
          node = node.parentElement;
        }
        return null;
      }

      function clickInRoot(root) {
        var spans = root.querySelectorAll("span.optiontitle");
        for (var i = 0; i < spans.length; i++) {
          var span = spans[i];
          if ((span.textContent || "").trim() !== TITLE) continue;
          var option = findOptionContainer(span);
          if (!option) continue;
          var rect = option.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            option.click();
            return "CLICKED";
          }
        }
        var all = root.querySelectorAll("*");
        for (var j = 0; j < all.length; j++) {
          if (!all[j].shadowRoot) continue;
          var nested = clickInRoot(all[j].shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }

      return clickInRoot(document);
    })()
  `;
}

export function setProfileNameExpr(name) {
  const target = escapeForTemplate(name);
  const placeholder = escapeForTemplate(PROFILE_NAME_PLACEHOLDER);
  return `
    (function () {
      var PLACEHOLDER = ${placeholder};

      function isProfileNameField(node) {
        if (!node || node.tagName !== "INPUT") return false;
        if (node.type === "password" || node.type === "hidden" || node.type === "submit") return false;
        return (node.placeholder || "") === PLACEHOLDER;
      }

      function collectInputs(root, out) {
        Array.prototype.forEach.call(root.querySelectorAll("input"), function (node) {
          if (isProfileNameField(node)) out.push(node);
        });
        Array.prototype.forEach.call(root.querySelectorAll("*"), function (el) {
          if (el.shadowRoot) collectInputs(el.shadowRoot, out);
        });
      }

      function pickBest(candidates) {
        function visibleEnough(node) {
          try {
            node.scrollIntoView({ block: "center", inline: "nearest" });
          } catch (e) {}
          var r = node.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }
        for (var i = 0; i < candidates.length; i++) {
          if (visibleEnough(candidates[i])) return candidates[i];
        }
        return candidates.length ? candidates[0] : null;
      }

      var found = [];
      collectInputs(document, found);
      var input = pickBest(found);
      if (!input) return "NOT_FOUND";

      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      setter = setter && setter.set;
      if (!setter) return "SETTER_NOT_FOUND";

      setter.call(input, ${target});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return "SET:" + input.value;
    })()
  `;
}

export function setServerLoginCredentialsExpr(username, password) {
  const usernameValue = escapeForTemplate(username);
  const passwordValue = escapeForTemplate(password);
  const usernameLabel = escapeForTemplate(USERNAME_LABEL);
  const passwordLabel = escapeForTemplate(PASSWORD_LABEL);
  return `
    (function () {
      var USERNAME_LABEL = ${usernameLabel};
      var PASSWORD_LABEL = ${passwordLabel};

      function isUsernameField(node) {
        if (!node || node.tagName !== "INPUT") return false;
        if (node.type === "password" || node.type === "hidden" || node.type === "submit") return false;
        return (node.placeholder || "") === USERNAME_LABEL;
      }

      function isPasswordField(node) {
        if (!node || node.tagName !== "INPUT") return false;
        return node.type === "password" && (node.placeholder || "") === PASSWORD_LABEL;
      }

      function collectFields(root, usernameOut, passwordOut) {
        Array.prototype.forEach.call(root.querySelectorAll("input"), function (node) {
          if (isUsernameField(node)) usernameOut.push(node);
          if (isPasswordField(node)) passwordOut.push(node);
        });
        Array.prototype.forEach.call(root.querySelectorAll("*"), function (el) {
          if (el.shadowRoot) collectFields(el.shadowRoot, usernameOut, passwordOut);
        });
      }

      function pickBest(candidates) {
        function visibleEnough(node) {
          try {
            node.scrollIntoView({ block: "center", inline: "nearest" });
          } catch (e) {}
          var r = node.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }
        for (var i = 0; i < candidates.length; i++) {
          if (visibleEnough(candidates[i])) return candidates[i];
        }
        return candidates.length ? candidates[0] : null;
      }

      function setValue(input, value) {
        var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        setter = setter && setter.set;
        if (!setter) return "SETTER_NOT_FOUND";
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return input.value;
      }

      var usernameCandidates = [];
      var passwordCandidates = [];
      collectFields(document, usernameCandidates, passwordCandidates);
      var usernameInput = pickBest(usernameCandidates);
      var passwordInput = pickBest(passwordCandidates);
      if (!usernameInput) return "USERNAME_NOT_FOUND";
      if (!passwordInput) return "PASSWORD_NOT_FOUND";

      var usernameSet = setValue(usernameInput, ${usernameValue});
      if (usernameSet === "SETTER_NOT_FOUND") return "SETTER_NOT_FOUND";
      var passwordSet = setValue(passwordInput, ${passwordValue});
      if (passwordSet === "SETTER_NOT_FOUND") return "SETTER_NOT_FOUND";
      return "SET:" + usernameSet + "," + passwordSet;
    })()
  `;
}

export function serverLoginFailureVisibleExpr() {
  const title = escapeForTemplate(LOGIN_FAILED_TITLE);
  const badUsername = escapeForTemplate(BAD_LOGIN_USERNAME_MESSAGE);
  const badPassword = escapeForTemplate(BAD_LOGIN_PASSWORD_MESSAGE);
  return `
    (function () {
      var TITLE = ${title};
      var BAD_USERNAME = ${badUsername};
      var BAD_PASSWORD = ${badPassword};

      function collectVisibleTexts(root, out) {
        Array.prototype.forEach.call(root.querySelectorAll("*"), function (el) {
          var rect = el.getBoundingClientRect();
          var visible = rect.width > 0 && rect.height > 0;
          if (!visible) return;
          var text = (el.textContent || "").trim();
          if (text) out.add(text);
          if (el.shadowRoot) collectVisibleTexts(el.shadowRoot, out);
        });
      }

      var visible = new Set();
      collectVisibleTexts(document, visible);
      var hasTitle = false;
      var hasBody = false;
      visible.forEach(function (text) {
        if (text === TITLE) hasTitle = true;
        if (text === BAD_USERNAME || text === BAD_PASSWORD) hasBody = true;
      });
      if (hasTitle && hasBody) return "VISIBLE";
      if (hasTitle) return "TITLE_ONLY";
      if (hasBody) return "BODY_ONLY";
      return "NOT_FOUND";
    })()
  `;
}
