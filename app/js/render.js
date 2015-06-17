/**
 * Created by delmarhager on 5/25/15.
 */

var _ = require('lodash'),
    paraRegExp = /<\/para>\s*/g;

function paraPattern(paraType) {
    'use strict';
    return new RegExp('<para\\s*style="' + paraType + '"\\s*>\\s*');
}

var render = {
    renderWhiteSpace: function (text) {
        'use strict';
        return text.replace(/\s+/g, ' ');
    },
    renderLineBreaks: function (text) {
        'use strict';
        return text.replace(/\s*\n+\s*/g, ' ');
    },
    renderNotes: function (text) {
        'use strict';
        return text.replace(/\s*\n+\s*/g, ' ');
    },
    trimWhiteSpace: function (text) {
        'use strict';
        return text.replace(/^\s*|\s*$/g, '');
    },
    renderVerse: function (text) {
        'use strict';
        return text.replace(/<verse\s+number=\"(\d+(-\d+)?)\"\s+style=\"v\"\s*\/>/g, '');
    },
    renderVerseHTML: function (text) {
        'use strict';
        var replacePre = '<span class="verse">',
            replacePost = '</span>';
        var output = text.replace(/<verse\s+number=\"(\d+(-\d+)?)\"\s+style=\"v\"\s*\/>/g,
            function (match) {
                return replacePre + _.parseInt(match.slice(match.search('"') + 1), 10) +
                    replacePost;
            });
        return output;
    },
    renderParagraph: function (text) {
        'use strict';
        var paraType = 'p',
            replacePara = paraPattern(paraType);
        return text.replace(replacePara, '').replace(paraRegExp, '');
    },
    renderParagraphHTML: function (text) {
        'use strict';
        var paraType = 'p',
            replacePara = paraPattern(paraType);
        return text.replace(replacePara, '<p>').replace(paraRegExp, '</p>');
    },
    renderCleanFrameHTML: function (text) {
        'use strict';
        return this.renderWhiteSpace(this.renderVerseHTML(this.renderParagraphHTML(text)));
    }
};


exports.renderWhiteSpace = render.renderWhiteSpace;
exports.renderLineBreaks = render.renderLineBreaks;
exports.trimWhiteSpace = render.trimWhiteSpace;
exports.renderVerse = render.renderVerse;
exports.renderParagraph = render.renderParagraph;
exports.renderCleanFrameHTML = render.renderCleanFrameHTML;
exports.renderVerseHTML = render.renderVerseHTML;
exports.renderParagraphHTML = render.renderParagraphHTML;
