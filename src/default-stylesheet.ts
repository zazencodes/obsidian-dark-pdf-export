export const BUNDLED_DEFAULT_VERSION = '1.0.1';

export const DEFAULT_STYLESHEET = `body {
  --dark-pdf-background: #0b0b0b;
  --dark-pdf-surface: #161616;
  --dark-pdf-border: #363636;
  --dark-pdf-text: #c8c8c8;
  --dark-pdf-heading: #eeeeee;
  --dark-pdf-muted: #999999;
  --dark-pdf-accent: #b18cfe;
}

@page {
  margin: 0;
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
  body.print {
    --background-primary: var(--dark-pdf-background);
    --background-primary-alt: var(--dark-pdf-surface);
    --background-secondary: var(--dark-pdf-surface);
    --background-secondary-alt: var(--dark-pdf-surface);
    --background-modifier-border: var(--dark-pdf-border);
    --background-modifier-border-hover: var(--dark-pdf-border);
    --code-background: var(--dark-pdf-surface);
    --text-normal: var(--dark-pdf-text);
    --text-muted: var(--dark-pdf-muted);
    --text-faint: var(--dark-pdf-muted);
    --text-accent: var(--dark-pdf-accent);
    --text-accent-hover: var(--dark-pdf-accent);
    --interactive-accent: var(--dark-pdf-accent);
    --blockquote-border-color: var(--dark-pdf-border);
    --table-border-color: var(--dark-pdf-border);
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
}
`;
