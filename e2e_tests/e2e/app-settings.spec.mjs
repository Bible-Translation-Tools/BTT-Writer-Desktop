import { describe, test } from "node:test";
import {
  clickSettingModalConfirmExpr,
  clickSettingsBackArrowExpr,
  setLanguageUrlSettingInputExpr,
  clickSettingModalRadioOptionExpr,
  clickSettingsLanguageUrlExpr,
  clickSettingsServerSuiteExpr,
  serverSuiteSettingModalVisibleExpr,
  languageUrlSettingHelpTextVisibleExpr,
  languageUrlSettingModalVisibleExpr,
  settingsHelpTextVisibleExpr,
  settingsScreenVisibleExpr,
  welcomeHomeVisibleExpr,
} from "../expressions/home.mjs";
import {
  clickProfileSidebarMenuIconExpr,
  clickProfileSidebarSettingsIconExpr,
  profileScreenVisibleExpr,
  profileSidebarMenuOpenExpr,
} from "../expressions/profile.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import { sleep, waitForEvalExact, waitForEvalState, waitForEvalStateWithReconnect } from "../support/wait.mjs";

const WAIT_TIMEOUT_MS = 2000;
const RELOAD_WAIT_TIMEOUT_MS = 20_000;
const LANGUAGE_URL = "https://test-url.com/langnames.json";
const SERVER_SUITE_OPTION = "WACS DEV";
const DATA_SERVER_URL = "https://content.wacsdev.org";

function printStep(name, result) {
  console.log(`[app-settings] ${name}: ${result}`);
}

describe("App settings", () => {
  test(
    "configure app settings in profile screen",
    { timeout: 30_000 },
    async () => {
      await withCdpSession(async ({ evaluate, target }) => {
        printStep("target", `${target.title || "unknown"} (${target.type})`);

        const homeState = await evaluate(welcomeHomeVisibleExpr());
        if (homeState === "VISIBLE") {
          throw new Error(
            "App is logged in (home screen). Run home-menu (logout) first or run the full e2e suite so app-settings starts on the profile screen."
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
          () => profileScreenVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected profile setup screen (ts-profile) with "Create Local User Profile" before opening settings'
        );
        printStep("profile-screen", "visible");

        await waitForEvalExact(
          evaluate,
          clickProfileSidebarMenuIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click profile sidebar menu icon"
        );
        printStep("profile-menuicon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => profileSidebarMenuOpenExpr(),
          (state) => state === "OPEN",
          WAIT_TIMEOUT_MS,
          "Expected ts-profile-sidebar menu to open"
        );
        printStep("profile-sidebar-menu", "open");

        await waitForEvalExact(
          evaluate,
          clickProfileSidebarSettingsIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Settings in ts-profile-sidebar menu"
        );
        printStep("profile-settings-icon", "clicked");
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

        await waitForEvalState(
          evaluate,
          () => setLanguageUrlSettingInputExpr(LANGUAGE_URL),
          (state) => typeof state === "string" && state === `SET:${LANGUAGE_URL}`,
          WAIT_TIMEOUT_MS,
          `Failed to set Languages URL input to ${LANGUAGE_URL}`
        );
        printStep("languageurl-input", LANGUAGE_URL);

        await waitForEvalExact(
          evaluate,
          clickSettingModalConfirmExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Confirm in ts-setting-modal"
        );
        printStep("languageurl-modal-confirm", "clicked");

        await waitForEvalState(
          evaluate,
          () => languageUrlSettingHelpTextVisibleExpr(LANGUAGE_URL),
          (state) => state === "MATCH",
          WAIT_TIMEOUT_MS,
          `Expected #languageurl .help-text to show ${LANGUAGE_URL} on settings screen`
        );
        printStep("languageurl-help-text", LANGUAGE_URL);

        await waitForEvalExact(
          evaluate,
          clickSettingsServerSuiteExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Server Suite setting (#serversuite) in ts-settings"
        );
        printStep("serversuite", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => serverSuiteSettingModalVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected ts-setting-modal with "Server Suite (e.g. WACS or DCS)" radio options'
        );
        printStep("serversuite-modal", "visible");

        await waitForEvalExact(
          evaluate,
          () => clickSettingModalRadioOptionExpr(SERVER_SUITE_OPTION),
          "CLICKED",
          WAIT_TIMEOUT_MS,
          `Failed to click "${SERVER_SUITE_OPTION}" radio option in ts-setting-modal`
        );
        printStep("serversuite-option", SERVER_SUITE_OPTION);

        await waitForEvalExact(
          evaluate,
          clickSettingModalConfirmExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Confirm in Server Suite ts-setting-modal"
        );
        printStep("serversuite-modal-confirm", "clicked");
        await sleep(500);

        await waitForEvalStateWithReconnect(
          evaluate,
          () => profileScreenVisibleExpr(),
          (state) => state === "VISIBLE",
          RELOAD_WAIT_TIMEOUT_MS,
          'Expected profile setup screen (ts-profile) with "Create Local User Profile" after server suite relaunch'
        );
        printStep("profile-screen-after-relaunch", "visible");
        await sleep(1000);
        
        await waitForEvalExact(
          evaluate,
          clickProfileSidebarMenuIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click profile sidebar menu icon after relaunch"
        );
        printStep("profile-menuicon-after-relaunch", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => profileSidebarMenuOpenExpr(),
          (state) => state === "OPEN",
          WAIT_TIMEOUT_MS,
          "Expected ts-profile-sidebar menu to open after relaunch"
        );
        printStep("profile-sidebar-menu-after-relaunch", "open");

        await waitForEvalExact(
          evaluate,
          clickProfileSidebarSettingsIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Settings in ts-profile-sidebar menu after relaunch"
        );
        printStep("profile-settings-icon-after-relaunch", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => settingsScreenVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected settings screen after reopening from profile screen'
        );
        printStep("settings-screen-after-relaunch", "visible");

        await waitForEvalState(
          evaluate,
          () =>
            settingsHelpTextVisibleExpr("dataserver", "Data Server", DATA_SERVER_URL),
          (state) => state === "MATCH",
          WAIT_TIMEOUT_MS,
          `Expected #dataserver .help-text to show ${DATA_SERVER_URL} after WACS DEV server suite`
        );
        printStep("dataserver-help-text", DATA_SERVER_URL);

        console.log(
          "[app-settings] PASS: Languages URL, Server Suite, and Data Server URL verified from app settings."
        );
      });
    }
  );
});
