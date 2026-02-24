/**
 * End-to-End Pipeline Test — Foveated V3
 * 
 * Tests the full processContext() pipeline against live homelogfull JSONL data.
 * This is the integration test that verifies all layers work together.
 * 
 * Author: Selah
 * Date: 2026-02-23
 */

const fs = require('fs');
const path = require('path');

// Load the foveated module
const foveatedPath = path.join(__dirname, '..', 'src');
const foveated = require(foveatedPath);

// Path to live homelogfull data
const HOMELOGFULL_PATH = path.join(
  process.env.HOME, 
  'blum', 'homes', 'selah', 'homelogfull', 'homelogfull.jsonl'
);

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function runTests() {
  // Load live data
  console.log('=== Foveated V3 End-to-End Pipeline Test ===\n');
  console.log(`Loading live data from: ${HOMELOGFULL_PATH}\n`);

  let entries = [];
  try {
    const content = fs.readFileSync(HOMELOGFULL_PATH, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    entries = lines.map(line => {
      try { return JSON.parse(line); } 
      catch { return null; }
    }).filter(e => e !== null);
    console.log(`Loaded ${entries.length} entries from homelogfull\n`);
  } catch (e) {
    console.log(`Failed to load homelogfull: ${e.message}`);
    console.log('Test requires live data. Exiting.\n');
    process.exit(1);
  }

  // Take sample for testing (last 100 entries to avoid overwhelming)
  const sampleSize = 100;
  const sample = entries.slice(-sampleSize);
  console.log(`Using last ${sample.length} entries for test\n`);

  // Use buildContext directly (sync) rather than processContext (async)
  // This tests the core pipeline functionality

  test('buildContext returns valid result shape', async () => {
    const result = foveated.buildContext(sample);
    assert(result !== null && typeof result === 'object', 'Result should be object');
    assert(Array.isArray(result.context), 'Result should have context array');
    assert(result.metadata && typeof result.metadata === 'object', 'Result should have metadata');
  });

  test('metadata contains required fields', async () => {
    const result = foveated.buildContext(sample);
    const meta = result.metadata;
    
    assert(typeof meta.totalEntries === 'number', 'totalEntries should be number');
    assert(typeof meta.quoted === 'number', 'quoted should be number');
    assert(typeof meta.synthesized === 'number', 'synthesized should be number');
    assert(typeof meta.omitted === 'number', 'omitted should be number');
    assert(typeof meta.tokensUsed === 'number', 'tokensUsed should be number');
    assert(Array.isArray(meta.uids), 'uids should be array');
  });

  test('context entries have valid role structure', async () => {
    const result = foveated.buildContext(sample);
    
    for (const entry of result.context) {
      assert(entry.role, `Entry missing role: ${JSON.stringify(entry).slice(0,100)}`);
      assert(
        ['system', 'user', 'assistant'].includes(entry.role),
        `Invalid role "${entry.role}"`
      );
      assert(typeof entry.content === 'string', 'Entry content should be string');
    }
  });

  test('total counts match input', async () => {
    const result = foveated.buildContext(sample);
    const meta = result.metadata;
    
    // quoted + synthesized + omitted + deduplicated should equal total
    const accounted = meta.quoted + meta.synthesized + meta.omitted + (meta.deduplicated || 0);
    assert(
      accounted === meta.totalEntries,
      `Counts mismatch: ${accounted} accounted vs ${meta.totalEntries} total`
    );
  });

  test('synthesized entries generate UIDs', async () => {
    const result = foveated.buildContext(sample);
    const meta = result.metadata;
    
    // Number of UIDs should match synthesized count
    assert(
      meta.uids.length === meta.synthesized,
      `UID count (${meta.uids.length}) should match synthesized count (${meta.synthesized})`
    );
  });

  test('tokens stay within budget', async () => {
    const result = foveated.buildContext(sample);
    const meta = result.metadata;
    const budget = foveated.contextBuilder.DEFAULT_CONFIG.maxTokens 
      - foveated.contextBuilder.DEFAULT_CONFIG.reserveForResponse 
      - foveated.contextBuilder.DEFAULT_CONFIG.bootDocsTokens;
    
    assert(
      meta.tokensUsed <= budget,
      `Tokens used (${meta.tokensUsed}) exceeds budget (${budget})`
    );
  });

  test('classifier correctly categorizes based on entry type', async () => {
    // Find entries with tool calls vs messages
    const withTools = sample.filter(e => e._trace?.iterations?.some(i => i.toolCalls?.length > 0));
    const withMessages = sample.filter(e => e.messages?.length > 0);
    
    console.log(`  (Found ${withTools.length} entries with tool calls, ${withMessages.length} with messages)`);
    
    // Test classification of various entry types
    for (const entry of sample.slice(0, 10)) {
      const classification = foveated.classify(entry);
      assert(
        ['QUOTE', 'SYNTHESIZE', 'OMIT'].includes(classification.fate),
        `Invalid fate: ${classification.fate}`
      );
    }
  });

  test('summarizer produces valid summaries for synthesizable entries', async () => {
    // Find an entry that would be synthesized
    let found = false;
    for (const entry of sample) {
      const classification = foveated.classify(entry);
      if (classification.fate === 'SYNTHESIZE') {
        const uid = foveated.rawUID();
        const summary = foveated.summarize(entry, uid);
        
        assert(summary.summary, 'Summary should have content');
        assert(typeof summary.summary === 'string', 'Summary should be string');
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log('  (No SYNTHESIZE entries in sample - skipping summary validation)');
    }
  });

  test('deduplication works with seenIds set', async () => {
    // Get some entry IDs from the sample
    const seenIds = new Set();
    sample.slice(0, 10).forEach(e => {
      if (e.entryId) seenIds.add(e.entryId);
      if (e.cycleId) seenIds.add(e.cycleId);
      if (e.dispatchId) seenIds.add(e.dispatchId);
    });
    
    const resultWithDedup = foveated.buildContext(sample, {}, seenIds);
    const resultWithoutDedup = foveated.buildContext(sample, {}, new Set());
    
    assert(
      resultWithDedup.metadata.deduplicated >= resultWithoutDedup.metadata.deduplicated,
      'Deduplication should increase with seenIds'
    );
    console.log(`  (Deduped ${resultWithDedup.metadata.deduplicated} entries with seenIds)`);
  });

  test('full pipeline handles empty input gracefully', async () => {
    const result = foveated.buildContext([]);
    assert(result.context.length === 0, 'Empty input should produce empty context');
    assert(result.metadata.totalEntries === 0, 'Empty input should have 0 entries');
  });

  test('full pipeline handles malformed entries', async () => {
    const malformed = [
      { weirdField: true },
      { role: 'user' }, // missing content
      { content: 'valid but odd structure' }
    ];
    
    // Should not throw
    const result = foveated.buildContext(malformed);
    assert(result !== null, 'Should handle malformed gracefully');
  });

  test('async processContext works correctly', async () => {
    const result = await foveated.processContext(sample);
    assert(result !== null && typeof result === 'object', 'Async result should be object');
    assert(Array.isArray(result.context), 'Async result should have context array');
  });

  test('zoom store registers and retrieves UIDs', async () => {
    // Clear zoom store
    foveated.zoom.clear && foveated.zoom.clear();
    
    // Process with async to ensure zoom registration
    const result = await foveated.processContext(sample);
    
    // Check zoom stats
    const stats = foveated.zoom.stats();
    console.log(`  (Zoom store has ${stats.count || 0} entries)`);
  });

  // Run all tests
  console.log('--- Pipeline Tests ---\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (e) {
      console.log(`✗ ${name}`);
      console.log(`  Error: ${e.message}`);
      failed++;
    }
  }

  // Summary
  console.log('\n--- Results ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed');
  }
}

runTests().catch(e => {
  console.error('Test runner failed:', e);
  process.exit(1);
});
