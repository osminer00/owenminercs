#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_EXTENSIONS = new Set(['.html', '.json']);
const EXCLUDED_DIRS = new Set([
	'.git',
	'.claude',
	'.cursor',
	'.vscode',
	'backup-pre-the-setup-2026-04-08',
	'dev',
	'memory',
	'mockups',
	'node_modules',
	'package',
]);
const EXCLUDED_FILES = new Set([
	'package-lock.json',
	'package.json',
	// Generated search artifacts (matched by basename below; may embed stale snippets locally)
	'site-search-index.json',
	'search-manual-keywords.json',
]);

const FORBIDDEN_PUBLIC_CONTENT = [
	{
		label: 'DMACC public mention',
		pattern: /\bDMACC\b/i,
	},
	{
		label: 'schema.org alumniOf field',
		pattern: /"alumniOf"\s*:/i,
	},
	{
		label: 'old graduate bio sentence',
		pattern: /I am a 23 year old graduate/i,
	},
	{
		label: 'old programming-at-school bio sentence',
		pattern: /While at DMACC I learned how to write software/i,
	},
];

const REQUIRED_PUBLIC_CONTENT = [
	{
		file: 'Keyboard/60he.html',
		label: 'Wooting 60HE detailed guide content',
		patterns: [
			/Wooting 60HE build guide: parts, switches, keycaps &amp; mods/i,
			/Kilowatt Keyboard Photo Gallery \(2025\)/i,
			/2023 Build Breakdown: Crosshair Alpha/i,
			/Wootility keyboard profile code/i,
			/Ultimate Wooting 60HE Mod Guide/i,
		],
	},
];

async function* walk(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		if (EXCLUDED_DIRS.has(entry.name)) continue;

		const abs = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(abs);
			continue;
		}

		if (!entry.isFile()) continue;
		if (EXCLUDED_FILES.has(entry.name)) continue;
		if (!PUBLIC_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

		yield abs;
	}
}

function toRelative(abs) {
	return path.relative(ROOT, abs).split(path.sep).join('/');
}

async function collectViolations() {
	const violations = [];

	for await (const file of walk(ROOT)) {
		const rel = toRelative(file);
		const text = await fs.readFile(file, 'utf8');

		for (const rule of FORBIDDEN_PUBLIC_CONTENT) {
			const match = text.match(rule.pattern);
			if (!match || match.index == null) continue;

			const line = text.slice(0, match.index).split('\n').length;
			violations.push(`${rel}:${line} contains ${rule.label}`);
		}
	}

	return violations;
}

async function collectMissingRequiredContent() {
	const missing = [];

	for (const rule of REQUIRED_PUBLIC_CONTENT) {
		const abs = path.join(ROOT, ...rule.file.split('/'));
		const text = await fs.readFile(abs, 'utf8');

		for (const pattern of rule.patterns) {
			if (pattern.test(text)) continue;
			missing.push(`${rule.file} is missing ${rule.label}: ${pattern}`);
		}
	}

	return missing;
}

const violations = await collectViolations();
const missingRequiredContent = await collectMissingRequiredContent();

assert.equal(
	violations.length,
	0,
	`Forbidden public content found:\n${violations.map((v) => `- ${v}`).join('\n')}`
);

assert.equal(
	missingRequiredContent.length,
	0,
	`Required public content missing:\n${missingRequiredContent.map((v) => `- ${v}`).join('\n')}`
);

console.log('Public content regression check passed.');
