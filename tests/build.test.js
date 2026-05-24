// Shell-level test: runs ./build.sh in an isolated temp dir, then verifies
// every file referenced by manifest.json or by popup.html / gallery.html
// <script>+<link> tags is present in the produced zip. Guards against the
// regression that motivated tech-debt #4.
//
// Runs the full build by copying the source tree to /tmp first so we never
// touch the developer's working dist/ or zip artifact.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// File globs we copy into the staging dir. Mirror of `git ls-files` — keeps
// the build test self-contained without a git dependency.
const SOURCE_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'content-styles.css',
  'injector.js',
  'autoplay.js',
  'analytics.js',
  'popup.html',
  'popup.js',
  'gallery.html',
  'gallery.js',
  'tokens.css',
  'build.sh',
  'privacy-policy.html'
];

// Files that the manifest + HTML references but are not duplicated above.
// Used to assert presence inside the zip.
const REQUIRED_IN_ZIP = [
  'manifest.json',
  'background.js',
  'content.js',
  'content-styles.css',  // listed in manifest content_scripts.css
  'injector.js',         // listed in manifest content_scripts.js (MAIN world)
  'autoplay.js',         // listed in manifest content_scripts.js (isolated world)
  'analytics.js',        // <script> in popup.html and gallery.html
  'popup.html',
  'popup.js',
  'gallery.html',
  'gallery.js',
  'tokens.css',          // shared design tokens linked from popup + gallery
  'lib/jszip.min.js',    // <script> in gallery.html — per-album ZIP feature
  'assets/icons/icon-16.png',
  'assets/icons/icon-32.png',
  'assets/icons/icon-48.png',
  'assets/icons/icon-128.png'
];

function stage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'igexporter-build-'));
  for (const f of SOURCE_FILES) {
    const src = path.join(REPO_ROOT, f);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(dir, f));
  }
  // assets/ is a directory tree
  const assetsSrc = path.join(REPO_ROOT, 'assets');
  const assetsDst = path.join(dir, 'assets');
  copyDir(assetsSrc, assetsDst);
  // lib/ holds bundled third-party scripts (JSZip)
  copyDir(path.join(REPO_ROOT, 'lib'), path.join(dir, 'lib'));
  // Make build.sh executable in the staged copy
  fs.chmodSync(path.join(dir, 'build.sh'), 0o755);
  return dir;
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

test('build.sh: produces a zip', () => {
  const dir = stage();
  try {
    execSync('./build.sh', { cwd: dir, stdio: 'pipe' });
    const zipPath = path.join(dir, 'instagram-saved-media-exporter.zip');
    assert.ok(fs.existsSync(zipPath), 'expected zip at ' + zipPath);
    assert.ok(fs.statSync(zipPath).size > 1000, 'zip should be more than 1KB');
  } finally {
    rmrf(dir);
  }
});

test('build.sh: zip contains every file referenced by manifest + HTML', () => {
  const dir = stage();
  try {
    execSync('./build.sh', { cwd: dir, stdio: 'pipe' });
    const zipPath = path.join(dir, 'instagram-saved-media-exporter.zip');
    const listing = execSync(`unzip -Z1 "${zipPath}"`, { encoding: 'utf8' });
    const filesInZip = new Set(listing.split('\n').map(l => l.trim()).filter(Boolean));

    const missing = REQUIRED_IN_ZIP.filter(f => !filesInZip.has(f));
    assert.equal(
      missing.length, 0,
      'zip is missing required files:\n  ' + missing.join('\n  ') +
      '\n\nfiles present:\n  ' + Array.from(filesInZip).sort().join('\n  ')
    );
  } finally {
    rmrf(dir);
  }
});

test('build.sh: zip does NOT include developer artifacts', () => {
  // Catch the case where someone adds .DS_Store / .venv / .git / *.zip to the
  // copied set by mistake.
  const dir = stage();
  try {
    execSync('./build.sh', { cwd: dir, stdio: 'pipe' });
    const zipPath = path.join(dir, 'instagram-saved-media-exporter.zip');
    const listing = execSync(`unzip -Z1 "${zipPath}"`, { encoding: 'utf8' });
    const files = listing.split('\n').map(l => l.trim()).filter(Boolean);
    const banned = files.filter(f =>
      f === '.DS_Store' || f.startsWith('.git/') || f.startsWith('.venv/') ||
      f.startsWith('node_modules/') || f.startsWith('tests/') ||
      f.startsWith('.claude/') || f.endsWith('.zip')
    );
    assert.equal(banned.length, 0, 'zip contains files it should not: ' + banned.join(', '));
  } finally {
    rmrf(dir);
  }
});

test('manifest.json: every script referenced exists on disk', () => {
  // Static lint — independent of build.sh. If the manifest references a file
  // that isn't in the repo, no amount of build.sh fixing will save us.
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));
  const referenced = [];
  for (const cs of manifest.content_scripts || []) {
    for (const j of cs.js || []) referenced.push(j);
    for (const c of cs.css || []) referenced.push(c);
  }
  if (manifest.background?.service_worker) {
    referenced.push(manifest.background.service_worker);
  }
  if (manifest.action?.default_popup) {
    referenced.push(manifest.action.default_popup);
  }
  for (const icon of Object.values(manifest.icons || {})) referenced.push(icon);

  const missing = referenced.filter(f => !fs.existsSync(path.join(REPO_ROOT, f)));
  assert.equal(missing.length, 0, 'manifest references missing files: ' + missing.join(', '));
});
