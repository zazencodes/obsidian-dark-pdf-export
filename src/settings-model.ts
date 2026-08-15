import { validateStylesheet, type CssValidationResult } from './css-validator';

export const CURRENT_SETTINGS_SCHEMA = 1;

interface BundledStylesheet {
	css: string;
	version: string;
}

type ActiveSource = 'bundled' | 'custom' | 'reset';

export interface SettingsRecord {
	schemaVersion: typeof CURRENT_SETTINGS_SCHEMA;
	enabled: boolean;
	bundledVersion: string;
	active: {
		css: string;
		source: ActiveSource;
		bundledFingerprint: string | null;
	};
	draft: {
		css: string;
		baseFingerprint: string;
		dirty: boolean;
	};
}

export interface SettingsPersistence {
	load(): Promise<unknown>;
	save(data: unknown): Promise<void>;
}

export interface RuntimeProjection {
	project(settings: SettingsRecord): void | Promise<void>;
}

type NormalizationKind = 'fresh' | 'accepted' | 'migrated' | 'fallback';

export interface NormalizationResult {
	kind: NormalizationKind;
	settings: SettingsRecord;
	shouldPersist: boolean;
	previousSettings?: SettingsRecord;
}

export type TransitionResult =
	| { ok: true }
	| { ok: false; error: Error; validation?: CssValidationResult };

function cloneSettings(settings: SettingsRecord): SettingsRecord {
	return {
		...settings,
		active: { ...settings.active },
		draft: { ...settings.draft },
	};
}

export function fingerprintCss(css: string): string {
	let hash = 0x811c9dc5;
	for (const byte of new TextEncoder().encode(css)) {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193);
	}
	return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createDefaultSettings(bundle: BundledStylesheet): SettingsRecord {
	const fingerprint = fingerprintCss(bundle.css);
	return {
		schemaVersion: CURRENT_SETTINGS_SCHEMA,
		enabled: true,
		bundledVersion: bundle.version,
		active: {
			css: bundle.css,
			source: 'bundled',
			bundledFingerprint: fingerprint,
		},
		draft: {
			css: bundle.css,
			baseFingerprint: fingerprint,
			dirty: false,
		},
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSemver(value: string): boolean {
	return /^\d+\.\d+\.\d+$/.test(value);
}

function compareVersions(left: string, right: string): number {
	const leftParts = left.split('.').map(Number);
	const rightParts = right.split('.').map(Number);
	for (let index = 0; index < 3; index += 1) {
		const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}

function decodeSettings(value: unknown): SettingsRecord | null {
	if (!isRecord(value) || value.schemaVersion !== CURRENT_SETTINGS_SCHEMA) return null;
	if (typeof value.enabled !== 'boolean' || typeof value.bundledVersion !== 'string') return null;
	if (!isSemver(value.bundledVersion) || !isRecord(value.active) || !isRecord(value.draft)) return null;

	const { active, draft } = value;
	if (
		typeof active.css !== 'string' ||
		(active.source !== 'bundled' && active.source !== 'custom' && active.source !== 'reset') ||
		(active.bundledFingerprint !== null && typeof active.bundledFingerprint !== 'string') ||
		typeof draft.css !== 'string' ||
		typeof draft.baseFingerprint !== 'string' ||
		typeof draft.dirty !== 'boolean'
	) {
		return null;
	}

	if (draft.baseFingerprint !== fingerprintCss(active.css)) return null;
	if (draft.dirty !== (draft.css !== active.css)) return null;

	return cloneSettings(value as unknown as SettingsRecord);
}

export function normalizeSettings(
	saved: unknown,
	bundle: BundledStylesheet,
): NormalizationResult {
	const safeDefault = createDefaultSettings(bundle);
	if (saved === undefined || saved === null) {
		return { kind: 'fresh', settings: safeDefault, shouldPersist: true };
	}

	const decoded = decodeSettings(saved);
	if (decoded === null) {
		return { kind: 'fallback', settings: safeDefault, shouldPersist: false };
	}

	const canMigrate =
		decoded.active.source === 'bundled' &&
		decoded.active.bundledFingerprint === fingerprintCss(decoded.active.css) &&
		!decoded.draft.dirty &&
		compareVersions(decoded.bundledVersion, bundle.version) < 0;

	if (canMigrate) {
		return {
			kind: 'migrated',
			settings: safeDefault,
			shouldPersist: true,
			previousSettings: decoded,
		};
	}

	return { kind: 'accepted', settings: decoded, shouldPersist: false };
}

function errorFrom(value: unknown): Error {
	return value instanceof Error ? value : new Error(String(value));
}

export class SettingsController {
	private current: SettingsRecord;
	private persistedSnapshot: unknown;
	private hasPersistedSnapshot = false;
	private persistenceWritable = true;
	private queue: Promise<void> = Promise.resolve();
	private closed = false;

	constructor(
		private readonly bundle: BundledStylesheet,
		private readonly persistence: SettingsPersistence,
		private readonly runtime: RuntimeProjection,
	) {
		this.current = createDefaultSettings(bundle);
	}

	get state(): SettingsRecord {
		return cloneSettings(this.current);
	}

	get isClosed(): boolean {
		return this.closed;
	}

	async load(): Promise<NormalizationResult> {
		let saved: unknown;
		try {
			saved = await this.persistence.load();
		} catch {
			this.persistenceWritable = false;
			const result: NormalizationResult = {
				kind: 'fallback',
				settings: createDefaultSettings(this.bundle),
				shouldPersist: false,
			};
			if (!this.closed) this.current = result.settings;
			return result;
		}

		if (this.closed) {
			return { kind: 'fallback', settings: this.state, shouldPersist: false };
		}
		this.persistenceWritable = true;
		this.persistedSnapshot = structuredClone(saved);
		this.hasPersistedSnapshot = true;

		let result = normalizeSettings(saved, this.bundle);
		const savedActive = result.previousSettings ?? result.settings;
		if (!validateStylesheet(savedActive.active.css).valid) {
			result = {
				kind: 'fallback',
				settings: createDefaultSettings(this.bundle),
				shouldPersist: false,
			};
		}

		if (result.shouldPersist) {
			try {
				await this.persistence.save(cloneSettings(result.settings));
				if (!this.closed) {
					this.persistedSnapshot = cloneSettings(result.settings);
					this.hasPersistedSnapshot = true;
				}
			} catch {
				if (result.previousSettings !== undefined) {
					result = {
						kind: 'accepted',
						settings: result.previousSettings,
						shouldPersist: false,
					};
				}
			}
		}

		if (!this.closed) this.current = cloneSettings(result.settings);
		return result;
	}

	editDraft(css: string): Promise<TransitionResult> {
		return this.enqueue(async () => {
			const candidate = cloneSettings(this.current);
			candidate.draft = {
				css,
				baseFingerprint: fingerprintCss(candidate.active.css),
				dirty: css !== candidate.active.css,
			};
			this.current = candidate;
			if (!this.persistenceWritable) {
				return {
					ok: false,
					error: new Error('Settings storage could not be read. Reload Obsidian before saving.'),
				};
			}
			try {
				await this.persistence.save(cloneSettings(candidate));
				if (!this.closed) {
					this.persistedSnapshot = cloneSettings(candidate);
					this.hasPersistedSnapshot = true;
				}
				return { ok: true };
			} catch (error) {
				return { ok: false, error: errorFrom(error) };
			}
		});
	}

	applyDraft(): Promise<TransitionResult> {
		return this.enqueue(async () => {
			const validation = validateStylesheet(this.current.draft.css);
			if (!validation.valid) {
				return {
					ok: false,
					error: new Error(validation.error.message),
					validation,
				};
			}

			const css = this.current.draft.css;
			const fingerprint = fingerprintCss(css);
			const candidate = cloneSettings(this.current);
			candidate.active = { css, source: 'custom', bundledFingerprint: null };
			candidate.draft = { css, baseFingerprint: fingerprint, dirty: false };
			return this.commit(candidate);
		});
	}

	setEnabled(enabled: boolean): Promise<TransitionResult> {
		return this.enqueue(async () => {
			if (this.current.enabled === enabled) return { ok: true };
			const candidate = cloneSettings(this.current);
			candidate.enabled = enabled;
			return this.commit(candidate);
		});
	}

	reset(): Promise<TransitionResult> {
		return this.enqueue(async () => {
			const candidate = createDefaultSettings(this.bundle);
			candidate.enabled = this.current.enabled;
			candidate.active.source = 'reset';
			return this.commit(candidate);
		});
	}

	close(): void {
		this.closed = true;
	}

	private enqueue(operation: () => Promise<TransitionResult>): Promise<TransitionResult> {
		const result = this.queue.then(async () => {
			if (this.closed) return { ok: false, error: new Error('Settings controller is closed.') };
			return operation();
		});
		this.queue = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	private async commit(candidate: SettingsRecord): Promise<TransitionResult> {
		if (!this.persistenceWritable) {
			return {
				ok: false,
				error: new Error('Settings storage could not be read. Reload Obsidian before saving.'),
			};
		}
		const previous = cloneSettings(this.current);
		const previousPersisted = this.hasPersistedSnapshot
			? structuredClone(this.persistedSnapshot)
			: cloneSettings(previous);
		try {
			await this.persistence.save(cloneSettings(candidate));
		} catch (error) {
			return { ok: false, error: errorFrom(error) };
		}

		if (this.closed) {
			try {
				await this.persistence.save(previousPersisted);
			} catch {
				// Closing forbids further projection; recovery will normalize on next load.
			}
			return { ok: false, error: new Error('Settings controller is closed.') };
		}

		try {
			await this.runtime.project(cloneSettings(candidate));
		} catch (error) {
			let rollbackError: Error | null = null;
			try {
				await this.persistence.save(previousPersisted);
				this.persistedSnapshot = structuredClone(previousPersisted);
				this.hasPersistedSnapshot = true;
			} catch (rollbackFailure) {
				rollbackError = errorFrom(rollbackFailure);
			}
			try {
				await this.runtime.project(previous);
			} catch (rollbackFailure) {
				rollbackError ??= errorFrom(rollbackFailure);
			}
			return {
				ok: false,
				error:
					rollbackError === null
						? errorFrom(error)
						: new Error(`${errorFrom(error).message} Rollback failed: ${rollbackError.message}`),
			};
		}

		this.current = cloneSettings(candidate);
		this.persistedSnapshot = cloneSettings(candidate);
		this.hasPersistedSnapshot = true;
		return { ok: true };
	}
}
