export const DEFAULT_PAGE_MARGIN = '14mm 12mm';

const PAGE_MARGIN_PATTERN =
	/^\d+(\.\d+)?(mm|cm|in|pt|pc|px|em|rem)?(\s+\d+(\.\d+)?(mm|cm|in|pt|pc|px|em|rem)?){0,3}$/i;

export function isValidPageMargin(value: string): boolean {
	return PAGE_MARGIN_PATTERN.test(value.trim());
}

export function createStylesheet(pageMargin: string = DEFAULT_PAGE_MARGIN): string {
	const margin = isValidPageMargin(pageMargin) ? pageMargin.trim() : DEFAULT_PAGE_MARGIN;
	return `body {
  --dark-pdf-background: #0b0b0b;
  --dark-pdf-surface: #161616;
  --dark-pdf-border: #363636;
  --dark-pdf-text: #c8c8c8;
  --dark-pdf-heading: #eeeeee;
  --dark-pdf-muted: #999999;
  --dark-pdf-accent: #b18cfe;
}

@page {
  margin: ${margin};
  background: #0b0b0b;
}

@media print {
  html,
  body,
  body.print,
  .print,
  .print .markdown-preview-view,
  .print .markdown-preview-sizer {
    background: var(--dark-pdf-background) !important;
    color: var(--dark-pdf-text) !important;
    color-scheme: dark;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body,
  body.print,
  body[class] {
    --background-primary: var(--dark-pdf-background) !important;
    --background-primary-alt: var(--dark-pdf-surface) !important;
    --background-secondary: var(--dark-pdf-surface) !important;
    --background-secondary-alt: var(--dark-pdf-surface) !important;
    --background-modifier-border: var(--dark-pdf-border) !important;
    --background-modifier-border-hover: var(--dark-pdf-border) !important;
    --code-background: var(--dark-pdf-surface) !important;
    --text-normal: var(--dark-pdf-text) !important;
    --text-muted: var(--dark-pdf-muted) !important;
    --text-faint: var(--dark-pdf-muted) !important;
    --text-accent: var(--dark-pdf-accent) !important;
    --text-accent-hover: var(--dark-pdf-accent) !important;
    --interactive-accent: var(--dark-pdf-accent) !important;
    --blockquote-border-color: var(--dark-pdf-border) !important;
    --table-border-color: var(--dark-pdf-border) !important;
  }

  .print :is(.inline-title, h1, h2, h3, h4, h5, h6) {
    color: var(--dark-pdf-heading) !important;
  }

  .print :is(a, a.external-link, .internal-link) {
    color: var(--dark-pdf-accent) !important;
  }

  .print :is(pre, code, table, blockquote, .callout, .metadata-container) {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .print :is(pre, code, .cm-s-obsidian, .HyperMD-codeblock),
  .print :is(pre, code, .cm-s-obsidian, .HyperMD-codeblock)[class] {
    background-color: #161616 !important;
    background-image: none !important;
    box-shadow: none !important;
    color: #c8c8c8 !important;
    border-color: #363636 !important;
  }

  /* Themes paint code blocks with a gradient shorthand (e.g. code-tactile),
     which a background-color override alone cannot clear. */
  .print :is(pre, .callout, blockquote, .markdown-rendered pre, .markdown-preview-view pre) {
    background-image: none !important;
    box-shadow: none !important;
  }

  .print :is(pre code, pre .token, pre span) {
    background-color: transparent !important;
    background-image: none !important;
  }

  .print pre .copy-code-button {
    display: none !important;
  }

  .print pre {
    overflow: visible !important;
  }

  .print :is(table, thead, tbody, tr, th, td) {
    background-color: var(--dark-pdf-surface) !important;
    color: var(--dark-pdf-text) !important;
    border-color: var(--dark-pdf-border) !important;
  }

  .print :is(pre, table, blockquote, .callout, img) {
    break-inside: avoid;
  }

  .print :is(.inline-title, h1, h2, h3, h4, h5, h6) {
    break-after: avoid;
  }

  .print p {
    orphans: 3;
    widows: 3;
  }

  .print :is(th, .inline-title, h1, h2, h3, h4, h5, h6) {
    color: var(--dark-pdf-heading) !important;
  }
}
`;
}

export const DEFAULT_STYLESHEET = createStylesheet();
