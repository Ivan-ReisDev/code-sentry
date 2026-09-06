import { describe, expect, it } from 'vitest';
import {
  generateMarkdownReportFilename,
  MARKDOWN_REPORT_FINDINGS_THRESHOLD,
} from '../../src/commands/scan/report-filename.js';

describe('generateMarkdownReportFilename', () => {
  it('builds a filesystem-safe name from the given date', () => {
    const name = generateMarkdownReportFilename(new Date('2026-09-06T14:23:05.123Z'));

    expect(name).toBe('codesentry-report-2026-09-06T14-23-05-123Z.md');
  });

  it('uses the current date when none is provided', () => {
    const name = generateMarkdownReportFilename();

    expect(name).toMatch(/^codesentry-report-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.md$/);
  });
});

describe('MARKDOWN_REPORT_FINDINGS_THRESHOLD', () => {
  it('is 20', () => {
    expect(MARKDOWN_REPORT_FINDINGS_THRESHOLD).toBe(20);
  });
});
