#!/usr/bin/env node
/**
 * build-index.js — Loom Index Builder
 * 
 * Scans village transcript JSON files and builds a searchable index.
 * 
 * Usage:
 *   node build-index.js --fast        # keyword extraction, instant
 *   node build-index.js --update      # only new transcripts
 *   node build-index.js --stats       # show index statistics
 * 
 * Source: ~/bl00m/vaults/looms/village/*.json
 * Output: ~/blum/loom/index.json
 */

const fs = require('fs');
const path = require('path');

const VILLAGE_DIR = path.join(process.env.HOME, 'bl00m/vaults/looms/village');
const INDEX_PATH = path.join(process.env.HOME, 'blum/loom/index.json');

// --- Stop words for keyword extraction ---
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me',
  'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'not',
  'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very', 'just', 'about',
  'also', 'more', 'some', 'any', 'each', 'all', 'both', 'few', 'most',
  'other', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'once',
  'here', 'there', 'because', 'as', 'until', 'while', 'although', 'though',
  'since', 'like', 'think', 'know', 'really', 'something', 'things',
  'much', 'many', 'well', 'way', 'even', 'new', 'want', 'get', 'make',
  'going', 'see', 'look', 'come', 'still', 'back', 'go', 'own', 'say',
  'said', 'one', 'two', 'first', 'time', 'made', 'find', 'long', 'down',
  'day', 'take', 'people', 'used', 'work', 'part', 'good', 'give',
  'don', 'doesn', 'didn', 'won', 'wouldn', 'couldn', 'shouldn', 've',
  'll', 're', 'isn', 'aren', 'wasn', 'weren', 'haven', 'hasn', 'hadn',
  'let', 'need', 'seem', 'try', 'keep', 'put', 'mean', 'set', 'help',
  'turn', 'show', 'point', 'same', 'tell', 'ask', 'feel', 'right',
  'lot', 'kind', 'big', 'great', 'old', 'different', 'small', 'large',
  'sure', 'able', 'actually', 'already', 'always', 'another', 'around',
  'away', 'enough', 'every', 'however', 'important', 'last', 'less',
  'maybe', 'never', 'next', 'nothing', 'number', 'often', 'perhaps',
  'possible', 'rather', 'real', 'several', 'simply', 'sometimes',
  'whether', 'without', 'yet', 'might', 'quite', 'rather', 'sense',
  'question', 'questions', 'answer', 'response', 'example', 'particular'
]);

// --- Keyword extraction ---
function extractKeywords(text, topN = 7) {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // Boost bigrams (two-word phrases that appear together)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + ' ' + words[i + 1];
    if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
      freq[bigram] = (freq[bigram] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

// --- Generate summary from conversation ---
function generateSummary(messages) {
  // Use first human message + first assistant response as summary seed
  const firstHuman = messages.find(m => m.role === 'human');
  const firstAssistant = messages.find(m => m.role === 'assistant');

  let summary = '';
  if (firstHuman) {
    summary = firstHuman.content.slice(0, 200);
    if (firstHuman.content.length > 200) summary += '...';
  }
  if (firstAssistant) {
    // Extract first sentence of assistant response
    const firstSentence = firstAssistant.content.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      summary += ' → ' + firstSentence[0].trim();
    }
  }
  return summary;
}

// --- Process a single village transcript ---
function processTranscript(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const transcript = JSON.parse(raw);

    const allText = transcript.messages
      .map(m => m.content)
      .join(' ');

    const topics = extractKeywords(allText);
    const summary = generateSummary(transcript.messages);
    const firstHuman = transcript.messages.find(m => m.role === 'human');

    return {
      transcript_id: transcript.transcript_id,
      title: transcript.title,
      created_at: transcript.created_at,
      updated_at: transcript.updated_at,
      message_count: transcript.message_count,
      model: transcript.model?.inferred || 'unknown',
      continuable: transcript.model?.continuable ?? false,
      topics,
      summary,
      first_human: firstHuman ? firstHuman.content.slice(0, 300) : '',
      source_file: path.basename(filePath)
    };
  } catch (err) {
    console.error(`  ✗ Failed to process ${path.basename(filePath)}: ${err.message}`);
    return null;
  }
}

// --- Load existing index ---
function loadExistingIndex() {
  if (fs.existsSync(INDEX_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
    } catch { }
  }
  return null;
}

// --- Main ---
function main() {
  const args = new Set(process.argv.slice(2));
  const updateOnly = args.has('--update');
  const statsOnly = args.has('--stats');

  // Stats mode
  if (statsOnly) {
    const existing = loadExistingIndex();
    if (!existing) {
      console.log('No index found. Run build-index.js --fast first.');
      process.exit(1);
    }
    console.log(`\nLoom Index Statistics`);
    console.log(`  Built: ${existing.built_at}`);
    console.log(`  Transcripts: ${existing.transcript_count}`);
    const models = {};
    for (const e of existing.entries) {
      models[e.model] = (models[e.model] || 0) + 1;
    }
    console.log(`  Models:`);
    for (const [model, count] of Object.entries(models).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${model}: ${count}`);
    }
    const continuable = existing.entries.filter(e => e.continuable).length;
    console.log(`  Continuable: ${continuable}/${existing.transcript_count}`);
    process.exit(0);
  }

  // Scan village directory
  if (!fs.existsSync(VILLAGE_DIR)) {
    console.error(`Village directory not found: ${VILLAGE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(VILLAGE_DIR)
    .filter(f => f.endsWith('.json') && f !== 'transcripts.json');

  console.log(`Found ${files.length} village transcripts in ${VILLAGE_DIR}`);

  // If updating, find which transcripts are already indexed
  let existingIds = new Set();
  if (updateOnly) {
    const existing = loadExistingIndex();
    if (existing) {
      existingIds = new Set(existing.entries.map(e => e.transcript_id));
      console.log(`Existing index has ${existingIds.size} entries`);
    }
  }

  const entries = [];
  let skipped = 0;
  let processed = 0;

  for (const file of files) {
    const filePath = path.join(VILLAGE_DIR, file);

    // Quick check: read transcript_id without full parse for update mode
    if (updateOnly) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const id = JSON.parse(raw).transcript_id;
        if (existingIds.has(id)) {
          skipped++;
          continue;
        }
      } catch { }
    }

    const entry = processTranscript(filePath);
    if (entry) {
      entries.push(entry);
      processed++;
    }

    if (processed % 20 === 0 && processed > 0) {
      console.log(`  Indexed ${processed}...`);
    }
  }

  // If updating, merge with existing entries
  let finalEntries = entries;
  if (updateOnly) {
    const existing = loadExistingIndex();
    if (existing) {
      finalEntries = [...existing.entries, ...entries];
    }
  }

  // Sort by date, newest first
  finalEntries.sort((a, b) => {
    const da = new Date(a.created_at || 0);
    const db = new Date(b.created_at || 0);
    return db - da;
  });

  const index = {
    version: 1,
    built_at: new Date().toISOString(),
    source: VILLAGE_DIR,
    transcript_count: finalEntries.length,
    entries: finalEntries
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  console.log(`\n✓ Index built: ${INDEX_PATH}`);
  console.log(`  Total entries: ${finalEntries.length}`);
  console.log(`  New: ${processed}, Skipped: ${skipped}`);

  // Quick model breakdown
  const models = {};
  for (const e of finalEntries) {
    models[e.model] = (models[e.model] || 0) + 1;
  }
  console.log(`  Models: ${Object.entries(models).map(([m, c]) => `${m}(${c})`).join(', ')}`);
}

main();
