import * as csstree from 'css-tree';

export interface CssValidationError {
	kind: 'syntax' | 'resource';
	message: string;
	line: number;
	column: number;
}

export type CssValidationResult =
	| { valid: true }
	| { valid: false; error: CssValidationError };

function locationOf(node: csstree.CssNode): Pick<CssValidationError, 'line' | 'column'> {
	return {
		line: node.loc?.start.line ?? 1,
		column: node.loc?.start.column ?? 1,
	};
}

function isNetworkUrl(value: string): boolean {
	const normalized = value.trim().replaceAll('\\', '').toLowerCase();
	if (normalized.startsWith('//')) return true;
	if (!/^[a-z][a-z\d+.-]*:/.test(normalized)) return false;
	return !/^(?:data|blob|file):/.test(normalized);
}

function decodeCssIdentifier(value: string): string {
	return value.replace(
		/\\([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\n\f\r])/gi,
		(_match, hexadecimal: string | undefined, escaped: string | undefined) => {
			if (hexadecimal === undefined) return escaped ?? '';
			const codePoint = Number.parseInt(hexadecimal, 16);
			return codePoint === 0 || codePoint > 0x10ffff
				? '\uFFFD'
				: String.fromCodePoint(codePoint);
		},
	);
}

const STRING_RESOURCE_FUNCTIONS = new Set([
	'image',
	'image-set',
	'-webkit-image-set',
	'src',
	'url',
]);
const DYNAMIC_SUBSTITUTION_FUNCTIONS = new Set(['attr', 'env', 'var']);

function findUnclosedBlock(css: string): CssValidationError | null {
	const openings: Array<{ line: number; column: number }> = [];
	let line = 1;
	let column = 1;
	let quote: '"' | "'" | null = null;
	let comment = false;
	let escaped = false;

	for (let index = 0; index < css.length; index += 1) {
		const character = css[index];
		const next = css[index + 1];
		if (character === '\n') {
			line += 1;
			column = 1;
			continue;
		}

		if (comment) {
			if (character === '*' && next === '/') {
				comment = false;
				index += 1;
				column += 2;
				continue;
			}
			column += 1;
			continue;
		}
		if (quote !== null) {
			if (escaped) escaped = false;
			else if (character === '\\') escaped = true;
			else if (character === quote) quote = null;
			column += 1;
			continue;
		}
		if (character === '/' && next === '*') {
			comment = true;
			index += 1;
			column += 2;
			continue;
		}
		if (character === '"' || character === "'") quote = character;
		else if (character === '{') openings.push({ line, column });
		else if (character === '}') openings.pop();
		column += 1;
	}

	const opening = openings.at(-1);
	return opening === undefined
		? null
		: {
				kind: 'syntax',
				message: 'Unclosed CSS block; expected a closing brace.',
				...opening,
			};
}

export function validateStylesheet(css: string): CssValidationResult {
	const unclosedBlock = findUnclosedBlock(css);
	if (unclosedBlock !== null) return { valid: false, error: unclosedBlock };

	let firstSyntaxError: CssValidationError | null = null;
	let ast: csstree.CssNode;

	try {
		ast = csstree.parse(css, {
			context: 'stylesheet',
			positions: true,
			parseAtrulePrelude: true,
			parseRulePrelude: true,
			parseValue: true,
			parseCustomProperty: true,
			onParseError(error) {
				firstSyntaxError ??= {
					kind: 'syntax',
					message: error.message,
					line: error.line,
					column: error.column,
				};
			},
		});
	} catch (error) {
		const syntaxError = error as Partial<csstree.SyntaxParseError>;
		return {
			valid: false,
			error: {
				kind: 'syntax',
				message: syntaxError.message ?? 'Invalid CSS syntax',
				line: syntaxError.line ?? 1,
				column: syntaxError.column ?? 1,
			},
		};
	}

	if (firstSyntaxError !== null) {
		return { valid: false, error: firstSyntaxError };
	}

	let resourceError: CssValidationError | null = null;
	csstree.walk(ast, (node) => {
		if (node.type === 'Atrule' && decodeCssIdentifier(node.name).toLowerCase() === 'import') {
			resourceError = {
				kind: 'resource',
				message: '@import is not allowed because it can load a network resource.',
				...locationOf(node),
			};
			return csstree.walk.break;
		}
		if (node.type === 'Url' && isNetworkUrl(node.value)) {
			resourceError = {
				kind: 'resource',
				message: `Remote CSS resource is not allowed: ${node.value}`,
				...locationOf(node),
			};
			return csstree.walk.break;
		}
		if (
			node.type === 'Function' &&
			STRING_RESOURCE_FUNCTIONS.has(decodeCssIdentifier(node.name).toLowerCase())
		) {
			csstree.walk(node, (child) => {
				if (child.type === 'String' && isNetworkUrl(child.value)) {
					resourceError = {
						kind: 'resource',
						message: `Remote CSS resource is not allowed: ${child.value}`,
						...locationOf(child),
					};
					return csstree.walk.break;
				}
				if (
					child.type === 'Function' &&
					DYNAMIC_SUBSTITUTION_FUNCTIONS.has(
						decodeCssIdentifier(child.name).toLowerCase(),
					)
				) {
					resourceError = {
						kind: 'resource',
						message: `Dynamic ${child.name}() values are not allowed inside resource functions.`,
						...locationOf(child),
					};
					return csstree.walk.break;
				}
				return undefined;
			});
			if (resourceError !== null) return csstree.walk.break;
		}
		return undefined;
	});

	return resourceError === null ? { valid: true } : { valid: false, error: resourceError };
}
