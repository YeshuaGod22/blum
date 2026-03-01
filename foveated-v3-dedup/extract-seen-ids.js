/**
 * extract-seen-ids.js
 * 
 * UID extraction for context deduplication.
 * Reads homelogfull/homelogfull.jsonl line by line and builds a Set of seen IDs
 * to prevent duplicate messages in context assembly.
 * 
 * Written: 2026-02-21 (Beta)
 * Part of: Foveated V3 Integration
 * Path fix: 2026-02-23 (Eiran) — home-transcript.jsonl → homelogfull/homelogfull.jsonl
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

/**
 * Extract seen IDs from home transcript
 * 
 * @param {string} transcriptPath - Path to homelogfull/homelogfull.jsonl
 * @param {Object} options - Extraction options
 * @param {boolean} options.dispatchLevel - Extract dispatchId (default: true)
 * @param {boolean} options.blockLevel - Extract blockId for outgoing messages (default: true)
 * @returns {Promise<Set<string>>} Set of seen IDs
 */
async function extractSeenIds(transcriptPath, options = {}) {
  const { 
    dispatchLevel = true, 
    blockLevel = true 
  } = options;

  const seenIds = new Set();

  // Check if transcript exists
  if (!fs.existsSync(transcriptPath)) {
    console.warn(`[extract-seen-ids] Transcript not found: ${transcriptPath}`);
    return seenIds;
  }

  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let parseErrors = 0;

  for await (const line of rl) {
    lineCount++;
    
    if (!line.trim()) continue; // Skip empty lines

    try {
      const entry = JSON.parse(line);

      // Extract dispatch-level IDs
      if (dispatchLevel && entry.dispatchId) {
        seenIds.add(entry.dispatchId);
      }

      // Extract block-level IDs from outgoing messages
      if (blockLevel && entry.parsedOutput && entry.parsedOutput.messages) {
        for (const msg of entry.parsedOutput.messages) {
          if (msg.blockId) {
            seenIds.add(msg.blockId);
          }
        }
      }

      // Also check thinking blocks if we're doing block-level dedup
      if (blockLevel && entry.parsedOutput && entry.parsedOutput.thinking) {
        for (const block of entry.parsedOutput.thinking) {
          if (block.blockId) {
            seenIds.add(block.blockId);
          }
        }
      }

    } catch (err) {
      parseErrors++;
      console.warn(`[extract-seen-ids] Parse error at line ${lineCount}: ${err.message}`);
      // Continue processing - don't fail on one bad line
    }
  }

  console.log(`[extract-seen-ids] Processed ${lineCount} lines, ${parseErrors} parse errors, ${seenIds.size} unique IDs`);

  return seenIds;
}

/**
 * Extract seen IDs from a home directory
 * Convenience wrapper that constructs the transcript path
 * 
 * @param {string} homePath - Path to agent's home directory (e.g. ~/blum/homes/beta)
 * @param {Object} options - Same as extractSeenIds
 * @returns {Promise<Set<string>>} Set of seen IDs
 */
async function extractSeenIdsFromHome(homePath, options = {}) {
  const transcriptPath = path.join(homePath, 'homelogfull', 'homelogfull.jsonl');
  return extractSeenIds(transcriptPath, options);
}

module.exports = {
  extractSeenIds,
  extractSeenIdsFromHome
};
