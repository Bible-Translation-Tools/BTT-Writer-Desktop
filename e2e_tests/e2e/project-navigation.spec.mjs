import { describe, test } from "node:test";
import {
  clickDoneIconExpr,
  clickEditIconForChunkExpr,
  clickMarkChunkDoneToggleExpr,
  clickVisibleDialogConfirmExpr,
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

const CHUNK_REF = process.env.BTT_CHUNK_REF || "Philemon 1:14–16";
const EDIT_TEXT =
  process.env.BTT_EDIT_TEXT ||
  "\\v 14 Nhưng tôi không muốn làm bất cứ điều gì mà không có sự ưng thuận của anh. Tôi làm điều này để bất kỳ việc tốt nào được thực hiện đều không phải do tôi ép buộc anh, nhưng vì anh muốn làm điều đó. \\v 15 Có lẽ lý do cậu ấy bị chia cắt khỏi anh trong một khoảng thời gian, là để anh có thể có lại cậu ấy mãi mãi. \\v 16 Để cậu ta không còn như một nô lệ nữa, nhưng còn hơn cả một nô lệ, như là một anh em yêu dấu, đặc biệt là với tôi và sẽ càng yêu dấu cho anh hơn nữa, cả trong xác thịt lẫn trong Chúa.";

function printStep(name, result) {
  console.log(`[chunk-nav] ${name}: ${result}`);
}

describe("BTT E2E — project navigation (review)", () => {
  test("scrolls to chunk, edits target, marks done, confirms dialog", async () => {
    await withCdpSession(async ({ evaluate, target }) => {
      printStep("target", `${target.title || "unknown"} (${target.type})`);

      await waitForChunkRefVisibleWithScroll(evaluate, CHUNK_REF, 10000);
      printStep("chunk-ref", CHUNK_REF);

      await waitForEvalExact(
        evaluate,
        () => clickEditIconForChunkExpr(CHUNK_REF),
        "CLICKED",
        10000,
        `Failed to click edit icon for chunk: ${CHUNK_REF}`
      );
      printStep("edit-icon", "clicked");
      await sleep(500);

      await waitForEvalExact(
        evaluate,
        () => setTextboxValueExpr(EDIT_TEXT),
        "SET",
        10000,
        "Failed to set target edit textbox value"
      );
      await waitForTextboxContains(evaluate, EDIT_TEXT, 10000);
      printStep("textbox-input", EDIT_TEXT);

      await waitForEvalExact(
        evaluate,
        clickDoneIconExpr,
        "CLICKED",
        10000,
        "Failed to click done icon"
      );
      printStep("done", "clicked");

      await waitForChunkRefVisibleWithScroll(evaluate, CHUNK_REF, 10000);
      await waitForVerseMarkerInChunk(evaluate, CHUNK_REF, 15, 10000);
      printStep("verse-marker", "15");
      await sleep(1000);

      await waitForEvalExact(
        evaluate,
        () => clickMarkChunkDoneToggleExpr(CHUNK_REF),
        "CLICKED",
        10000,
        "Failed to click mark-chunk-done toggle"
      );
      printStep("mark-chunk-done", "clicked");

      await sleep(1000);

      await waitForEvalExact(
        evaluate,
        clickVisibleDialogConfirmExpr,
        "CLICKED",
        10000,
        "Failed to click dialog confirm button"
      );
      printStep("dialog-confirm", "clicked");

      console.log("[chunk-nav] PASS: chunk navigation + edit + done + toggle + confirm completed.");
    });
  });
});
