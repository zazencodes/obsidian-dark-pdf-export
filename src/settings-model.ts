import { DEFAULT_PAGE_MARGIN, isValidPageMargin } from './default-stylesheet';

export interface SettingsRecord {
	enabled: boolean;
	pageMargin: string;
}

export const DEFAULT_SETTINGS: SettingsRecord = {
	enabled: true,
	pageMargin: DEFAULT_PAGE_MARGIN,
};

export interface SettingsPersistence {
	load(): Promise<unknown>;
	save(data: unknown): Promise<void>;
}

export interface RuntimeProjection {
	project(settings: SettingsRecord): void | Promise<void>;
}

export class SettingsController {
	private currentSettings: SettingsRecord = { ...DEFAULT_SETTINGS };
	private closed = false;

	constructor(
		private readonly persistence: SettingsPersistence,
		private readonly runtime: RuntimeProjection,
	) {}

	get state(): SettingsRecord {
		return { ...this.currentSettings };
	}

	get isClosed(): boolean {
		return this.closed;
	}

	async load(): Promise<void> {
		if (this.closed) return;
		const raw = await this.persistence.load();
		if (this.closed) return;

		const enabled =
			typeof raw === 'object' && raw !== null && 'enabled' in raw && typeof (raw as Record<string, unknown>).enabled === 'boolean'
				? ((raw as Record<string, unknown>).enabled as boolean)
				: DEFAULT_SETTINGS.enabled;

		const rawMargin =
			typeof raw === 'object' && raw !== null && 'pageMargin' in raw
				? (raw as Record<string, unknown>).pageMargin
				: undefined;
		const pageMargin =
			typeof rawMargin === 'string' && isValidPageMargin(rawMargin)
				? rawMargin.trim()
				: DEFAULT_SETTINGS.pageMargin;

		this.currentSettings = { enabled, pageMargin };
		await this.runtime.project(this.state);
	}

	async setEnabled(enabled: boolean): Promise<void> {
		if (this.closed || this.currentSettings.enabled === enabled) return;
		this.currentSettings.enabled = enabled;
		await this.persistence.save(this.currentSettings);
		await this.runtime.project(this.state);
	}

	async setPageMargin(pageMargin: string): Promise<void> {
		const normalized = pageMargin.trim();
		if (this.closed || !isValidPageMargin(normalized)) return;
		if (this.currentSettings.pageMargin === normalized) return;
		this.currentSettings.pageMargin = normalized;
		await this.persistence.save(this.currentSettings);
		await this.runtime.project(this.state);
	}

	close(): void {
		this.closed = true;
	}
}
