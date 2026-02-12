/**
 * @jest-environment jsdom
 */

'use strict';

jest.unmock('../src/js/usfmparse');

const { HtmlParseContext, usfmToHtml } = require('../src/js/usfmparse');

describe('usfmToHtml', () => {
    describe('HtmlParseContext', () => {
        let context;

        beforeEach(() => {
            jest.clearAllMocks();
            context = new HtmlParseContext('GEN.1', 'module-name');
        });

        describe('constructor', () => {
            it('should initialize with correct default values', () => {
                expect(context.chapterId).toBe('GEN.1');
                expect(context.module).toBe('module-name');
                expect(context.htmlBuffer).toEqual([]);
                expect(context.footnotes).toEqual([]);
                expect(context.currentTextBuffer).toBe('');
                expect(context.isParagraphStart).toBe(true);
                expect(context.inFootnote).toBe(false);
                expect(context.footnoteBuffer).toBe('');
                expect(context.currentIndentLevel).toBe(0);
                expect(context.currentAlignment).toBe('align-start');
                expect(context.pendingVerseNumber).toBe(null);
                expect(context.isItalic).toBe(false);
            });
        });

        describe('escapeHtml', () => {
            it('should escape HTML special characters', () => {
                expect(context.escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#039;');
            });

            it('should handle null/undefined input', () => {
                expect(context.escapeHtml(null)).toBe('');
                expect(context.escapeHtml(undefined)).toBe('');
            });

            it('should handle empty string', () => {
                expect(context.escapeHtml('')).toBe('');
            });

            it('should handle normal text unchanged', () => {
                expect(context.escapeHtml('hello world')).toBe('hello world');
            });
        });

        describe('addText', () => {
            it('should add text to current buffer', () => {
                context.addText('hello');
                expect(context.currentTextBuffer).toBe('hello');
                expect(context.isParagraphStart).toBe(false);
            });

            it('should escape HTML in text', () => {
                context.addText('<b>bold</b>');
                expect(context.currentTextBuffer).toBe('&lt;b&gt;bold&lt;/b&gt;');
            });

            it('should wrap text in italic tags when isItalic is true', () => {
                context.isItalic = true;
                context.addText('italic text');
                expect(context.currentTextBuffer).toBe('<i>italic text</i>');
            });

            it('should not add empty/whitespace-only text', () => {
                context.addText('   ');
                expect(context.currentTextBuffer).toBe('');
                expect(context.isParagraphStart).toBe(true);
            });

            it('should handle footnote text separately', () => {
                context.inFootnote = true;
                context.addText('footnote text');
                expect(context.currentTextBuffer).toBe('');
                expect(context.footnoteBuffer).toBe('footnote text');
            });
        });

        describe('handleVerse', () => {
            it('should add inline verse number for normal paragraphs', () => {
                context.handleVerse('5');
                expect(context.currentTextBuffer).toBe('<sup class="verse-num module-name">5</sup> ');
                expect(context.isParagraphStart).toBe(false);
            });

            it('should set pending verse number for special blocks at paragraph start', () => {
                context.currentIndentLevel = 1;
                context.isParagraphStart = true;
                context.handleVerse('5');
                expect(context.pendingVerseNumber).toBe('5');
                expect(context.currentTextBuffer).toBe('');
            });

            it('should flush and add inline verse for special blocks not at start', () => {
                context.currentIndentLevel = 1;
                context.currentTextBuffer = 'some text';
                context.isParagraphStart = false;

                const originalFlush = context.flush;
                let flushCalled = false;
                context.flush = function() {
                    flushCalled = true;
                    return originalFlush.apply(this, arguments);
                };

                context.handleVerse('5');
                expect(flushCalled).toBe(true);
                expect(context.currentTextBuffer).toBe('<sup class="verse-num module-name">5</sup> ');
            });
        });

        describe('startBlock', () => {
            it('should flush with correct alignment and no indent', () => {
                const flushSpy = jest.spyOn(context, 'flush');
                context.startBlock('align-center');
                expect(flushSpy).toHaveBeenCalledWith({ indent: 0, align: 'align-center' });
                expect(context.isItalic).toBe(false);
                flushSpy.mockRestore();
            });

            it('should set italic mode when specified', () => {
                const flushSpy = jest.spyOn(context, 'flush');
                context.startBlock('align-center', true);
                expect(context.isItalic).toBe(true);
                flushSpy.mockRestore();
            });
        });

        describe('startPoetryBlock', () => {
            it('should parse indent level from marker', () => {
                const flushSpy = jest.spyOn(context, 'flush');
                context.startPoetryBlock('q2', false);
                expect(flushSpy).toHaveBeenCalledWith({ indent: 2, align: 'align-start' });
                expect(context.isItalic).toBe(false);
                flushSpy.mockRestore();
            });

            it('should default to level 1 when no digits', () => {
                const flushSpy = jest.spyOn(context, 'flush');
                context.startPoetryBlock('q', true);
                expect(flushSpy).toHaveBeenCalledWith({ indent: 1, align: 'align-start' });
                expect(context.isItalic).toBe(true);
                flushSpy.mockRestore();
            });
        });

        describe('addSpacerBlock', () => {
            it('should flush and add spacer div', () => {
                const flushSpy = jest.spyOn(context, 'flush');
                context.addSpacerBlock();
                expect(flushSpy).toHaveBeenCalled();
                expect(context.htmlBuffer).toContain('<div class="paragraph spacer module-name"></div>');
                expect(context.currentIndentLevel).toBe(0);
                expect(context.currentAlignment).toBe('align-start');
                expect(context.isItalic).toBe(false);
                flushSpy.mockRestore();
            });
        });

        describe('startFootnote', () => {
            it('should set footnote mode and add caller link', () => {
                context.startFootnote();
                expect(context.inFootnote).toBe(true);
                expect(context.currentTextBuffer).toBe('<a href="#caller-GEN.1-1" class="footnote-caller-link module-name"><sup>1</sup></a>');
            });

            it('should increment footnote index', () => {
                context.footnotes = ['existing'];
                context.startFootnote();
                expect(context.currentTextBuffer).toContain('caller-GEN.1-2');
            });
        });

        describe('captureFootnote', () => {
            it('should add cleaned footnote content', () => {
                context.captureFootnote(' f test footnote content ');
                expect(context.footnotes).toEqual(['test footnote content']);
            });

            it('should skip empty footnotes', () => {
                context.captureFootnote(' f ');
                expect(context.footnotes).toEqual([]);
            });
        });

        describe('flush', () => {
            it('should do nothing when in footnote', () => {
                context.inFootnote = true;
                context.currentTextBuffer = 'text';
                context.flush();
                expect(context.htmlBuffer).toEqual([]);
            });

            it('should add paragraph div with text', () => {
                context.currentTextBuffer = 'hello world';
                context.flush();
                expect(context.htmlBuffer).toEqual(['<div class="paragraph align-start indent-0 module-name">hello world</div>']);
                expect(context.currentTextBuffer).toBe('');
                expect(context.isParagraphStart).toBe(true);
            });

            it('should add paragraph with pending verse number', () => {
                context.pendingVerseNumber = '5';
                context.flush();
                expect(context.htmlBuffer).toEqual(['<div class="paragraph align-start indent-0 module-name"><span class="verse-num verse-num-abs module-name">5</span></div>']);
                expect(context.pendingVerseNumber).toBe(null);
            });

            it('should update style when newStyle provided', () => {
                context.flush({ indent: 2, align: 'align-center' });
                expect(context.currentIndentLevel).toBe(2);
                expect(context.currentAlignment).toBe('align-center');
            });
        });

        describe('flushAndGetResult', () => {
            it('should flush and return html and footnotes', () => {
                const flushSpy = jest.spyOn(context, 'flush');
                context.htmlBuffer = ['<div>test</div>'];
                context.footnotes = ['footnote'];

                const result = context.flushAndGetResult();
                expect(flushSpy).toHaveBeenCalled();
                expect(result).toEqual({
                    html: '<div>test</div>',
                    footnotes: ['footnote']
                });
                flushSpy.mockRestore();
            });
        });
    });

    describe('usfmToHtml', () => {
        it('should parse basic verse marker', () => {
            const result = usfmToHtml('\\v 1 In the beginning', 'GEN.1', 'module');
            expect(result.html).toContain('<sup class="verse-num module">1</sup>');
            expect(result.html).toContain('In the beginning');
        });

        it('should parse paragraph marker', () => {
            const result = usfmToHtml('\\p\n\\v 1 Text', 'GEN.1', 'module');
            expect(result.html).toContain('class="paragraph align-start indent-0 module"');
        });

        it('should handle footnotes', () => {
            const result = usfmToHtml('Text \\f + \\ft footnote content\\f*', 'GEN.1', 'module');
            expect(result.html).toContain('footnote-caller-link');
            expect(result.footnotes).toEqual(['footnote content']);
        });

        it('should handle poetry markers', () => {
            const result = usfmToHtml('\\q1\n\\v 1 Poetry text', 'GEN.1', 'module');
            expect(result.html).toContain('indent-1');
        });

        it('should handle alignment markers', () => {
            const result = usfmToHtml('\\qc\n\\v 1 Centered text', 'GEN.1', 'module');
            expect(result.html).toContain('align-center');
        });

        it('should escape HTML in text', () => {
            const result = usfmToHtml('\\v 1 Text with <tags>', 'GEN.1', 'module');
            expect(result.html).toContain('&lt;tags&gt;');
        });
    });
});