/* check-html-safety.js — fails when HTML is built from an untagged template literal.
 *
 * Any template literal that contains an interpolation AND looks like markup must
 * use the `html` tag from app/html-safe.js, which escapes every ${...} it
 * inserts. Add `html-safe-ignore` in a comment on the opening line to opt out.
 */
const fs = require("fs");
const path = require("path");

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error("Usage: node scripts/check-html-safety.js <file-or-dir> [...]");
  process.exit(1);
}

function collectFiles(target) {
  const resolved = path.resolve(target);
  const stats = fs.statSync(resolved);
  if (stats.isFile()) return resolved.endsWith(".js") ? [resolved] : [];
  return fs.readdirSync(resolved, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    return collectFiles(path.join(resolved, entry.name));
  });
}

// Returns the index just past the template literal that opens at `start`.
function findTemplateEnd(text, start) {
  let i = start + 1;
  let depth = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (depth === 0 && ch === "`") return i + 1;
    if (ch === "$" && text[i + 1] === "{") {
      depth += 1;
      i += 2;
      continue;
    }
    if (depth > 0) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (ch === "`") i = findTemplateEnd(text, i) - 1;
    }
    i += 1;
  }
  return text.length;
}

// Blank out comments and quoted strings so stray backticks in prose cannot
// mis-pair the template scan. Offsets are preserved.
function maskNonCode(text) {
  const out = text.split("");
  let i = 0;
  const blank = (from, to) => {
    for (let j = from; j < to && j < out.length; j += 1) {
      if (out[j] !== "\n") out[j] = " ";
    }
  };
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      blank(i, end === -1 ? text.length : end);
      i = end === -1 ? text.length : end;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      blank(i, end === -1 ? text.length : end + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\") { j += 2; continue; }
        if (text[j] === ch || text[j] === "\n") break;
        j += 1;
      }
      blank(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "`") {
      i = findTemplateEnd(text, i);
      continue;
    }
    i += 1;
  }
  return out.join("");
}

const MARKUP = /<\/?[a-zA-Z][\w-]*(\s|>|\/)/;
const failures = [];
let checked = 0;
let scanned = 0;

for (const target of targets) {
  for (const file of collectFiles(target)) {
    scanned += 1;
    const original = fs.readFileSync(file, "utf8");
    const text = maskNonCode(original);
    const lineStarts = [];
    original.split("\n").reduce((offset, line) => {
      lineStarts.push(offset);
      return offset + line.length + 1;
    }, 0);
    const lineOf = (index) => {
      let low = 0;
      let high = lineStarts.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (lineStarts[mid] <= index) low = mid;
        else high = mid - 1;
      }
      return low + 1;
    };

    for (let i = 0; i < text.length; i += 1) {
      if (text[i] !== "`") continue;
      const end = findTemplateEnd(text, i);
      const body = original.slice(i, end);
      const start = i;
      i = end - 1;

      if (!body.includes("${")) continue;
      if (!MARKUP.test(body)) continue;
      checked += 1;

      const tagged = /(?:^|[^\w$.])html\s*$/.test(original.slice(Math.max(0, start - 12), start));
      const line = lineOf(start);
      const sourceLine = original.split("\n")[line - 1] || "";
      if (tagged || /html-safe-ignore/.test(sourceLine)) continue;

      failures.push({
        file: path.relative(process.cwd(), file),
        line,
        snippet: body.replace(/\s+/g, " ").slice(0, 90)
      });
    }
  }
}

if (failures.length) {
  console.error(`HTML safety check failed — ${failures.length} untagged markup template(s):\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}`);
    console.error(`    ${failure.snippet}`);
  }
  console.error(`\nUse the html\`\` tag from app/html-safe.js so every \${...} is escaped.`);
  process.exit(1);
}

console.log(`HTML safety check passed for ${checked} markup template(s) in ${scanned} files.`);
