import { describe, expect, it } from 'vitest';

import { validateStylesheet } from '../src/css-validator';

describe('validateStylesheet', () => {
	it.each([
		'@page { background: #111; } @media print { body { color: white; } }',
		':root { --surface: #111; } body { color: var(--surface); }',
		'@supports (display: grid) { @media print { main { display: grid; } } }',
		'.local { background: url(./image.png); src: url("data:image/png;base64,AA=="); }',
	])('accepts valid local stylesheet %s', (css) => {
		expect(validateStylesheet(css)).toEqual({ valid: true });
	});

	it.each([
		['selector', 'body,,main { color: red; }'],
		['declaration', 'body { color red; }'],
		['brace', 'body { color: red;'],
		['at-rule', '@media print body { color: red; }'],
	])('reports an actionable fatal %s error', (_kind, css) => {
		const result = validateStylesheet(css);

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error.kind).toBe('syntax');
			expect(result.error.line).toBeGreaterThan(0);
			expect(result.error.column).toBeGreaterThan(0);
			expect(result.error.message.length).toBeGreaterThan(0);
		}
	});

	it.each([
		'@import "theme.css";',
		String.raw`@\69mport "https://example.com/theme.css";`,
		'@import url(./local.css);',
		'.remote { background-image: url(//example.com/a.png); }',
		'@font-face { src: url("https://example.com/font.woff2"); }',
		'.remote { background: url(http://example.com/image.png); }',
		'.remote { background: image-set("https://example.com/image.png" 1x); }',
		'.remote { background: -webkit-image-set("//example.com/image.png" 1x); }',
		String.raw`.remote { background: image("h\74tps://example.com/image.png"); }`,
		String.raw`.remote { background: u\72l("https://example.com/image.png"); }`,
		'.remote { --asset: "https://example.com/image.png"; background: image-set(var(--asset) 1x); }',
	])('rejects network-capable resource syntax %s', (css) => {
		const result = validateStylesheet(css);

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error.kind).toBe('resource');
			expect(result.error.line).toBeGreaterThan(0);
			expect(result.error.column).toBeGreaterThan(0);
		}
	});
});
