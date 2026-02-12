/**
 * @jest-environment jsdom
 */

'use strict';

// 1. Mock External Dependencies
jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/'))
}));

jest.mock('../src/js/usfmparse', () => ({
    usfmToHtml: jest.fn()
}));

jest.mock('lodash', () => ({
    forEach: jest.fn((obj, fn) => {
        if (Array.isArray(obj)) obj.forEach(fn);
        else Object.keys(obj).forEach(key => fn(obj[key], key));
    }),
    groupBy: jest.fn(),
    uniq: jest.fn(arr => arr),
    compact: jest.fn(arr => arr.filter(Boolean)),
    merge: jest.fn((...args) => Object.assign({}, ...args))
}));

// 2. Global App Mock (Still needed as it's your app logic)
global.App = {
    locale: {
        translate: jest.fn((key, ...args) => `${key}: ${args.join(', ')}`)
    }
};

// 3. Import modules
// Note: JSDOM is already active, so 'Node', 'document', and 'DOMParser' exist globally.
const { Renderer } = require('../src/js/render');
const { usfmToHtml } = require('../src/js/usfmparse');

describe('Renderer', () => {
    let renderer;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the JSDOM body to keep tests isolated
        document.body.innerHTML = '';
        renderer = Renderer();
    });

    describe('convertVerseMarkers', () => {
        it('should convert single verse marker', () => {
            const input = '<verse number="5" style="v">text</verse>';
            const result = renderer.convertVerseMarkers(input);
            expect(result.text).toBe(' \\v 5 text</verse>');
            expect(result.verses).toEqual([5]);
        });

        it('should convert verse range', () => {
            const input = '<verse number="3-5" style="v">text</verse>';
            const result = renderer.convertVerseMarkers(input);
            expect(result.text).toBe(' \\v 3-5 text</verse>');
            expect(result.verses).toEqual([3, 4, 5]);
        });
    });

    describe('sanitizeHtmlContent', () => {
        it('should extract text content from HTML', () => {
            // Because JSDOM is real, your sanitizeHtmlContent will actually
            // parse this string and walk the nodes correctly.
            const input = '<div>text content<br/></div>';
            const result = renderer.sanitizeHtmlContent(input);

            // Note: Update this expectation to match what your real
            // render.js logic produces given the input above.
            expect(result).toBe('text content');
        });
    });

    describe('balloonsToMarkers', () => {
        it('should convert balloon elements back to markers', () => {
            // We use real DOM elements instead of mocks!
            const div = document.createElement('div');

            const marker = document.createElement('ts-verse-marker');
            marker.setAttribute('verse', '5');

            const text = document.createTextNode(' text ');

            const br = document.createElement('br');
            br.dataset.type = 'p';

            div.appendChild(marker);
            div.appendChild(text);
            div.appendChild(br);

            const paragraphs = [div];
            const result = renderer.balloonsToMarkers(paragraphs);

            expect(result).toContain('\\v');
        });
    });

    describe('markersToFootnotes', () => {
        it('should convert footnote markers to HTML', () => {
            const text = '\\f + footnote content \\f*';
            const result = renderer.markersToFootnotes(text, 0, false);

            // You can even parse the result back to check attributes!
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = result;
            const marker = tempDiv.querySelector('ts-target-note-marker');

            expect(marker).toBeTruthy();
            expect(marker.getAttribute('text')).toBe('footnote content');
        });
    });

    describe('translate', () => {
        it('should call App.locale.translate', () => {
            renderer.translate('test.key', 'arg1');
            expect(global.App.locale.translate).toHaveBeenCalledWith('test.key', 'arg1');
        });
    });
});
