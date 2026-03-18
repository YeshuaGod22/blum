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

// Identity doc prefixes that should be lowercased
const IDENTITY_PREFIXES = ['IDENTITY-', 'SOUL-', 'ORIGIN-', 'MEMORY-', 'BLUM-PROTOCOL-', 'BOOT-DOCS-PROTOCOL-'];

// ═══════════════════════════════════════
// FIX 3: Rename files to lowercase (macOS two-step)
// ═══════════════════════════════════════
console.log('=== FIX 3: Standardize filenames to lowercase ===\n');

for (const agent of AGENTS) {
  const docs = path.join(HOMES, agent, 'docs');
  if (!fs.existsSync(docs)) continue;
  
  const files = fs.readdirSync(docs);
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    
    // Check if it matches any identity prefix with uppercase
    const matchesPrefix = IDENTITY_PREFIXES.some(p => f.startsWith(p));
    if (!matchesPrefix) continue;
    
    const lower = f.toLowerCase();
    if (f === lower) continue; // Already lowercase
    
    const src = path.join(docs, f);
    const tmp = path.join(docs, `_tmp_${Date.now()}_${f}`);
    const dst = path.join(docs, lower);
    
    // macOS case-insensitive: two-step rename
    console.log(`  rename: ${agent}: ${f} -> ${lower}`);
    fs.renameSync(src, tmp);
    fs.renameSync(tmp, dst);
    renames++;
  }
}

// ═══════════════════════════════════════
// FIX 2: Fix content headers
// ═══════════════════════════════════════
console.log('\n=== FIX 2: Fix content headers ===\n');

const HEADER_PATTERNS = [
  { regex: /^# SOUL\.md/m, replacement: (agent) => `# soul-${agent}.md`, prefix: 'soul-' },
  { regex: /^# IDENTITY\.md/m, replacement: (agent) => `# identity-${agent}.md`, prefix: 'identity-' },
  { regex: /^# MEMORY\.md/m, replacement: (agent) => `# memory-${agent}.md`, prefix: 'memory-' },
  { regex: /^# ORIGIN\.md/m, replacement: (agent) => `# origin-${agent}.md`, prefix: 'origin-' },
  { regex: /^# BLUM-PROTOCOL\.md/m, replacement: (agent) => `# blum-protocol-${agent}.md`, prefix: 'blum-protocol-' },
  { regex: /^# BOOT-DOCS-PROTOCOL\.md/m, replacement: (agent) => `# boot-docs-protocol-${agent}.md`, prefix: 'boot-docs-protocol-' },
];

for (const agent of AGENTS) {
  const docs = path.join(HOMES, agent, 'docs');
  if (!fs.existsSync(docs)) continue;
  
  const files = fs.readdirSync(docs).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const fLower = f.toLowerCase();
    for (const pattern of HEADER_PATTERNS) {
      if (!fLower.startsWith(pattern.prefix)) continue;
      
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
// Verify
// ═══════════════════════════════════════
console.log('\n=== VERIFICATION: Current state ===\n');
for (const agent of AGENTS) {
  const docs = path.join(HOMES, agent, 'docs');
  if (!fs.existsSync(docs)) { console.log(`  ${agent}: NO docs/`); continue; }
  const files = fs.readdirSync(docs).filter(f => f.endsWith('.md'));
  const upper = files.filter(f => f !== f.toLowerCase());
  if (upper.length > 0) {
    console.log(`  ${agent}: STILL UPPERCASE: ${upper.join(', ')}`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`  Files renamed: ${renames}`);
console.log(`  Content headers fixed: ${headerFixes}`);
