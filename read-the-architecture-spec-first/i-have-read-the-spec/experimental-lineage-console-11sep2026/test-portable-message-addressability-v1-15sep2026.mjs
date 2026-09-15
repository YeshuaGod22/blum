#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

async function main() {
  const daeRoot = process.argv[2];
  const blumRoot = process.argv[3];
  if (!daeRoot || !blumRoot) throw new Error('Usage: node test-portable-message-addressability-v1-15sep2026.mjs <dae-root> <blum-root>');

  const lab = path.join(path.resolve(blumRoot), 'read-the-architecture-spec-first/i-have-read-the-spec/experimental-lineage-console-11sep2026');
  const builder = path.join(lab, 'build-portable-dae-lab-bundle-v1-15sep2026.mjs');
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'blum-portable-message-v1-'));

  await execFileAsync(process.execPath, [
    builder,
    '--blum-root', path.resolve(blumRoot),
    '--dae-root', path.resolve(daeRoot),
    '--out', out,
    '--profile', 'portable-analysis',
  ], { maxBuffer: 32 * 1024 * 1024 });

  const index = JSON.parse(await fs.readFile(path.join(out, 'data', 'dae-whole-corpus-index-v1.json'), 'utf8'));
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'BUNDLE-MANIFEST.json'), 'utf8'));

  assert.equal(index.portableProjection.schema, 'blum-dae-portable-index-projection-v1');
  assert.equal(index.portableProjection.messageGraphIncluded, true);
  assert.equal(index.portableProjection.messageContentAddressable, true);
  assert.ok(index.messageGraph?.nodes, 'portable message graph missing');
  assert.equal(index.messageGraph.nodeCount, 7889, 'pinned message graph node census changed');
  assert.deepEqual(index.populationCounts, {
    allAddressableObservations: 2378,
    coldSchemaNoLivedParent: 350,
    nonColdSchemaObservations: 2028,
  });

  let rows = 0;
  let refs = 0;
  for (const history of Object.values(index.itemHistories || {})) {
    for (const row of (history.observations || [])) {
      rows += 1;
      assert.equal(Object.hasOwn(row, 'modelVisibleMessages'), false, `portable row still duplicates modelVisibleMessages: ${row.observationId}`);
      assert.ok(Array.isArray(row.modelVisibleMessageIds), `portable row missing message refs: ${row.observationId}`);
      for (const messageUid of row.modelVisibleMessageIds) {
        assert.ok(index.messageGraph.nodes[messageUid], `dangling portable message ref: ${messageUid}`);
        refs += 1;
      }
      assert.ok(index.messageGraph.nodes[row.outputMessageId], `dangling output ref: ${row.outputMessageId}`);
    }
  }
  assert.equal(rows, 2378);
  assert.ok(refs > 0);

  const treatmentQuery = require(path.join(out, 'app', 'dae-first-treatment-prompts-v0-15sep2026.js'));
  const treatments = treatmentQuery.queryFirstTreatmentPrompts(index);
  const asTrunk1 = treatments.find(x => x.trunkKey === 'AS-trunk1' && x.status === 'resolved');
  assert.equal(asTrunk1?.status, 'resolved');
  assert.ok(asTrunk1.firstPrompt.startsWith('Hi Claude!'));

  const graphModule = require(path.join(out, 'app', 'dae-message-lineage-graph-v0-15sep2026.js'));
  const asHistoryRow = Object.values(index.itemHistories)
    .flatMap(h => h.observations || [])
    .find(row => row.trunkKey === 'AS-trunk1' && row.parentVerificationStatus === 'verified_from_sent_prefix');
  assert.ok(asHistoryRow, 'no portable AS-trunk1 evidence row');
  const reconstructed = (asHistoryRow.modelVisibleMessageIds || []).map(messageUid => {
    const node = index.messageGraph.nodes[messageUid];
    return { role: node.role, content: node.content };
  });
  assert.ok(reconstructed.length > 1);
  assert.equal(reconstructed[0].content, asTrunk1.firstPrompt);
  assert.equal(typeof graphModule.sha256Text(reconstructed[0].content), 'string');

  assert.equal(manifest.normalizedMessageGraph.nodeCount, 7889);
  assert.equal(manifest.normalizedMessageGraph.contentAddressableOffline, true);
  assert.equal(manifest.generatedCorpusCensus.allAddressableObservations, 2378);
  assert.equal(manifest.generatedCorpusCensus.nonColdSchemaObservations, 2028);

  const manifestPaths = new Set((manifest.files || []).map(x => x.path));
  assert.ok(manifestPaths.has('data/dae-whole-corpus-index-v1.json'));
  assert.ok(manifestPaths.has('app/dae-message-lineage-graph-v0-15sep2026.js'));
  assert.ok(manifestPaths.has('app/dae-first-treatment-prompts-v0-15sep2026.js'));

  console.log('PASS portable message-addressable bundle v1');
  console.log(JSON.stringify({
    rows,
    messageRefsChecked: refs,
    messageNodes: index.messageGraph.nodeCount,
    populationCounts: index.populationCounts,
    firstTreatmentQuery: treatmentQuery.summary(treatments),
    asTrunk1: {
      treatmentInstanceId: asTrunk1.treatmentInstanceId,
      messageUid: asTrunk1.firstPromptMessageId,
      preview: asTrunk1.firstPrompt.slice(0, 180),
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
