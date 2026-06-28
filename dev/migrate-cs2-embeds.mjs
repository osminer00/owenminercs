import fs from "fs";

const path = "Gaming/cs2-videos.html";
let html = fs.readFileSync(path, "utf8");
html = html.replace(
	/<iframe loading="lazy"([^>]*?) src="(https:\/\/www\.youtube\.com\/embed\/[^"]+)"/g,
	'<iframe$1 data-embed-src="$2"',
);
const count = (html.match(/data-embed-src="https:\/\/www\.youtube\.com\/embed/g) || []).length;
fs.writeFileSync(path, html);
console.log(`Converted ${count} YouTube iframes in ${path}`);
