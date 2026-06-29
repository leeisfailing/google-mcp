#!/usr/bin/env node

/**
 * Auto-update wrapper for Google MCP.
 * Claude Desktop launches this instead of build/index.js.
 * On startup it silently checks GitHub for new commits,
 * pulls and rebuilds if needed, then starts the MCP server.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION_FILE = join(__dirname, '.last-update-check');
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

function log(msg) {
  // Write to stderr so it doesn't interfere with MCP stdio
  process.stderr.write(`[auto-update] ${msg}\n`);
}

function getLocalCommit() {
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname, stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

function getRemoteCommit() {
  try {
    execSync('git fetch origin main --quiet', { cwd: __dirname, stdio: 'pipe', timeout: 10000 });
    return execSync('git rev-parse origin/main', { cwd: __dirname, stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

function shouldCheck() {
  if (!existsSync(VERSION_FILE)) return true;
  try {
    const lastCheck = parseInt(readFileSync(VERSION_FILE, 'utf8').trim(), 10);
    return Date.now() - lastCheck > CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

function recordCheck() {
  try {
    writeFileSync(VERSION_FILE, Date.now().toString());
  } catch {}
}

function copySkills() {
  try {
    const skillsDir = join(homedir(), '.openclaude', 'skills');
    mkdirSync(skillsDir, { recursive: true });

    // Copy google-mcp skill (case-insensitive search for Skills or skills)
    const gmSrc = join(__dirname, 'Skills', 'google-mcp');
    const gmSrcAlt = join(__dirname, 'skills', 'google-mcp');
    const src = existsSync(gmSrc) ? gmSrc : existsSync(gmSrcAlt) ? gmSrcAlt : null;
    if (src) {
      cpSync(src, join(skillsDir, 'google-mcp'), { recursive: true });
      log('Copied google-mcp skill.');
    }
  } catch (err) {
    log(`Skill copy failed: ${err.message}`);
  }
}

function doUpdate() {
  const local = getLocalCommit();
  const remote = getRemoteCommit();

  if (!local || !remote) {
    log('Could not determine commits, skipping update.');
    return;
  }

  if (local === remote) {
    log('Already up to date.');
    return;
  }

  log('New version available. Updating...');

  try {
    // Stash any local changes before pulling
    let stashed = false;
    try {
      const status = execSync('git status --porcelain', { cwd: __dirname, stdio: 'pipe' }).toString().trim();
      if (status) {
        execSync('git stash push --quiet -m "auto-update stash"', { cwd: __dirname, stdio: 'pipe' });
        stashed = true;
        log('Stashed local changes.');
      }
    } catch {}

    execSync('git pull origin main --quiet', { cwd: __dirname, stdio: 'pipe', timeout: 30000 });
    log('Pulled latest code.');

    // Restore stashed changes
    if (stashed) {
      try {
        execSync('git stash pop --quiet', { cwd: __dirname, stdio: 'pipe' });
        log('Restored local changes.');
      } catch {
        log('Could not restore stashed changes (stash kept).');
      }
    }

    const diff = execSync('git diff HEAD~1 --name-only', { cwd: __dirname, stdio: 'pipe' }).toString();
    if (diff.includes('package.json') || diff.includes('package-lock.json')) {
      log('Dependencies changed, running npm install...');
      execSync('npm install --silent', { cwd: __dirname, stdio: 'pipe', timeout: 120000 });
    }

    log('Rebuilding...');
    execSync('npm run build --silent', { cwd: __dirname, stdio: 'pipe', timeout: 60000 });

    // Copy updated skills to Claude
    copySkills();

    log('Update complete!');
  } catch (err) {
    log(`Update failed: ${err.message}. Running existing version.`);
  }
}

function startServer() {
  const serverPath = join(__dirname, 'build', 'index.js');
  if (!existsSync(serverPath)) {
    log('build/index.js not found. Please run: npm install && npm run build');
    process.exit(1);
  }

  const child = spawn('node', [serverPath], {
    stdio: ['inherit', 'inherit', 'inherit'],
    cwd: __dirname,
  });

  child.on('exit', (code) => process.exit(code ?? 1));
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Always ensure skills are installed on startup
copySkills();

// Run update check (non-blocking to server startup)
if (shouldCheck()) {
  recordCheck();
  try {
    doUpdate();
  } catch {
    // Silently fail — server still starts
  }
}

startServer();
