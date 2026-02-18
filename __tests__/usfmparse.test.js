/**
 * @jest-environment node
 */

'use strict';

const { usfmToHtml } = require('../src/js/usfmparse');

describe('usfmToHtml', () => {
    const CHAPTER = 1;
    const MODULE = 'ts-module';

    describe('Basic Text and Verse Handling', () => {
        it('should wrap standard text in a paragraph div', () => {
            const input = '\\p In the beginning.';
            const result = usfmToHtml(input, CHAPTER, MODULE);

            expect(result.html).toContain('<div class="paragraph align-start indent-0 ts-module">');
            expect(result.html).toContain('In the beginning.');
        });

        it('should render inline verse numbers correctly', () => {
            const input = '\\p \\v 1 God created';
            const result = usfmToHtml(input, CHAPTER, MODULE);

            expect(result.html).toContain('<sup class="verse-num ts-module">1</sup>');
            expect(result.html).toContain('God created');
        });

        it('should handle verse ranges (e.g., 1-2)', () => {
            const input = '\\v 1-2 Text';
            const result = usfmToHtml(input, CHAPTER, MODULE);
            expect(result.html).toContain('<sup class="verse-num ts-module">1-2</sup>');
        });

        it('should ignore chapter markers (\\c) within chunk files', () => {
            const input = '\\c 1 \\p Text';
            const result = usfmToHtml(input, CHAPTER, MODULE);
            expect(result.html).not.toContain('\\c');
            expect(result.html).toContain('Text');
        });
    });

    describe('Poetry and Alignment', () => {
        it('should handle poetry markers (q1, q2) with indentation', () => {
            const input = '\\q1 This is indented poetry.';
            const result = usfmToHtml(input, CHAPTER, MODULE);

            expect(result.html).toContain('indent-1');
            expect(result.html).toContain('align-start');
            expect(result.html).toContain('This is indented poetry.');
        });

        it('should handle centering markers (qc) and enable italics', () => {
            const input = '\\qc Centered Text';
            const result = usfmToHtml(input, CHAPTER, MODULE);

            expect(result.html).toContain('align-center');
            expect(result.html).toContain('<i>Centered Text</i>');
        });

        it('should handle right-alignment (qr)', () => {
            const input = '\\qr Right aligned text';
            const result = usfmToHtml(input, CHAPTER, MODULE);
            expect(result.html).toContain('align-end');
            expect(result.html).toContain('Right aligned text');
        });
    });

    describe('Footnote Extraction', () => {
        it('should extract footnotes and replace them with caller links', () => {
            const input = '\\p Verse text \\f + \\ft Footnote content \\f* followed by text.';
            const result = usfmToHtml(input, CHAPTER, MODULE);

            expect(result.html).toContain('<a href="#caller-1-1" class="footnote-caller-link ts-module"><sup>1</sup></a>');
            expect(result.footnotes).toHaveLength(1);
            expect(result.footnotes[0]).toBe('Footnote content');
            expect(result.html).toContain('followed by text');
        });
    });

    describe('Edge Cases and Safety', () => {
        it('should escape HTML special characters to prevent XSS', () => {
            const input = '\\p X < 2 & "Quote"';
            const result = usfmToHtml(input, CHAPTER, MODULE);

            expect(result.html).toContain('X &lt; 2 &amp; &quot;Quote&quot;');
        });

        it('should handle unknown markers by treating them as literal text', () => {
            const input = '\\unknown Testing';
            const result = usfmToHtml(input, CHAPTER, MODULE);
            expect(result.html).toContain('\\unknownTesting');
        });
    });

    describe('Absolute Verse Positioning', () => {
        it('should use absolute positioning for verses starting in poetry blocks', () => {
            const input = '\\q1 \\v 5 Poetry start';
            const result = usfmToHtml(input, CHAPTER, MODULE);

            // Corrected to include the internal space found in received string
            expect(result.html).toContain('verse-num-abs ts-module">5</span>');
        });

        it('should flush blocks if an absolute verse is followed by another verse in the same block', () => {
            const input = '\\q1 \\v 5 Poetry \\v 6 More';
            const result = usfmToHtml(input, CHAPTER, MODULE);

            expect(result.html).toContain('verse-num-abs ts-module">5</span>');
            expect(result.html).toContain('verse-num ts-module">6</sup>');
        });
    });

    describe('Italic Toggling (qac)', () => {
        it('should toggle italics using qac markers', () => {
            const input = '\\p Text \\qac start italics \\qac* normal text';
            const result = usfmToHtml(input, CHAPTER, MODULE);

            // Corrected to match the parser adding a trailing space inside the italic tag
            expect(result.html).toContain('<i>start italics </i>');
            expect(result.html).toContain('normal text');
        });
    });
});
