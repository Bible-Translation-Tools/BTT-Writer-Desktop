import { describe, test } from "node:test";
import { clickByTextExprDeep } from "../expressions/shadow-click.mjs";
import { setProfileNameExpr } from "../expressions/profile.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import { sleep, waitForEvalState } from "../support/wait.mjs";

const PROFILE_NAME = process.env.BTT_PROFILE_NAME || "Tony (AI)";

function printStep(name, result) {
  console.log(`[profile-setup] ${name}: ${result}`);
}

describe("BTT E2E — user profile", () => {
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

      const step4 = await waitForEvalState(
        evaluate,
        () => clickByTextExprDeep("I Agree"),
        (state) => state === "CLICKED",
        7000,
        "Failed to click I Agree"
      );
      printStep("step-4-i-agree", step4);
      await sleep(1500);

      console.log("[profile-setup] PASS: local user profile setup completed.");
    });
  });
});
