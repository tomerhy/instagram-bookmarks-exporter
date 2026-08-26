// Regression test for clean-directory reproducible builds.
//
// WHY THIS FILE EXISTS: 4.4.2 claimed a reproducible build on the strength of
// three consecutive builds in the SAME working directory. That is not evidence.
// An independent reviewer building the shipped source snapshot in their own
// directory got a different ZIP hash, with byte-identical extracted contents.
//
// Cause: `zip -r ./*` walks directories in FILESYSTEM order. LC_ALL=C sorts the
// shell glob, which fixes only the top-level argument order — the recursive
// descent into assets/icons/ and lib/ still emitted entries in whatever order
// the filesystem returned. Same files, different byte layout, different hash.
//
// The fix feeds zip an explicitly sorted file list. These tests build in two
// genuinely separate clean directories, populated in DIFFERENT insertion orders
// so their filesystem directory entries differ, and require identical hashes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// Everything build.sh copies, plus build.sh itself.
const TOP_LEVEL = [
  'manifest.json', 'background.js', 'content.js', 'capture-hook.js',
  'url-allowlist.js', 'library-sanitize.js', 'legacy-cleanup.js',
  'popup.html', 'popup.js', 'gallery.html', 'gallery.js', 'tokens.css',
  'privacy-policy.html', 'build.sh'
];
const ICONS = ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png'];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function manifestVersion() {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8')).version;
}

function zipName() {
  return 'saved-posts-library-export-' + manifestVersion() + '.zip';
}

/**
 * Populate a clean directory. `order` controls the sequence in which files are
 * created, which is what determines the on-disk directory entry order — the
 * variable that broke reproducibility.
 */
function populate(dir, order) {
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets', 'icons'), { recursive: true });

  const top = order === 'forward' ? TOP_LEVEL : TOP_LEVEL.slice().reverse();
  for (const f of top) {
    fs.copyFileSync(path.join(REPO_ROOT, f), path.join(dir, f));
  }
  const icons = order === 'forward' ? ICONS : ICONS.slice().reverse();
  for (const f of icons) {
    fs.copyFileSync(path.join(REPO_ROOT, 'assets', 'icons', f),
                    path.join(dir, 'assets', 'icons', f));
  }
  fs.copyFileSync(path.join(REPO_ROOT, 'lib', 'jszip.min.js'),
                  path.join(dir, 'lib', 'jszip.min.js'));
  fs.chmodSync(path.join(dir, 'build.sh'), 0o755);
}

function buildIn(dir) {
  execSync('./build.sh', { cwd: dir, stdio: 'pipe' });
  return path.join(dir, zipName());
}

function listEntries(zip) {
  return execSync(`unzip -Z1 "${zip}"`, { encoding: 'utf8' })
    .split('\n').map(l => l.trim()).filter(Boolean);
}

function tmpdir(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sbe-repro-' + tag + '-'));
}

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

test('two independent clean directories produce byte-identical ZIPs', () => {
  const a = tmpdir('a');
  const b = tmpdir('b');
  try {
    // Deliberately different insertion orders.
    populate(a, 'forward');
    populate(b, 'reverse');

    const zipA = buildIn(a);
    const zipB = buildIn(b);
    const hashA = sha256(zipA);
    const hashB = sha256(zipB);

    assert.equal(hashA, hashB,
      'ZIP hashes differ between clean directories:\n' +
      '  ' + hashA + '  (files created in forward order)\n' +
      '  ' + hashB + '  (files created in reverse order)\n' +
      'This is the 4.4.2 defect: entry order followed the filesystem.');
  } finally {
    rmrf(a); rmrf(b);
  }
});

test('the two ZIPs extract to identical paths and identical bytes', () => {
  const a = tmpdir('xa');
  const b = tmpdir('xb');
  try {
    populate(a, 'forward');
    populate(b, 'reverse');
    const zipA = buildIn(a);
    const zipB = buildIn(b);

    const outA = path.join(a, 'x');
    const outB = path.join(b, 'x');
    execSync(`unzip -q "${zipA}" -d "${outA}"`);
    execSync(`unzip -q "${zipB}" -d "${outB}"`);

    // diff -qr exits non-zero on any difference.
    execSync(`diff -qr "${outA}" "${outB}"`, { stdio: 'pipe' });

    // And prove it at the byte level, path by path.
    const walk = (root) => {
      const out = [];
      const rec = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => x.name < y.name ? -1 : 1)) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) rec(p);
          else out.push([path.relative(root, p), sha256(p)]);
        }
      };
      rec(root);
      return out;
    };
    assert.deepEqual(walk(outA), walk(outB));
  } finally {
    rmrf(a); rmrf(b);
  }
});

test('entry order is byte-sorted and carries no directory entries', () => {
  // This is the property that makes the hash filesystem-independent. Asserting
  // it directly means a future change to build.sh that reintroduces `zip -r`
  // fails here with a clear reason, not just a hash mismatch somewhere else.
  const d = tmpdir('order');
  try {
    populate(d, 'reverse');
    const entries = listEntries(buildIn(d));

    const sorted = entries.slice().sort();
    assert.deepEqual(entries, sorted,
      'entries are not byte-sorted; zip is still following traversal order');

    const dirs = entries.filter(e => e.endsWith('/'));
    assert.deepEqual(dirs, [],
      'directory entries are order-dependent bytes and must be omitted');

    assert.ok(entries.includes('manifest.json'));
    assert.ok(entries.includes('assets/icons/icon-16.png'));
    assert.ok(entries.includes('lib/jszip.min.js'));
  } finally {
    rmrf(d);
  }
});

test('a build in a clean directory matches the repository artifact', () => {
  // The end-to-end claim: the source alone, with no .git and no node_modules,
  // reproduces the exact artifact that ships.
  const repoZip = path.join(REPO_ROOT, zipName());
  if (!fs.existsSync(repoZip)) return;   // no build in this tree yet

  const d = tmpdir('vs-repo');
  try {
    populate(d, 'forward');
    assert.equal(sha256(buildIn(d)), sha256(repoZip),
      'a clean-directory build must reproduce the repository artifact exactly');
  } finally {
    rmrf(d);
  }
});

test('build.sh does not use the order-dependent recursive form', () => {
  // Comments deliberately mention `zip -r` to explain what must NOT be used,
  // so only executable lines are scanned.
  const sh = fs.readFileSync(path.join(REPO_ROOT, 'build.sh'), 'utf8')
    .split('\n')
    .filter(l => !l.trim().startsWith('#'))
    .join('\n');
  assert.equal(/zip\s+-r\b/.test(sh), false,
    "`zip -r` walks the filesystem in directory order; use a sorted -@ list");
  assert.ok(/-@/.test(sh), 'zip must read an explicit file list from stdin');
  assert.ok(/LC_ALL=C sort/.test(sh), 'the list must be byte-sorted');
  assert.ok(/-type f/.test(sh), 'directory entries must be excluded');
  assert.ok(/touch -t/.test(sh), 'timestamps must still be normalised');
  assert.ok(/zip -X|-X -q|-X\b/.test(sh), '-X must still drop extra fields');
});
