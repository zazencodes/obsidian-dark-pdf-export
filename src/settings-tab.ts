import {
	ButtonComponent,
	Modal,
	Notice,
	PluginSettingTab,
	Setting,
	TextAreaComponent,
	type App,
	type Plugin,
	type SettingDefinitionItem,
} from 'obsidian';

import { SettingsController, type TransitionResult } from './settings-model';

type FeedbackTone = 'status' | 'success' | 'error';

interface SettingsFeedback {
	message: string;
	tone: FeedbackTone;
}

function failureFeedback(action: string, result: Extract<TransitionResult, { ok: false }>): SettingsFeedback {
	if (result.validation !== undefined && !result.validation.valid) {
		const { line, column, message } = result.validation.error;
		return {
			tone: 'error',
			message: `CSS was not applied. Line ${line}, column ${column}: ${message}`,
		};
	}

	return {
		tone: 'error',
		message: `${action} was not completed. ${result.error.message}`,
	};
}

class SettingsInteractionPresenter {
	constructor(private readonly controller: SettingsController) {}

	get state() {
		return this.controller.state;
	}

	async editDraft(css: string): Promise<SettingsFeedback> {
		const result = await this.controller.editDraft(css);
		return result.ok
			? { tone: 'status', message: 'Draft saved. Apply to activate it.' }
			: failureFeedback('The draft save', result);
	}

	async apply(): Promise<SettingsFeedback> {
		const result = await this.controller.applyDraft();
		return result.ok
			? { tone: 'success', message: 'Custom CSS applied.' }
			: failureFeedback('CSS Apply', result);
	}

	async setEnabled(enabled: boolean): Promise<SettingsFeedback> {
		const result = await this.controller.setEnabled(enabled);
		if (!result.ok) {
			return {
				tone: 'error',
				message: `Dark PDF styling was not changed. ${result.error.message}`,
			};
		}
		return {
			tone: 'success',
			message: enabled ? 'Dark PDF styling enabled.' : 'Dark PDF styling disabled.',
		};
	}

	async reset(): Promise<SettingsFeedback> {
		const result = await this.controller.reset();
		return result.ok
			? { tone: 'success', message: 'CSS reset to the installed defaults.' }
			: failureFeedback('CSS Reset', result);
	}
}

class ResetStylesheetModal extends Modal {
	constructor(
		app: App,
		private readonly confirmReset: () => Promise<void>,
	) {
		super(app);
	}

	override onOpen(): void {
		this.containerEl.classList.add('dark-pdf-export-reset-modal');
		this.titleEl.setText('Reset CSS to the installed defaults?');
		this.contentEl.createEl('p', {
			text: 'This replaces the current draft and active stylesheet. This action cannot be undone.',
		});
		const actions = this.contentEl.createDiv({ cls: 'dark-pdf-export-modal-actions' });
		const cancelButton = new ButtonComponent(actions)
			.setButtonText('Cancel')
			.onClick(() => this.close());
		new ButtonComponent(actions)
			.setButtonText('Reset')
			.setDestructive()
			.setCta()
			.onClick(async () => {
				this.close();
				await this.confirmReset();
			});
		cancelButton.buttonEl.focus();
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}

export class DarkPdfExportSettingTab extends PluginSettingTab {
	private readonly presenter: SettingsInteractionPresenter;
	private toggle: import('obsidian').ToggleComponent | null = null;
	private editor: TextAreaComponent | null = null;
	private applyButton: ButtonComponent | null = null;
	private resetButton: ButtonComponent | null = null;
	private feedbackEl: HTMLParagraphElement | null = null;

	constructor(app: App, plugin: Plugin, controller: SettingsController) {
		super(app, plugin);
		this.presenter = new SettingsInteractionPresenter(controller);
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Dark PDF Export settings',
				render: (setting) => {
					this.renderSurface(setting);
					return () => this.clearControlReferences();
				},
			},
		];
	}

	private renderSurface(enabledSetting: Setting): void {
		const container = enabledSetting.settingEl.parentElement ?? enabledSetting.settingEl;
		container.classList.add('dark-pdf-export-settings');
		enabledSetting
			.setName('Enable dark PDF styling')
			.setDesc('Apply the saved stylesheet during native PDF export.')
			.setClass('dark-pdf-export-enabled-setting');
		enabledSetting.addToggle((toggle) => {
			this.toggle = toggle;
			toggle.toggleEl.setAttribute('aria-label', 'Enable dark PDF styling');
			toggle.setValue(this.presenter.state.enabled).onChange(async (enabled) => {
				await this.performAction(() => this.presenter.setEnabled(enabled));
			});
		});

		const editorSection = container.createDiv({ cls: 'dark-pdf-export-editor-section' });
		const editorId = 'dark-pdf-export-css-editor';
		const riskId = 'dark-pdf-export-css-risk';
		const feedbackId = 'dark-pdf-export-feedback';
		editorSection.createEl('label', {
			cls: 'dark-pdf-export-editor-label',
			text: 'Complete CSS stylesheet',
			attr: { for: editorId },
		});
		editorSection.createEl('p', {
			cls: 'setting-item-description dark-pdf-export-risk',
			text: 'Edit the complete stylesheet. Selectors outside @media print can affect the Obsidian interface.',
			attr: { id: riskId },
		});

		this.editor = new TextAreaComponent(editorSection).setValue(this.presenter.state.draft.css);
		this.editor.inputEl.id = editorId;
		this.editor.inputEl.classList.add('dark-pdf-export-css-editor');
		this.editor.inputEl.setAttribute('aria-describedby', `${riskId} ${feedbackId}`);
		this.editor.inputEl.setAttribute('spellcheck', 'false');
		this.editor.onChange(async (css) => {
			const feedback = await this.presenter.editDraft(css);
			this.showFeedback(feedback);
		});

		const actions = editorSection.createDiv({ cls: 'dark-pdf-export-actions' });
		this.applyButton = new ButtonComponent(actions)
			.setButtonText('Apply')
			.setCta()
			.onClick(async () => {
				await this.performAction(() => this.presenter.apply());
			});
		this.resetButton = new ButtonComponent(actions)
			.setButtonText('Reset')
			.setDestructive()
			.onClick(() => {
				new ResetStylesheetModal(this.app, async () => {
					await this.performAction(() => this.presenter.reset());
				}).open();
			});

		this.feedbackEl = editorSection.createEl('p', {
			cls: 'dark-pdf-export-feedback',
			attr: { id: feedbackId, role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
		});
	}

	private clearControlReferences(): void {
		this.toggle = null;
		this.editor = null;
		this.applyButton = null;
		this.resetButton = null;
		this.feedbackEl = null;
	}

	private setBusy(busy: boolean): void {
		this.toggle?.setDisabled(busy);
		this.editor?.setDisabled(busy);
		this.applyButton?.setDisabled(busy);
		this.resetButton?.setDisabled(busy);
	}

	private synchronizeControls(): void {
		const state = this.presenter.state;
		if (this.toggle !== null && this.toggle.getValue() !== state.enabled) {
			this.toggle.setValue(state.enabled);
		}
		if (this.editor !== null && this.editor.inputEl.value !== state.draft.css) {
			this.editor.setValue(state.draft.css);
		}
	}

	private async performAction(action: () => Promise<SettingsFeedback>): Promise<void> {
		this.setBusy(true);
		const feedback = await action();
		this.synchronizeControls();
		this.setBusy(false);
		this.showFeedback(feedback);
		if (feedback.tone === 'success') new Notice(feedback.message);
	}

	private showFeedback(feedback: SettingsFeedback): void {
		if (this.feedbackEl === null) return;
		this.feedbackEl.textContent = feedback.message;
		this.feedbackEl.classList.toggle('is-error', feedback.tone === 'error');
		this.feedbackEl.classList.toggle('is-success', feedback.tone === 'success');
		this.feedbackEl.setAttribute('role', feedback.tone === 'error' ? 'alert' : 'status');
	}
}
