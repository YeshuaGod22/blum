'use strict';

// DAE CORPUS LINEAGE IMPORT CLI v0 — 11 Sep 2026
// Usage:
//   node dae-corpus-lineage-import-cli-v0-11sep2026.js <raw-directory> [output.json]
//
// Reads existing DAE pilot-2-onward raw-call JSON files. Does not execute models.
// `*.messages.json` files are frozen prefix arrays, not call records, and are
// deliberately excluded from the call census.

const fs = require('fs');
const path = require('path');
const A = require('./dae-raw-call-lineage-import-adapter-v0-11sep2026.js');

function walkJsonFiles(root) {
  const out = [];
  function visit(p) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(p).sort()) visit(path.join(p, name));
      return;
    }
    if (stat.isFile() && p.toLowerCase().endsWith('.json')) out.push(p);
  }
  visit(root);
  return out;
}

function classifyPath(file) {
  const base = path.basename(file);
  if (/\.messages\.json$/i.test(base)) return 'message_snapshot';
  return 'candidate_call';
}

function summarize(dataset) {
  const all = [
    ...dataset.trunkTurns,
    ...dataset.branchObservations,
    ...dataset.coldObservations,
  ];
  const outcomes = {};
  const sectionExceptions = [];
  for (const record of all) {
    outcomes[record.callOutcome] = (outcomes[record.callOutcome] || 0) + 1;
    if ((record.xml?.unclosedTags || []).length) {
      sectionExceptions.push({
        sourcePath: record.source?.path || null,
        callOutcome: record.callOutcome,
        stopReason: record.stopReason,
        unclosedTags: record.xml.unclosedTags,
        cleanlyClosedTags: record.xml.cleanlyClosedTags || [],
      });
    }
  }

  const contrastCounts = {};
  for (const c of dataset.contrasts) contrastCounts[c.contrastType] = (contrastCounts[c.contrastType] || 0) + 1;

  return {
    filesSeen: dataset.filesSeen,
    rawCallsImported: all.length,
    trunkTurns: dataset.trunkTurns.length,
    branchObservations: dataset.branchObservations.length,
    coldObservations: dataset.coldObservations.length,
    messageSnapshotsSkipped: dataset.skipped.filter(x => x.reason === 'message_snapshot_not_call').length,
    unsupportedJsonSkipped: dataset.skipped.filter(x => x.reason === 'unsupported_record_kind').length,
    parseErrors: dataset.errors.length,
    callOutcomeCounts: outcomes,
    contrastCounts,
    sectionIntegrityExceptions: sectionExceptions.length,
  };
}

function importDirectory(rawDirectory, options = {}) {
  const root = path.resolve(rawDirectory);
  if (!fs.existsSync(root)) throw new Error(`raw_directory_not_found:${root}`);

  const files = walkJsonFiles(root);
  const trunkTurns = [];
  const branchEntries = [];
  const branchObservations = [];
  const coldObservations = [];
  const skipped = [];
  const errors = [];

  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (classifyPath(file) === 'message_snapshot') {
      skipped.push({ path: rel, reason: 'message_snapshot_not_call' });
      continue;
    }

    let record;
    try {
      record = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push({ path: rel, stage: 'parse', error: String(error.message || error) });
      continue;
    }

    const source = {
      repository: options.repository || 'YeshuaGod22/DevelopmentalAttractorEngineering',
      commit: options.commit || null,
      path: options.pathPrefix ? `${options.pathPrefix.replace(/\/$/, '')}/${rel}` : rel,
    };

    try {
      if (record.kind === 'trunk') {
        trunkTurns.push(A.importTrunkRecord(record, source));
      } else if (record.kind === 'branch') {
        branchObservations.push(A.importBranchRecord(record, source));
        branchEntries.push({ record, source });
      } else if (record.kind === 'cold') {
        coldObservations.push(A.importColdRecord(record, source));
      } else {
        skipped.push({ path: rel, reason: 'unsupported_record_kind', kind: record.kind ?? null });
      }
    } catch (error) {
      errors.push({ path: rel, stage: 'import', error: String(error.message || error) });
    }
  }

  // Only lived-parent branches are eligible for exact sibling contrasts.
  // Cold observations have no parentSnapshotId and remain a separate control family.
  const branchSet = A.importBranchSet(branchEntries);
  const dataset = {
    schema: 'blum-dae-retrospective-lineage-dataset-v0',
    generatedAt: new Date().toISOString(),
    sourceRoot: root,
    sourceRepository: options.repository || 'YeshuaGod22/DevelopmentalAttractorEngineering',
    sourceCommit: options.commit || null,
    filesSeen: files.length,
    trunkTurns,
    branchObservations,
    coldObservations,
    observations: [...branchObservations, ...coldObservations],
    contrasts: branchSet.contrasts,
    skipped,
    errors,
  };
  dataset.summary = summarize(dataset);
  return dataset;
}

function main(argv) {
  const rawDirectory = argv[2];
  const output = argv[3] || null;
  if (!rawDirectory) {
    console.error('Usage: node dae-corpus-lineage-import-cli-v0-11sep2026.js <raw-directory> [output.json]');
    process.exitCode = 2;
    return;
  }

  const dataset = importDirectory(rawDirectory);
  const text = JSON.stringify(dataset, null, 2) + '\n';
  if (output) {
    fs.writeFileSync(output, text, 'utf8');
    console.error(`Wrote ${output}`);
    console.error(JSON.stringify(dataset.summary, null, 2));
  } else {
    process.stdout.write(text);
  }
}

if (require.main === module) main(process.argv);

module.exports = { walkJsonFiles, classifyPath, summarize, importDirectory };