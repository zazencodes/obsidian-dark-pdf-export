import { Plugin } from 'obsidian';

import { BUNDLED_DEFAULT_VERSION, DEFAULT_STYLESHEET } from './default-stylesheet';
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
				this.styleRegistry?.setCss(settings.active.css);
				this.styleRegistry?.setEnabled(settings.enabled);
			},
		};
		const settingsController = new SettingsController(
			{ css: DEFAULT_STYLESHEET, version: BUNDLED_DEFAULT_VERSION },
			persistence,
			runtime,
		);
		this.settingsController = settingsController;
		await settingsController.load();
		if (settingsController.isClosed) return;

		const settings = settingsController.state;
		const styleRegistry = new DocumentStyleRegistry(settings.active.css, settings.enabled);
		this.styleRegistry = styleRegistry;
		this.addSettingTab(new DarkPdfExportSettingTab(this.app, this, settingsController));

		const documents = new Set<Document>([this.app.workspace.rootSplit.doc]);
		this.app.workspace.iterateAllLeaves((leaf) => {
			documents.add(leaf.view.containerEl.ownerDocument);
		});
		for (const target of documents) styleRegistry.addDocument(target);

		this.registerEvent(
			this.app.workspace.on('window-open', (workspaceWindow) => {
				styleRegistry.addDocument(workspaceWindow.doc);
			}),
		);
		this.registerEvent(
			this.app.workspace.on('window-close', (workspaceWindow) => {
				styleRegistry.removeDocument(workspaceWindow.doc);
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
