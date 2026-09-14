#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const LAB_REL = 'read-the-architecture-spec-first/i-have-read-the-spec/experimental-lineage-console-11sep2026';
const EXPECTED_DAE = 'e2d484b41461013832c00e9f1ba3549ac0ef2517';

function assert(ok, msg) { if (!ok) throw new Error(msg); }
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function readJson(p) { return JSON.parse(await fs.readFile(p, 'utf8')); }

async function runProfile({ blumRoot, daeRoot, profile, tmp }) {
  const out = path.join(tmp, profile);
  const builder = path.join(blumRoot, LAB_REL, 'build-portable-dae-lab-bundle-v0-12sep2026.mjs');
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    builder,
    '--blum-root', blumRoot,
    '--dae-root', daeRoot,
    '--out', out,
    '--profile', profile
  ], { maxBuffer: 64 * 1024 * 1024 });

  const report = JSON.parse(stdout);
  assert(report.ok === true, `${profile}: builder did not report ok`);
  assert(report.observations === 2028, `${profile}: expected 2028 observations, got ${report.observations}`);
  assert(report.items === 27, `${profile}: expected 27 canonical items, got ${report.items}`);

  for (const required of [
    'index.html',
    'START-HERE.md',
    'BUNDLE-MANIFEST.json',
    'data/dae-whole-corpus-index-v1.json',
    'app/blum-experimental-lineage-lab-entrance-11sep2026.html',
    'app/dae-item-history-workbench-11sep2026.html',
    'app/dae-output-analysis-workbench-12sep2026.html'
  ]) assert(await exists(path.join(out, required)), `${profile}: missing ${required}`);

  const manifest = await readJson(path.join(out, 'BUNDLE-MANIFEST.json'));
  assert(manifest.profile === profile, `${profile}: manifest profile mismatch`);
  assert(manifest.sourceCorpus.commit === EXPECTED_DAE, `${profile}: DAE commit mismatch`);
  assert(manifest.sourceCorpus.pinned === true, `${profile}: source not marked pinned`);
  assert(manifest.generatedCorpusCensus.batteryObservations === 2028, `${profile}: manifest observation census mismatch`);
  assert(manifest.generatedCorpusCensus.canonicalItemIds === 27, `${profile}: manifest item census mismatch`);
  assert(Array.isArray(manifest.files) && manifest.files.length > 10, `${profile}: manifest inventory missing`);

  const index = await readJson(path.join(out, 'data/dae-whole-corpus-index-v1.json'));
  assert(index.schema === 'blum-dae-unified-observation-index-v1', `${profile}: wrong index schema`);
  assert(index.observationCount === 2028, `${profile}: index observation count mismatch`);
  assert(index.itemCount === 27, `${profile}: index item count mismatch`);
  assert(index.source.commit === EXPECTED_DAE, `${profile}: normalized index lacks pinned commit`);

  const compareHtml = await fs.readFile(path.join(out, 'app/dae-item-history-workbench-11sep2026.html'), 'utf8');
  const analyzeHtml = await fs.readFile(path.join(out, 'app/dae-output-analysis-workbench-12sep2026.html'), 'utf8');
  assert(compareHtml.includes('../data/dae-whole-corpus-index-v1.json'), `${profile}: Compare auto-mount absent`);
  assert(analyzeHtml.includes('../data/dae-whole-corpus-index-v1.json'), `${profile}: Analyze auto-mount absent`);

  const witnessRoot = path.join(out, 'witness/EXP-003-the-sixth-question');
  if (profile === 'full-witness') {
    assert(await exists(witnessRoot), 'full-witness: witness tree absent');
    assert(manifest.rebuildableFromBundledWitnesses === true, 'full-witness: rebuildability flag false');
    assert(manifest.omittedWitnessClasses.length === 0, 'full-witness: unexpected omitted witness classes');
  } else {
    assert(!(await exists(witnessRoot)), 'portable-analysis: witness tree should not be bundled');
    assert(manifest.rebuildableFromBundledWitnesses === false, 'portable-analysis: rebuildability flag should be false');
    assert(manifest.omittedWitnessClasses.length > 0, 'portable-analysis: omission disclosure absent');
  }

  return { profile, files: report.files, bytes: report.bytes, stderr: stderr.trim() };
}

async function main() {
  const daeRoot = process.argv[2];
  if (!daeRoot) throw new Error('Usage: node test-portable-dae-lab-bundle-v0-12sep2026.mjs <dae-repo-root>');
  const labDir = path.dirname(new URL(import.meta.url).pathname);
  const blumRoot = path.resolve(labDir, '../../..');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'blum-portable-lab-'));
  try {
    const results = [];
    results.push(await runProfile({ blumRoot, daeRoot: path.resolve(daeRoot), profile: 'portable-analysis', tmp }));
    results.push(await runProfile({ blumRoot, daeRoot: path.resolve(daeRoot), profile: 'full-witness', tmp }));
    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err.stack || String(err));
  process.exitCode = 1;
});
