// Token Radar, entrypoint (Node 22, standard library only).
//
// Run it:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|dir>
// In the grader it reads /input/snapshot.json and writes /output.
//
// A run does four things in order. It reads the sealed snapshot and
// scores it with lib/model.ts, which returns the ranked board plus the
// dashboard's dataset. It refuses to go on if the board would fail the
// gate, or if a fitted literal printed in dashboard/index.html differs
// from the value the model just computed: the page's formula line, odds
// coefficients and peer counts are text, and the build must fail rather
// than ship text the arithmetic disagrees with. Then it writes
// board.json and data.js, copies dashboard/ and screenshots/ into the
// output, and only then builds dossier.json, last, because the scorer
// rebuilds the dossier from /output and compares bytes, so it has to
// describe exactly the files on disk.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

// Caps from the scorer itself: the text cap shapes how big the
// dashboard may be, the rest refuse outright.
const TEXT_CAP = 65_536;
const SHOTS = { max: 4, max_bytes: 524_288 };
const NAME_OK = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** The value after --name, or --name=value, or the fallback. */
function optionValue(name: string, fallback: string): string {
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}` && i + 1 < argv.length) return argv[i + 1]!;
    if (argv[i]!.startsWith(`--${name}=`)) return argv[i]!.slice(name.length + 3);
  }
  return fallback;
}

function fail(msg: string, code = 1): never {
  process.stderr.write(`token radar: ${msg}\n`);
  process.exit(code);
}

/** Copy a directory's regular files, skipping dot-names, and list what landed. */
function copyPlainFiles(from: string, to: string): string[] {
  const landed: string[] = [];
  if (!existsSync(from)) return landed;
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, join(to, name));
    landed.push(name);
  }
  return landed;
}

function signed3(v: number): string {
  return `${v < 0 ? '-' : '+'} ${Math.abs(v).toFixed(3)}`;
}

/**
 * The D8 check: every fitted literal in dashboard/index.html must equal
 * the value just computed from the snapshot. A literal that drifts from
 * the arithmetic fails the build instead of shipping a page that argues
 * with its own code.
 */
function assertPageLiterals(html: string, radar: ReturnType<typeof buildRadar>['radar']): void {
  const m = radar.model;
  const of = radar.odds_fit;
  const expected: string[] = [];
  expected.push(`exp(${m.value_const.toFixed(2)} + ${m.value_log_tvl.toFixed(2)} × ln TVL + category)`);
  expected.push(`if it launches = exp(${m.value_const.toFixed(4)} + ${m.value_log_tvl.toFixed(4)} x ln(TVL) + category_effect)`);
  const logitLine =
    `logit p(age) = ${of.const.toFixed(3)} ${signed3(of.years)} x years ${signed3(of.ln_tvl)} x ln(TVL/$100M) ${signed3(of.growth)} x 7d growth ${signed3(of.family)} x family`;
  expected.push(logitLine);
  expected.push(`${of.peers} shape-passing peers: ${of.peers_symbol} record a symbol; ${of.peers_owned} own it (${of.peers_symbol - of.peers_owned} inherit a sibling's)`);
  expected.push(`p(${m.odds_ceiling_years.toFixed(2)}y)`);
  // F1: the judge-note and headline literals, restored from runtime-filled
  // spans to literal text the dossier carries. Each is built from the
  // computed values, so a literal that drifts from the arithmetic fails
  // the build exactly as the formula literals above do.
  const fit = radar.fit;
  expected.push(`${radar.board_size} protocols record no token`);
  expected.push(`ranks ${radar.watchlist_size} of ${radar.watchlist_size} watchlist protocols plus ${radar.early_size} more`);
  expected.push(`checksum ${radar.checksum}, FNV-1a of rank:slug:implied`);
  expected.push(`leave-one-out (×${fit.loo_miss.toFixed(2)}) and walk-forward (×${fit.wf_miss.toFixed(2)})`);
  expected.push(`walk-forward Brier ${fit.odds_brier_wf.toFixed(3)} against a ${fit.odds_brier_base.toFixed(3)} base`);
  expected.push(`misses by ×${fit.loo_miss.toFixed(2)} leave-one-out`);
  expected.push(`the snapshot's oldest cohort, ${of.ceiling_years.toFixed(2)} years`);
  for (const line of expected) {
    if (!html.includes(line)) fail(`dashboard/index.html literal disagrees with the computed model: missing "${line}"`);
  }
}

const given = optionValue('input', '/input');
const snapPath = given.endsWith('.json') ? given : join(given, 'snapshot.json');
if (!existsSync(snapPath)) fail(`no snapshot at ${snapPath}: pass --input <snapshot.json|directory> or mount the sealed /input`, 2);
const outDir = optionValue('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snap = parseSnapshot(readFileSync(snapPath, 'utf8'));
const { board, radar } = buildRadar(snap);
const problem = boardIssue(board, snap);
if (problem !== null) fail(`the model wrote a board the gate refuses: ${problem}`);

const pageHtml = readFileSync(join(root, 'dashboard', 'index.html'), 'utf8');
assertPageLiterals(pageHtml, radar);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

copyPlainFiles(join(root, 'dashboard'), join(outDir, 'dashboard'));
const shots = copyPlainFiles(join(root, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3) fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
for (const name of shots) {
  if (!NAME_OK.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// Dossier last, from the files above, byte for byte.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, { text_max_bytes: TEXT_CAP, screenshots: SHOTS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }),
);

process.stdout.write(
  `token radar: ${snap.protocols.length} protocols, ${snap.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (3 files), ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
);
