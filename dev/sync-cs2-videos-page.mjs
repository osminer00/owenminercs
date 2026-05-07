/**
 * Regenerates Gaming/cs2-videos.html embed grid from Socials/data/youtube-videos.json
 * (long-form uploads only; Shorts stay on Socials).
 *
 * Layout: compact 4-column grid (responsive), with per-card "Larger" dialog player.
 *
 *   node dev/sync-cs2-videos-page.mjs
 */
import fs from "fs";

const pageUrl = new URL("../Gaming/cs2-videos.html", import.meta.url);
const dataUrl = new URL("../Socials/data/youtube-videos.json", import.meta.url);

function vidId(url) {
	const m = url.match(/[?&]v=([^&]+)/);
	return m ? m[1] : null;
}

function escHtml(s) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

const data = JSON.parse(fs.readFileSync(dataUrl, "utf8"));
const vids = data
	.filter((x) => x.platform === "youtube" && x.contentType === "video")
	.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

let snippet =
	`\t\t\t\t\t<div class="cs2-yt-grid-wrap">\n\t\t\t\t\t\t<div class="cs2-yt-grid" role="list">\n`;

for (const v of vids) {
	const id = vidId(v.url);
	if (!id) continue;
	const title = escHtml(v.title);
	snippet += `\t\t\t\t\t\t\t<article class="cs2-yt-card" role="listitem">\n`;
	snippet += `\t\t\t\t\t\t\t\t<div class="cs2-yt-card__head">\n`;
	snippet += `\t\t\t\t\t\t\t\t\t<h2 class="cs2-yt-card__title">${title}</h2>\n`;
	snippet += `\t\t\t\t\t\t\t\t\t<button type="button" class="cs2-yt-card__popout" aria-haspopup="dialog" aria-controls="cs2YtPlayerDialog" data-youtube-id="${id}" title="Open larger player">Larger</button>\n`;
	snippet += `\t\t\t\t\t\t\t\t</div>\n`;
	snippet += `\t\t\t\t\t\t\t\t<div class="video-responsive cs2-yt-card__embed">\n`;
	snippet +=
		`\t\t\t\t\t\t\t\t\t<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/${id}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n`;
	snippet += `\t\t\t\t\t\t\t\t</div>\n`;
	snippet += `\t\t\t\t\t\t\t</article>\n`;
}

snippet += `\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n`;

const full = fs.readFileSync(pageUrl, "utf8");
const start = full.indexOf(
	"\t\t\t\t\t<h1>Long-form YouTube videos — OwenMinerCS</h1>",
);
if (start === -1) {
	throw new Error("Missing expected <h1>; restore Gaming/cs2-videos.html header.");
}

const pairRe = /\t\t\t\t\t<\/div>\r?\n\t\t\t\t<\/div>/;
const pairMatch = full.slice(start).match(pairRe);
if (!pairMatch) throw new Error("Could not find closing grid-wrap + ultrawide pair.");
const mid = start + pairMatch.index;
const nlAfterBd4 = full.slice(mid).match(/\r?\n/)[0];
const bd4End = mid + `\t\t\t\t\t</div>${nlAfterBd4}`.length;

const newMiddle = `\t\t\t\t\t<h1>Long-form YouTube videos — OwenMinerCS</h1>
\t\t\t\t\t<p style="margin-top: 8px; margin-bottom: 0; opacity: 0.92">
\t\t\t\t\t\t<a href="https://www.youtube.com/@OwenMinerCS" target="_blank" rel="noopener noreferrer"
\t\t\t\t\t\t\t>Channel @OwenMinerCS</a
\t\t\t\t\t\t>
\t\t\t\t\t\t— newest first. Vertical Shorts are on the
\t\t\t\t\t\t<a href="../Socials/socials.html">Socials hub</a>.
\t\t\t\t\t</p>

${snippet}`;

fs.writeFileSync(pageUrl, full.slice(0, start) + newMiddle + full.slice(bd4End));
console.log(`sync-cs2-videos-page: wrote ${vids.length} videos to Gaming/cs2-videos.html`);
