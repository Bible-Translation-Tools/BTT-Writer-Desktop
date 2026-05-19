import { describe, test } from "node:test";
import {
  clickHomeSidebarMenuIconExpr,
  clickHomeSidebarSettingsIconExpr,
  clickSettingModalCancelExpr,
  clickSettingsBackArrowExpr,
  clickSettingsLanguageUrlExpr,
  homeSidebarMenuOpenExpr,
  languageUrlSettingModalVisibleExpr,
  settingsScreenVisibleExpr,
  welcomeHomeVisibleExpr,
} from "../expressions/home.mjs";
import { profileScreenVisibleExpr } from "../expressions/profile.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import { sleep, waitForEvalExact, waitForEvalState } from "../support/wait.mjs";

const WAIT_TIMEOUT_MS = 2000;

function printStep(name, result) {
  console.log(`[app-settings] ${name}: ${result}`);
}

describe("App settings", () => {
  test(
    "opens Languages URL setting from home sidebar Settings",
    { timeout: 20_000 },
    async () => {
      await withCdpSession(async ({ evaluate, target }) => {
        printStep("target", `${target.title || "unknown"} (${target.type})`);

        const profileState = await evaluate(profileScreenVisibleExpr());
        if (profileState === "VISIBLE") {
          throw new Error(
            "App is logged out (profile screen). Re-run the full e2e suite from user-profile-setup before app-settings."
          );
        }

        const settingsState = await evaluate(settingsScreenVisibleExpr());
        if (settingsState === "VISIBLE") {
          await waitForEvalExact(
            evaluate,
            clickSettingsBackArrowExpr,
            "CLICKED",
            WAIT_TIMEOUT_MS,
            "Failed to leave settings screen before app-settings test"
          );
          printStep("settings-back-recovery", "clicked");
          await sleep(500);
        }

        await waitForEvalState(
          evaluate,
          () => welcomeHomeVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected home screen before opening settings"
        );
        printStep("home-screen", "visible");

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarMenuIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click home sidebar menu icon"
        );
        printStep("menuicon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => homeSidebarMenuOpenExpr(),
          (state) => state === "OPEN",
          WAIT_TIMEOUT_MS,
          "Expected ts-home-sidebar menu to open"
        );
        printStep("sidebar-menu", "open");

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarSettingsIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Settings icon in ts-home-sidebar menu"
        );
        printStep("settings-icon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => settingsScreenVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected settings screen (ts-settings) with "Settings" in heading'
        );
        printStep("settings-screen", "visible");

        await waitForEvalExact(
          evaluate,
          clickSettingsLanguageUrlExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Languages URL setting (#languageurl) in ts-settings"
        );
        printStep("languageurl", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => languageUrlSettingModalVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected ts-setting-modal with "Languages URL" heading and URL input'
        );
        printStep("languageurl-modal", "visible");

        await waitForEvalExact(
          evaluate,
          clickSettingModalCancelExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Cancel in ts-setting-modal"
        );
        printStep("languageurl-modal-cancel", "clicked");
        await sleep(500);

        await waitForEvalExact(
          evaluate,
          clickSettingsBackArrowExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click arrow-back in ts-settings header"
        );
        printStep("settings-back-arrow", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => welcomeHomeVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected home screen after leaving settings"
        );
        printStep("home-screen-after-settings", "visible");

        console.log("[app-settings] PASS: Languages URL setting modal opened from app settings.");
      });
    }
  );
});
