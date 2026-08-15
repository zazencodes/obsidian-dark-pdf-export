import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Setting } from 'obsidian';

import {
	CURRENT_SETTINGS_SCHEMA,
	SettingsController,
	createDefaultSettings,
	type RuntimeProjection,
	type SettingsPersistence,
	type SettingsRecord,
} from '../src/settings-model';

const notices: string[] = [];
const fireEvent = {
	input(element: HTMLTextAreaElement, init: { target: { value: string } }): void {
		element.value = init.target.value;
		element.dispatchEvent(new Event('input', { bubbles: true }));
	},
	click(element: HTMLElement): void {
		element.click();
	},
	change(element: HTMLElement): void {
		element.dispatchEvent(new Event('change', { bubbles: true }));
	},
};

vi.mock('obsidian', () => {
	class BaseComponent {
		setDisabled(disabled: boolean): this {
			const element = 'buttonEl' in this ? this.buttonEl : 'inputEl' in this ? this.inputEl : null;
			if (element instanceof HTMLButtonElement || element instanceof HTMLTextAreaElement) {
				element.disabled = disabled;
			}
			return this;
		}
	}

	class ButtonComponent extends BaseComponent {
		buttonEl: HTMLButtonElement;

		constructor(containerEl: HTMLElement) {
			super();
			this.buttonEl = document.createElement('button');
			containerEl.append(this.buttonEl);
		}

		setButtonText(text: string): this {
			this.buttonEl.textContent = text;
			return this;
		}

		setCta(): this {
			this.buttonEl.classList.add('mod-cta');
			return this;
		}

		setDestructive(): this {
			this.buttonEl.classList.add('mod-warning');
			return this;
		}

		onClick(callback: (event: MouseEvent) => unknown): this {
			this.buttonEl.addEventListener('click', callback);
			return this;
		}
	}

	class ToggleComponent extends BaseComponent {
		toggleEl: HTMLInputElement;
		private callback: ((value: boolean) => unknown) | null = null;

		constructor(containerEl: HTMLElement) {
			super();
			this.toggleEl = document.createElement('input');
			this.toggleEl.type = 'checkbox';
			this.toggleEl.addEventListener('change', () => this.callback?.(this.toggleEl.checked));
			containerEl.append(this.toggleEl);
		}

		setValue(value: boolean): this {
			this.toggleEl.checked = value;
			return this;
		}

		getValue(): boolean {
			return this.toggleEl.checked;
		}

		onChange(callback: (value: boolean) => unknown): this {
			this.callback = callback;
			return this;
		}

		setDisabled(disabled: boolean): this {
			this.toggleEl.disabled = disabled;
			return this;
		}
	}

	class TextAreaComponent extends BaseComponent {
		inputEl: HTMLTextAreaElement;
		private callback: ((value: string) => unknown) | null = null;

		constructor(containerEl: HTMLElement) {
			super();
			this.inputEl = document.createElement('textarea');
			this.inputEl.addEventListener('input', () => this.callback?.(this.inputEl.value));
			containerEl.append(this.inputEl);
		}

		setValue(value: string): this {
			this.inputEl.value = value;
			return this;
		}

		onChange(callback: (value: string) => unknown): this {
			this.callback = callback;
			return this;
		}
	}

	class Setting {
		settingEl: HTMLElement;
		infoEl: HTMLElement;
		nameEl: HTMLElement;
		descEl: HTMLElement;
		controlEl: HTMLElement;

		constructor(containerEl: HTMLElement) {
			this.settingEl = document.createElement('div');
			this.settingEl.className = 'setting-item';
			this.infoEl = document.createElement('div');
			this.nameEl = document.createElement('div');
			this.descEl = document.createElement('div');
			this.controlEl = document.createElement('div');
			this.infoEl.append(this.nameEl, this.descEl);
			this.settingEl.append(this.infoEl, this.controlEl);
			containerEl.append(this.settingEl);
		}

		setName(text: string): this {
			this.nameEl.textContent = text;
			return this;
		}

		setDesc(text: string): this {
			this.descEl.textContent = text;
			return this;
		}

		setClass(className: string): this {
			this.settingEl.classList.add(className);
			return this;
		}

		addToggle(callback: (toggle: ToggleComponent) => unknown): this {
			callback(new ToggleComponent(this.controlEl));
			return this;
		}
	}

	class PluginSettingTab {
		containerEl = document.createElement('div');

		constructor(public app: unknown, public plugin: unknown) {}
	}

	class Modal {
		containerEl = document.createElement('div');
		modalEl = this.containerEl;
		titleEl = document.createElement('h2');
		contentEl = document.createElement('div');

		constructor(public app: unknown) {
			this.containerEl.className = 'modal-container';
			this.containerEl.append(this.titleEl, this.contentEl);
		}

		open(): void {
			document.body.append(this.containerEl);
			this.onOpen();
		}

		close(): void {
			this.onClose();
			this.containerEl.remove();
		}

		onOpen(): void {}
		onClose(): void {}
	}

	class Notice {
		constructor(message: string) {
			notices.push(message);
		}
	}

	return { ButtonComponent, Modal, Notice, PluginSettingTab, Setting, TextAreaComponent };
});

import { DarkPdfExportSettingTab } from '../src/settings-tab';

const DEFAULT_CSS = '@media print { body { color: #eee; } }';
const CUSTOM_CSS = '@media print { body { color: hotpink; } }';
const bundle = { css: DEFAULT_CSS, version: '1.0.0' };

class MemoryPersistence implements SettingsPersistence {
	readonly saves: SettingsRecord[] = [];

	constructor(public value: unknown = createDefaultSettings(bundle)) {}

	async load(): Promise<unknown> {
		return this.value;
	}

	async save(data: unknown): Promise<void> {
		const settings = data as SettingsRecord;
		this.saves.push(structuredClone(settings));
		this.value = structuredClone(settings);
	}
}

function projection(): RuntimeProjection & { snapshots: SettingsRecord[] } {
	const snapshots: SettingsRecord[] = [];
	return {
		snapshots,
		project(settings) {
			snapshots.push(structuredClone(settings));
		},
	};
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

async function render(options?: {
	persistence?: SettingsPersistence;
	runtime?: RuntimeProjection;
}): Promise<{
	tab: DarkPdfExportSettingTab;
	controller: SettingsController;
	persistence: SettingsPersistence;
	runtime: RuntimeProjection;
}> {
	const persistence = options?.persistence ?? new MemoryPersistence();
	const runtime = options?.runtime ?? projection();
	const controller = new SettingsController(bundle, persistence, runtime);
	await controller.load();
	const tab = new DarkPdfExportSettingTab({} as never, {} as never, controller);
	const definition = tab.getSettingDefinitions()[0];
	if (definition === undefined || !('render' in definition) || definition.render === undefined) {
		throw new Error('Expected one custom settings definition.');
	}
	definition.render(new Setting(tab.containerEl), {} as never);
	document.body.append(tab.containerEl);
	return { tab, controller, persistence, runtime };
}

async function settle(): Promise<void> {
	await new Promise((resolve) => window.setTimeout(resolve, 0));
}

beforeEach(() => {
	Object.defineProperties(HTMLElement.prototype, {
		empty: {
			configurable: true,
			value(this: HTMLElement) {
				this.replaceChildren();
			},
		},
		setText: {
			configurable: true,
			value(this: HTMLElement, text: string) {
				this.textContent = text;
			},
		},
		createEl: {
			configurable: true,
			value(
				this: HTMLElement,
				tag: string,
				options?: { cls?: string; text?: string; attr?: Record<string, string> },
			) {
				const element = document.createElement(tag);
				if (options?.cls !== undefined) element.className = options.cls;
				if (options?.text !== undefined) element.textContent = options.text;
				for (const [name, value] of Object.entries(options?.attr ?? {})) {
					element.setAttribute(name, value);
				}
				this.append(element);
				return element;
			},
		},
		createDiv: {
			configurable: true,
			value(this: HTMLElement, options?: { cls?: string }) {
				const element = document.createElement('div');
				if (options?.cls !== undefined) element.className = options.cls;
				this.append(element);
				return element;
			},
		},
	});
	document.body.replaceChildren();
	notices.length = 0;
});

describe('DarkPdfExportSettingTab', () => {
	it('renders only the narrow, labelled, keyboard-focusable settings surface', async () => {
		const { tab } = await render();
		const toggle = tab.containerEl.querySelector<HTMLInputElement>('input[type="checkbox"]');
		const editor = tab.containerEl.querySelector<HTMLTextAreaElement>('textarea');
		const buttons = [...tab.containerEl.querySelectorAll('button')];

		expect(toggle).not.toBeNull();
		expect(editor).not.toBeNull();
		expect(tab.containerEl.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
		expect(tab.containerEl.querySelectorAll('textarea')).toHaveLength(1);
		expect(buttons.map((button) => button.textContent)).toEqual(['Apply', 'Reset']);
		expect(tab.containerEl.textContent).toContain('Enable dark PDF styling');
		expect(tab.containerEl.textContent).toContain('complete stylesheet');
		expect(tab.containerEl.textContent).toContain('Selectors outside @media print can affect the Obsidian interface.');
		expect(toggle?.getAttribute('aria-label')).toBe('Enable dark PDF styling');
		expect(editor?.labels?.[0]?.textContent).toBe('Complete CSS stylesheet');
		expect(editor?.getAttribute('aria-describedby')).toContain('dark-pdf-export-feedback');
		expect(tab.containerEl.querySelector('[role="status"]')).not.toBeNull();
		expect([toggle, editor, ...buttons].every((element) => element?.tabIndex === 0)).toBe(true);
	});

	it('keeps the editable draft and reports a rejected draft write inline', async () => {
		const persistence: SettingsPersistence = {
			load: async () => createDefaultSettings(bundle),
			save: vi.fn().mockRejectedValue(new Error('disk full')),
		};
		const { tab, controller } = await render({ persistence });
		const editor = tab.containerEl.querySelector<HTMLTextAreaElement>('textarea')!;

		fireEvent.input(editor, { target: { value: CUSTOM_CSS } });
		await settle();

		expect(controller.state.draft.css).toBe(CUSTOM_CSS);
		expect(editor.value).toBe(CUSTOM_CSS);
		expect(tab.containerEl.querySelector('[role="alert"]')?.textContent).toBe(
			'The draft save was not completed. disk full',
		);
	});

	it('persists an edited draft without activating it, then applies valid CSS', async () => {
		const runtime = projection();
		const { tab, controller, persistence } = await render({ runtime });
		const editor = tab.containerEl.querySelector<HTMLTextAreaElement>('textarea')!;

		fireEvent.input(editor, { target: { value: CUSTOM_CSS } });
		await settle();

		expect(controller.state.draft).toMatchObject({ css: CUSTOM_CSS, dirty: true });
		expect(controller.state.active.css).toBe(DEFAULT_CSS);
		expect((persistence as MemoryPersistence).value).toMatchObject({
			active: { css: DEFAULT_CSS },
			draft: { css: CUSTOM_CSS },
		});
		expect(runtime.snapshots).toHaveLength(0);

		fireEvent.click([...tab.containerEl.querySelectorAll('button')][0]!);
		await settle();

		expect(controller.state.active).toMatchObject({ css: CUSTOM_CSS, source: 'custom' });
		expect(runtime.snapshots.at(-1)?.active.css).toBe(CUSTOM_CSS);
		expect(tab.containerEl.querySelector('[role="status"]')?.textContent).toBe('Custom CSS applied.');
		expect(notices).toContain('Custom CSS applied.');
	});

	it('keeps an invalid draft and active CSS while reporting an actionable location', async () => {
		const runtime = projection();
		const { tab, controller } = await render({ runtime });
		const editor = tab.containerEl.querySelector<HTMLTextAreaElement>('textarea')!;
		fireEvent.input(editor, { target: { value: 'body {\n color: red;' } });
		await settle();

		fireEvent.click([...tab.containerEl.querySelectorAll('button')][0]!);
		await settle();

		const feedback = tab.containerEl.querySelector('[role="alert"]');
		expect(feedback?.textContent).toMatch(/Line 1, column 6: Unclosed CSS block/);
		expect(editor.value).toBe('body {\n color: red;');
		expect(controller.state.active.css).toBe(DEFAULT_CSS);
		expect(runtime.snapshots).toHaveLength(0);
	});

	it('orders Apply after a pending draft save so the draft cannot overwrite the commit', async () => {
		const firstSave = deferred();
		let saveCount = 0;
		const persistence: SettingsPersistence = {
			load: async () => createDefaultSettings(bundle),
			save: async () => {
				saveCount += 1;
				if (saveCount === 1) await firstSave.promise;
			},
		};
		const { tab, controller } = await render({ persistence });
		const editor = tab.containerEl.querySelector<HTMLTextAreaElement>('textarea')!;
		fireEvent.input(editor, { target: { value: CUSTOM_CSS } });
		fireEvent.click([...tab.containerEl.querySelectorAll('button')][0]!);
		await Promise.resolve();

		expect(saveCount).toBe(1);
		firstSave.resolve();
		await settle();

		expect(saveCount).toBe(2);
		expect(controller.state.active.css).toBe(CUSTOM_CSS);
	});

	it('restores toggle state and controls when persistence rejects', async () => {
		const persistence: SettingsPersistence = {
			load: async () => createDefaultSettings(bundle),
			save: vi.fn().mockRejectedValue(new Error('disk full')),
		};
		const { tab, controller } = await render({ persistence });
		const toggle = tab.containerEl.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
		toggle.checked = false;
		fireEvent.change(toggle);
		await settle();

		expect(controller.state.enabled).toBe(true);
		expect(toggle.checked).toBe(true);
		expect(toggle.disabled).toBe(false);
		expect(tab.containerEl.querySelector('[role="alert"]')?.textContent).toContain('Dark PDF styling was not changed');
	});

	it('declines Reset without changes and confirms Reset to the installed default', async () => {
		const { tab, controller } = await render();
		const editor = tab.containerEl.querySelector<HTMLTextAreaElement>('textarea')!;
		fireEvent.input(editor, { target: { value: CUSTOM_CSS } });
		await settle();
		fireEvent.click([...tab.containerEl.querySelectorAll('button')][0]!);
		await settle();

		fireEvent.click([...tab.containerEl.querySelectorAll('button')][1]!);
		const modal = document.body.querySelector('.dark-pdf-export-reset-modal')!;
		expect(modal.textContent).toContain('Reset CSS to the installed defaults?');
		expect(document.activeElement?.textContent).toBe('Cancel');
		fireEvent.click([...modal.querySelectorAll('button')].find((button) => button.textContent === 'Cancel')!);
		expect(controller.state.active.css).toBe(CUSTOM_CSS);

		fireEvent.click([...tab.containerEl.querySelectorAll('button')][1]!);
		const secondModal = document.body.querySelector('.dark-pdf-export-reset-modal')!;
		fireEvent.click([...secondModal.querySelectorAll('button')].find((button) => button.textContent === 'Reset')!);
		await settle();

		expect(controller.state).toMatchObject({
			schemaVersion: CURRENT_SETTINGS_SCHEMA,
			active: { css: DEFAULT_CSS, source: 'reset' },
			draft: { css: DEFAULT_CSS, dirty: false },
		});
		expect(editor.value).toBe(DEFAULT_CSS);
	});

	it.each([
		['Apply', 0],
		['Reset', 1],
	] as const)('keeps the draft and restores controls when %s persistence rejects', async (_label, buttonIndex) => {
		const persistence = new MemoryPersistence();
		const { tab, controller } = await render({ persistence });
		const editor = tab.containerEl.querySelector<HTMLTextAreaElement>('textarea')!;
		fireEvent.input(editor, { target: { value: CUSTOM_CSS } });
		await settle();
		persistence.save = vi.fn().mockRejectedValue(new Error('disk full'));

		fireEvent.click([...tab.containerEl.querySelectorAll('button')][buttonIndex]!);
		if (buttonIndex === 1) {
			const modal = document.body.querySelector('.dark-pdf-export-reset-modal')!;
			fireEvent.click([...modal.querySelectorAll('button')].find((button) => button.textContent === 'Reset')!);
		}
		await settle();

		expect(controller.state.draft.css).toBe(CUSTOM_CSS);
		expect(controller.state.active.css).toBe(DEFAULT_CSS);
		expect(editor.value).toBe(CUSTOM_CSS);
		expect([...tab.containerEl.querySelectorAll('button')].every((button) => !button.disabled)).toBe(true);
		expect(tab.containerEl.querySelector('[role="alert"]')?.textContent).toContain('was not');
	});

	it('toggles styling off and on without deleting CSS or the draft', async () => {
		const runtime = projection();
		const { tab, controller } = await render({ runtime });
		const editor = tab.containerEl.querySelector<HTMLTextAreaElement>('textarea')!;
		fireEvent.input(editor, { target: { value: CUSTOM_CSS } });
		await settle();
		const toggle = tab.containerEl.querySelector<HTMLInputElement>('input[type="checkbox"]')!;

		toggle.checked = false;
		fireEvent.change(toggle);
		await settle();
		toggle.checked = true;
		fireEvent.change(toggle);
		await settle();

		expect(runtime.snapshots.at(-2)?.enabled).toBe(false);
		expect(runtime.snapshots.at(-1)?.enabled).toBe(true);
		expect(controller.state.draft.css).toBe(CUSTOM_CSS);
		expect(controller.state.active.css).toBe(DEFAULT_CSS);
	});
});
