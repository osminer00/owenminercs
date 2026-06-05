import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { persistTwitchEventOnce } = require('../netlify/functions/twitch-eventsub.js');
const cloudflareEventSubSource = readFileSync(
	new URL('../functions/api/twitch-eventsub.js', import.meta.url),
	'utf8'
);

const normalizedFollow = {
	type: 'follow',
	userName: 'ExampleUser',
	displayText: 'ExampleUser followed',
};

test('EventSub persistence marks done only after the event/stat pipeline', async () => {
	const commandCalls = [];
	const pipelineCalls = [];
	const result = await persistTwitchEventOnce({
		idempotencyKey: 'activity:twitch:seen:test-message',
		normalized: normalizedFollow,
		now: () => '2026-06-05T11:00:00.000Z',
		command: async (command) => {
			commandCalls.push(command);
			assert.equal(command[0], 'SET');
			assert.equal(command[3], 'pending');
			return 'OK';
		},
		pipeline: async (commands) => {
			pipelineCalls.push(commands);
		},
	});

	assert.deepEqual(result, { status: 'stored' });
	assert.equal(commandCalls.length, 1);
	assert.equal(pipelineCalls.length, 1);
	assert.deepEqual(pipelineCalls[0].at(-1), [
		'SET',
		'activity:twitch:seen:test-message',
		'done',
		'EX',
		'86400',
	]);
	assert.ok(
		pipelineCalls[0].some(
			(command) => command[0] === 'LPUSH' && command[1] === 'activity:twitch:events'
		),
		'event write should be part of the same pipeline as the done marker'
	);
});

test('EventSub persistence clears pending marker when the write pipeline fails', async () => {
	const commandCalls = [];
	await assert.rejects(
		persistTwitchEventOnce({
			idempotencyKey: 'activity:twitch:seen:test-failure',
			normalized: normalizedFollow,
			command: async (command) => {
				commandCalls.push(command);
				if (command[0] === 'SET') return 'OK';
				if (command[0] === 'GET') return 'pending';
				if (command[0] === 'DEL') return 1;
				assert.fail(`Unexpected command: ${command.join(' ')}`);
			},
			pipeline: async () => {
				throw new Error('simulated Redis pipeline failure');
			},
		}),
		/simulated Redis pipeline failure/
	);

	assert.deepEqual(commandCalls.at(-1), ['DEL', 'activity:twitch:seen:test-failure']);
});

test('EventSub duplicate acknowledgement is only returned for completed writes', async () => {
	const duplicate = await persistTwitchEventOnce({
		idempotencyKey: 'activity:twitch:seen:test-duplicate',
		normalized: normalizedFollow,
		command: async (command) => {
			if (command[0] === 'SET') return null;
			if (command[0] === 'GET') return 'done';
			assert.fail(`Unexpected command: ${command.join(' ')}`);
		},
		pipeline: async () => assert.fail('completed duplicate should not write again'),
	});
	assert.deepEqual(duplicate, { status: 'duplicate' });

	await assert.rejects(
		persistTwitchEventOnce({
			idempotencyKey: 'activity:twitch:seen:test-pending',
			normalized: normalizedFollow,
			command: async (command) => {
				if (command[0] === 'SET') return null;
				if (command[0] === 'GET') return 'pending';
				assert.fail(`Unexpected command: ${command.join(' ')}`);
			},
			pipeline: async () => assert.fail('pending duplicate should not write immediately'),
		}),
		/already pending/
	);
});

test('Cloudflare EventSub implementation uses the same pending/done idempotency states', () => {
	assert.match(cloudflareEventSubSource, /const IDEMPOTENCY_PENDING = 'pending';/);
	assert.match(cloudflareEventSubSource, /const IDEMPOTENCY_DONE = 'done';/);
	assert.match(
		cloudflareEventSubSource,
		/\['SET', idempotencyKey, IDEMPOTENCY_DONE, 'EX', String\(IDEMPOTENCY_DONE_TTL_SECONDS\)\]/
	);
	assert.match(
		cloudflareEventSubSource,
		/if \(state === IDEMPOTENCY_DONE\) return \{ status: 'duplicate' \};/
	);
	assert.match(cloudflareEventSubSource, /\['DEL', idempotencyKey\]/);
});
