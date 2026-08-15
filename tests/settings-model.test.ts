import { describe, expect, it } from 'vitest';

import {
	DEFAULT_SETTINGS,
	SettingsController,
	type RuntimeProjection,
	type SettingsPersistence,
	type SettingsRecord,
} from '../src/settings-model';

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

describe('SettingsController', () => {
	it('loads default settings when stored data is empty or null', async () => {
		const persistence = new MemoryPersistence(null);
		const runtime = projection();
		const controller = new SettingsController(persistence, runtime);

		await controller.load();

		expect(controller.state).toEqual(DEFAULT_SETTINGS);
		expect(runtime.snapshots).toEqual([{ enabled: true }]);
	});

	it('loads stored enabled setting', async () => {
		const persistence = new MemoryPersistence({ enabled: false });
		const runtime = projection();
		const controller = new SettingsController(persistence, runtime);

		await controller.load();

		expect(controller.state).toEqual({ enabled: false });
		expect(runtime.snapshots).toEqual([{ enabled: false }]);
	});

	it('falls back to default enabled setting for invalid data', async () => {
		const persistence = new MemoryPersistence({ enabled: 'invalid' });
		const runtime = projection();
		const controller = new SettingsController(persistence, runtime);

		await controller.load();

		expect(controller.state).toEqual({ enabled: true });
		expect(runtime.snapshots).toEqual([{ enabled: true }]);
	});

	it('persists and projects enabled changes', async () => {
		const persistence = new MemoryPersistence({ enabled: true });
		const runtime = projection();
		const controller = new SettingsController(persistence, runtime);

		await controller.load();
		await controller.setEnabled(false);

		expect(controller.state).toEqual({ enabled: false });
		expect(persistence.saves).toEqual([{ enabled: false }]);
		expect(runtime.snapshots).toEqual([{ enabled: true }, { enabled: false }]);
	});

	it('does not save or project when enabled value is unchanged', async () => {
		const persistence = new MemoryPersistence({ enabled: true });
		const runtime = projection();
		const controller = new SettingsController(persistence, runtime);

		await controller.load();
		await controller.setEnabled(true);

		expect(persistence.saves).toHaveLength(0);
		expect(runtime.snapshots).toEqual([{ enabled: true }]);
	});

	it('ignores operations after controller is closed', async () => {
		const persistence = new MemoryPersistence({ enabled: true });
		const runtime = projection();
		const controller = new SettingsController(persistence, runtime);

		controller.close();
		expect(controller.isClosed).toBe(true);

		await controller.load();
		await controller.setEnabled(false);

		expect(persistence.saves).toHaveLength(0);
		expect(runtime.snapshots).toHaveLength(0);
	});
});
