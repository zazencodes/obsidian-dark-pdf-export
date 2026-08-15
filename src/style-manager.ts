export const STYLE_MARKER_ATTRIBUTE = 'data-dark-pdf-export';

const OWNED_STYLE_SELECTOR = `style[${STYLE_MARKER_ATTRIBUTE}]`;

/**
 * Projects one effective stylesheet into each participating Obsidian document.
 * Documents are explicit because pop-out windows have separate DOM globals.
 */
export class DocumentStyleRegistry {
	private readonly documents = new Set<Document>();
	private readonly styles = new Map<Document, HTMLStyleElement>();
	private css: string;
	private enabled: boolean;
	private closed = false;

	constructor(css: string, enabled = true) {
		this.css = css;
		this.enabled = enabled;
	}

	get documentCount(): number {
		return this.documents.size;
	}

	addDocument(target: Document | null | undefined): void {
		if (this.closed || !target || !target.head || this.isClosedDocument(target)) {
			return;
		}

		this.documents.add(target);
		if (this.enabled) {
			this.reconcileDocument(target);
		} else {
			this.removeMarkedStyles(target);
		}
	}

	removeDocument(target: Document | null | undefined): void {
		if (!target) return;
		this.removeMarkedStyles(target);
		this.documents.delete(target);
	}

	setCss(css: string): void {
		if (this.closed || this.css === css) {
			return;
		}

		this.css = css;
		if (this.enabled) {
			this.reconcileAll();
		}
	}

	setEnabled(enabled: boolean): void {
		if (this.closed || this.enabled === enabled) {
			return;
		}

		this.enabled = enabled;
		if (enabled) {
			this.reconcileAll();
			return;
		}

		for (const target of this.documents) {
			this.removeMarkedStyles(target);
		}
	}

	close(): void {
		if (this.closed) {
			return;
		}

		this.closed = true;
		for (const target of this.documents) {
			this.removeDocument(target);
		}
	}

	private reconcileAll(): void {
		for (const target of this.documents) {
			if (this.isClosedDocument(target)) {
				this.removeDocument(target);
				continue;
			}
			this.reconcileDocument(target);
		}
	}

	private reconcileDocument(target: Document): void {
		const markedStyles = Array.from(
			target.querySelectorAll<HTMLStyleElement>(OWNED_STYLE_SELECTOR),
		);
		const trackedStyle = this.styles.get(target);
		const style = trackedStyle?.isConnected ? trackedStyle : markedStyles[0];

		for (const markedStyle of markedStyles) {
			if (markedStyle !== style) {
				markedStyle.remove();
			}
		}

		const effectiveStyle =
			style ??
			(target.createElementNS(
				'http://www.w3.org/1999/xhtml',
				'style',
			) as HTMLStyleElement);
		effectiveStyle.setAttribute(STYLE_MARKER_ATTRIBUTE, '');
		if (effectiveStyle.textContent !== this.css) effectiveStyle.textContent = this.css;
		if (!effectiveStyle.isConnected) {
			target.head.append(effectiveStyle);
		}
		this.styles.set(target, effectiveStyle);
	}

	private removeMarkedStyles(target: Document): void {
		for (const style of target.querySelectorAll(OWNED_STYLE_SELECTOR)) {
			style.remove();
		}
		this.styles.delete(target);
	}

	private isClosedDocument(target: Document): boolean {
		return target.defaultView?.closed === true;
	}
}
