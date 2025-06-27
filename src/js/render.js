'use strict';

const path = require('path');

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

                const marker = "<ts-note-marker text='" + notestr + "'><ts-note-marker>";

                text = text.replace(expression, marker);
            }
            return text;
        },

        removeParaTags: function (text) {
            var test = new RegExp(/<\/?para[^<>]*>/g);

            text = text.replace(test, "");

            return text.trim();
        },

        removeCharTags: function (text) {
            var test = new RegExp(/<\/?char[^<>]*>/g);

            text = text.replace(test, "");

            return text.trim();
        },

        migrateMarkers: function (text) {
            var vtest = new RegExp(/ ?[\\\/]v ?(?=\d)/g);
            var ctest = new RegExp(/ ?[\\\/]c ?(?=\d)/g);
            var vreplace = " \\v ";
            var creplace = "\\c ";

            text = text.replace(vtest, vreplace);
            text = text.replace(ctest, creplace);

            return text.trim();
        },

        removeChapterMarkers: function (text) {
            var expression = new RegExp(/\\c \d+\s+/g);

            return text.replace(expression, "");
        },

        renderSuperscriptVerses: function (text) {
            var expression = new RegExp(/(\\v )(\d+-?\d*)(\s+)/);

            while (expression.test(text)) {
                var versestr = expression.exec(text)[2];

                text = text.replace(expression, "\<sup\>" + versestr + "\<\/sup\>");
            }

            return text.trim();
        },

        renderParagraphs: function (text, module) {
            var expression = new RegExp(/([^>\n]*)([\n])/);
            var startp = "\<p class='style-scope " + module + "'\>";
            var endp = "\<\/p\>";

            text = text + "\n";

            while (expression.test(text)) {
                var paragraph = expression.exec(text)[1];

                if (!paragraph) {
                    paragraph = "&nbsp";
                }

                text = text.replace(expression, startp + paragraph + endp);
            }

            return text;
        },

        renderTargetWithVerses: function (text, module) {
            text = this.replaceParagraphs(text);
            text = this.renderParagraphs(text, module);
            text = this.renderSuperscriptVerses(text);

            return text;
        },

        replaceConflictCode: function (text) {
            var starttest = new RegExp(/<{7} HEAD\n/g);
            var midtest = new RegExp(/={7}\n/g);
            var endtest = new RegExp(/>{7} \w{40}\n?/g);

            text = text.replace(starttest, "<S>");
            text = text.replace(midtest, "<M>");
            text = text.replace(endtest, "<E>");

            return text;
        },

        parseConflicts: function (text) {
            var conflicttest = new RegExp(/([^<>]*)(<S>)([^<>]*)(<M>)([^<>]*)(<E>)([^<>]*)/);
            var optiontest = new RegExp(/(@s@)([^]+?)(@e@)/);
            var confirmtest = new RegExp(/<(S|M|E)>/);
            var startmarker = "@s@";
            var endmarker = "@e@";
            var exists = false;
            var conarray = [];

            while (conflicttest.test(text)) {
                var pieces = conflicttest.exec(text);

                if (!optiontest.test(pieces[3])) {
                    pieces[3] = startmarker + pieces[3] + endmarker;
                }
                if (!optiontest.test(pieces[5])) {
                    pieces[5] = startmarker + pieces[5] + endmarker;
                }

                var newcontent = pieces[3] + pieces[5];

                if (pieces[1]) {
                    newcontent = newcontent.replace(/@s@/g, startmarker + pieces[1]);
                }
                if (pieces[7]) {
                    newcontent = newcontent.replace(/@e@/g, pieces[7] + endmarker);
                }

                text = text.replace(conflicttest, newcontent);
                exists = true;
            }

            if (exists) {
                while (optiontest.test(text)) {
                    var option = optiontest.exec(text)[2];

                    conarray.push(option.trim());
                    text = text.replace(optiontest, "");
                }

                conarray = _.uniq(conarray);
            }

            if (confirmtest.test(text)) {
                exists = true;
                conarray.push("Conflict Parsing Error");
            }

            return {exists: exists, array: conarray};
        },

        consolidateHelpsConflict: function (text) {
            var conflicttest = new RegExp(/^([^<>]*)(<S>)([^<>]*)(<M>)([^<>]*)(<E>)([^]*)/);
            var confirmtest = new RegExp(/<(S|M|E)>/);
            var errormsg = [{title: "Conflict Parsing Error", body: "Conflict Parsing Error"}];
            var start = "<S>";
            var middle = "<M>";
            var end = "<E>";
            var first = "";
            var second = "";

            if (conflicttest.test(text)) {
                while (conflicttest.test(text)) {
                    var pieces = conflicttest.exec(text);

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
            text = text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/\$/g, "\\$");
            text = text.replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\?/g, "\\?").replace(/\./g, "\\.").replace(/\//g, "\\/");
            text = text.replace(/\+/g, "\\+").replace(/\*/g, "\\*").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\|/g, "\\|");

            return text;
        },

        replaceParagraphs: function (text) {
            return text.replace(/\\p\W/g, "\n");
        },

        displayConflicts: function (content) {
            var conflicts = this.parseConflicts(this.replaceConflictCode(content));
            var text = "";

            if (conflicts.exists) {
                text += "\n***Start of Conflict***\n";
                for (var i = 0; i < conflicts.array.length; i++) {
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
            var mythis = this;
            var module = "ts-print";
            var startheader = "\<h2 class='style-scope " + module + "'\>";
            var endheader = "\<\/h2\>";
            var add = "";
            if (options.doubleSpace) {
                add += "double ";
            }
            if (options.justify) {
                add += "justify ";
            }
            if (options.newpage) {
                add += "break ";
            }
            var startdiv = "\<div class='style-scope " + add + module + "'\>";
            var enddiv = "\<\/div\>";
            var chapters = [];

            var pagetitle = options.pagetitle ? "\<div class='style-scope page-title centered " + module + "' \>" + pagetitle + "\<\/div\>" : "";
            var text = "\<div id='startnum' class='style-scope " + module + "'\>";

            _.forEach(_.groupBy(chunks, function(chunk) {
                return chunk.chunkmeta.chapter;
            }), function (data, chap) {
                var content = "";
                var title = "";

                _.forEach(data, function (chunk) {
                    if (chunk.chunkmeta.frameid === "title") {
                        title = chunk.transcontent || chunk.srccontent;
                    }
                    if (chunk.chunkmeta.frame > 0 && chunk.transcontent) {
                        if (options.includeIncompleteFrames || chunk.completed) {
                            content += mythis.displayConflicts(chunk.transcontent) + " ";
                        }
                    }
                });

                if (chap > 0) {
                    chapters.push({title: title, content: content.trim()});
                }
            });

            chapters.forEach(function (chapter) {
                if (chapter.content) {
                    if (options.newpage) {
                        text += pagetitle;
                    }
                    text += startheader + chapter.title + endheader;
                    text += startdiv + mythis.renderTargetWithVerses(chapter.content, module) + enddiv;
                }
            });

            var title = !options.newpage ? pagetitle : "";

            return title + text + enddiv;
        },

        renderObsPrintPreview: function (chunks, options, imagePath) {
            var mythis = this;
            var module = "ts-print";
            var startheader = "\<h2 class='style-scope " + module + "'\>";
            var endheader = "\<\/h2\>";
            var startp = "\<p class='style-scope " + module + "'\>";
            var endp = "\<\/p\>";
            var add = "";
            if (options.doubleSpace) {
                add += "double ";
            }
            if (options.justify) {
                add += "justify ";
            }
            var startbreakdiv = "\<div class='style-scope break " + add + module + "'\>";
            var starttocdiv = "\<div class='style-scope double break toc " + module + "'\>";
            var starttitlediv1 = "\<div id='chap";
            var starttitlediv2 = "' class='style-scope break titles " + module + "'\>";
            var startnobreakdiv = "\<div class='style-scope nobreak " + module + "'\>";
            var enddiv = "\<\/div\>";
            var chapters = [];
            var text = "\<div id='startnum' class='style-scope " + module + "'\>";
            var toc = starttocdiv + startheader + "Table of Contents" + endheader;
            var startadiv1 = "\<div class='style-scope " + module + "'\>\<a class='style-scope " + module + "' href='#chap";
            var startadiv2 = "'\>";
            var endadiv = "\<\/a\>\<\/div\>";

            _.forEach(_.groupBy(chunks, function(chunk) {
                return chunk.chunkmeta.chapter;
            }), function (data, chap) {
                var content = "";
                var title = "";
                var ref = "";

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
                                var image = path.join(imagePath, chunk.projectmeta.resource.id + "-en-" + chunk.chunkmeta.chapterid + "-" + chunk.chunkmeta.frameid + ".jpg");
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
            var starth2 = "\<h2 class='style-scope " + module + "'\>";
            var endh2 = "\<\/h2\>";
            var startdiv = "\<div class='style-scope " + module + "'\>";
            var enddiv = "\<\/div\>";

            return starth2 + data.title + endh2 + startdiv + this.renderResourceLinks(data.body, linksEnabled, module) + enddiv;
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
            const linearray = this.replaceParagraphs(chunk.transcontent).split("\n");
            const startp = `<p class="style-scope ${module}">`;
            let returnstr = "";
            let prestr = startp;
            const used = [];
            let noteindex = 0;

            for (let j = 0; j < linearray.length; j++) {
                if (j !== 0) {
                    returnstr += startp;
                }
                if (linearray[j] === "") {
                    returnstr += "&nbsp";
                } else {
                    const wordarray = linearray[j].split(/\s/);
                    for (let i = 0; i < wordarray.length; i++) {
                        if (wordarray[i] === "\\v") {
                            const verse = parseInt(wordarray[i + 1]);
                            if (verses.indexOf(verse) >= 0 && used.indexOf(verse) === -1) {
                                returnstr += `<ts-verse-marker id="c${chap}v${verse}" `;
                                returnstr += `draggable="true" class="markers" verse="${verse}">`;
                                returnstr += `</ts-verse-marker>`;
                                used.push(verse);
                            }
                            i++;
                        } else if (wordarray[i] === "\\f") {
                            let footnote = "";

                            for (let k = i; k < wordarray.length; k++) {
                                footnote += `${wordarray[k]} `;
                                if (wordarray[k] === "\\f*") {
                                    break;
                                }
                                i++;
                            }
                            returnstr += this.markerToFootnote(footnote, chunk.index, noteindex);
                            noteindex++;
                        } else {
                            returnstr += `<span class="targets style-scope ${module}">${wordarray[i]}</span> `;
                        }
                    }
                }
                returnstr += `</p>`;
            }
            for (let i = 0; i < verses.length; i++) {
                if (used.indexOf(verses[i]) === -1) {
                    prestr += `<ts-verse-marker id="c${chap}v${verses[i]}" `;
                    prestr += `draggable="true" class="markers" verse="${verses[i]}">`;
                    prestr += `</ts-verse-marker>`;
                }
            }
            return prestr + returnstr;
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

                        if (type === "TS-VERSE-MARKER") {
                            const versenum = children[i].verse;
                            returnstr += `\\v ${versenum} `;
                        } else if (type === "TS-TARGET-NOTE-MARKER") {
                            const text = children[i].text;
                            returnstr += `\\f + \\ft ${text.trim()} \\f* `;
                        } else {
                            const text = children[i].textContent;
                            returnstr += `${text} `;
                        }
                    }
                    returnstr = returnstr.trim();
                    if (j !== paragraphs.length-1) {
                        returnstr += " \\p ";
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
            const charRegex = new RegExp(/\\(f[^*\s]+)\s([^\\]+)(?:\\f\1\*)?/g);
            let match;
            let note = "";

            do {
                match = charRegex.exec(marker);
                if (match) {
                    note += match[2];
                }
            } while (match);

            let footnoteStart, footnoteEnd;
            if (readonly) {
                footnoteStart = `<ts-note-marker `;
                footnoteEnd = `</ts-note-marker>`;
            } else {
                footnoteStart = `<ts-target-note-marker `;
                footnoteEnd = `</ts-target-note-marker>`;
            }

            let footnote = `${footnoteStart} contenteditable="false" class="targets" `;
            footnote += `text="${note}" `;
            footnote += `chunkindex="${chunkIndex}" `;
            footnote += `noteindex="${noteIndex}">`;
            footnote += footnoteEnd;

            return footnote;
        },

        footnotesToMarkers: function (text) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            const body = doc.body;
            let result = "";
            for (let elm of body.childNodes) {
                if (elm instanceof Text) {
                    result += elm.textContent;
                } else if (elm instanceof HTMLElement) {
                    if (elm.tagName === "TS-TARGET-NOTE-MARKER" && elm.attributes["text"]) {
                        const noteText = elm.attributes["text"].textContent.trim();
                        const footnote = `\\f + \\ft ${noteText} \\f*`;
                        result += footnote;
                    }
                }
            }
            return result;
        },

        translate: function (key, ...args) {
            return App.locale.translate(key, ...args);
        },
    };
}

module.exports.Renderer = Renderer;
