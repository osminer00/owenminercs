import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');

const REDDIT_TOP_POSTS = [
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1mv03i2/im_so_excited_to_support_north_american/',
		subreddit: 'GlobalOffensive',
		title: "I'm so excited to support North American Counter-Strike with the new T-shirt I just bought! 🇺🇸🦅",
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1jgxch2/inferno_bookend_d/',
		subreddit: 'GlobalOffensive',
		title: 'Inferno Bookend :D',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/16t80up/dear_valve_1_vote_to_surrender_is_not_okay/',
		subreddit: 'GlobalOffensive',
		title: 'Dear Valve, 1 vote to surrender is not okay.',
	},
	{
		url: 'https://www.reddit.com/r/ohnePixel/comments/1nx7pom/everyone_fix_game_please_valve/',
		subreddit: 'ohnePixel',
		title: 'Everyone: "Fix Game PLEASE" Valve:',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/15fehzt/hopefully_this_tip_helps_someone_out/',
		subreddit: 'GlobalOffensive',
		title: 'Hopefully This Tip Helps Someone Out!',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1i0fcm4/ive_been_practicing_my_wallbangs_on_train_the/',
		subreddit: 'GlobalOffensive',
		title: "I've been practicing my Wall-Bangs on Train the last two days 😄",
	},
	{
		url: 'https://www.reddit.com/r/ohnePixel/comments/1nl8li3/you_know_what_bro/',
		subreddit: 'ohnePixel',
		title: 'You know what bro…',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1dql5e7/heads_up_this_wall_crack_reveals_your_position_on/',
		subreddit: 'GlobalOffensive',
		title: 'Heads Up: This Wall Crack Reveals Your Position on Dust II!',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1jkdzr0/1v5_deagle/',
		subreddit: 'GlobalOffensive',
		title: '1v5 Deagle',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1cmehf8/43_moment/',
		subreddit: 'GlobalOffensive',
		title: '4:3 Moment',
	},
];

function escHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escAttr(s) {
	return escHtml(s);
}

function shortTitle(title) {
	const raw = String(title).replace(/\s+/g, ' ').trim();
	if (raw.length <= 72) return raw;
	return `${raw.slice(0, 69).trim()}…`;
}

function tile(item) {
	const postUrl = escAttr(item.url);
	const subredditUrl = escAttr(`https://www.reddit.com/r/${item.subreddit}/`);
	const title = escHtml(shortTitle(item.title));
	const bodyTitle = escHtml(item.title);
	const subreddit = escHtml(item.subreddit);
	return `\t\t\t\t\t\t<article class="home-yt-tile home-yt-tile--landscape home-yt-tile--reddit" role="listitem">
\t\t\t\t\t\t\t<div class="home-yt-tile__media home-yt-tile__media--reddit">
\t\t\t\t\t\t\t\t<blockquote class="reddit-embed-bq" data-embed-theme="dark" data-embed-height="280">
\t\t\t\t\t\t\t\t\t<a href="${postUrl}">${bodyTitle}</a>
\t\t\t\t\t\t\t\t\t<br />
\t\t\t\t\t\t\t\t\tin
\t\t\t\t\t\t\t\t\t<a href="${subredditUrl}">${subreddit}</a>
\t\t\t\t\t\t\t\t</blockquote>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<h3 class="home-yt-tile__title">${title}</h3>
\t\t\t\t\t\t</article>`;
}

const tiles = REDDIT_TOP_POSTS.map(tile).join('\n');
const rowGroup = `\t\t\t\t\t<div class="home-yt-row-group">
\t\t\t\t\t\t<h3 class="home-yt-row-label" id="home-yt-row-reddit">Reddit posts</h3>
\t\t\t\t\t\t<div class="home-yt-row home-yt-row--landscape" role="list" aria-labelledby="home-yt-row-reddit">
${tiles}
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>`;

let html = fs.readFileSync(indexPath, 'utf8');
const rowPattern =
	/<div class="home-yt-row-group">\s*<h3 class="home-yt-row-label" id="home-yt-row-reddit">[\s\S]*?<\/div>\s*<\/div>/;
if (!rowPattern.test(html)) throw new Error('Reddit row group not found');
html = html.replace(rowPattern, rowGroup);

fs.writeFileSync(indexPath, html);
console.log(`Patched Reddit row (${REDDIT_TOP_POSTS.length} embed tiles)`);
