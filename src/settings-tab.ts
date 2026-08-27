import {
	PluginSettingTab,
	Setting,
	type App,
	type Plugin,
	type SettingDefinitionItem,
} from 'obsidian';

import { DEFAULT_PAGE_MARGIN, isValidPageMargin } from './default-stylesheet';
import { SettingsController } from './settings-model';

export class DarkPdfExportSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private readonly controller: SettingsController,
	) {
		super(app, plugin);
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.renderSetting(new Setting(containerEl));
		this.renderPageMarginSetting(new Setting(containerEl));
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Enable dark PDF styling',
				render: (setting) => {
					this.renderSetting(setting);
				},
			},
			{
				name: 'Page margin',
				render: (setting) => {
					this.renderPageMarginSetting(setting);
				},
			},
		];
	}

	private renderSetting(setting: Setting): void {
		setting
			.setName('Enable dark PDF styling')
			.setDesc('Apply dark styling during native PDF export.')
			.addToggle((toggle) => {
				toggle
					.setTooltip('Enable dark PDF styling')
					.setValue(this.controller.state.enabled)
					.onChange(async (enabled) => {
						await this.controller.setEnabled(enabled);
					});
			});
	}

	private renderPageMarginSetting(setting: Setting): void {
		setting
			.setName('Page margin')
			.setDesc(
				'Space around content on every exported page. Accepts one to four CSS lengths, e.g. "14mm 12mm".',
			)
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_PAGE_MARGIN)
					.setValue(this.controller.state.pageMargin)
					.onChange(async (pageMargin) => {
						const valid = isValidPageMargin(pageMargin);
						text.inputEl.classList.toggle('dark-pdf-export-invalid-margin', !valid);
						if (valid) {
							await this.controller.setPageMargin(pageMargin);
						}
					});
			});
	}
}
