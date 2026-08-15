import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateRelease } from '../scripts/validate-release.mjs';

async function writeReleaseFixture(
	rootDirectory: string,
	overrides: {
		packageVersion?: string;
		manifestVersion?: string;
		minAppVersion?: string;
		versions?: Record<string, string>;
	} = {},
): Promise<void> {
	await mkdir(rootDirectory, { recursive: true });

	const packageVersion = overrides.packageVersion ?? '1.0.0';
	const manifestVersion = overrides.manifestVersion ?? '1.0.0';
	const minAppVersion = overrides.minAppVersion ?? '1.13.7';
	const versions = overrides.versions ?? { '1.0.0': '1.13.7' };

	await Promise.all([
		writeFile(
			join(rootDirectory, 'package.json'),
			JSON.stringify({ version: packageVersion }),
		),
		writeFile(
			join(rootDirectory, 'manifest.json'),
			JSON.stringify({ version: manifestVersion, minAppVersion }),
		),
		writeFile(
			join(rootDirectory, 'versions.json'),
			JSON.stringify(versions),
		),
	]);
}

describe('validateRelease', () => {
	it('accepts an exact unprefixed tag when all release metadata agrees', async () => {
		const fixtureDirectory = await mkdtemp(join(tmpdir(), 'dark-pdf-export-release-'));
		await writeReleaseFixture(fixtureDirectory);

		await expect(
			validateRelease({ rootDirectory: fixtureDirectory, tag: '1.0.0' }),
		).resolves.toEqual({
			minAppVersion: '1.13.7',
			version: '1.0.0',
		});
	});

	it.each([
		{
			label: 'package version',
			overrides: { packageVersion: '1.0.1' },
			expected: 'package.json version 1.0.1 does not match manifest.json version 1.0.0',
		},
		{
			label: 'manifest version',
			overrides: { manifestVersion: '1.0.1' },
			expected: 'package.json version 1.0.0 does not match manifest.json version 1.0.1',
		},
	])('rejects a mismatched $label with both values', async ({ overrides, expected }) => {
		const fixtureDirectory = await mkdtemp(join(tmpdir(), 'dark-pdf-export-release-'));
		await writeReleaseFixture(fixtureDirectory, overrides);

		await expect(
			validateRelease({ rootDirectory: fixtureDirectory, tag: '1.0.0' }),
		).rejects.toThrow(expected);
	});

	it.each(['v1.0.0', '1.0', '1.0.0-beta.1', 'release-1.0.0'])(
		'rejects malformed or prefixed tag %s',
		async (tag) => {
			const fixtureDirectory = await mkdtemp(join(tmpdir(), 'dark-pdf-export-release-'));
			await writeReleaseFixture(fixtureDirectory);

			await expect(
				validateRelease({ rootDirectory: fixtureDirectory, tag }),
			).rejects.toThrow(`Release tag ${tag} must be an exact unprefixed x.y.z version`);
		},
	);

	it('rejects a valid tag that differs from the manifest version', async () => {
		const fixtureDirectory = await mkdtemp(join(tmpdir(), 'dark-pdf-export-release-'));
		await writeReleaseFixture(fixtureDirectory);

		await expect(
			validateRelease({ rootDirectory: fixtureDirectory, tag: '1.0.1' }),
		).rejects.toThrow('Release tag 1.0.1 does not match manifest.json version 1.0.0');
	});

	it('rejects a missing compatibility mapping', async () => {
		const fixtureDirectory = await mkdtemp(join(tmpdir(), 'dark-pdf-export-release-'));
		await writeReleaseFixture(fixtureDirectory, { versions: {} });

		await expect(
			validateRelease({ rootDirectory: fixtureDirectory, tag: '1.0.0' }),
		).rejects.toThrow('versions.json has no compatibility mapping for 1.0.0');
	});

	it('rejects a compatibility floor that differs from the manifest', async () => {
		const fixtureDirectory = await mkdtemp(join(tmpdir(), 'dark-pdf-export-release-'));
		await writeReleaseFixture(fixtureDirectory, {
			versions: { '1.0.0': '1.12.0' },
		});

		await expect(
			validateRelease({ rootDirectory: fixtureDirectory, tag: '1.0.0' }),
		).rejects.toThrow(
			'versions.json minimum app version 1.12.0 does not match manifest.json minAppVersion 1.13.7 for 1.0.0',
		);
	});
});
