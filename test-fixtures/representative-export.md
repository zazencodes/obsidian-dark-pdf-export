---
title: Dark PDF Export fixture
tags:
  - export-fixture
aliases:
  - Print fixture
---

# Dark PDF Export fixture

This fixture exercises **bold text**, *emphasis*, ==highlighting==, a [link](https://obsidian.md), and `inline code` against the stable dark palette.

> Secondary text and borders must remain visible without becoming brighter than headings.

> [!note] Callout surface
> Callouts preserve their dark background and readable border during export.

## Structured content

| Element | Expected result |
| --- | --- |
| Page box | Neutral near-black with no white frame |
| Body text | Readable light gray |
| Links | Visible purple accent |
| Media | Original colors; no inversion |

```ts
const exportMode = 'native';
console.log(`Use the ${exportMode} PDF exporter.`);
```

<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120" role="img" aria-label="Media inversion test">
  <rect width="160" height="120" fill="#f2c94c"></rect>
  <rect x="160" width="160" height="120" fill="#2f80ed"></rect>
  <circle cx="160" cy="60" r="35" fill="#eb5757"></circle>
</svg>

<div style="break-before: page"></div>

# Second printed page

The second page verifies that `@page` colors the complete page box across a multipage export.

1. Export this note with Obsidian's native **Export to PDF** command.
2. Check Letter and A4 with ordinary margins.
3. Confirm the workspace stays unchanged before and after export.
4. Disable the plugin and confirm ordinary export styling returns.

---

End of representative export fixture.

