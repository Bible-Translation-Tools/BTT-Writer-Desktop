import { escapeForTemplate } from "./shadow-click.mjs";

/** Matches i18n key `local_user_prompt` across shipped locales (see i18n/*.json). */
export const PROFILE_NAME_PLACEHOLDERS = new Set([
  "Full Name or Pseudonym",
  "Nombre Completo o Apodo",
  "Nom Complet ou Pseudonyme",
  "Nome Completo ou Pseudônimo",
  "Полное имя или псевдоним",
  "نام کامل یا مستعار",
]);

export function setProfileNameExpr(name) {
  const target = escapeForTemplate(name);
  const placeholdersJson = JSON.stringify([...PROFILE_NAME_PLACEHOLDERS]);
  return `
    (function () {
      var PLACEHOLDERS = new Set(${placeholdersJson});

      function isProfileNameField(node) {
        if (!node || node.tagName !== "INPUT") return false;
        if (node.type === "password" || node.type === "hidden" || node.type === "submit") return false;
        return PLACEHOLDERS.has(node.placeholder || "");
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
