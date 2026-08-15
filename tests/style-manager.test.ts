import { describe, expect, it } from 'vitest';

import { DEFAULT_STYLESHEET } from '../src/default-stylesheet';
import { DocumentStyleRegistry, STYLE_MARKER_ATTRIBUTE } from '../src/style-manager';

const DEFAULT_CSS = DEFAULT_STYLESHEET;

function ownedStyles(document: Document): HTMLStyleElement[] {
	return Array.from(
		document.querySelectorAll<HTMLStyleElement>(`style[${STYLE_MARKER_ATTRIBUTE}]`),
	);
}

function createDocument(): Document {
	return document.implementation.createHTMLDocument();
}

describe('DocumentStyleRegistry', () => {
	it('ships the opaque page fallback without duplicate Style Settings metadata or media inversion', () => {
		expect(DEFAULT_STYLESHEET).toContain('@page {\n  margin: 0;\n  background: #0b0b0b;\n}');
		expect(DEFAULT_STYLESHEET).toContain('@media print');
		expect(DEFAULT_STYLESHEET).not.toContain('@settings');
		expect(DEFAULT_STYLESHEET).not.toMatch(/filter\s*:\s*invert/i);
	});

	it('attaches exactly one marked style containing the effective CSS', () => {
		const registry = new DocumentStyleRegistry(DEFAULT_CSS);
		const target = createDocument();

		registry.addDocument(target);
		registry.addDocument(target);

		expect(ownedStyles(target)).toHaveLength(1);
		expect(ownedStyles(target)[0]?.textContent).toBe(DEFAULT_CSS);
	});

	it('replaces the effective CSS without adding another style source', () => {
		const registry = new DocumentStyleRegistry(DEFAULT_CSS);
		const target = createDocument();
		registry.addDocument(target);
		const original = ownedStyles(target)[0];

		registry.setCss('@media print { body { color: white; } }');

		expect(ownedStyles(target)).toEqual([original]);
		expect(original?.textContent).toBe('@media print { body { color: white; } }');
	});

	it('tracks the main document and pop-out documents independently', () => {
		const registry = new DocumentStyleRegistry(DEFAULT_CSS);
		const mainDocument = createDocument();
		const popoutDocument = createDocument();

		registry.addDocument(mainDocument);
		registry.addDocument(popoutDocument);

		expect(ownedStyles(mainDocument)).toHaveLength(1);
		expect(ownedStyles(popoutDocument)).toHaveLength(1);

		registry.removeDocument(popoutDocument);

		expect(ownedStyles(mainDocument)).toHaveLength(1);
		expect(ownedStyles(popoutDocument)).toHaveLength(0);
		expect(registry.documentCount).toBe(1);
	});

	it('reconciles stale marked styles and leaves unrelated styles untouched', () => {
		const target = createDocument();
		const unrelated = target.createElement('style');
		unrelated.textContent = '.workspace { color: red; }';
		target.head.append(unrelated);
		for (let index = 0; index < 2; index += 1) {
			const stale = target.createElement('style');
			stale.setAttribute(STYLE_MARKER_ATTRIBUTE, '');
			stale.textContent = `stale-${index}`;
			target.head.append(stale);
		}

		const registry = new DocumentStyleRegistry(DEFAULT_CSS);
		registry.addDocument(target);

		expect(ownedStyles(target)).toHaveLength(1);
		expect(ownedStyles(target)[0]?.textContent).toBe(DEFAULT_CSS);
		expect(target.head.contains(unrelated)).toBe(true);
	});

	it('removes styles while disabled and restores the same CSS when enabled', () => {
		const registry = new DocumentStyleRegistry(DEFAULT_CSS);
		const mainDocument = createDocument();
		const popoutDocument = createDocument();
		registry.addDocument(mainDocument);
		registry.addDocument(popoutDocument);

		registry.setEnabled(false);

		expect(ownedStyles(mainDocument)).toHaveLength(0);
		expect(ownedStyles(popoutDocument)).toHaveLength(0);

		registry.setEnabled(true);

		expect(ownedStyles(mainDocument)[0]?.textContent).toBe(DEFAULT_CSS);
		expect(ownedStyles(popoutDocument)[0]?.textContent).toBe(DEFAULT_CSS);
	});

	it('removes every owned style on close and never reattaches afterward', () => {
		const registry = new DocumentStyleRegistry(DEFAULT_CSS);
		const target = createDocument();
		registry.addDocument(target);

		registry.close();
		registry.addDocument(target);
		registry.setEnabled(false);
		registry.setEnabled(true);
		registry.setCss('body { color: red; }');

		expect(ownedStyles(target)).toHaveLength(0);
		expect(registry.documentCount).toBe(0);
	});

	it('does not attach to a document whose pop-out window is already closed', () => {
		const registry = new DocumentStyleRegistry(DEFAULT_CSS);
		const popoutDocument = createDocument();
		Object.defineProperty(popoutDocument, 'defaultView', {
			configurable: true,
			value: { closed: true },
		});

		registry.addDocument(popoutDocument);

		expect(ownedStyles(popoutDocument)).toHaveLength(0);
		expect(registry.documentCount).toBe(0);
	});
});
