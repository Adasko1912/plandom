// Fails when a production dependency has a license outside the allow list.
// Reads the installed tree (`npm ls --omit=dev --all --parseable`) — no network, no extra tools.
// SPDX expressions are understood: "A OR B" passes if either side passes, "A AND B" needs both.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = new Set([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'CC0-1.0',
  'BlueOak-1.0.0', 'Zlib', 'Python-2.0', 'CC-BY-4.0',
  'MPL-2.0', // file-level copyleft: allowed only as an unmodified dependency
]);

function licenseOf(pkg) {
  const value = pkg.license ?? pkg.licenses;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((entry) => entry?.type ?? String(entry)).join(' OR ');
  if (value && typeof value === 'object') return value.type ?? '';
  return '';
}

/** True when the SPDX-like expression can be satisfied with allowed licenses only. */
function isAllowed(expression) {
  const text = expression.replace(/[()]/g, ' ').trim();
  if (!text) return false;
  return text.split(/\s+OR\s+/i).some((option) =>
    option.split(/\s+AND\s+/i).every((part) => ALLOWED.has(part.trim())));
}

// Fixed command string, no user input.
const listing = execSync('npm ls --omit=dev --all --parseable', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const paths = listing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(1); // first line is the root project

const rejected = [];
for (const path of paths) {
  const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  const license = licenseOf(pkg);
  if (!isAllowed(license)) rejected.push(`${pkg.name}@${pkg.version}: ${license || '(no license field)'}`);
}

if (rejected.length) {
  console.error(`Production dependencies with licenses outside the allow list (${rejected.length}):`);
  for (const line of rejected) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`License check passed: ${paths.length} production packages.`);
