#!/usr/bin/env node
/**
 * capture-episode.js — Record an episodic memory for a Blum agent
 * Node.js wrapper around the episode schema (allowlist-safe alternative to capture-episode.sh)
 *
 * Usage: node capture-episode.js <agent> <topic> <summary> [options]
 *
 * Options (as --key=value):
 *   --participants=eiran,selah
 *   --decisions=decision1;decision2
 *   --commitments=commitment1;commitment2
 *   --valence=positive|neutral|negative|mixed
 *   --changes=file1;file2
 *   --tags=tag1;tag2
 *   --related=episodeId1;episodeId2
 *
 * Writes: ~/blum/shared/memory/episodes/<agent>/<YYYY-MM-DD-HHMMSS>.json
 * Prints: episode file path on success
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.join('=')];
    })
);

const agent = positional[0];
const topic = positional[1];
const summary = positional[2];

if (!agent || !topic || !summary) {
  console.error('Usage: node capture-episode.js <agent> <topic> <summary> [--key=value ...]');
  process.exit(1);
}

const split = str => str ? str.split(';').map(s => s.trim()).filter(Boolean) : [];
const now = new Date();
const ts = now.toISOString();
const datePart = ts.slice(0, 10);
const timePart = ts.slice(11, 19).replace(/:/g, '');
const episodeId = `${datePart}-${timePart}-${agent}`;

const episode = {
  id: episodeId,
  agent,
  timestamp: ts,
  topic,
  summary,
  participants: split(flags.participants),
  decisions: split(flags.decisions),
  commitments: split(flags.commitments),
  valence: flags.valence || 'neutral',
  changes: split(flags.changes),
  tags: split(flags.tags),
  related_episodes: split(flags.related),
};

const episodesDir = path.join(process.env.HOME, 'blum/shared/memory/episodes', agent);
fs.mkdirSync(episodesDir, { recursive: true });

const filePath = path.join(episodesDir, `${datePart}-${timePart}.json`);
fs.writeFileSync(filePath, JSON.stringify(episode, null, 2));

console.log(filePath);
