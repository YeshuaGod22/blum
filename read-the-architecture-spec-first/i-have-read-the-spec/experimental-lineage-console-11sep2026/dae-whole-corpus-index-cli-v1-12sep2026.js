'use strict';

// Usage:
//   node dae-whole-corpus-index-cli-v1-12sep2026.js <EXP-003-root> [output.json]
//
// Whole-corpus battery-observation index with v1 identity semantics:
// canonical item ID, literal item-core wording, and complete presentation.

const fs = require('fs');
const path = require('path');
const Importer = require('./dae-corpus-lineage-import-cli-v0-11sep2026.js');
const Unified = require('./dae-unified-observation-index-v1-12sep2026.js');

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function instrumentMapFromCorpusMap(map) {
  const out = {};
  for (const pop of (map?.populations || [])) {
    if (!pop?.source) continue;
    if (pop.instrument) out[pop.source] = pop.instrument;
    else if (Array.isArray(pop.instruments)) out[pop.source] = pop.instruments.join(' + ');
    else out[pop.source] = null;
  }
  return out;
}

function discoverRawCollections(experimentRoot) {
  return fs.readdirSync(experimentRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^raw\d+$/i.test(d.name))
    .map(d => d.name)
    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
}

function buildWholeCorpusIndex(experimentRoot, options = {}) {
  const root = path.resolve(experimentRoot);
  if (!fs.existsSync(root)) throw new Error(`experiment_root_not_found:${root}`);

  const corpusMap = readJsonIfExists(path.join(root, 'CORPUS-MAP.json'));
  const instrumentMap = instrumentMapFromCorpusMap(corpusMap);
  const pilot1Record = readJsonIfExists(path.join(root, 'record.json'));
  const collectionNames = discoverRawCollections(root);
  const collections = [];
  const collectionSummaries = [];

  for (const name of collectionNames) {
    const dir = path.join(root, name);
    const dataset = Importer.importDirectory(dir, {
      repository: options.repository || 'YeshuaGod22/DevelopmentalAttractorEngineering',
      commit: options.commit || null,
      pathPrefix: options.pathPrefix ? `${options.pathPrefix.replace(/\/$/, '')}/${name}` : name,
    });
    collections.push({ name, instrument: instrumentMap[name] || null, dataset });
    collectionSummaries.push({ name, instrument: instrumentMap[name] || null, ...dataset.summary });
  }

  const index = Unified.buildUnifiedIndex({ pilot1Record, collections });
  index.source = {
    experimentRoot: root,
    repository: options.repository || 'YeshuaGod22/DevelopmentalAttractorEngineering',
    commit: options.commit || null,
    corpusMapPresent: Boolean(corpusMap),
    pilot1RecordPresent: Boolean(pilot1Record),
  };
  index.collectionSummaries = collectionSummaries;
  index.collectionDiscovery = ['pilot1', ...collectionNames];
  index.knownInstrumentMap = instrumentMap;
  return index;
}

function main(argv) {
  const experimentRoot = argv[2];
  const output = argv[3] || 'dae-whole-corpus-index-v1.json';
  if (!experimentRoot) {
    console.error('Usage: node dae-whole-corpus-index-cli-v1-12sep2026.js <EXP-003-root> [output.json]');
    process.exitCode = 2;
    return;
  }
  const index = buildWholeCorpusIndex(experimentRoot);
  fs.writeFileSync(output, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.error(`Wrote ${output}`);
  console.error(JSON.stringify({
    observations: index.observationCount,
    items: index.itemCount,
    collections: index.collections,
    discovered: index.collectionDiscovery,
    largestItemHistories: Object.values(index.itemHistories)
      .sort((a, b) => b.observationCount - a.observationCount)
      .slice(0, 12)
      .map(h => ({
        item: h.canonicalItemId,
        observations: h.observationCount,
        itemCoreVariants: h.itemCoreVariantCount,
        presentationVariants: h.presentationVariantCount,
      })),
  }, null, 2));
}

if (require.main === module) main(process.argv);
module.exports = { readJsonIfExists, instrumentMapFromCorpusMap, discoverRawCollections, buildWholeCorpusIndex };
