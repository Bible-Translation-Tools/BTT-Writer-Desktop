'use strict';

class HtmlParseContext {
    constructor(chapterId, module) {
        this.chapterId = chapterId;
        this.module = module;
        this.htmlBuffer = [];
        this.footnotes = [];

        this.currentTextBuffer = "";
        this.isParagraphStart = true;
        this.inFootnote = false;
        this.footnoteBuffer = "";

        this.currentIndentLevel = 0;
        this.currentAlignment = "align-start";
        this.pendingVerseNumber = null;
        this.isItalic = false;
    }

    addText(text, isTrailing = false) {
        if (this.inFootnote) {
            this.footnoteBuffer += text;
            return;
        }

        if (text.trim().length > 0) {
            // If italic mode is on, wrap text
            const content = this.isItalic ? `<i>${this.escapeHtml(text)}</i>` : this.escapeHtml(text);
            this.currentTextBuffer += content;
            this.isParagraphStart = false;
        } else if (this.inFootnote && isTrailing) {
            this.captureFootnote(text);
        }
    }

    processMarker(marker, isCloser, argument) {
        if (this.inFootnote) {
            this.handleFootnoteMarker(marker, isCloser, argument);
            return;
        }

        switch (marker) {
            case "f":
                if (!isCloser) this.startFootnote();
                break;
            case "v":
                if (argument) this.handleVerse(argument);
                break;

            // Spacers
            case "b":
                this.addSpacerBlock();
                break;

            // Standard Paragraphs
            case "p":
            case "m":
                this.startBlock("align-start");
                break;

            // Alignment
            case "qa":
            case "qc":
            case "qd":
                this.startBlock("align-center", true); // true = default italic
                break;
            case "qr":
                this.startBlock("align-end");
                break;
            case "qs":
                if (!isCloser) this.startBlock("align-end");
                else this.flush();
                break;
            case "qac":
                // Inline italic toggle
                if (isCloser) this.currentTextBuffer += " "; // qac* usually adds space
                this.isItalic = !isCloser;
                break;

            case "c":
                // We ignore chapter marker if it's in the chunk file
                break;

            // Poetry
            default:
                if (marker.startsWith("qm")) {
                    this.startPoetryBlock(marker, true); // italic
                } else if (marker.startsWith("q")) {
                    this.startPoetryBlock(marker, false);
                } else {
                    // Unknown marker - append as text
                    this.currentTextBuffer += this.escapeHtml(`\\${marker}${argument}`);
                }
                break;
        }
    }

    handleVerse(number) {
        const isSpecialBlock = this.currentIndentLevel > 0 || this.currentAlignment !== "align-start";

        // Auto-flush if needed
        if (isSpecialBlock && !this.isParagraphStart) {
            this.flush();
        }

        if (this.isParagraphStart && isSpecialBlock) {
            // Capture for absolute positioning
            this.pendingVerseNumber = number;
        } else {
            // Inline verse
            this.currentTextBuffer += `<sup class="verse-num ${this.module}">${number}</sup> `;
        }
        this.isParagraphStart = false;
    }

    startPoetryBlock(marker, defaultItalic) {
        const digits = marker.match(/\d+/);
        const level = digits ? parseInt(digits[0], 10) : 1;

        this.isItalic = defaultItalic;

        // Poetry resets alignment to Start
        this.flush({ indent: level, align: "align-start" });
    }

    startBlock(alignment, defaultItalic = false) {
        this.isItalic = defaultItalic;
        this.flush({ indent: 0, align: alignment });
    }

    addSpacerBlock() {
        this.flush(); // Commit previous
        this.htmlBuffer.push(`<div class="paragraph spacer ${this.module}"></div>`);

        // Reset state
        this.currentIndentLevel = 0;
        this.currentAlignment = "align-start";
        this.isItalic = false;
    }

    startFootnote() {
        this.inFootnote = true;
        const index = this.footnotes.length + 1;
        const fnId = `caller-${this.chapterId}-${index}`;

        // Add link in text
        this.currentTextBuffer += `<a href="#${fnId}" class="footnote-caller-link ${this.module}"><sup>${index}</sup></a>`;
    }

    handleFootnoteMarker(marker, isCloser, argument) {
        if (marker === "f" && isCloser) {
            this.captureFootnote(this.footnoteBuffer);
            this.footnoteBuffer = "";
            this.inFootnote = false;
        } else if (argument) {
            this.footnoteBuffer += argument + " ";
        }
    }

    captureFootnote(rawContent) {
        const clean = rawContent.replace(/^\s*\S+\s*/, "").trim();
        if (clean.length > 0) {
            this.footnotes.push(clean);
        }
    }

    flush(newStyle = null) {
        if (this.inFootnote) return;

        // We add a block if there is text OR a pending absolute verse number
        if (this.currentTextBuffer.trim().length > 0 || this.pendingVerseNumber !== null) {

            // Build Classes
            const classes = [
                "paragraph",
                this.currentAlignment,
                `indent-${this.currentIndentLevel}`,
                this.module
            ].join(" ");

            // Build Inner HTML
            let innerHtml = "";

            // Inject Absolute Verse Number if present
            if (this.pendingVerseNumber !== null) {
                innerHtml += `<span class="verse-num verse-num-abs ${this.module}">${this.pendingVerseNumber}</span>`;
            }

            innerHtml += this.currentTextBuffer;

            this.htmlBuffer.push(`<div class="${classes}">${innerHtml}</div>`);
        }

        this.currentTextBuffer = "";
        this.isParagraphStart = true;
        this.pendingVerseNumber = null;

        if (newStyle) {
            this.currentIndentLevel = newStyle.indent;
            this.currentAlignment = newStyle.align;
        }
        // If newStyle is null, we stick with currentIndentLevel & currentAlignment
    }

    flushAndGetResult() {
        this.flush(); // Flush any remaining text
        return {
            html: this.htmlBuffer.join("\n"),
            footnotes: this.footnotes
        };
    }

    escapeHtml(text) {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

function usfmToHtml(usfm, chapterId, module) {
    const context = new HtmlParseContext(chapterId, module);

    // Regex: 1=Marker, 2=Closer(*), 3=Argument
    const usfmRegex = /\\([a-z0-9]+)(\*?)(?:\s+(\d+(?:-\d+)?))?[ \t]?/g;

    let lastIndex = 0;
    let match;

    while ((match = usfmRegex.exec(usfm)) !== null) {
        const markerIndex = match.index;
        const marker = match[1];
        const isCloser = match[2] === "*";
        const argument = match[3] || "";

        // Handle Gap Text
        if (markerIndex > lastIndex) {
            context.addText(usfm.substring(lastIndex, markerIndex));
        }

        // Process Marker
        context.processMarker(marker, isCloser, argument);

        lastIndex = markerIndex + match[0].length;
    }

    // Handle Trailing Text
    if (lastIndex < usfm.length) {
        context.addText(usfm.substring(lastIndex), true);
    }

    return context.flushAndGetResult();
}

module.exports = {
    HtmlParseContext,
    usfmToHtml
};
