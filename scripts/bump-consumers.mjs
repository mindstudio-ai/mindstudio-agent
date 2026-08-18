#!/usr/bin/env node
/**
 * bump-consumers — post-release chore automation.
 *
 * After publishing @mindstudio-ai/agent, bumps the dependency in the
 * downstream repos:
 *
 *   1. ../mindstudio-sandbox (package.json + package-lock.json)
 *        → new branch off origin/main in a temp worktree, push, open PR
 *   2. ../youai-custom-function-execution-service (worker/package.json + lock)
 *        → same PR flow (different org, still works — plain git + gh)
 *   3. ../mindstudio-sandbox/empty-mindstudio-app (dist/methods/package.json)
 *        → separate repo (empty-mindstudio-app-scaffold), gitignored by the
 *          sandbox repo. Bumped in place and pushed directly to main,
 *          matching the existing "bump" commit history. npm install runs so
 *          the local node_modules stays in sync too.
 *
 * After pushing each branch, opens the prefilled GitHub compare page in the
 * browser — one click to create the PR.
 *
 * Usage:
 *   npm run bump-consumers              # bump to latest published version
 *   npm run bump-consumers -- 0.1.91    # bump to a specific version
 *   npm run bump-consumers -- --dry-run # show what would happen
 */

import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = '@mindstudio-ai/agent';
const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsRoot = path.resolve(agentRoot, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const versionArg = args.find((a) => !a.startsWith('-'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim();
}

function displayPath(p) {
  const rel = path.relative(projectsRoot, p);
  return rel.startsWith('..') ? p : rel;
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}${opts.cwd ? `  (in ${displayPath(opts.cwd)})` : ''}`);
  if (dryRun) return '';
  return sh(cmd, opts);
}

/** Rewrite the dependency version in-place, preserving file formatting. */
function bumpDep(pkgJsonPath, version, { srcOverride } = {}) {
  const src = srcOverride ?? fs.readFileSync(pkgJsonPath, 'utf-8');
  const re = new RegExp(`("${PKG.replace('/', '\\/')}"\\s*:\\s*")[^"]+(")`);
  if (!re.test(src)) {
    throw new Error(`${PKG} not found in ${pkgJsonPath}`);
  }
  const current = src.match(re)[0].split(':')[1].replace(/["\s]/g, '');
  const next = `^${version}`;
  if (current === next) return false;
  if (!dryRun) fs.writeFileSync(pkgJsonPath, src.replace(re, `$1${next}$2`));
  console.log(`  ${path.relative(projectsRoot, pkgJsonPath)}: ${current} → ${next}`);
  return true;
}

function openUrl(url) {
  console.log(`  Opening ${url}`);
  if (!dryRun) execFileSync('open', [url], { stdio: 'ignore' });
}

// ---------------------------------------------------------------------------
// Resolve target version
// ---------------------------------------------------------------------------

const version = versionArg || sh(`npm view ${PKG} version`);
if (versionArg) {
  // Verify the requested version actually exists on the registry
  try {
    sh(`npm view ${PKG}@${versionArg} version`);
  } catch {
    console.error(`✖ ${PKG}@${versionArg} is not published to npm`);
    process.exit(1);
  }
}
console.log(`\nBumping consumers of ${PKG} to ${version}${dryRun ? ' (dry run)' : ''}\n`);

const results = [];

// ---------------------------------------------------------------------------
// PR flow — branch off origin/main in a temp worktree, never touching the
// user's working checkout (which may be on a feature branch / dirty).
// ---------------------------------------------------------------------------

function bumpViaPr({ name, repoDir, pkgJsonRel, npmDirRel, githubRepo }) {
  console.log(`\n── ${name} ──`);
  const branch = `bump/agent-v${version}`;
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-agent-'));

  try {
    run('git fetch origin main', { cwd: repoDir });
    // -B: reuse/reset the branch if a previous run left it behind
    run(`git worktree add -B ${branch} ${worktree} origin/main`, { cwd: repoDir });

    // In dry runs the worktree isn't created — read the file straight from
    // origin/main so the preview reflects what the PR would actually change.
    const changed = dryRun
      ? bumpDep(path.join(repoDir, pkgJsonRel), version, {
          srcOverride: sh(`git show origin/main:${pkgJsonRel}`, { cwd: repoDir }),
        })
      : bumpDep(path.join(worktree, pkgJsonRel), version);
    if (!changed) {
      console.log(`  Already at ^${version} on origin/main — skipping.`);
      results.push({ name, status: 'already up to date' });
      return;
    }

    console.log('  Updating lockfile…');
    run('npm install --package-lock-only --ignore-scripts', {
      cwd: path.join(worktree, npmDirRel),
    });

    const title = `Bump ${PKG} to ${version}`;
    run(`git add -A && git commit -m ${JSON.stringify(title)}`, {
      cwd: worktree,
      shell: '/bin/zsh',
    });
    run(`git push -u origin ${branch} --force`, { cwd: worktree });

    const url = `https://github.com/${githubRepo}/compare/main...${encodeURIComponent(branch)}?expand=1`;
    openUrl(url);
    results.push({ name, status: `branch pushed — finish PR at ${url}` });
  } finally {
    if (!dryRun) {
      try {
        sh(`git worktree remove --force ${worktree}`, { cwd: repoDir });
        sh(`git branch -D ${branch}`, { cwd: repoDir });
      } catch {
        /* best effort cleanup */
      }
    }
    fs.rmSync(worktree, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Scaffold flow — the local clone at mindstudio-sandbox/empty-mindstudio-app
// is the working copy for empty-mindstudio-app-scaffold. Bumps go straight
// to main (matching existing history), and npm install keeps the local
// node_modules current for sandbox dev.
// ---------------------------------------------------------------------------

function bumpScaffold({ name, repoDir, methodsDirRel }) {
  console.log(`\n── ${name} ──`);
  const currentBranch = sh('git branch --show-current', { cwd: repoDir });
  const dirty = sh('git status --porcelain', { cwd: repoDir });
  if (currentBranch !== 'main' || dirty) {
    console.log(
      `  ⚠ Skipping: expected a clean checkout on main ` +
        `(on '${currentBranch}'${dirty ? ', dirty' : ''}). Bump manually.`,
    );
    results.push({ name, status: 'SKIPPED — checkout not clean/on main' });
    return;
  }

  run('git pull --ff-only origin main', { cwd: repoDir });

  const changed = bumpDep(
    path.join(repoDir, methodsDirRel, 'package.json'),
    version,
  );
  if (!changed) {
    console.log(`  Already at ^${version} — skipping.`);
    results.push({ name, status: 'already up to date' });
    return;
  }

  console.log('  Installing (updates lockfile + local node_modules)…');
  run('npm install', { cwd: path.join(repoDir, methodsDirRel) });

  const title = `Bump ${PKG} to ${version}`;
  run(`git add -A && git commit -m ${JSON.stringify(title)}`, {
    cwd: repoDir,
    shell: '/bin/zsh',
  });
  run('git push origin main', { cwd: repoDir });
  results.push({ name, status: 'committed + pushed to main' });
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

bumpViaPr({
  name: 'mindstudio-sandbox',
  repoDir: path.join(projectsRoot, 'mindstudio-sandbox'),
  pkgJsonRel: 'package.json',
  npmDirRel: '.',
  githubRepo: 'mindstudio-ai/mindstudio-sandbox',
});

bumpViaPr({
  name: 'youai-custom-function-execution-service',
  repoDir: path.join(projectsRoot, 'youai-custom-function-execution-service'),
  pkgJsonRel: 'worker/package.json',
  npmDirRel: 'worker',
  githubRepo: 'youai1/youai-custom-function-execution-service',
});

bumpScaffold({
  name: 'empty-mindstudio-app-scaffold',
  repoDir: path.join(projectsRoot, 'mindstudio-sandbox', 'empty-mindstudio-app'),
  methodsDirRel: 'dist/methods',
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n──────── Summary ────────');
for (const r of results) {
  console.log(`  ${r.name}: ${r.status}`);
}
console.log('');
