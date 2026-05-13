import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { welcomeHomeVisibleExpr } from "../expressions/home.mjs";
import { clickByTextExprDeep } from "../expressions/shadow-click.mjs";
import { setProfileNameExpr } from "../expressions/profile.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import { sleep, waitForEvalState } from "../support/wait.mjs";

const PROFILE_NAME = "TEST USER";

function printStep(name, result) {
  console.log(`[profile-setup] ${name}: ${result}`);
}

describe("User profile setup", () => {
  test("creates local user profile", async () => {
    await withCdpSession(async ({ evaluate, target }) => {
      printStep("target", `${target.title || "unknown"} (${target.type})`);

      const step1 = await waitForEvalState(
        evaluate,
        () => clickByTextExprDeep("Create Local User Profile"),
        (state) => state === "CLICKED",
        7000,
        "Failed to click Create Local User Profile"
      );
      printStep("step-1-create-local-profile", step1);
      await sleep(1500);

      const step2 = await waitForEvalState(
        evaluate,
        () => setProfileNameExpr(PROFILE_NAME),
        (state) => typeof state === "string" && state.startsWith("SET:"),
        7000,
        "Failed to set profile name input"
      );
      printStep("step-2-enter-username", step2);
      await sleep(500);

      const step3 = await waitForEvalState(
        evaluate,
        () => clickByTextExprDeep("OK"),
        (state) => state === "CLICKED",
        7000,
        "Failed to click OK"
      );
      printStep("step-3-ok", step3);
      await sleep(1500);

      const welcomeBeforeAgree = await evaluate(welcomeHomeVisibleExpr());
      assert.notStrictEqual(
        welcomeBeforeAgree,
        "VISIBLE",
        "Home screen must not be visible before accepting terms"
      );
      printStep("welcome-before-i-agree", String(welcomeBeforeAgree));

      const step4 = await waitForEvalState(
        evaluate,
        () => clickByTextExprDeep("I Agree"),
        (state) => state === "CLICKED",
        7000,
        "Failed to click I Agree"
      );
      printStep("step-4-i-agree", step4);
      await sleep(1000);

      await waitForEvalState(
        evaluate,
        () => welcomeHomeVisibleExpr(),
        (state) => state === "VISIBLE",
        5000,
        "Expected ts-home #welcome to be visible (home screen, not hidden) when profile setup completes."
      );
      printStep("welcome", "visible");

      console.log("[profile-setup] PASS: local user profile setup completed.");
    });
  });
});
