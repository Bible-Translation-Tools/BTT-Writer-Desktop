import { describe, test } from "node:test";
import {
  clickProjectInfoIconExpr,
  clickExportOptionsCancelExpr,
  clickDeleteProjectConfirmExpr,
  clickPrintOptionsCancelExpr,
  clickProjectInfoDeleteExpr,
  clickProjectInfoPrintExpr,
  clickProjectInfoReviewExpr,
  clickProjectInfoUploadExportExpr,
  clickReviewBackArrowExpr,
  deleteProjectDialogDismissedExpr,
  deleteProjectDialogVisibleExpr,
  exportOptionsDialogDismissedExpr,
  exportOptionsDialogVisibleExpr,
  printOptionsDialogDismissedExpr,
  printOptionsDialogVisibleExpr,
  homeProjectBookLabelAbsentExpr,
  homeProjectBookVisibleExpr,
  projectInfoDialogVisibleExpr,
  reviewProjectScreenVisibleExpr,
  welcomeHomeVisibleExpr,
} from "../expressions/home.mjs";
import {
  clickMenuIconExpr,
  clickTranslateSidebarHomeExpr,
} from "../expressions/review.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import { sleep, waitForEvalExact, waitForEvalState } from "../support/wait.mjs";

const PROJECT_BOOK = "Philemon";
const WAIT_TIMEOUT_MS = 2000;
const REVIEW_LOAD_TIMEOUT_MS = 5_000;

function printStep(name, result) {
  console.log(`[project-info] ${name}: ${result}`);
}

describe("Project info actions", () => {
  test(
    "opens project details from the home list info icon",
    { timeout: 20_000 },
    async () => {
      await withCdpSession(async ({ evaluate, target }) => {
        printStep("target", `${target.title || "unknown"} (${target.type})`);

        await waitForEvalState(
          evaluate,
          () => homeProjectBookVisibleExpr(PROJECT_BOOK),
          (state) => state === "FOUND",
          WAIT_TIMEOUT_MS,
          `Expected visible span.bigspan with book name ${PROJECT_BOOK} on home project list`
        );
        printStep("project-book", PROJECT_BOOK);

        await waitForEvalExact(
          evaluate,
          () => clickProjectInfoIconExpr(PROJECT_BOOK),
          "CLICKED",
          WAIT_TIMEOUT_MS,
          `Failed to click project info icon for ${PROJECT_BOOK}`
        );
        printStep("info-icon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => projectInfoDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected project info dialog (paper-dialog#info / ts-project-info) to open"
        );
        printStep("info-dialog", "visible");

        await waitForEvalExact(
          evaluate,
          clickProjectInfoUploadExportExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Upload/Export icon (iron-icon[icon='file-upload']) in ts-project-info"
        );
        printStep("upload-export-icon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => exportOptionsDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected visible ts-export-options h2 "Upload/Export Options"'
        );
        printStep("export-options-title", "Upload/Export Options");

        await waitForEvalExact(
          evaluate,
          clickExportOptionsCancelExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Cancel (paper-button[dialog-dismiss]) in ts-export-options"
        );
        printStep("export-options-cancel", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => exportOptionsDialogDismissedExpr(),
          (state) => state === "DISMISSED",
          WAIT_TIMEOUT_MS,
          "Expected export options dialog to close after Cancel"
        );
        printStep("export-options-dialog", "dismissed");

        await waitForEvalExact(
          evaluate,
          () => clickProjectInfoIconExpr(PROJECT_BOOK),
          "CLICKED",
          WAIT_TIMEOUT_MS,
          `Failed to click project info icon again for ${PROJECT_BOOK}`
        );
        printStep("info-icon-again", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => projectInfoDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected project info dialog to open again"
        );
        printStep("info-dialog-again", "visible");

        await waitForEvalExact(
          evaluate,
          clickProjectInfoReviewExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Review icon (iron-icon[icon='done-all']) in ts-project-info"
        );
        printStep("review-icon", "clicked");

        await waitForEvalState(
          evaluate,
          () => reviewProjectScreenVisibleExpr(),
          (state) => state === "VISIBLE",
          REVIEW_LOAD_TIMEOUT_MS,
          'Expected review project screen (ts-review) with "Review Project" in title'
        );
        printStep("review-screen", "visible");

        await waitForEvalExact(
          evaluate,
          clickReviewBackArrowExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click arrow-back in ts-review header"
        );
        printStep("review-back-arrow", "clicked");
        await sleep(1500);

        await waitForEvalExact(
          evaluate,
          clickMenuIconExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to open translate sidebar menu (paper-menu-button#menu)"
        );
        printStep("sidebar-menu", "opened");
        await sleep(1500);

        await waitForEvalExact(
          evaluate,
          clickTranslateSidebarHomeExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Home menu item (paper-item[on-tap='gohome'])"
        );
        printStep("sidebar-home", "clicked");
        await sleep(1000);

        await waitForEvalState(
          evaluate,
          () => welcomeHomeVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected home screen after selecting Home from sidebar menu"
        );
        printStep("welcome-home", "visible");

        await waitForEvalExact(
          evaluate,
          () => clickProjectInfoIconExpr(PROJECT_BOOK),
          "CLICKED",
          WAIT_TIMEOUT_MS,
          `Failed to click project info icon after returning home for ${PROJECT_BOOK}`
        );
        printStep("info-icon-after-home", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => projectInfoDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected project info dialog to open after returning home"
        );
        printStep("info-dialog-after-home", "visible");

        await waitForEvalExact(
          evaluate,
          clickProjectInfoPrintExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Print icon (iron-icon[icon='print']) in ts-project-info"
        );
        printStep("print-icon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => printOptionsDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          'Expected visible ts-print-options h2 "Print/Export to PDF Options"'
        );
        printStep("print-options-title", "Print/Export to PDF Options");

        await waitForEvalExact(
          evaluate,
          clickPrintOptionsCancelExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Cancel (paper-button[dialog-dismiss]) in ts-print-options"
        );
        printStep("print-options-cancel", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => printOptionsDialogDismissedExpr(),
          (state) => state === "DISMISSED",
          WAIT_TIMEOUT_MS,
          "Expected print options dialog to close after Cancel"
        );
        printStep("print-options-dialog", "dismissed");

        await waitForEvalExact(
          evaluate,
          () => clickProjectInfoIconExpr(PROJECT_BOOK),
          "CLICKED",
          WAIT_TIMEOUT_MS,
          `Failed to click project info icon after print cancel for ${PROJECT_BOOK}`
        );
        printStep("info-icon-after-print-cancel", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => projectInfoDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected project info dialog to open again after print cancel"
        );
        printStep("info-dialog-after-print-cancel", "visible");

        await waitForEvalExact(
          evaluate,
          clickProjectInfoDeleteExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Delete icon (iron-icon[icon='delete']) in ts-project-info"
        );
        printStep("delete-icon", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => deleteProjectDialogVisibleExpr(),
          (state) => state === "VISIBLE",
          WAIT_TIMEOUT_MS,
          "Expected delete confirm dialog (paper-dialog#delete) after clicking Delete"
        );
        printStep("delete-dialog", "visible");

        await waitForEvalExact(
          evaluate,
          clickDeleteProjectConfirmExpr,
          "CLICKED",
          WAIT_TIMEOUT_MS,
          "Failed to click Confirm (paper-button[on-tap='deleteproject']) in delete dialog"
        );
        printStep("delete-confirm", "clicked");
        await sleep(500);

        await waitForEvalState(
          evaluate,
          () => deleteProjectDialogDismissedExpr(),
          (state) => state === "DISMISSED",
          WAIT_TIMEOUT_MS,
          "Expected delete dialog to close after Confirm"
        );
        printStep("delete-dialog-dismissed", "dismissed");

        await waitForEvalState(
          evaluate,
          () => homeProjectBookLabelAbsentExpr(PROJECT_BOOK),
          (state) => state === "ABSENT",
          WAIT_TIMEOUT_MS,
          `Expected ${PROJECT_BOOK} label (span.bigspan) to no longer appear on home project list after delete`
        );
        printStep("philemon-label", "absent");

        console.log(
          "[project-info] PASS: project info actions including project delete completed."
        );
      });
    }
  );
});
