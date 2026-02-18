/**
 * @jest-environment jsdom
 */

'use strict';

const lodash = require('lodash');
lodash.unique = lodash.uniq;
global._ = lodash;

jest.mock('lodash', () => {
    const actual = jest.requireActual('lodash');
    actual.unique = actual.uniq;
    return actual;
});
jest.mock('../src/js/usfmparse', () => require('../__mocks__/usfmparse'));

describe('Renderer', () => {
    let renderer;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        global.App = {
            locale: {
                translate: jest.fn((k, v) => `${k}_${v}`),
                getLocale: () => ({ code: 'en' })
            }
        };

        const RenderModule = require('../src/js/render');
        renderer = new RenderModule.Renderer();
    });

    describe('USFM & Marker Parsing', () => {
        it('should migrate legacy markers to standard USFM spacing', () => {
            const input = '/v1 text /c1';
            const result = renderer.migrateMarkers(input);
            // The code produces " \v 1 text\c 1" based on the regex replacements
            // We trim to match the function's final .trim() call
            expect(result).toBe('\\v 1 text\\c 1');
        });

        it('should convert verse markers and handle numeric ranges', () => {
            const input = '<verse number="1">A</verse><verse number="2-3">B</verse>';
            const result = renderer.convertVerseMarkers(input);
            expect(result.verses).toEqual([1, 2, 3]);
        });
    });

    describe('DOM Rendering', () => {
        it('should convert USFM markers into Draggable Verse Balloons', () => {
            const chunk = {
                chunkmeta: { chapter: 1, verses: [1] }, // Only verse 1
                transcontent: '\\v 1 In the beginning',
                index: 0
            };

            const html = renderer.markersToBalloons(chunk, 'ts-module');
            const container = document.createElement('div');
            container.innerHTML = html;

            const marker = container.querySelector('ts-verse-marker');
            expect(marker).not.toBeNull();
            expect(marker.getAttribute('verse')).toBe('1');
            expect(marker.classList.contains('markers')).toBe(true);
        });
    });

    describe('Sanitization & Safety', () => {
        it('should recover USFM footnotes from custom elements', () => {
            // Note: sanitizeHtmlContent trims text nodes.
            // We test the recovery of the marker logic specifically.
            const html = 'Text<ts-target-note-marker text="Footnote content"></ts-target-note-marker>';
            const result = renderer.sanitizeHtmlContent(html);

            expect(result).toBe('Text\\f + \\ft Footnote content \\f*');
        });

        it('should escape regex special characters', () => {
            const result = renderer.replaceEscapes('file.txt?');
            expect(result).toBe('file\\.txt\\?');
        });
    });

    describe('Conflict Parsing', () => {
        it('should identify and extract conflict options', () => {
            const text = "<S>Option 1<M>Option 2<E>";
            const result = renderer.parseConflicts(text);
            expect(result.exists).toBe(true);
            expect(result.array).toEqual(['Option 1', 'Option 2']);
        });
    });
});
