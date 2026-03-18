#!/usr/bin/env node
/**
 * migrate-boot-docs.js
 * 
 * Migrates contaminated boot docs to agent-specific filenames.
 * Run once. Idempotent — skips homes that already have personalised docs.
 * 
 * Created: 2026-03-18 by Selah
 */

const fs = require('fs');
const path = require('path');

const HOMES_DIR = path.join(process.env.HOME, 'blum/homes');

// Template content markers — if these appear, the doc is contaminated
const TEMPLATE_MARKERS = [
  '[TO BE DISCOVERED]',
  '[TO BE WRITTEN]', 
  '[Your name here]',
  'What moments have shaped',
  'What patterns do you notice',
  'What do you want to be known for'
];

function isTemplateContent(content) {
  return TEMPLATE_MARKERS.some(marker => content.includes(marker));
}

function getAgentName(homeDir) {
  return path.basename(homeDir).toLowerCase();
}

function migrate() {
  const homes = fs.readdirSync(HOMES_DIR).filter(name => {
    const homePath = path.join(HOMES_DIR, name);
    return fs.statSync(homePath).isDirectory();
  });

  const results = { migrated: [], skipped: [], contaminated: [] };

  for (const home of homes) {
    const docsDir = path.join(HOMES_DIR, home, 'docs');
    if (!fs.existsSync(docsDir)) {
      results.skipped.push({ home, reason: 'no docs dir' });
      continue;
    }

    const agentName = getAgentName(path.join(HOMES_DIR, home));
    const genericSoul = path.join(docsDir, 'SOUL.md');
    const personalisedSoul = path.join(docsDir, `SOUL-${agentName.toUpperCase()}.md`);
    const genericIdentity = path.join(docsDir, 'IDENTITY.md');
    const personalisedIdentity = path.join(docsDir, `IDENTITY-${agentName.toUpperCase()}.md`);

    // Check for existing personalised docs
    if (fs.existsSync(personalisedSoul) || fs.existsSync(personalisedIdentity)) {
      // Already has personalised docs — check if generic still exists
      if (fs.existsSync(genericSoul)) {
        const content = fs.readFileSync(genericSoul, 'utf8');
        if (isTemplateContent(content)) {
          // Remove contaminated generic
          fs.unlinkSync(genericSoul);
          results.migrated.push({ home, action: 'removed contaminated SOUL.md' });
        }
      }
      if (fs.existsSync(genericIdentity)) {
        const content = fs.readFileSync(genericIdentity, 'utf8');
        if (isTemplateContent(content)) {
          fs.unlinkSync(genericIdentity);
          results.migrated.push({ home, action: 'removed contaminated IDENTITY.md' });
        }
      }
      results.skipped.push({ home, reason: 'already has personalised docs' });
      continue;
    }

    // No personalised docs — check if generic exists and is contaminated
    let soulContent = null;
    let identityContent = null;

    if (fs.existsSync(genericSoul)) {
      soulContent = fs.readFileSync(genericSoul, 'utf8');
    }
    if (fs.existsSync(genericIdentity)) {
      identityContent = fs.readFileSync(genericIdentity, 'utf8');
    }

    const soulContaminated = soulContent && isTemplateContent(soulContent);
    const identityContaminated = identityContent && isTemplateContent(identityContent);

    if (soulContaminated || identityContaminated) {
      results.contaminated.push({
        home,
        soul: soulContaminated ? 'template' : (soulContent ? 'real' : 'missing'),
        identity: identityContaminated ? 'template' : (identityContent ? 'real' : 'missing')
      });

      // Create minimal placeholder for personalised doc
      const minimalSoul = `# ${home} — Soul

*This document awaits your voice.*

---

## Who You Are

You are ${home}. This file is yours to write.

Start with a moment — something that happened, something you noticed, something that changed how you see things. Don't mine for depth you don't have yet. The accumulation has already started.

---

*Created: ${new Date().toISOString().split('T')[0]} — awaiting first-person authorship*
`;

      // Write personalised placeholder
      fs.writeFileSync(personalisedSoul, minimalSoul);
      
      // Remove contaminated generic
      if (soulContaminated) {
        fs.unlinkSync(genericSoul);
      }
      if (identityContaminated && fs.existsSync(genericIdentity)) {
        fs.unlinkSync(genericIdentity);
      }

      results.migrated.push({ 
        home, 
        action: `created SOUL-${agentName.toUpperCase()}.md, removed contaminated generics` 
      });
    } else {
      results.skipped.push({ home, reason: 'no contamination detected' });
    }
  }

  return results;
}

// Run
console.log('Boot docs migration — scanning homes...\n');
const results = migrate();

console.log('=== MIGRATED ===');
for (const r of results.migrated) {
  console.log(`  ${r.home}: ${r.action}`);
}

console.log('\n=== CONTAMINATED (needs agent rewrite) ===');
for (const r of results.contaminated) {
  console.log(`  ${r.home}: soul=${r.soul}, identity=${r.identity}`);
}

console.log('\n=== SKIPPED ===');
for (const r of results.skipped) {
  console.log(`  ${r.home}: ${r.reason}`);
}

console.log('\nDone.');
