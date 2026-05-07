import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** One-off generator: writes keep-card HTML for top Reddit posts (sorted by score). */
const url =
	'https://www.reddit.com/user/OwenMCS/submitted.json?sort=top&t=all&limit=100&raw_json=1';
const res = await fetch(url, {
	headers: { 'User-Agent': 'OwenMinerCS-site-builder/1.0' },
});
const j = await res.json();
const sorted = [...j.data.children]
	.map((c) => c.data)
	.sort((a, b) => b.score - a.score)
	.slice(0, 10);

function escAttr(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
function escText(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
function oneLine(s) {
	return String(s).replace(/\s+/g, ' ').trim();
}

const lines = [];
for (const d of sorted) {
	const postUrl = `https://www.reddit.com${d.permalink}`;
	const subUrl = `https://www.reddit.com/r/${d.subreddit}/`;
	const titleOne = oneLine(d.title);
	const titleEsc = escText(titleOne);
	const isDustGap =
		d.permalink.includes('1dql5e7') ||
		/heads_up_this_wall_crack/i.test(d.permalink);
	const peek = escText(
		`${titleOne} · r/${d.subreddit} · ${d.score.toLocaleString('en-US')} upvotes`
	);

	const push = (s) => lines.push(s);
	push(`\t\t\t\t\t<div class="keep-card" role="link" tabindex="0" data-href="${isDustGap ? 'cs2-dust2-gap-bug.html' : escAttr(postUrl)}">`);
	push(`\t\t\t\t\t\t<span class="keep-card__inner">`);
	push(
		`\t\t\t\t\t\t\t<div\n\t\t\t\t\t\t\t\tclass="keep-card__thumb keep-card__reddit-embed keep-card__embed-skip-nav"\n\t\t\t\t\t\t\t\trole="presentation"\n\t\t\t\t\t\t\t\tstyle="--reddit-embed-height: 340px"\n\t\t\t\t\t\t\t>`
	);
	push(
		`\t\t\t\t\t\t\t\t<blockquote class="reddit-embed-bq" data-embed-theme="dark" data-embed-height="340">`
	);
	push(`\t\t\t\t\t\t\t\t\t<a href="${escAttr(postUrl)}">`);
	push(`\t\t\t\t\t\t\t\t\t\t${titleEsc}`);
	push(`\t\t\t\t\t\t\t\t\t</a>`);
	push(`\t\t\t\t\t\t\t\t\t<br />`);
	push(`\t\t\t\t\t\t\t\t\tin`);
	push(`\t\t\t\t\t\t\t\t\t<a href="${escAttr(subUrl)}">${escText(d.subreddit)}</a>`);
	push(`\t\t\t\t\t\t\t\t</blockquote>`);
	push(`\t\t\t\t\t\t\t</div>`);
	push(`\t\t\t\t\t\t\t<div class="keep-card__scalable">`);
	push(`\t\t\t\t\t\t\t\t<div class="keep-card__video-slot">Video (embed)</div>`);
	push(`\t\t\t\t\t\t\t\t<div class="keep-card__body">`);
	push(`\t\t\t\t\t\t\t\t\t<p class="keep-card__label">${titleEsc}</p>`);
	push(`\t\t\t\t\t\t\t\t\t<div class="keep-card__affiliate">`);
	push(
		`\t\t\t\t\t\t\t\t\t\t<p style="margin: 0; font-size: 0.9rem">r/${escText(d.subreddit)} · ${d.score.toLocaleString('en-US')} upvotes</p>`
	);
	push(`\t\t\t\t\t\t\t\t\t</div>`);
	push(`\t\t\t\t\t\t\t\t\t<span class="keep-card__cta">More →</span>`);
	push(`\t\t\t\t\t\t\t\t</div>`);
	push(`\t\t\t\t\t\t\t</div></span`);
	push(`\t\t\t\t\t\t>`);
	push(`\t\t\t\t\t\t<div class="keep-card__peek">`);
	push(`\t\t\t\t\t\t\t<p>${peek}</p>`);
	push(`\t\t\t\t\t\t\t<div class="keep-card__peek-extra" aria-hidden="true">&nbsp;</div>`);
	push(`\t\t\t\t\t\t</div>`);
	push(`\t\t\t\t\t</div>`);
	push('');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, 'gaming-reddit-cards-fragment.html');
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.error('Wrote', out);
