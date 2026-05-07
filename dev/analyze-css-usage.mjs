/**
 * One-off: find CSS class/id tokens in owenminercs.css that never appear in site sources.
 * Run: node dev/analyze-css-usage.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SKIP_DIRS = new Set(["node_modules", ".git", "package"]);

const EXT = new Set([".html", ".htm", ".js", ".mjs", ".jsx", ".tsx", ".vue", ".json", ".md"]);

function walk(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, files);
    } else if (EXT.has(path.extname(e.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

const cssPath = path.join(root, "css", "owenminercs.css");
const css = fs.readFileSync(cssPath, "utf8");

// Strip comments for cleaner matching (optional — keep for token extraction only from selectors is harder)
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, " ");

const classTokens = new Set();
const idTokens = new Set();

// Class names: .identifier — skip known pseudo-element/class suffix mistakes
const pseudoFalsePositives = new Set([
  "hover",
  "focus",
  "active",
  "visited",
  "before",
  "after",
  "first-child",
  "last-child",
  "nth-child",
  "empty",
  "root",
  "target",
  "focus-visible",
  "disabled",
  "checked",
  "placeholder",
  "selection",
  "not",
  "is",
  "where",
  "has",
]);

let cm;
const classRe = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
while ((cm = classRe.exec(cssNoComments))) {
  const t = cm[1];
  if (!pseudoFalsePositives.has(t)) classTokens.add(t);
}

const idRe = /#([a-zA-Z_][a-zA-Z0-9_-]*)/g;
let im;
while ((im = idRe.exec(cssNoComments))) {
  idTokens.add(im[1]);
}

const sources = walk(root);
let haystack = "";
for (const f of sources) {
  try {
    haystack += "\n" + fs.readFileSync(f, "utf8");
  } catch {
    /* skip */
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Class token appears as its own identifier (not a substring of another BEM part) */
function isClassUsed(c, text) {
  const er = escapeRe(c);
  // class="a b c" or class='...' (allow multiple classes in one string)
  if (new RegExp(`class\\s*=\\s*["'][^"']*\\b${er}\\b`, "i").test(text)) return true;
  // classList.add('foo', …) or = 'a b c'
  if (new RegExp(`classList\\.[a-zA-Z]+\\([^)]*\\b${er}\\b`, "i").test(text)) return true;
  if (new RegExp(`className\\s*[=:]\\s*["'\`][^"'\`]*\\b${er}\\b`, "i").test(text)) return true;
  // querySelector / closest / matches
  if (new RegExp(`\\.${er}\\b`).test(text)) return true;
  // quoted singleton or substring in template literal
  if (new RegExp(`["'\`]\\s*[^"'\`]*\\b${er}\\b[^"'\`]*["'\`]`, "i").test(text)) return true;
  return false;
}

const unusedClasses2 = [...classTokens].filter((c) => !isClassUsed(c, haystack));

const unusedIds = [...idTokens].filter((id) => {
  return (
    !haystack.includes(`id="${id}"`) &&
    !haystack.includes(`id='${id}'`) &&
    !haystack.includes(`getElementById("${id}")`) &&
    !haystack.includes(`getElementById('${id}')`) &&
    !haystack.includes(`#${id}`) &&
    !haystack.includes(`"${id}"`)
  );
});

console.log("CSS file classes (unique tokens):", classTokens.size);
console.log("Unused classes (strict substring heuristic):", unusedClasses2.length);
console.log(unusedClasses2.sort().join("\n"));
console.log("\n--- IDs ---");
console.log("Unused ids:", unusedIds.length);
console.log(unusedIds.sort().join("\n"));
