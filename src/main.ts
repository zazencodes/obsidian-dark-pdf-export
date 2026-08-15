import { Plugin } from 'obsidian';

import { DEFAULT_STYLESHEET } from './default-stylesheet';
import {
	SettingsController,
	type RuntimeProjection,
	type SettingsPersistence,
} from './settings-model';
import { DarkPdfExportSettingTab } from './settings-tab';
import { DocumentStyleRegistry } from './style-manager';

export default class DarkPdfExportPlugin extends Plugin {
	private styleRegistry: DocumentStyleRegistry | null = null;
	settingsController: SettingsController | null = null;

	async onload(): Promise<void> {
		const persistence: SettingsPersistence = {
			load: () => this.loadData(),
			save: (settings) => this.saveData(settings),
		};
		const runtime: RuntimeProjection = {
			project: (settings) => {
				this.styleRegistry?.setEnabled(settings.enabled);
				this.app.workspace.trigger('parse-style-settings');
			},
		};
		const settingsController = new SettingsController(
			persistence,
			runtime,
		);
		this.settingsController = settingsController;
		await settingsController.load();
		if (settingsController.isClosed) return;

		const settings = settingsController.state;
		const styleRegistry = new DocumentStyleRegistry(DEFAULT_STYLESHEET, settings.enabled);
		this.styleRegistry = styleRegistry;
		this.addSettingTab(new DarkPdfExportSettingTab(this.app, this, settingsController));

		if (typeof document !== 'undefined') {
			styleRegistry.addDocument(document);
		}
		this.app.workspace.trigger('parse-style-settings');

		this.app.workspace.onLayoutReady(() => {
			this.app.workspace.iterateAllLeaves((leaf) => {
				const doc = leaf.view?.containerEl?.ownerDocument;
				if (doc) styleRegistry.addDocument(doc);
			});
		});

		this.registerEvent(
			this.app.workspace.on('window-open', (workspaceWindow) => {
				if (workspaceWindow?.doc) styleRegistry.addDocument(workspaceWindow.doc);
			}),
		);
		this.registerEvent(
			this.app.workspace.on('window-close', (workspaceWindow) => {
				if (workspaceWindow?.doc) styleRegistry.removeDocument(workspaceWindow.doc);
			}),
		);
	}

	onunload(): void {
		this.settingsController?.close();
		this.settingsController = null;
		this.styleRegistry?.close();
		this.styleRegistry = null;
	}
}
