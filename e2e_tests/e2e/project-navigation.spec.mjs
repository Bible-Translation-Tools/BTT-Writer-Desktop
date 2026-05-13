import { describe, test } from "node:test";
import {
  clickDoneIconExpr,
  clickEditIconForChunkExpr,
  clickMarkChunkDoneToggleExpr,
  clickVisibleDialogConfirmExpr,
  findTargetReviewParagraphByChunkRefExpr,
  setTextboxValueExpr,
} from "../expressions/review.mjs";
import { withCdpSession } from "../support/cdp-runtime.mjs";
import {
  sleep,
  waitForChunkRefVisibleWithScroll,
  waitForEvalExact,
  waitForTextboxContains,
  waitForVerseMarkerInChunk,
} from "../support/wait.mjs";

const CHUNK_REF = "Philemon 1:14–16";
const EDIT_TEXT = "\\v 14 But I did not want to do anything without your consent. I did not want your good deed to be from necessity but from good will. \\v 15 Perhaps for this he was separated from you for a time, so that you might have him back forever. \\v 16 No longer would he be a slave, but better than a slave, a beloved brother. He is beloved especially to me, and much more so to you, in both the flesh and in the Lord.";
const EXPECTED_TARGET_FINISHED_CHUNK_HTML =
  '<sup>14</sup>But I did not want to do anything without your consent. I did not want your good deed to be from necessity but from good will. <sup>15</sup>Perhaps for this he was separated from you for a time, so that you might have him back forever. <sup>16</sup>No longer would he be a slave, but better than a slave, a beloved brother. He is beloved especially to me, and much more so to you, in both the flesh and in the Lord.';
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

      await waitForEvalExact(
        evaluate,
        () => findTargetReviewParagraphByChunkRefExpr(CHUNK_REF, EXPECTED_TARGET_FINISHED_CHUNK_HTML),
        "OK",
        WAIT_TIMEOUT_MS,
        "Expected ts-target-review #content <p> (Philemon 1:14–16) innerHTML to match expected markup."
      );
      printStep("target-review-p", "OK");

      console.log("[chunk-nav] PASS: chunk navigation + edit + done + toggle + confirm completed.");
    });
  });
});
