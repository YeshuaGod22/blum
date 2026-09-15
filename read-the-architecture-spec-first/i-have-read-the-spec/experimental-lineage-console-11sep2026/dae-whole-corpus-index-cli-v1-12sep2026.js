'use strict';

// Usage:
//   node dae-whole-corpus-index-cli-v1-12sep2026.js <EXP-003-root> [output.json]
//
// Whole-corpus battery-observation index with v1 identity semantics:
// canonical item ID, literal item-core wording, complete presentation,
// inference-call/package identity, compatibility message lineage, and trajectories.

const fs = require('fs');
const path = require('path');
const Importer = require('./dae-corpus-lineage-import-cli-v0-11sep2026.js');
const Unified = require('./dae-unified-observation-index-v1-12sep2026.js');
const MessageGraph = require('./dae-message-lineage-graph-v0-15sep2026.js');
const PackageGraph = require('./dae-inference-package-graph-v0-15sep2026.js');
const InstanceCensus = require('./dae-instance-start-census-v0-15sep2026.js');
const TrajectoryPackages = require('./dae-trajectory-package-bind-v0-15sep2026.js');
const WitnessParentSnapshots = require('./dae-witness-parent-snapshot-integrity-v0-15sep2026.js');
const TrajectoryIntegrity = require('./dae-trajectory-package-integrity-v0-15sep2026.js');
const CallOutcomes = require('./dae-call-outcome-census-v0-15sep2026.js');

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

  // Compatibility projection retained for existing message-level consumers.
  MessageGraph.attachMessageGraph(index, { collections });

  // Primary experimental unit: one inference call owns one complete input package
  // and one complete output package. System framing and conversation content are
  // sections inside the input package, not peer top-level inference units.
  PackageGraph.attachInferencePackageGraph(index, { pilot1Record, collections });

  // Trajectories are ordered administered calls. Inherited history visible to a
  // branch is content inside its branch input package; it is NOT counted as
  // downstream calls belonging to the branch trajectory.
  InstanceCensus.attachInstanceStartCensus(index, { pilot1Record, collections });
  TrajectoryPackages.bindTrajectoryPackages(index);

  // Historical collections sometimes preserve the exact inherited parent prefix
  // inside each branch witness without retaining the parent inference calls as
  // materialized corpus events. Verify that frozen snapshot independently. This
  // proves prefix ancestry without fabricating a missing parent trajectory.
  WitnessParentSnapshots.attachWitnessParentSnapshotIntegrity(index, { collections });

  // Prove topology from package contents rather than trusting labels/order alone.
  // Materialized parents use terminal-call state; absent parents may use the
  // independently verified frozen witness snapshot proof class above.
  TrajectoryIntegrity.attachTrajectoryPackageIntegrity(index);

  // Outcome is a property of an already-identified call, never part of its UID.
  // This separates administered depth from normally-completed depth.
  CallOutcomes.attachCallOutcomeCensus(index);

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
    calls: index.inferencePackageGraph?.callCount ?? null,
    inputPackages: index.inferencePackageGraph?.inputPackageCount ?? null,
    outputPackages: index.inferencePackageGraph?.outputPackageCount ?? null,
    packageSections: index.inferencePackageGraph?.sectionCount ?? null,
    compatibilityMessageNodes: index.messageGraph?.nodeCount ?? null,
    trajectories: index.instanceStartCensus?.instanceCount ?? null,
    packageBoundTrajectories: index.instanceStartCensus?.packageBoundInstanceCount ?? null,
    trajectoriesWithFurtherInferenceCalls: index.instanceStartCensus?.withFurtherInferenceCalls ?? null,
    witnessParentSnapshotStatuses: index.witnessParentSnapshotIntegrity?.statuses ?? null,
    trunkTransitionStatuses: index.trajectoryPackageIntegrity?.trunkTransitionStatuses ?? null,
    branchParentRelationStatuses: index.trajectoryPackageIntegrity?.branchParentRelationStatuses ?? null,
    callOutcomeCounts: index.callOutcomeCensus?.callOutcomeCounts ?? null,
    trajectoriesWithIncompleteCalls: index.callOutcomeCensus?.trajectoriesWithIncompleteCalls ?? null,
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
