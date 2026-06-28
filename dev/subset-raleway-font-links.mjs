import fs from "fs";
import path from "path";

const oldUrl = "family=Raleway:ital,wght@0,100..900;1,100..900&display=swap";
const newUrl = "family=Raleway:wght@400;600;700;800;900&display=swap";
const skipDirs = new Set(["node_modules", ".git", "backup-pre-the-setup-2026-04-08", "mockups"]);
let count = 0;

function walk(dir) {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		if (skipDirs.has(ent.name)) continue;
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) walk(p);
		else if (ent.name.endsWith(".html")) {
			const src = fs.readFileSync(p, "utf8");
			if (src.includes(oldUrl)) {
				fs.writeFileSync(p, src.split(oldUrl).join(newUrl));
				count++;
			}
		}
	}
}

walk(".");
console.log(`Updated font link in ${count} HTML files`);
