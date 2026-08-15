import { describe, expect, it, vi } from 'vitest';

import {
	CURRENT_SETTINGS_SCHEMA,
	SettingsController,
	createDefaultSettings,
	fingerprintCss,
	normalizeSettings,
	type RuntimeProjection,
	type SettingsPersistence,
	type SettingsRecord,
} from '../src/settings-model';

const OLD_CSS = '@media print { body { color: #ddd; } }';
const NEW_CSS = '@media print { body { color: #eee; } }';
const CUSTOM_CSS = '@media print { body { color: hotpink; } }';
const bundle = { css: NEW_CSS, version: '1.1.0' };

function oldBundledSettings(): SettingsRecord {
	const fingerprint = fingerprintCss(OLD_CSS);
	return {
		schemaVersion: CURRENT_SETTINGS_SCHEMA,
		enabled: true,
		bundledVersion: '1.0.0',
		active: { css: OLD_CSS, source: 'bundled', bundledFingerprint: fingerprint },
		draft: { css: OLD_CSS, baseFingerprint: fingerprint, dirty: false },
	};
}

function deferred(): {
	promise: Promise<void>;
	resolve: () => void;
	reject: (error: Error) => void;
} {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

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

describe('settings normalization', () => {
	it('creates enabled bundled settings for missing data', () => {
		const result = normalizeSettings(undefined, bundle);

		expect(result.kind).toBe('fresh');
		expect(result.settings).toEqual(createDefaultSettings(bundle));
		expect(result.settings.draft.css).toBe(result.settings.active.css);
	});

	it.each([
		{},
		{ schemaVersion: CURRENT_SETTINGS_SCHEMA, enabled: 'yes' },
		{ ...oldBundledSettings(), schemaVersion: CURRENT_SETTINGS_SCHEMA + 1 },
		{ ...oldBundledSettings(), draft: { ...oldBundledSettings().draft, dirty: true } },
	])('uses a non-persisting safe fallback for rejected data %#', (saved) => {
		const result = normalizeSettings(saved, bundle);

		expect(result.kind).toBe('fallback');
		expect(result.shouldPersist).toBe(false);
		expect(result.settings).toEqual(createDefaultSettings(bundle));
	});

	it('treats Obsidian\'s null no-data result as a fresh install', () => {
		const result = normalizeSettings(null, bundle);

		expect(result.kind).toBe('fresh');
		expect(result.shouldPersist).toBe(true);
	});

	it('migrates only a provably untouched older bundled record', () => {
		const result = normalizeSettings(oldBundledSettings(), bundle);

		expect(result.kind).toBe('migrated');
		expect(result.shouldPersist).toBe(true);
		expect(result.settings).toEqual(createDefaultSettings(bundle));
	});

	it.each([
		['same version', (record: SettingsRecord) => ({ ...record, bundledVersion: '1.1.0' })],
		['downgrade', (record: SettingsRecord) => ({ ...record, bundledVersion: '2.0.0' })],
		['dirty draft', (record: SettingsRecord) => ({
			...record,
			draft: { ...record.draft, css: `${record.draft.css}\n/* exact draft bytes */`, dirty: true },
		})],
		['custom active', (record: SettingsRecord) => {
			const fingerprint = fingerprintCss(CUSTOM_CSS);
			return {
				...record,
				active: { css: CUSTOM_CSS, source: 'custom' as const, bundledFingerprint: null },
				draft: { css: CUSTOM_CSS, baseFingerprint: fingerprint, dirty: false },
			};
		}],
		['reset active', (record: SettingsRecord) => ({
			...record,
			active: { ...record.active, source: 'reset' as const },
		})],
		['ambiguous fingerprint', (record: SettingsRecord) => ({
			...record,
			active: { ...record.active, bundledFingerprint: 'unknown-release-fingerprint' },
		})],
	] as const)('preserves exact saved bytes for %s', (_label, change) => {
		const saved = change(oldBundledSettings());
		const result = normalizeSettings(saved, bundle);

		expect(result.kind).toBe('accepted');
		expect(result.shouldPersist).toBe(false);
		expect(result.settings).toEqual(saved);
	});
});

describe('SettingsController', () => {
	it('loads and validates before exposing state, without rewriting corrupt data', async () => {
		const corrupt = { schemaVersion: 999, bytes: 'leave me alone' };
		const persistence = new MemoryPersistence(corrupt);
		const controller = new SettingsController(bundle, persistence, projection());

		const loaded = await controller.load();

		expect(loaded.kind).toBe('fallback');
		expect(persistence.value).toBe(corrupt);
		expect(persistence.saves).toHaveLength(0);
		expect(controller.state).toEqual(createDefaultSettings(bundle));
	});

	it('uses the safe default without writing when loading rejects', async () => {
		const save = vi.fn();
		const persistence: SettingsPersistence = {
			load: vi.fn().mockRejectedValue(new Error('unreadable data')),
			save,
		};
		const controller = new SettingsController(bundle, persistence, projection());

		const loaded = await controller.load();

		expect(loaded.kind).toBe('fallback');
		expect(save).not.toHaveBeenCalled();
		expect(controller.state).toEqual(createDefaultSettings(bundle));
	});

	it('keeps persistence read-only after load rejects because no rollback snapshot exists', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const runtime = projection();
		const persistence: SettingsPersistence = {
			load: vi.fn().mockRejectedValue(new Error('unreadable data')),
			save,
		};
		const controller = new SettingsController(bundle, persistence, runtime);
		await controller.load();

		const result = await controller.setEnabled(false);

		expect(result).toMatchObject({ ok: false });
		expect(save).not.toHaveBeenCalled();
		expect(runtime.snapshots).toHaveLength(0);
		expect(controller.state.enabled).toBe(true);
	});

	it('keeps the older complete snapshot when atomic migration persistence rejects', async () => {
		const saved = oldBundledSettings();
		const persistence: SettingsPersistence = {
			load: async () => saved,
			save: vi.fn().mockRejectedValue(new Error('disk full')),
		};
		const controller = new SettingsController(bundle, persistence, projection());

		const loaded = await controller.load();

		expect(loaded.kind).toBe('accepted');
		expect(controller.state).toEqual(saved);
	});

	it('falls back without rewriting when saved active CSS fails validation', async () => {
		const saved = oldBundledSettings();
		saved.active.css = '@import "https://example.com/theme.css";';
		saved.draft = {
			css: saved.active.css,
			baseFingerprint: fingerprintCss(saved.active.css),
			dirty: false,
		};
		const persistence = new MemoryPersistence(saved);
		const controller = new SettingsController(bundle, persistence, projection());

		const loaded = await controller.load();

		expect(loaded.kind).toBe('fallback');
		expect(persistence.saves).toHaveLength(0);
		expect(controller.state.active.css).toBe(NEW_CSS);
	});

	it('keeps draft isolated, applies valid CSS, toggles without data loss, and resets', async () => {
		const persistence = new MemoryPersistence(undefined);
		const runtime = projection();
		const controller = new SettingsController(bundle, persistence, runtime);
		await controller.load();

		await controller.editDraft(CUSTOM_CSS);
		expect(controller.state.active.css).toBe(NEW_CSS);
		expect(controller.state.draft).toMatchObject({ css: CUSTOM_CSS, dirty: true });
		expect(runtime.snapshots).toHaveLength(0);

		expect(await controller.applyDraft()).toMatchObject({ ok: true });
		expect(controller.state.active).toMatchObject({ css: CUSTOM_CSS, source: 'custom' });
		expect(controller.state.draft.dirty).toBe(false);

		await controller.setEnabled(false);
		await controller.setEnabled(true);
		expect(controller.state.active.css).toBe(CUSTOM_CSS);
		expect(runtime.snapshots.at(-2)?.enabled).toBe(false);
		expect(runtime.snapshots.at(-1)?.enabled).toBe(true);

		await controller.reset();
		expect(controller.state.active).toMatchObject({ css: NEW_CSS, source: 'reset' });
		expect(controller.state.draft).toMatchObject({ css: NEW_CSS, dirty: false });
	});

	it('retains an invalid draft and the prior active projection', async () => {
		const persistence = new MemoryPersistence(undefined);
		const runtime = projection();
		const controller = new SettingsController(bundle, persistence, runtime);
		await controller.load();
		await controller.editDraft('body { color red; }');

		const result = await controller.applyDraft();

		expect(result.ok).toBe(false);
		expect(controller.state.draft.css).toBe('body { color red; }');
		expect(controller.state.active.css).toBe(NEW_CSS);
		expect(runtime.snapshots).toHaveLength(0);
		expect((persistence.value as SettingsRecord).draft.css).toBe('body { color red; }');
	});

	it('serializes forced out-of-order saves so a committed transition wins', async () => {
		const firstSave = deferred();
		const saves: SettingsRecord[] = [];
		let saveCount = 0;
		const persistence: SettingsPersistence = {
			load: async () => createDefaultSettings(bundle),
			save: async (data) => {
				const settings = data as SettingsRecord;
				saves.push(structuredClone(settings));
				saveCount += 1;
				if (saveCount === 1) await firstSave.promise;
			},
		};
		const runtime = projection();
		const controller = new SettingsController(bundle, persistence, runtime);
		await controller.load();

		const draftWrite = controller.editDraft(CUSTOM_CSS);
		const toggleWrite = controller.setEnabled(false);
		await Promise.resolve();
		expect(saves).toHaveLength(1);

		firstSave.resolve();
		await Promise.all([draftWrite, toggleWrite]);

		expect(saves).toHaveLength(2);
		expect(saves[1]).toMatchObject({ enabled: false, draft: { css: CUSTOM_CSS } });
		expect(controller.state.enabled).toBe(false);
		expect(runtime.snapshots.at(-1)?.enabled).toBe(false);
	});

	it('retains the prior committed state and runtime when a write is rejected', async () => {
		const persistence = new MemoryPersistence(createDefaultSettings(bundle));
		persistence.save = vi.fn().mockRejectedValue(new Error('disk full'));
		const runtime = projection();
		const controller = new SettingsController(bundle, persistence, runtime);
		await controller.load();

		const result = await controller.setEnabled(false);

		expect(result.ok).toBe(false);
		expect(controller.state.enabled).toBe(true);
		expect(runtime.snapshots).toHaveLength(0);
	});

	it('keeps an edited draft in memory when its persistence write is rejected', async () => {
		const persistence = new MemoryPersistence(createDefaultSettings(bundle));
		persistence.save = vi.fn().mockRejectedValue(new Error('disk full'));
		const runtime = projection();
		const controller = new SettingsController(bundle, persistence, runtime);
		await controller.load();

		const result = await controller.editDraft(CUSTOM_CSS);

		expect(result.ok).toBe(false);
		expect(controller.state.draft).toMatchObject({ css: CUSTOM_CSS, dirty: true });
		expect(controller.state.active.css).toBe(NEW_CSS);
		expect(runtime.snapshots).toHaveLength(0);
	});

	it('rolls persistence back when runtime projection fails', async () => {
		const initial = createDefaultSettings(bundle);
		const persistence = new MemoryPersistence(initial);
		const runtime: RuntimeProjection = {
			project: vi.fn().mockRejectedValueOnce(new Error('projection failed')),
		};
		const controller = new SettingsController(bundle, persistence, runtime);
		await controller.load();

		const result = await controller.setEnabled(false);

		expect(result.ok).toBe(false);
		expect(controller.state.enabled).toBe(true);
		expect(persistence.saves.at(-1)).toEqual(initial);
	});

	it('restores the exact fallback payload when runtime projection fails', async () => {
		const corrupt = { schemaVersion: 999, bytes: 'preserve exactly' };
		const writes: unknown[] = [];
		const persistence: SettingsPersistence & { value: unknown } = {
			value: corrupt,
			load: async () => persistence.value,
			save: async (data) => {
				writes.push(structuredClone(data));
				persistence.value = structuredClone(data);
			},
		};
		const runtime: RuntimeProjection = {
			project: vi.fn().mockRejectedValueOnce(new Error('projection failed')),
		};
		const controller = new SettingsController(bundle, persistence, runtime);
		await controller.load();

		const result = await controller.setEnabled(false);

		expect(result.ok).toBe(false);
		expect(controller.state.enabled).toBe(true);
		expect(writes).toHaveLength(2);
		expect(writes.at(-1)).toEqual(corrupt);
		expect(persistence.value).toEqual(corrupt);
	});

	it('does not project a delayed save after close', async () => {
		const pending = deferred();
		const persistence: SettingsPersistence = {
			load: async () => createDefaultSettings(bundle),
			save: async () => pending.promise,
		};
		const runtime = projection();
		const controller = new SettingsController(bundle, persistence, runtime);
		await controller.load();

		const transition = controller.setEnabled(false);
		controller.close();
		pending.resolve();
		await transition;

		expect(runtime.snapshots).toHaveLength(0);
	});
});
