export interface ReleaseValidationOptions {
	rootDirectory?: string;
	tag: string;
}

export interface ReleaseValidationResult {
	version: string;
	minAppVersion: string;
}

export function validateRelease(
	options: ReleaseValidationOptions,
): Promise<ReleaseValidationResult>;
