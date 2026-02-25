'use strict';

module.exports = {
    usfmToHtml: jest.fn((content) => ({
        html: `<p>HTML for ${content}</p>`,
        footnotes: []
    }))
};
