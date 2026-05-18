import { describe, test } from "node:test";
import {
  clickFeedbackCancelExpr,
  clickHomeSidebarFeedbackIconExpr,
  clickHomeSidebarImportIconExpr,
  clickHomeSidebarLogoutIconExpr,
  clickHomeSidebarMenuIconExpr,
  clickHomeSidebarSettingsIconExpr,
  clickHomeSidebarUpdateIconExpr,
  clickImportOptionsCancelExpr,
  clickSettingsBackArrowExpr,
  clickUpdateOptionsCancelExpr,
  feedbackDialogVisibleExpr,
  homeSidebarMenuOpenExpr,
  importOptionsDialogVisibleExpr,
  settingsScreenVisibleExpr,
  updateOptionsDialogVisibleExpr,
  welcomeHomeVisibleExpr,
} from "../expressions/home.mjs";
import { profileScreenVisibleExpr } from "../expressions/profile.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import { sleep, waitForEvalExact, waitForEvalState } from "../support/wait.mjs";

const WAIT_TIMEOUT_MS = 2000;

function printStep(name, result) {
  console.log(`[home-menu] ${name}: ${result}`);
}

describe("Home menu", () => {
  test(
    "opens the home sidebar menu",
    { timeout: 45_000 },
    async () => {
      await withCdpSession(async ({ evaluate, target }) => {
        printStep("target", `${target.title || "unknown"} (${target.type})`);

        const profileState = await evaluate(profileScreenVisibleExpr());
        if (profileState === "VISIBLE") {
          throw new Error(
            "App is logged out (profile screen). Re-run the full e2e suite from user-profile-setup, or log in manually before home-menu."
          );
        }

        const settingsState = await evaluate(settingsScreenVisibleExpr());
        if (settingsState === "VISIBLE") {
          await waitForEvalExact(
            evaluate,
            clickSettingsBackArrowExpr,
            "CLICKED",
            WAIT_TIMEOUT_MS,
            "Failed to leave settings screen before home menu test"
          );
          printStep("settings-back-recovery", "clicked");
          await sleep(500);
        }

        await waitForEvalState(
          evaluate,
          () => welcomeHomeVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected home screen before opening home sidebar menu"
        );
        printStep("home-screen", "visible");

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarMenuIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click home sidebar menu icon (iron-icon#menuicon on ts-home-sidebar)"
        );
        printStep("menuicon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => homeSidebarMenuOpenExpr(),
          (state) => state === "OPEN",
          WAIT_TIMEOUT_MS,
          "Expected ts-home-sidebar paper-menu-button#menu dropdown to open"
        );
        printStep("sidebar-menu", "open");

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarUpdateIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Update icon (iron-icon[icon='maps:local-library']) in ts-home-sidebar menu"
        );
        printStep("update-icon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => updateOptionsDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected visible ts-update-options h2 "Update Options"'
        );
        printStep("update-options-title", "Update Options");

        await waitForEvalExact(
          evaluate,
          clickUpdateOptionsCancelExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Cancel (paper-button[dialog-dismiss]) in ts-update-options"
        );
        printStep("update-options-cancel", "clicked");
        await sleep(500);

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarMenuIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to re-open home sidebar menu after closing Update Options"
        );
        printStep("menuicon-again", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => homeSidebarMenuOpenExpr(),
          (state) => state === "OPEN",
          WAIT_TIMEOUT_MS,
          "Expected ts-home-sidebar menu to open before Import"
        );
        printStep("sidebar-menu-again", "open");

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarImportIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Import icon (iron-icon[icon='file-download']) in ts-home-sidebar menu"
        );
        printStep("import-icon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => importOptionsDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected visible ts-import-options h2 "Import Options"'
        );
        printStep("import-options-title", "Import Options");

        await waitForEvalExact(
          evaluate,
          clickImportOptionsCancelExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Cancel (paper-button[dialog-dismiss]) in ts-import-options"
        );
        printStep("import-options-cancel", "clicked");
        await sleep(500);

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarMenuIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to re-open home sidebar menu after closing Import Options"
        );
        printStep("menuicon-feedback", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => homeSidebarMenuOpenExpr(),
          (state) => state === "OPEN",
          WAIT_TIMEOUT_MS,
          "Expected ts-home-sidebar menu to open before Feedback"
        );
        printStep("sidebar-menu-feedback", "open");

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarFeedbackIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Feedback icon (iron-icon[icon='announcement']) in ts-home-sidebar menu"
        );
        printStep("feedback-icon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => feedbackDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected visible ts-feedback h2 "Feedback"'
        );
        printStep("feedback-title", "Feedback");

        await waitForEvalExact(
          evaluate,
          clickFeedbackCancelExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Cancel (paper-button[on-tap='close']) in ts-feedback"
        );
        printStep("feedback-cancel", "clicked");
        await sleep(500);

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarMenuIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to re-open home sidebar menu after closing Feedback"
        );
        printStep("menuicon-settings", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => homeSidebarMenuOpenExpr(),
          (state) => state === "OPEN",
          WAIT_TIMEOUT_MS,
          "Expected ts-home-sidebar menu to open before Settings"
        );
        printStep("sidebar-menu-settings", "open");

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarSettingsIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Settings icon (iron-icon[icon='settings']) in ts-home-sidebar menu"
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
          "Expected home screen after returning from settings"
        );
        printStep("home-screen-after-settings", "visible");

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarMenuIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to re-open home sidebar menu before Logout"
        );
        printStep("menuicon-logout", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => homeSidebarMenuOpenExpr(),
          (state) => state === "OPEN",
          WAIT_TIMEOUT_MS,
          "Expected ts-home-sidebar menu to open before Logout"
        );
        printStep("sidebar-menu-logout", "open");

        await waitForEvalExact(
          evaluate,
          clickHomeSidebarLogoutIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Logout icon (iron-icon[icon='perm-identity']) in ts-home-sidebar menu"
        );
        printStep("logout-icon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => profileScreenVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected profile screen (ts-profile) with "User Profile" and "Create Local User Profile"'
        );
        printStep("profile-screen", "visible");

        console.log(
          "[home-menu] PASS: home sidebar menu items (Update, Import, Feedback, Settings, Logout) verified."
        );
      });
    }
  );
});
