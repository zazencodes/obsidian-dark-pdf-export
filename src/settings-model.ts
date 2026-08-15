export interface SettingsRecord {
	enabled: boolean;
}

export const DEFAULT_SETTINGS: SettingsRecord = {
	enabled: true,
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

		this.currentSettings = { enabled };
		await this.runtime.project(this.state);
	}

	async setEnabled(enabled: boolean): Promise<void> {
		if (this.closed || this.currentSettings.enabled === enabled) return;
		this.currentSettings.enabled = enabled;
		await this.persistence.save(this.currentSettings);
		await this.runtime.project(this.state);
	}

	close(): void {
		this.closed = true;
	}
}
