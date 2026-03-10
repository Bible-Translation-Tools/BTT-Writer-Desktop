'use strict';

const path = require('path');
const { usfmToHtml } = require('./usfmparse');

function Renderer() {

    return {

        convertVerseMarkers: function (text) {
            const expression = new RegExp(/(\s*<verse[^<>"]*")(\d+-?\d*)("[^<>]*>)/);
            const verses = [];

            while (expression.test(text)) {
                const versestr = expression.exec(text)[2];

                if (versestr.indexOf("-") < 0) {
                    verses.push(parseInt(versestr));
                } else {
                    const firstnum = parseInt(versestr.substring(0, versestr.search("-")));
                    const lastnum = parseInt(versestr.substring(versestr.search("-") + 1));
                    for (let j = firstnum; j <= lastnum; j++) {
                        verses.push(j);
                    }
                }
                text = text.replace(expression, " \\v " + versestr + " ");
            }
            return {text: text, verses: verses};
        },

        convertNoteMarkers: function (text) {
            const expression = new RegExp(/(<note[^<>]*>)([^]+?)(<\/note>)/);

            while (expression.test(text)) {
                let notestr = expression.exec(text)[2];
                const tagtest = new RegExp(/<[^<>]*>/g);
                const quotetest = new RegExp(/(<char[^<>]*fqa">)([^]+?)(<\/char>)/);

                while (quotetest.test(notestr)) {
                    const quotestr = quotetest.exec(notestr)[2].trim();

                    notestr = notestr.replace(quotetest, '"' + quotestr + '" ');
                }

                notestr = notestr.replace(tagtest, "");
                notestr = notestr.replace(/'/g, '&apos;');

                const marker = "<ts-note-marker text='" + notestr + "'></ts-note-marker>";

                text = text.replace(expression, marker);
            }
            return text;
        },

        removeParaTags: function (text) {
            const test = new RegExp(/<\/?para[^<>]*>/g);
            text = text.replace(test, "");
            return text.trim();
        },

        removeCharTags: function (text) {
            const test = new RegExp(/<\/?char[^<>]*>/g);
            text = text.replace(test, "");
            return text.trim();
        },

        migrateMarkers: function (text) {
            const vtest = new RegExp(/ ?[\\\/]v ?(?=\d)/g);
            const ctest = new RegExp(/ ?[\\\/]c ?(?=\d)/g);
            const vreplace = " \\v ";
            const creplace = "\\c ";

            text = text.replace(vtest, vreplace);
            text = text.replace(ctest, creplace);

            return text.trim();
        },

        removeChapterMarkers: function (text) {
            const expression = new RegExp(/\\c \d+\s+/g);

            return text.replace(expression, "");
        },

        renderSuperscriptVerses: function (text) {
            const expression = new RegExp(/(\\v )(\d+-?\d*)(\s+)/);

            while (expression.test(text)) {
                const versestr = expression.exec(text)[2];

                text = text.replace(expression, `<sup>${versestr}</sup>`);
            }

            return text.trim();
        },

        renderParagraphs: function (text, module) {
            const expression = new RegExp(/([^>\r\n]*)(\r\n|\r|\n)/);
            const container = document.createElement('div');

            text = text + "\n";

            while (expression.test(text)) {
                let paragraph = expression.exec(text)[1];

                if (!paragraph) {
                    paragraph = "&nbsp;";
                }

                const div = document.createElement('div');
                div.className = `style-scope ${module}`;
                div.innerHTML = paragraph;

                container.appendChild(div);

                // Remove the processed part from text
                text = text.replace(expression, '');
            }

            return container.innerHTML;
        },

        renderTargetWithVerses: function (text, module) {
            text = this.replaceParagraphs(text);
            text = this.renderParagraphs(text, module);
            text = this.renderSuperscriptVerses(text);

            return text;
        },

        replaceConflictCode: function (text) {
            const starttest = new RegExp(/<{7} HEAD(?:\r\n|\r|\n)/g);
            const midtest = new RegExp(/={7}(?:\r\n|\r|\n)/g);
            const endtest = new RegExp(/>{7} \w{40}(?:\r\n|\r|\n)?/g);

            text = text.replace(starttest, "<S>");
            text = text.replace(midtest, "<M>");
            text = text.replace(endtest, "<E>");

            return text;
        },

        parseConflicts: function (text) {
            const conflictTest = new RegExp(/([^<>]*)(<S>)([^<>]*)(<M>)([^<>]*)(<E>)([^<>]*)/);
            const optionTest = new RegExp(/(@s@)([^]+?)(@e@)/);
            const confirmTest = new RegExp(/<([SME])>/);
            const startMarker = "@s@";
            const endMarker = "@e@";
            let exists = false;
            let conArray = [];

            while (conflictTest.test(text)) {
                const pieces = conflictTest.exec(text);

                if (!optionTest.test(pieces[3])) {
                    pieces[3] = startMarker + pieces[3] + endMarker;
                }
                if (!optionTest.test(pieces[5])) {
                    pieces[5] = startMarker + pieces[5] + endMarker;
                }

                let newContent = pieces[3] + pieces[5];

                if (pieces[1]) {
                    newContent = newContent.replace(/@s@/g, startMarker + pieces[1]);
                }
                if (pieces[7]) {
                    newContent = newContent.replace(/@e@/g, pieces[7] + endMarker);
                }

                text = text.replace(conflictTest, newContent);
                exists = true;
            }

            if (exists) {
                while (optionTest.test(text)) {
                    const option = optionTest.exec(text)[2];

                    conArray.push(option.trim());
                    text = text.replace(optionTest, "");
                }

                conArray = _.uniq(conArray);
            }

            if (confirmTest.test(text)) {
                exists = true;
                conArray.push("Conflict Parsing Error");
            }

            return {exists: exists, array: conArray};
        },

        consolidateHelpsConflict: function (text) {
            const conflicttest = new RegExp(/^([^<>]*)(<S>)([^<>]*)(<M>)([^<>]*)(<E>)([^]*)/);
            const confirmtest = new RegExp(/<([SME])>/);
            const errormsg = [{title: "Conflict Parsing Error", body: "Conflict Parsing Error"}];
            const start = "<S>";
            const middle = "<M>";
            const end = "<E>";
            let first = "";
            let second = "";

            if (conflicttest.test(text)) {
                while (conflicttest.test(text)) {
                    const pieces = conflicttest.exec(text);

                    first += pieces[1] + pieces[3];
                    second += pieces[1] + pieces[5];
                    text = pieces[7];
                }

                first += text;
                second += text;

                return start + first + middle + second + end;
            } else if (confirmtest.test(text)) {
                return start + errormsg + middle + errormsg + end;
            } else {
                return text;
            }
        },

        replaceEscapes: function (text) {
            text = text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/]/g, "\\]").replace(/\^/g, "\\^").replace(/\$/g, "\\$");
            text = text.replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\?/g, "\\?").replace(/\./g, "\\.").replace(/\//g, "\\/");
            text = text.replace(/\+/g, "\\+").replace(/\*/g, "\\*").replace(/\{/g, "\\{").replace(/}/g, "\\}").replace(/\|/g, "\\|");

            return text;
        },

        replaceParagraphs: function (text) {
            return text.replace(/\\p\W?/g, "\n");
        },

        paragraphsToBreaks: function (text) {
            return text.replace(/\n/g, '<br>');
        },

        displayConflicts: function (content) {
            const conflicts = this.parseConflicts(this.replaceConflictCode(content));
            let text = "";

            if (conflicts.exists) {
                text += "\n***Start of Conflict***\n";
                for (let i = 0; i < conflicts.array.length; i++) {
                    text += "***Option " + (i +1) + "***\n";
                    text += this.removeChapterMarkers(conflicts.array[i]) + "\n";
                }
                text += "***End of Conflict***\n";
                return text;
            } else {
                return content;
            }
        },

        renderPrintPreview: function (chunks, options, pagetitle) {
            const mythis = this;
            const module = "ts-print";

            const chapters = [];
            _.forEach(_.groupBy(chunks, function(chunk) {
                return chunk.chunkmeta.chapter;
            }), function (data, chap) {
                let content = "";
                let title = "";

                _.forEach(data, function (chunk) {
                    if (chunk.chunkmeta.frameid === "title") {
                        // Use transcontent if available, otherwise srccontent
                        title = chunk.transcontent || chunk.srccontent;
                    }
                    if (chunk.chunkmeta.frame > 0 && chunk.transcontent) {
                        if (options.includeIncompleteFrames || chunk.completed) {
                            content += mythis.displayConflicts(chunk.transcontent) + " ";
                        }
                    }
                });

                if (chap > 0) {
                    chapters.push({id: chap, title: title, content: content.trim()});
                }
            });

            function createScopedElement(tag, extraClasses = []) {
                const el = document.createElement(tag);
                // Add default 'style-scope' and module class
                el.classList.add("style-scope", module);
                if (extraClasses.length > 0) {
                    el.classList.add(...extraClasses);
                }
                return el;
            }

            function createPageTitleEl() {
                const el = createScopedElement("div", ["page-title", "centered"]);
                el.textContent = pagetitle || "";
                return el;
            }

            const fragment = document.createDocumentFragment();

            // If not in 'newpage' mode, the title sits outside the main container
            if (!options.newpage && options.pagetitle) {
                fragment.appendChild(createPageTitleEl());
            }

            const chaptersContainer = createScopedElement("div");
            chaptersContainer.id = "startnum";

            chapters.forEach(function (chapter, index) {
                if (!chapter.content) return;

                // If 'newpage' is on, title repeats inside the container before every chapter
                if (options.newpage && options.pagetitle) {
                    chaptersContainer.appendChild(createPageTitleEl());
                }

                const header = createScopedElement("h2");
                // Using innerHTML allows formatting within titles if necessary
                header.innerHTML = chapter.title;
                chaptersContainer.appendChild(header);

                const contentClasses = [];
                if (options.doubleSpace) contentClasses.push("double");
                if (options.justify) contentClasses.push("justify");
                if (options.newpage) contentClasses.push("break");

                const chapterDiv = createScopedElement("div", contentClasses);

                // Render verses content
                const result = usfmToHtml(chapter.content, chapter.id, module);
                chapterDiv.innerHTML = result.html;

                chaptersContainer.appendChild(chapterDiv);

                if (result.footnotes.length > 0) {
                    const footnotesDiv = document.createElement("div");
                    footnotesDiv.className = `footnotes ${module}`;

                    result.footnotes.forEach(function (footnote, index) {
                        const order = (index + 1);
                        const noteDiv = document.createElement("div");
                        const orderSup = document.createElement("sup");
                        orderSup.className = `footnote-caller-target ${module}`;
                        orderSup.textContent = order + " ";

                        const backLink = document.createElement("a");
                        backLink.href = `#source-caller-${chapter.id}-${order}`;
                        backLink.className = `footnote-back-link ${module}`;
                        backLink.style.cursor = "pointer";
                        backLink.appendChild(orderSup);

                        noteDiv.id = `caller-${chapter.id}-${order}`;
                        noteDiv.appendChild(backLink);

                        const noteText = document.createElement("span");
                        noteText.textContent = footnote;
                        noteDiv.appendChild(noteText);

                        footnotesDiv.appendChild(noteDiv);
                    })

                    chapterDiv.appendChild(footnotesDiv);
                }
            });

            fragment.appendChild(chaptersContainer);
            const output = document.createElement("div");
            output.appendChild(fragment);

            return output.innerHTML;
        },

        renderObsPrintPreview: function (chunks, options, imagePath) {
            const mythis = this;
            const module = "ts-print";
            const startheader = "\<h2 class='style-scope " + module + "'\>";
            const endheader = "\<\/h2\>";
            const startp = "\<p class='style-scope " + module + "'\>";
            const endp = "\<\/p\>";
            let add = "";
            if (options.doubleSpace) {
                add += "double ";
            }
            if (options.justify) {
                add += "justify ";
            }
            const startbreakdiv = "\<div class='style-scope break " + add + module + "'\>";
            const starttocdiv = "\<div class='style-scope double break toc " + module + "'\>";
            const starttitlediv1 = "\<div id='chap";
            const starttitlediv2 = "' class='style-scope break titles " + module + "'\>";
            const startnobreakdiv = "\<div class='style-scope nobreak " + module + "'\>";
            const enddiv = "\<\/div\>";
            const chapters = [];
            let text = "\<div id='startnum' class='style-scope " + module + "'\>";
            let toc = starttocdiv + startheader + "Table of Contents" + endheader;
            const startadiv1 = "\<div class='style-scope " + module + "'\>\<a class='style-scope " + module + "' href='#chap";
            const startadiv2 = "'\>";
            const endadiv = "\<\/a\>\<\/div\>";

            _.forEach(_.groupBy(chunks, function(chunk) {
                return chunk.chunkmeta.chapter;
            }), function (data, chap) {
                let content = "";
                let title = "";
                let ref = "";

                _.forEach(data, function (chunk) {
                    if (chunk.chunkmeta.frameid === "title") {
                        title = chunk.transcontent || chunk.srccontent;
                    }
                    if (chunk.chunkmeta.frameid === "reference") {
                        ref = chunk.transcontent || chunk.srccontent;
                    }
                    if (chunk.chunkmeta.frame > 0 && chunk.transcontent) {
                        if (options.includeIncompleteFrames || chunk.completed) {
                            if (options.includeImages) {
                                const image = path.join(imagePath, chunk.projectmeta.resource.id + "-en-" + chunk.chunkmeta.chapterid + "-" + chunk.chunkmeta.frameid + ".jpg");
                                content += startnobreakdiv + "\<img src='" + image + "'\>";
                                content += startp + mythis.displayConflicts(chunk.transcontent) + endp + enddiv;
                            } else {
                                content += mythis.displayConflicts(chunk.transcontent) + " ";
                            }
                        }
                    }
                });

                if (chap > 0) {
                    chapters.push({chapter: chap, title: title, reference: ref, content: content.trim()});
                }
            });

            chapters.forEach(function (chapter) {
                if (chapter.content) {
                    toc += startadiv1 + chapter.chapter + startadiv2 + chapter.title + endadiv;
                    text += starttitlediv1 + chapter.chapter + starttitlediv2 + startheader + chapter.title + endheader + startheader + chapter.reference + endheader + enddiv;
                    text += startbreakdiv + chapter.content + enddiv;
                }
            });

            toc += enddiv;

            return toc + text + enddiv;
        },

        renderResource: function (data, linksEnabled, module) {
            const container = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.className = `style-scope ${module}`;
            h2.textContent = data.title;
            const div = document.createElement('div');
            div.className = `style-scope ${module}`;
            div.innerHTML = this.renderResourceLinks(data.body, linksEnabled, module);

            container.appendChild(h2);
            container.appendChild(div);

            return container.innerHTML;
        },

        renderResourceLinks: function (text, linksEnabled, module) {
            const tmLinkTest = new RegExp(/\[\[:en:ta:([^:]*):([^:]*):([^:\]]*)]]/);
            const bibleLinkTest = new RegExp(/(\[\[:en:bible)(:[^:]*:)(\w*:\d*:\d*)(\|[^\]]*]])/);
            let linkSlug;
            let startLink;
            const enda = "\<\/a\>";

            while (tmLinkTest.test(text)) {
                const linkSection = tmLinkTest.exec(text)[2];
                linkSlug = tmLinkTest.exec(text)[3];

                const linkName = this.translate("translation_manual", `${linkSection}/${linkSlug}`);
                let target;

                if (linksEnabled) {
                    target = `<a class="style-scope link tmlink ${module}" data-section="${linkSection}" data-slug="${linkSlug}">${linkName}</a>`;
                } else {
                    target = linkName;
                }

                text = text.replace(tmLinkTest, target);
            }

            while (bibleLinkTest.test(text)) {
                linkSlug = bibleLinkTest.exec(text)[3];
                const chapter = parseInt(linkSlug.split(":")[1]);
                const verse = parseInt(linkSlug.split(":")[2]);

                startLink = "\<a href='" + linkSlug + "' class='style-scope link biblelink " + module + "' id='" + chapter + ":" + verse + "'\>";

                text = text.replace(bibleLinkTest, startLink + chapter + ":" + verse + enda);
            }

            text = this.removeHrefPaths(text); // remove relative resource path to avoid crashing when clicked

            return text;
        },

        removeHrefPaths: function(text) {
            const hrefRegex = new RegExp(/\s*href=".*?"/);
            while (hrefRegex.test(text)) {
                text = text.replace(hrefRegex, '');
            }
            return text;
        },

        validateVerseMarkers: function (text, verses) {
            let returnstr = text.trim();
            const used = [];
            let addon = "";
            const versetest = new RegExp(/\s*\\v\s*(\d+)\s*/);
            const cleantest = new RegExp(/\\fv/g);

            while (versetest.test(returnstr)) {
                const versenum = parseInt(versetest.exec(returnstr)[1]);
                let replace = " ";

                if (verses.indexOf(versenum) >= 0 && used.indexOf(versenum) === -1) {
                    replace = " \\fv " + versenum + " ";
                    used.push(versenum);
                }
                returnstr = returnstr.replace(versetest, replace);
            }

            returnstr = returnstr.replace(cleantest, "\\v");

            if (returnstr) {
                for (let k = 0; k < verses.length; k++) {
                    if (used.indexOf(verses[k]) < 0) {
                        addon += "\\v " + verses[k] + " ";
                    }
                }
            }

            return addon + returnstr.trim();
        },

        markersToBalloons: function (chunk, module) {
            const verses = chunk.chunkmeta.verses;
            const chap = chunk.chunkmeta.chapter;
            const linearray = chunk.transcontent.split("\n");
            const used = [];
            let noteindex = 0;

            // Create the container fragment to build the result
            const fragment = document.createDocumentFragment();

            // Create the prefix div container
            const prefixDiv = document.createElement("div");
            prefixDiv.className = `style-scope ${module}`;

            // Process each line
            for (let j = 0; j < linearray.length; j++) {
                const lineDiv = document.createElement("div");
                lineDiv.className = `style-scope ${module}`;

                if (linearray[j].trim() === "") {
                    // Add non-breaking space for empty lines
                    lineDiv.innerHTML = "&nbsp;";
                } else {
                    const wordarray = linearray[j].split(/\s/);

                    for (let i = 0; i < wordarray.length; i++) {
                        if (wordarray[i] === "\\v") {
                            // Verse marker
                            const verse = parseInt(wordarray[i + 1]);
                            if (verses.indexOf(verse) >= 0 && used.indexOf(verse) === -1) {
                                const marker = document.createElement("ts-verse-marker");
                                marker.id = `c${chap}v${verse}`;
                                marker.draggable = true;
                                marker.classList.add("markers");
                                marker.setAttribute("verse", verse.toString());
                                lineDiv.appendChild(marker);

                                used.push(verse);
                            }
                            i++;
                        } else if (wordarray[i] === "\\f") {
                            // Footnote marker
                            let footnote = "";

                            for (let k = i; k < wordarray.length; k++) {
                                footnote += `${wordarray[k]} `;
                                if (wordarray[k] === "\\f*") {
                                    break;
                                }
                                i++;
                            }

                            const footnoteHtml = this.markerToFootnote(footnote, chunk.index, noteindex);
                            const tempDiv = document.createElement("div");
                            tempDiv.innerHTML = footnoteHtml;

                            // Append all child nodes from the temporary div
                            while (tempDiv.firstChild) {
                                lineDiv.appendChild(tempDiv.firstChild);
                            }

                            noteindex++;
                        } else if (wordarray[i] === "\\p") {
                            const br = document.createElement("br");
                            br.dataset.type = "p";
                            lineDiv.appendChild(br);
                        } else {
                            // All the rest text and markers
                            const span = document.createElement("span");
                            span.className = `targets style-scope ${module}`;
                            span.textContent = wordarray[i];
                            lineDiv.appendChild(span);

                            // Add space after the span (except for last word)
                            if (i < wordarray.length - 1) {
                                lineDiv.appendChild(document.createTextNode(" "));
                            }
                        }
                    }
                }

                fragment.appendChild(lineDiv);
            }

            // Add unused verses to the prefix div
            for (let i = 0; i < verses.length; i++) {
                if (used.indexOf(verses[i]) === -1) {
                    const preMarker = document.createElement("ts-verse-marker");
                    preMarker.id = `c${chap}v${verses[i]}`;
                    preMarker.draggable = true;
                    preMarker.classList.add("markers");
                    preMarker.setAttribute("verse", verses[i].toString());

                    prefixDiv.appendChild(preMarker);
                }
            }

            // Create final container and combine prefix + content
            const finalContainer = document.createElement("div");
            if (prefixDiv.children.length > 0) {
                finalContainer.appendChild(prefixDiv);
            }
            finalContainer.appendChild(fragment);

            return finalContainer.innerHTML;
        },

        balloonsToMarkers: function (paragraphs) {
            let returnstr = "";

            for (let j = 0; j < paragraphs.length; j++) {
                const children = paragraphs[j].children;
                if (!children.length) {
                    returnstr += "\n";
                } else {
                    for (let i = 0; i < children.length; i++) {
                        const type = children[i].nodeName;
                        const child = children[i];

                        if (type === "TS-VERSE-MARKER") {
                            const versenum = child.verse;
                            returnstr += `\\v ${versenum} `;
                        } else if (type === "TS-TARGET-NOTE-MARKER") {
                            const text = child.text;
                            returnstr += `\\f + \\ft ${text.trim()} \\f* `;
                        } else if (type === "BR") {
                            const brType = child.dataset.type;
                            let br = "\n";
                            if (brType === "p") br = "\\p ";
                            returnstr += br;
                        } else {
                            const text = child.textContent;
                            returnstr += `${text} `;
                        }
                    }
                    returnstr = returnstr.trim();
                    if (j !== paragraphs.length-1) {
                        returnstr += "\n";
                    }
                }
            }
            return returnstr;
        },

        validateFootnotes: function (text) {
            let returnstr = text.trim();
            const notetest = new RegExp(/\s*(\\f)(\s\S\s[\s\S]+?\\f\*)\s*/);
            const cleantest = new RegExp(/\\ftest/g);

            while (notetest.test(returnstr)) {
                const marker = notetest.exec(returnstr)[1];
                const body = notetest.exec(returnstr)[2];
                const result = ` ${marker}test${body} `;

                returnstr = returnstr.replace(notetest, result);
            }

            returnstr = returnstr.replace(cleantest, "\\f");

            return returnstr.trim();
        },

        markersToFootnotes: function (text, chunkIndex, readonly) {
            const noteRegex = new RegExp(/\\f\s(\S)\s([\s\S]+?)\\f\*/);
            let noteIndex = 0;

            while (noteRegex.test(text)) {
                const match = noteRegex.exec(text);

                const marker = this.markerToFootnote(match[0], chunkIndex, noteIndex, readonly);
                text = text.replace(noteRegex, marker);
                noteIndex++;
            }

            return text;
        },

        markerToFootnote: function (marker, chunkIndex, noteIndex, readonly) {
            readonly = readonly || false;
            const wrapperRegex = /\\f\s+\S+\s+([\s\S]+?)\\f\*/;
            const match = wrapperRegex.exec(marker);
            let note = "";

            if (match) {
                let rawContent = match[1];
                note = rawContent.replace(/\\f[a-z0-9]*\*?\s?/gi, "").trim();
            }

            let footnote;
            if (readonly) {
                footnote = document.createElement("ts-note-marker");
            } else {
                footnote = document.createElement("ts-target-note-marker");
                footnote.contentEditable = "false";
                footnote.classList.add("targets");
                footnote.setAttribute("chunkindex", chunkIndex);
                footnote.setAttribute("noteindex", noteIndex);
            }
            footnote.setAttribute("text", note);

            return footnote.outerHTML;
        },

        sanitizeHtmlContent: function (text) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");

            const BLOCK_TAGS = new Set([
                'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                'LI', 'BLOCKQUOTE', 'PRE', 'HR', 'TABLE', 'TR'
            ]);

            function walk(node) {
                let result = "";

                for (const child of node.childNodes) {
                    if (child.nodeType === Node.TEXT_NODE) {
                        result += child.textContent.trim();
                    }
                    else if (child.nodeType === Node.ELEMENT_NODE) {
                        if (BLOCK_TAGS.has(child.tagName) && result.length > 0 && !result.endsWith('\n')) {
                            result += '\n';
                        }

                        if (child.tagName === "TS-TARGET-NOTE-MARKER") {
                            const noteText = (child.getAttribute("text") || "").trim();
                            if (noteText) {
                                result += `\\f + \\ft ${noteText} \\f*`;
                            }
                        } else if (child.tagName === 'BR') {
                            result += '\n';
                        } else {
                            result += walk(child);
                        }
                    }
                }
                return result;
            }

            return walk(doc.body).trim();
        },

        translate: function (key, ...args) {
            return App.locale.translate(key, ...args);
        },
    };
}

module.exports.Renderer = Renderer;
