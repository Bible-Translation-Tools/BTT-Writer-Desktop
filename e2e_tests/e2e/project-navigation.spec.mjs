import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { welcomeHomeVisibleExpr } from "../expressions/home.mjs";
import {
  clickDoneIconExpr,
  clickEditIconForChunkExpr,
  clickMarkChunkDoneToggleExpr,
  clickMenuIconExpr,
  clickTranslateSidebarHomeExpr,
  clickVisibleDialogConfirmExpr,
  findTargetReviewParagraphByChunkRefExpr,
  setTextboxValueExpr,
} from "../expressions/review.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import {
  sleep,
  waitForChunkRefVisibleWithScroll,
  waitForEvalExact,
  waitForEvalState,
  waitForTextboxContains,
  waitForVerseMarkerInChunk,
} from "../support/wait.mjs";

const CHUNK_REF = "Philemon 1:14–16";
const EDIT_TEXT = "\\v 14 Verse 14 \\v 15 Verse 15 \\v 16 Verse 16";
const EXPECTED_TARGET_FINISHED_CHUNK_HTML =
  '<sup>14</sup>Verse 14 <sup>15</sup>Verse 15 <sup>16</sup>Verse 16';
const WAIT_TIMEOUT_MS = 5000;

function printStep(name, result) {
  console.log(`[chunk-nav] ${name}: ${result}`);
}

describe("Draft chunk content", () => {
  test("scrolls to chunk, edits target, marks done, confirms dialog", async () => {
    await withCdpSession(async ({ evaluate, target }) => {
      printStep("target", `${target.title || "unknown"} (${target.type})`);

      await waitForChunkRefVisibleWithScroll(evaluate, CHUNK_REF, WAIT_TIMEOUT_MS);
      printStep("chunk-ref", CHUNK_REF);

      await waitForEvalExact(
        evaluate,
        () => clickEditIconForChunkExpr(CHUNK_REF),
        "CLICKED",
        WAIT_TIMEOUT_MS,
        `Failed to click edit icon for chunk: ${CHUNK_REF}`
      );
      printStep("edit-icon", "clicked");
      await sleep(500);

      await waitForEvalExact(
        evaluate,
        () => setTextboxValueExpr(EDIT_TEXT),
        "SET",
        WAIT_TIMEOUT_MS,
        "Failed to set target edit textbox value"
      );
      await waitForTextboxContains(evaluate, EDIT_TEXT, WAIT_TIMEOUT_MS);
      printStep("textbox-input", EDIT_TEXT);

      await waitForEvalExact(
        evaluate,
        clickDoneIconExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Failed to click done icon"
      );
      printStep("done", "clicked");

      await waitForChunkRefVisibleWithScroll(evaluate, CHUNK_REF, WAIT_TIMEOUT_MS);
      await waitForVerseMarkerInChunk(evaluate, CHUNK_REF, 15, WAIT_TIMEOUT_MS);
      printStep("verse-marker", "15");
      await sleep(1000);

      await waitForEvalExact(
        evaluate,
        () => clickMarkChunkDoneToggleExpr(CHUNK_REF),
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Failed to click mark-chunk-done toggle"
      );
      printStep("mark-chunk-done", "clicked");

      await sleep(1000);

      await waitForEvalExact(
        evaluate,
        clickVisibleDialogConfirmExpr,
        "CLICKED",
        WAIT_TIMEOUT_MS,
        "Failed to click dialog confirm button"
      );
      printStep("dialog-confirm", "clicked");

      await sleep(1000);

      await waitForEvalExact(
        evaluate,
        () => findTargetReviewParagraphByChunkRefExpr(CHUNK_REF, EXPECTED_TARGET_FINISHED_CHUNK_HTML),
        "OK",
        WAIT_TIMEOUT_MS,
        "Expected first visible ts-target-review with chunk ref span and #textholder .style-scope.ts-target-review innerHTML match."
      );
      printStep("target-review-p", "OK");

      assert.ok(
        typeof process.env.HOME === "string" && process.env.HOME.length > 0,
        "HOME must be set (e.g. Linux CI) to assert ~/.config/BTT-Writer target translation path."
      );
      const expectedTargetFile = path.join(
        process.env.HOME,
        ".config",
        "BTT-Writer",
        "targetTranslations",
        "aac_phm_text_reg",
        "01",
        "14.txt"
      );
      assert.ok(
        existsSync(expectedTargetFile),
        `Expected on-disk target chunk file after confirm: ${expectedTargetFile}`
      );
      printStep("target-file-on-disk", expectedTargetFile);

      const onDiskUsfm = readFileSync(expectedTargetFile, "utf8");
      assert.equal(
        onDiskUsfm,
        EDIT_TEXT,
        `14.txt USFM must match saved target (expected \\v 14 Verse 14 \\v 15 Verse 15 \\v 16 Verse 16)`
      );
      printStep("target-file-content", "OK");

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
        "Expected home screen (#welcome) after selecting Home from sidebar menu"
      );
      printStep("welcome-home", "visible");

      console.log(
        "[chunk-nav] PASS: chunk navigation + edit + done + toggle + confirm + go home completed."
      );
    });
  });
});
