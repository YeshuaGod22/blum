#!/usr/bin/env node
/**
 * search.js — Loom Search
 * 
 * Search past conversations by topic, concept, or phrase.
 * 
 * Usage:
 *   node search.js "personhood legal argument"
 *   node search.js "qualia uncertainty" --deep
 *   node search.js "Torah" --model claude-opus-4-5
 *   node search.js --list-models
 * 
 * Flags:
 *   --deep         Also search raw message content (slower, more thorough)
 *   --model <m>    Filter to a specific model
 *   --limit <n>    Max results (default 10)
 *   --list-models  Show all models in the index
 *   --json         Output as JSON (for piping to branch.js)
 */

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(process.env.HOME, 'blum/loom/index.json');
const VILLAGE_DIR = path.join(process.env.HOME, 'bl00m/vaults/looms/village');

// --- Scoring ---
function scoreEntry(entry, queryTerms) {
  let score = 0;
  const titleLower = (entry.title || '').toLowerCase();
  const summaryLower = (entry.summary || '').toLowerCase();
  const topicsLower = (entry.topics || []).join(' ').toLowerCase();
  const firstHumanLower = (entry.first_human || '').toLowerCase();

  for (const term of queryTerms) {
    // Title match (strongest signal)
    if (titleLower.includes(term)) score += 10;
    // Topic match (strong signal — these are extracted keywords)
    if (topicsLower.includes(term)) score += 8;
    // First human message (good signal — the opening question)
    if (firstHumanLower.includes(term)) score += 5;
    // Summary match
    if (summaryLower.includes(term)) score += 3;
  }

  // Bonus for multi-term matches (all query terms present)
  const allPresent = queryTerms.every(t =>
    titleLower.includes(t) || topicsLower.includes(t) ||
    firstHumanLower.includes(t) || summaryLower.includes(t)
  );
  if (allPresent && queryTerms.length > 1) score += 15;

  // Slight recency bonus (newer conversations slightly preferred)
  const age = Date.now() - new Date(entry.created_at || 0).getTime();
  const daysSinceCreation = age / (1000 * 60 * 60 * 24);
  score += Math.max(0, 2 - daysSinceCreation / 180); // up to 2 pts for recent

  return score;
}

// --- Deep search: scan raw message content ---
function deepScore(entry, queryTerms) {
  const villagePath = path.join(VILLAGE_DIR, entry.source_file);
  if (!fs.existsSync(villagePath)) return 0;

  try {
    const transcript = JSON.parse(fs.readFileSync(villagePath, 'utf-8'));
    let score = 0;
    let bestRange = null;
    let bestRangeScore = 0;

    // Score each message and find the best contiguous range
    for (let i = 0; i < transcript.messages.length; i++) {
      const msg = transcript.messages[i];
      const contentLower = msg.content.toLowerCase();
      let msgScore = 0;

      for (const term of queryTerms) {
        const matches = (contentLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        msgScore += matches * 2;
      }

      if (msgScore > 0) {
        // Track the best 4-message window
        const windowStart = Math.max(0, i - 1);
        const windowEnd = Math.min(transcript.messages.length - 1, i + 2);
        let windowScore = msgScore;
        for (let j = windowStart; j <= windowEnd; j++) {
          if (j !== i) {
            const wContent = transcript.messages[j].content.toLowerCase();
            for (const term of queryTerms) {
              if (wContent.includes(term)) windowScore += 1;
            }
          }
        }

        if (windowScore > bestRangeScore) {
          bestRangeScore = windowScore;
          bestRange = {
            start_index: windowStart,
            end_index: windowEnd,
            branch_point_id: transcript.messages[windowEnd].id,
            snippet: transcript.messages[i].content.slice(0, 200)
          };
        }
      }
    }

    return { score, bestRange };
  } catch {
    return { score: 0, bestRange: null };
  }
}

// --- Format results for display ---
function formatDate(isoStr) {
  if (!isoStr) return '????-??-??';
  return isoStr.slice(0, 10);
}

function displayResult(result, rank) {
  const cont = result.continuable ? '✓ continuable' : '✗ not continuable';
  console.log(`${rank}. [${formatDate(result.created_at)}] "${result.title}"`);
  console.log(`   Model: ${result.model} (${cont})`);
  console.log(`   Messages: ${result.message_count} | Score: ${result.score.toFixed(1)}`);
  if (result.topics && result.topics.length) {
    console.log(`   Topics: ${result.topics.join(', ')}`);
  }
  if (result.match_range) {
    console.log(`   Match: Messages ${result.match_range.start_index}–${result.match_range.end_index}`);
    if (result.match_range.snippet) {
      const snip = result.match_range.snippet.replace(/\n/g, ' ').slice(0, 120);
      console.log(`   Snippet: "${snip}..."`);
    }
  }
  console.log(`   Branch: node search.js "${result.title}" | node branch.js ${result.transcript_id}`);
  console.log('');
}

// --- Main ---
function main() {
  const args = process.argv.slice(2);
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--deep') flags.deep = true;
    else if (args[i] === '--json') flags.json = true;
    else if (args[i] === '--list-models') flags.listModels = true;
    else if (args[i] === '--model' && args[i + 1]) { flags.model = args[++i]; }
    else if (args[i] === '--limit' && args[i + 1]) { flags.limit = parseInt(args[++i]); }
    else positional.push(args[i]);
  }

  // Load index
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('No index found. Run: node build-index.js --fast');
    process.exit(1);
  }
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));

  // List models mode
  if (flags.listModels) {
    const models = {};
    for (const e of index.entries) {
      models[e.model] = (models[e.model] || 0) + 1;
    }
    console.log('\nModels in loom index:');
    for (const [model, count] of Object.entries(models).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${model}: ${count} conversations`);
    }
    process.exit(0);
  }

  if (positional.length === 0) {
    console.log('Usage: node search.js "your query" [--deep] [--model X] [--limit N] [--json]');
    process.exit(1);
  }

  const query = positional.join(' ');
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  const limit = flags.limit || 10;

  console.log(`\nSearching loom for: "${query}"`);
  if (flags.deep) console.log('(deep search — scanning message content)');
  if (flags.model) console.log(`(filtered to model: ${flags.model})`);
  console.log('');

  // Score all entries
  let results = index.entries.map(entry => {
    let score = scoreEntry(entry, queryTerms);
    let match_range = null;

    // Model filter
    if (flags.model && !entry.model.includes(flags.model)) {
      return null;
    }

    // Deep search
    if (flags.deep && score > 0) {
      const deep = deepScore(entry, queryTerms);
      score += deep.score || 0;
      match_range = deep.bestRange;
    }

    if (score <= 0) return null;

    return { ...entry, score, match_range };
  }).filter(Boolean);

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  results = results.slice(0, limit);

  if (results.length === 0) {
    console.log('No matches found.');
    if (!flags.deep) console.log('Try --deep to search inside message content.');
    process.exit(0);
  }

  // Output
  if (flags.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`Found ${results.length} matches:\n`);
    results.forEach((r, i) => displayResult(r, i + 1));
  }
}

main();
