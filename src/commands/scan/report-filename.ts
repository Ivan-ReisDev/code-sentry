export const MARKDOWN_REPORT_FINDINGS_THRESHOLD = 20;

export const generateMarkdownReportFilename = (date: Date = new Date()): string => {
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  return `codesentry-report-${timestamp}.md`;
};
