import {
	PluginSettingTab,
	Setting,
	type App,
	type Plugin,
	type SettingDefinitionItem,
} from 'obsidian';

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
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Enable dark PDF styling',
				render: (setting) => {
					this.renderSetting(setting);
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
}
