import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { welcomeHomeVisibleExpr } from "../expressions/home.mjs";
import { clickByTextExprDeep, hasVisibleTextExpr } from "../expressions/shadow-click.mjs";
import {
  serverLoginFailureVisibleExpr,
  setServerLoginCredentialsExpr,
} from "../expressions/profile.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import { sleep, waitForEvalState } from "../support/wait.mjs";

const INVALID_USERNAME = "_@@@_invalid_user_@@@_";
const INVALID_PASSWORD = "_@@@_invalid_password_@@@_";
const WAIT_TIMEOUT_MS = 7000;

function printStep(name, result) {
  console.log(`[login-incorrect] ${name}: ${result}`);
}

describe("User login incorrect", () => {
  test(
    "shows login failed for invalid server credentials",
    { timeout: 20_000 },
    async () => {
      await withCdpSession(async ({ evaluate, target }) => {
        printStep("target", `${target.title || "unknown"} (${target.type})`);

        await waitForEvalState(
          evaluate,
          () => hasVisibleTextExpr("Login to your Server Account"),
          (state) => state === "FOUND",
          WAIT_TIMEOUT_MS,
          "Timed out waiting for Login to your Server Account to appear"
        );

        const step1 = await waitForEvalState(
          evaluate,
          () => clickByTextExprDeep("Login to your Server Account"),
          (state) => state === "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Login to your Server Account"
        );
        printStep("step-1-server-login-option", step1);
        await sleep(500);

        const step2 = await waitForEvalState(
          evaluate,
          () =>
            setServerLoginCredentialsExpr(INVALID_USERNAME, INVALID_PASSWORD),
          (state) => typeof state === "string" && state.startsWith("SET:"),
          WAIT_TIMEOUT_MS,
          "Failed to set server login username and password"
        );
        printStep("step-2-enter-credentials", step2);
        await sleep(500);

        const step3 = await waitForEvalState(
          evaluate,
          () => clickByTextExprDeep("Login"),
          (state) => state === "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Login"
        );
        printStep("step-3-submit-login", step3);

        const welcomeDuringLogin = await evaluate(welcomeHomeVisibleExpr());
        assert.notStrictEqual(
          welcomeDuringLogin,
          "VISIBLE",
          "Home screen must not be visible while server login is in progress"
        );
        printStep("welcome-during-login", String(welcomeDuringLogin));

        await waitForEvalState(
          evaluate,
          () => serverLoginFailureVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected login failure dialog with incorrect credentials message"
        );
        printStep("login-failure-dialog", "visible");

        const welcomeAfterFailure = await evaluate(welcomeHomeVisibleExpr());
        assert.notStrictEqual(
          welcomeAfterFailure,
          "VISIBLE",
          "Home screen must not be visible after failed server login"
        );
        printStep("welcome-after-failure", String(welcomeAfterFailure));

        console.log(
          "[login-incorrect] PASS: invalid server login shows failure dialog."
        );
      });
    }
  );
});
