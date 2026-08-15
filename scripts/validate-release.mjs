import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const EXACT_SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

async function readJson(rootDirectory, filename) {
	const path = resolve(rootDirectory, filename);
	let source;
	try {
		source = await readFile(path, 'utf8');
	} catch (error) {
		throw new Error(`Unable to read ${filename}: ${error.message}`);
	}

	try {
		return JSON.parse(source);
	} catch (error) {
		throw new Error(`Unable to parse ${filename}: ${error.message}`);
	}
}

export async function validateRelease({ rootDirectory = process.cwd(), tag }) {
	const [packageJson, manifest, versions] = await Promise.all([
		readJson(rootDirectory, 'package.json'),
		readJson(rootDirectory, 'manifest.json'),
		readJson(rootDirectory, 'versions.json'),
	]);

	if (packageJson.version !== manifest.version) {
		throw new Error(
			`package.json version ${String(packageJson.version)} does not match manifest.json version ${String(manifest.version)}`,
		);
	}
	if (typeof tag !== 'string' || !EXACT_SEMVER.test(tag)) {
		throw new Error(
			`Release tag ${String(tag)} must be an exact unprefixed x.y.z version`,
		);
	}
	if (tag !== manifest.version) {
		throw new Error(
			`Release tag ${tag} does not match manifest.json version ${String(manifest.version)}`,
		);
	}
	if (!Object.hasOwn(versions, manifest.version)) {
		throw new Error(`versions.json has no compatibility mapping for ${manifest.version}`);
	}

	const compatibleAppVersion = versions[manifest.version];
	if (compatibleAppVersion !== manifest.minAppVersion) {
		throw new Error(
			`versions.json minimum app version ${String(compatibleAppVersion)} does not match manifest.json minAppVersion ${String(manifest.minAppVersion)} for ${manifest.version}`,
		);
	}

	return {
		version: manifest.version,
		minAppVersion: manifest.minAppVersion,
	};
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
	try {
		await validateRelease({ tag: process.argv[2] });
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
