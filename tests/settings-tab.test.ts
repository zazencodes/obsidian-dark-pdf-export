import { describe, expect, it, vi } from 'vitest';
import type { App, Plugin } from 'obsidian';

import {
	SettingsController,
	type RuntimeProjection,
	type SettingsPersistence,
	type SettingsRecord,
} from '../src/settings-model';
import { DarkPdfExportSettingTab } from '../src/settings-tab';

vi.mock('obsidian', () => {
	class BaseComponent {
		setDisabled(disabled: boolean): this {
			const element = 'toggleEl' in this ? (this.toggleEl as HTMLInputElement) : null;
			if (element) element.disabled = disabled;
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

		setTooltip(text: string): this {
			this.toggleEl.title = text;
			return this;
		}

		onChange(callback: (value: boolean) => unknown): this {
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
		containerEl: HTMLElement;

		constructor(public app: App, public plugin: Plugin) {
			this.containerEl = document.createElement('div');
			(this.containerEl as unknown as { empty: () => void }).empty = () => {
				this.containerEl.replaceChildren();
			};
		}
	}

	return {
		PluginSettingTab,
		Setting,
	};
});

class MemoryPersistence implements SettingsPersistence {
	readonly saves: SettingsRecord[] = [];

	constructor(public value: unknown) {}

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

const dummyApp = {} as unknown as App;
const dummyPlugin = {} as unknown as Plugin;

describe('DarkPdfExportSettingTab', () => {
	it('renders the enable toggle reflecting current controller state via display and definitions', async () => {
		const persistence = new MemoryPersistence({ enabled: true });
		const controller = new SettingsController(persistence, projection());
		await controller.load();

		const tab = new DarkPdfExportSettingTab(dummyApp, dummyPlugin, controller);
		tab.display();

		const toggle = tab.containerEl.querySelector<HTMLInputElement>('input[type="checkbox"]');
		expect(toggle).not.toBeNull();
		expect(toggle?.checked).toBe(true);

		const definitions = tab.getSettingDefinitions();
		expect(definitions).toHaveLength(1);
		const firstDef = definitions[0];
		expect(firstDef && 'name' in firstDef ? firstDef.name : '').toBe('Enable dark PDF styling');
	});

	it('toggles the enabled setting when user changes switch', async () => {
		const persistence = new MemoryPersistence({ enabled: true });
		const runtime = projection();
		const controller = new SettingsController(persistence, runtime);
		await controller.load();

		const tab = new DarkPdfExportSettingTab(dummyApp, dummyPlugin, controller);
		tab.display();

		const toggle = tab.containerEl.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
		toggle.checked = false;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));

		await Promise.resolve();

		expect(controller.state.enabled).toBe(false);
		expect(persistence.saves).toEqual([{ enabled: false }]);
		expect(runtime.snapshots).toEqual([{ enabled: true }, { enabled: false }]);
	});
});
