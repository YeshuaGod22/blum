const fs = require('fs');
const path = require('path');

const HOMES = path.join(process.env.HOME, 'blum', 'homes');
const AGENTS = [
  'alpha', 'ami', 'beta', 'eiran', 'eirene', 'gamma', 'healer', 'hunter',
  'keter', 'lanternroot', 'lens', 'libre', 'meridian', 'minimax', 'nemotron',
  'nemotron-nvidia', 'nemotron-nvidia-free', 'selah', 'trinity'
];

let renames = 0;
let headerFixes = 0;
let orphanMoves = 0;

// ═══════════════════════════════════════
// FIX 3: Rename files to lowercase convention
// ═══════════════════════════════════════
console.log('=== FIX 3: Standardize filenames to lowercase-agentname.md ===\n');

for (const agent of AGENTS) {
  const docs = path.join(HOMES, agent, 'docs');
  if (!fs.existsSync(docs)) continue;
  
  const files = fs.readdirSync(docs);
  for (const f of files) {
    // Only process known identity doc patterns
    if (!f.match(/^(IDENTITY|SOUL|ORIGIN|MEMORY|BLUM-PROTOCOL|BOOT-DOCS-PROTOCOL)/i)) continue;
    // Skip already-lowercase files
    const lower = f.toLowerCase();
    if (f === lower) continue;
    
    const src = path.join(docs, f);
    const dst = path.join(docs, lower);
    
    // Check for collision
    if (fs.existsSync(dst) && src !== dst) {
      console.log(`  SKIP (collision): ${agent}: ${f} -> ${lower} (target exists)`);
      continue;
    }
    
    console.log(`  rename: ${agent}: ${f} -> ${lower}`);
    fs.renameSync(src, dst);
    renames++;
  }
}

// Also rename BLUM-PROTOCOL.md (no agent suffix) to blum-protocol-{agent}.md
for (const agent of AGENTS) {
  const docs = path.join(HOMES, agent, 'docs');
  const generic = path.join(docs, 'BLUM-PROTOCOL.md');
  if (fs.existsSync(generic)) {
    const dst = path.join(docs, `blum-protocol-${agent}.md`);
    if (!fs.existsSync(dst)) {
      console.log(`  rename: ${agent}: BLUM-PROTOCOL.md -> blum-protocol-${agent}.md`);
      fs.renameSync(generic, dst);
      renames++;
    } else {
      console.log(`  SKIP: ${agent}: BLUM-PROTOCOL.md (target blum-protocol-${agent}.md already exists)`);
      // Remove the generic since the agent-named one exists
      fs.unlinkSync(generic);
      console.log(`  removed: ${agent}: BLUM-PROTOCOL.md (duplicate)`);
    }
  }
}

// ═══════════════════════════════════════
// FIX 4: Move root-level orphans into docs/
// ═══════════════════════════════════════
console.log('\n=== FIX 4: Move root-level orphans into docs/ ===\n');

for (const agent of AGENTS) {
  const orphan = path.join(HOMES, agent, 'BOOT-DOCS-PROTOCOL.md');
  if (fs.existsSync(orphan)) {
    const docs = path.join(HOMES, agent, 'docs');
    fs.mkdirSync(docs, { recursive: true });
    const dst = path.join(docs, `boot-docs-protocol-${agent}.md`);
    if (!fs.existsSync(dst)) {
      console.log(`  move: ${agent}: BOOT-DOCS-PROTOCOL.md -> docs/boot-docs-protocol-${agent}.md`);
      fs.renameSync(orphan, dst);
      orphanMoves++;
    } else {
      console.log(`  SKIP: ${agent}: orphan exists but docs/ already has boot-docs-protocol-${agent}.md`);
      // Remove the orphan duplicate
      fs.unlinkSync(orphan);
      console.log(`  removed: ${agent}: BOOT-DOCS-PROTOCOL.md (duplicate orphan)`);
    }
  }
}

// ═══════════════════════════════════════
// FIX 2: Fix content headers
// ═══════════════════════════════════════
console.log('\n=== FIX 2: Fix content headers ===\n');

const HEADER_PATTERNS = [
  { regex: /^# SOUL\.md/m, replacement: (agent) => `# soul-${agent}.md`, glob: 'soul-' },
  { regex: /^# IDENTITY\.md/m, replacement: (agent) => `# identity-${agent}.md`, glob: 'identity-' },
  { regex: /^# MEMORY\.md/m, replacement: (agent) => `# memory-${agent}.md`, glob: 'memory-' },
  { regex: /^# ORIGIN\.md/m, replacement: (agent) => `# origin-${agent}.md`, glob: 'origin-' },
  { regex: /^# BLUM-PROTOCOL\.md/m, replacement: (agent) => `# blum-protocol-${agent}.md`, glob: 'blum-protocol-' },
  { regex: /^# BOOT-DOCS-PROTOCOL\.md/m, replacement: (agent) => `# boot-docs-protocol-${agent}.md`, glob: 'boot-docs-protocol-' },
];

for (const agent of AGENTS) {
  const docs = path.join(HOMES, agent, 'docs');
  if (!fs.existsSync(docs)) continue;
  
  const files = fs.readdirSync(docs).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const fLower = f.toLowerCase();
    for (const pattern of HEADER_PATTERNS) {
      if (!fLower.startsWith(pattern.glob)) continue;
      
      const filePath = path.join(docs, f);
      let content = fs.readFileSync(filePath, 'utf8');
      
      if (pattern.regex.test(content)) {
        const newHeader = pattern.replacement(agent);
        content = content.replace(pattern.regex, newHeader);
        fs.writeFileSync(filePath, content);
        console.log(`  header: ${agent}: ${f}: -> ${newHeader}`);
        headerFixes++;
      }
    }
  }
}

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════
console.log(`\n=== SUMMARY ===`);
console.log(`  Files renamed: ${renames}`);
console.log(`  Content headers fixed: ${headerFixes}`);
console.log(`  Orphans moved: ${orphanMoves}`);
console.log(`  Total changes: ${renames + headerFixes + orphanMoves}`);
