#!/usr/bin/env node

const { execFileSync, spawnSync } = require('child_process');

const SECRET_PATTERNS = [
  { name: 'Anthropic key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'OpenRouter key', regex: /sk-or-v1-[A-Za-z0-9]{20,}/g },
  { name: 'Generic sk- key', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'NVIDIA key', regex: /nvapi-[A-Za-z0-9_-]{20,}/g },
];

function runGit(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options });
}

function scanText(label, text) {
  const findings = [];
  for (const pattern of SECRET_PATTERNS) {
    const matches = text.match(pattern.regex) || [];
    for (const match of matches) {
      findings.push({ label, type: pattern.name, sample: match.slice(0, 12) + '...' });
    }
  }
  return findings;
}

function scanStaged() {
  const files = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).trim().split('\n').filter(Boolean);
  const findings = [];
  for (const file of files) {
    let content = '';
    try {
      content = runGit(['show', `:${file}`]);
    } catch {
      continue;
    }
    findings.push(...scanText(file, content));
  }
  return findings;
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

function scanPrePushLines(stdinText) {
  const findings = [];
  const lines = stdinText.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
    if (!localSha || /^0+$/.test(localSha)) continue;
    const range = (!remoteSha || /^0+$/.test(remoteSha)) ? localSha : `${remoteSha}..${localSha}`;
    const revList = spawnSync('git', ['rev-list', range], { encoding: 'utf8' });
    if (revList.status !== 0) continue;
    const commits = revList.stdout.trim().split('\n').filter(Boolean);
    for (const commit of commits) {
      const lsTree = spawnSync('git', ['ls-tree', '-r', '--name-only', commit], { encoding: 'utf8' });
      if (lsTree.status !== 0) continue;
      const files = lsTree.stdout.trim().split('\n').filter(Boolean);
      for (const file of files) {
        const show = spawnSync('git', ['show', `${commit}:${file}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        if (show.status !== 0) continue;
        findings.push(...scanText(`${localRef} ${commit.slice(0, 12)}:${file}`, show.stdout));
      }
    }
  }
  return findings;
}

function printFindings(findings) {
  if (findings.length === 0) return;
  console.error('Secret scan failed. Remove live credentials before committing/pushing:');
  for (const finding of findings) {
    console.error(`- ${finding.label}: ${finding.type} (${finding.sample})`);
  }
}

async function main() {
  const mode = process.argv[2];
  let findings = [];
  if (mode === '--staged') {
    findings = scanStaged();
  } else if (mode === '--pre-push') {
    findings = scanPrePushLines(await readStdin());
  } else {
    console.error('Usage: node scripts/secret-scan.js --staged|--pre-push');
    process.exit(2);
  }

  printFindings(findings);
  process.exit(findings.length ? 1 : 0);
}

main().catch(error => {
  console.error(error.message || String(error));
  process.exit(2);
});
