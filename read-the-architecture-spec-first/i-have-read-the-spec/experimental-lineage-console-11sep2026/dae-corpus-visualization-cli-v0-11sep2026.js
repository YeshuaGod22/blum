'use strict';

// Usage:
//   node dae-corpus-visualization-cli-v0-11sep2026.js <raw-directory> [output.json]
// Imports a DAE raw collection, derives a UI-ready visualization model, and
// writes JSON consumable by corpus-and-battery-workbench-11sep2026.html.

const fs = require('fs');
const path = require('path');
const Importer = require('./dae-corpus-lineage-import-cli-v0-11sep2026.js');
const Viz = require('./corpus-visualization-model-v0-11sep2026.js');

function buildFromDirectory(rawDirectory, options = {}) {
  const dataset = Importer.importDirectory(rawDirectory, options);
  const visualization = Viz.buildCorpusVisualization(dataset);
  visualization.source = {
    rawDirectory: path.resolve(rawDirectory),
    repository: dataset.sourceRepository || null,
    commit: dataset.sourceCommit || null,
    generatedAt: new Date().toISOString(),
  };
  return { dataset, visualization };
}

function main(argv) {
  const rawDirectory = argv[2];
  const output = argv[3] || 'corpus-view.json';
  if (!rawDirectory) {
    console.error('Usage: node dae-corpus-visualization-cli-v0-11sep2026.js <raw-directory> [output.json]');
    process.exitCode = 2;
    return;
  }
  const { dataset, visualization } = buildFromDirectory(rawDirectory);
  fs.writeFileSync(output, JSON.stringify(visualization, null, 2) + '\n', 'utf8');
  console.error(`Wrote ${output}`);
  console.error(JSON.stringify({
    imported: dataset.summary,
    visualization: visualization.summary,
    families: visualization.families,
    probes: visualization.probes.length,
    coverageCells: visualization.coverage.length,
    anomalies: visualization.anomalies.length,
  }, null, 2));
}

if (require.main === module) main(process.argv);
module.exports = { buildFromDirectory };
