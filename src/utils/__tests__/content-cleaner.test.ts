import { describe, test, expect } from 'bun:test';
import {
  extractTextFromStorage,
  truncateContent,
  optimizeForAI,
  storageFormatToMarkdown
} from '../content-cleaner.js';

describe('extractTextFromStorage', () => {
  test('should extract plain text from HTML content', () => {
    const html = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
    const expected = 'This is bold and italic text.';
    expect(extractTextFromStorage(html)).toBe(expected);
  });

  test('should handle HTML entities', () => {
    const html = '<p>This &amp; that &lt;tag&gt;</p>';
    const expected = 'This that tag';
    expect(extractTextFromStorage(html)).toBe(expected);
  });

  test('should return empty string for null or undefined input', () => {
    expect(extractTextFromStorage('')).toBe('');
    expect(extractTextFromStorage(null as any)).toBe('');
    expect(extractTextFromStorage(undefined as any)).toBe('');
  });

  test('should normalize whitespace', () => {
    const html = '<div>  Multiple    spaces   </div>\n<p>and\nnewlines</p>';
    const expected = 'Multiple spaces and newlines';
    expect(extractTextFromStorage(html)).toBe(expected);
  });
});

describe('truncateContent', () => {
  test('should not truncate content shorter than maxLength', () => {
    const content = 'This is a short text';
    expect(truncateContent(content, 100)).toBe(content);
  });

  test('should truncate content at word boundary', () => {
    const content = 'This is a longer text that should be truncated';
    const truncated = truncateContent(content, 15);
    expect(truncated).toBe('This is a...');
    expect(truncated.length).toBeLessThan(20); // Some buffer for the ellipsis
  });

  test('should truncate at maxLength if no word boundary found', () => {
    const content = 'ThisIsAVeryLongWordWithoutSpaces';
    const maxLength = 10;
    expect(truncateContent(content, maxLength)).toBe('ThisIsAVer');
  });

  test('should use default maxLength if not specified', () => {
    const longContent = 'a'.repeat(10000);
    const truncated = truncateContent(longContent);
    expect(truncated.length).toBeLessThan(8100); // Default 8000 + some buffer
  });
});

describe('optimizeForAI', () => {
  test('should call truncateContent', () => {
    const content = 'This is some content';
    // Since optimizeForAI is currently just a wrapper for truncateContent,
    // we can test that it returns the same result
    expect(optimizeForAI(content)).toBe(truncateContent(content));
  });

  test('should handle empty content', () => {
    expect(optimizeForAI('')).toBe('');
  });
});

describe('storageFormatToMarkdown', () => {
  test('should convert headings', () => {
    const html = '<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3>';
    const expected = '# Heading 1## Heading 2### Heading 3';
    expect(storageFormatToMarkdown(html)).toBe(expected);
  });

  test('should convert paragraphs', () => {
    const html = '<p>First paragraph</p><p>Second paragraph</p>';
    const expected = 'First paragraph\n\nSecond paragraph';
    expect(storageFormatToMarkdown(html)).toBe(expected);
  });

  test('should convert text formatting', () => {
    const html = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
    const expected = 'This is **bold** and *italic* text.';
    expect(storageFormatToMarkdown(html)).toBe(expected);
  });

  test('should convert links', () => {
    const html = '<a href="https://example.com">Example</a>';
    const expected = '[Example](https://example.com)';
    expect(storageFormatToMarkdown(html)).toBe(expected);
  });

  test('should convert lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const expected = '- Item 1\n- Item 2';
    expect(storageFormatToMarkdown(html)).toBe(expected);
  });

  test('should handle empty input', () => {
    expect(storageFormatToMarkdown('')).toBe('');
    expect(storageFormatToMarkdown(null as any)).toBe('');
    expect(storageFormatToMarkdown(undefined as any)).toBe('');
  });

  test('should handle complex nested content', () => {
    const html = `
      <h1>Title</h1>
      <p>This is a <strong>paragraph</strong> with <em>formatting</em>.</p>
      <ul>
        <li>Item with <a href="https://example.com">link</a></li>
        <li>Another <strong>item</strong></li>
      </ul>
    `;
    const expected = '# Title\n      This is a **paragraph** with *formatting*.\n\n        - Item with [link](https://example.com)\n\n        - Another **item**';
    expect(storageFormatToMarkdown(html).trim()).toBe(expected);
  });
});
