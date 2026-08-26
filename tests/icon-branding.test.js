// Branding tests for the extension icon.
//
// The icon is the developer's own portrait — an established part of his
// personal brand, and one of the clearest possible signals that this is an
// independent tool rather than an official Instagram/Meta product. The
// trade-dress problem in the removed version was never the face; it was the
// pink/magenta/purple gradient behind it.
//
// So these tests must do two things at once:
//   - keep rejecting Instagram's brand colours and glyphs
//   - NOT reject the portrait merely because a photograph contains varied
//     pixels, including warm skin tones
//
// The plate and ring are therefore checked at fixed sample points, and the
// circular portrait region is deliberately exempt from colour assertions.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const ICON_DIR = path.join(REPO_ROOT, 'assets', 'icons');
const SIZES = [16, 32, 48, 128];

// Hashes of the approved icons taken at module load, BEFORE any test body runs.
// The mutation check at the bottom compares against these. `git status` is the
// wrong oracle: on this branch the icons are legitimately modified relative to
// HEAD (the portrait restore is uncommitted), so a dirty-vs-HEAD signal says
// nothing about whether the test suite touched them.
const APPROVED_AT_START = Object.fromEntries(SIZES.map(s => {
  const f = path.join(ICON_DIR, 'icon-' + s + '.png');
  return [s, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')];
}));

// Pillow is used for the pixel assertions, the same dependency the generator
// needs. If it is unavailable the pixel tests are skipped rather than silently
// passing — a skipped test is visible, a vacuous one is not.
function pillowAvailable() {
  try {
    execSync('python3 -c "import PIL"', { stdio: 'pipe' });
    return true;
  } catch (_) {
    return false;
  }
}

function probe(script) {
  const os = require('os');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sbe-icon-')), 'probe.py');
  fs.writeFileSync(f, script);
  try {
    return JSON.parse(execSync('python3 ' + JSON.stringify(f),
      { cwd: REPO_ROOT, encoding: 'utf8' }));
  } finally {
    fs.rmSync(path.dirname(f), { recursive: true, force: true });
  }
}

// Python source with comments AND docstrings removed. The generator's module
// docstring legitimately names the Instagram assets it does not draw; treating
// that prose as code would fail the very test it is explaining.
function generatorCode() {
  const raw = fs.readFileSync(path.join(REPO_ROOT, 'tools', 'make-icons.py'), 'utf8');
  return raw
    .replace(/"""[\s\S]*?"""/g, ' ')
    .replace(/'''[\s\S]*?'''/g, ' ')
    .split('\n')
    .filter(l => !l.trim().startsWith('#'))
    .map(l => l.replace(/#.*$/, ''))
    .join('\n');
}

// ---------------------------------------------------------------------------
// Files and provenance
// ---------------------------------------------------------------------------

test('all four manifest icon sizes exist and are PNG of the right dimensions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));
  for (const size of SIZES) {
    const rel = 'assets/icons/icon-' + size + '.png';
    assert.equal(manifest.icons[String(size)], rel);
    assert.equal(manifest.action.default_icon[String(size)], rel);
    const p = path.join(REPO_ROOT, 'assets', 'icons', 'icon-' + size + '.png');
    assert.ok(fs.existsSync(p), 'missing ' + rel);
    const head = fs.readFileSync(p).subarray(0, 8);
    assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      rel + ' is not a PNG');
  }
});

test('the portrait source is present and is a build input, not a shipped asset', () => {
  const src = path.join(ICON_DIR, 'portrait-source.png');
  assert.ok(fs.existsSync(src),
    'the developer portrait must be in the repository so the icons are reproducible');
  // build.sh copies only the four sizes. Comments there explain that `cp -r`
  // is deliberately avoided, so only executable lines are scanned.
  const sh = fs.readFileSync(path.join(REPO_ROOT, 'build.sh'), 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
  assert.equal(/cp -r assets\/icons/.test(sh), false,
    'copying the whole icons directory would ship the portrait and the master');
  assert.match(sh, /for size in 16 32 48 128/,
    'build.sh must copy exactly the four referenced sizes');
});

test('the generator uses the real portrait and does not synthesise a face', () => {
  const gen = generatorCode();
  assert.ok(gen.includes('portrait-source.png'),
    'the generator must composite the developer\'s own photograph');
  // No drawing primitives that would fabricate facial features.
  for (const bad of ['polygon(', 'arc(', 'pieslice(', 'ImageFont', 'text('] ) {
    assert.equal(gen.includes(bad), false,
      'generator must not draw synthetic artwork or text: ' + bad);
  }
  // No retouching of the photograph itself.
  for (const bad of ['ImageEnhance', 'ImageFilter', 'ImageOps.posterize',
                     'convert("L")', "convert('L')"]) {
    assert.equal(gen.includes(bad), false,
      'the portrait must not be cartoonised or materially altered: ' + bad);
  }
});

test('the generator declares no warm/Instagram-like colour', () => {
  const code = generatorCode();
  const tuples = [...code.matchAll(/\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*\d{1,3})?\)/g)]
    .map(m => [ +m[1], +m[2], +m[3] ]);
  for (const [r, g, b] of tuples) {
    // Instagram-ish magenta/pink: strong red and blue, weak green.
    const magenta = r > 120 && b > 90 && g < r - 40 && g < b - 20;
    // Instagram-ish orange/yellow: strong red, weak blue.
    const warm = r > 170 && b < 90;
    assert.equal(magenta, false, 'magenta-family constant in generator: ' + [r, g, b]);
    assert.equal(warm, false, 'orange/yellow constant in generator: ' + [r, g, b]);
  }
});

// ---------------------------------------------------------------------------
// Pixel assertions on the plate and ring only
// ---------------------------------------------------------------------------

test('the plate corners are neutral slate, not a warm gradient', (t) => {
  if (!pillowAvailable()) return t.skip('Pillow not installed');
  // Four corner samples per icon, just inside the rounded plate. The portrait
  // never reaches these points, so a warm reading here means a gradient
  // background has come back.
  const res = probe([
    'import json',
    'from PIL import Image',
    'out={}',
    'for s in [48,128]:',
    '    im=Image.open("assets/icons/icon-%d.png"%s).convert("RGBA")',
    '    n=im.size[0]; k=max(2,int(n*0.10))',
    '    pts=[(k,k),(n-1-k,k),(k,n-1-k),(n-1-k,n-1-k)]',
    '    out[str(s)]=[list(im.getpixel(p)) for p in pts]',
    'print(json.dumps(out))'
  ].join('\n'));
  for (const [size, pts] of Object.entries(res)) {
    for (const [r, g, b, a] of pts) {
      if (a < 32) continue;                       // rounded-corner transparency
      assert.ok(r < 90 && g < 90 && b < 110,
        'icon-' + size + ' corner is not dark slate: ' + [r, g, b]);
      // A warm cast would show red clearly above blue.
      assert.ok(r <= b + 24,
        'icon-' + size + ' corner has a warm cast (r=' + r + ', b=' + b + ')');
    }
  }
});

test('a horizontal scan of the plate contains no magenta or orange pixel', (t) => {
  if (!pillowAvailable()) return t.skip('Pillow not installed');
  // Scans the top 12% of the icon — plate and ring only, above the face.
  const res = probe([
    'import json',
    'from PIL import Image',
    'bad=[]',
    'for s in [16,32,48,128]:',
    '    im=Image.open("assets/icons/icon-%d.png"%s).convert("RGBA")',
    '    n=im.size[0]',
    '    for y in range(0, max(2,int(n*0.12))):',
    '        for x in range(n):',
    '            r,g,b,a=im.getpixel((x,y))',
    '            if a<32: continue',
    '            if r>120 and b>90 and g<r-40 and g<b-20: bad.append([s,x,y,r,g,b])',
    '            if r>170 and b<90: bad.append([s,x,y,r,g,b])',
    'print(json.dumps(bad[:12]))'
  ].join('\n'));
  assert.deepEqual(res, [],
    'magenta/orange pixels found in the plate region: ' + JSON.stringify(res));
});

test('the icon is a photograph, not a flat glyph', (t) => {
  if (!pillowAvailable()) return t.skip('Pillow not installed');
  // A generic vector glyph has very few distinct colours. A photograph has
  // many. This is what keeps a future "just use a neutral archive icon" change
  // from silently passing as if nothing had been lost.
  const res = probe([
    'import json',
    'from PIL import Image',
    'im=Image.open("assets/icons/icon-128.png").convert("RGB")',
    'n=im.size[0]; c=n//2; rad=int(n*0.30)',
    'px=[im.getpixel((x,y)) for y in range(c-rad,c+rad) for x in range(c-rad,c+rad)]',
    'print(json.dumps({"distinct": len(set(px)), "sampled": len(px)}))'
  ].join('\n'));
  assert.ok(res.distinct > 400,
    'only ' + res.distinct + ' distinct colours in the portrait region — ' +
    'this looks like a flat glyph, not the developer\'s photograph');
});

test('the portrait region is exempt from colour assertions, by design', () => {
  // Documenting the exemption as an assertion so it cannot be quietly widened
  // into "the icon may contain any colour anywhere".
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(self.includes('the circular portrait region is deliberately exempt'),
    'the rationale for exempting the portrait must stay written down');
  assert.ok(self.includes('top 12%'),
    'the colour scan must state which region it covers');
});

// ---------------------------------------------------------------------------
// No Instagram/Meta asset anywhere near the icon
// ---------------------------------------------------------------------------

test('no Instagram glyph or badge is drawn into the icon', () => {
  // The docstring names these to say they are NOT drawn, so only code counts.
  const code = generatorCode();
  for (const bad of ['camera', 'lens', 'flash', 'album', 'verified',
                     'checkmark', 'wordmark', 'createLinearGradient']) {
    assert.equal(new RegExp(bad, 'i').test(code), false,
      'generator code references ' + bad);
  }
});

test('the generator reproduces the approved icons pixel-for-pixel', (t) => {
  if (!pillowAvailable()) return t.skip('Pillow not installed');

  // WHAT THIS COMPARES, AND WHY IT IS NOT FILE BYTES
  //
  // The previous version of this test regenerated the icons in place and
  // compared encoded PNG bytes. Both halves were wrong:
  //
  //   1. It mutated the repository's APPROVED icon files as a side effect of
  //      running the test suite. The icons are a reviewed, signed-off artefact;
  //      a test must not rewrite them.
  //   2. PNG encoding is not stable across library versions. The encoder picks
  //      filtering and deflate parameters, and those choices change between
  //      Pillow/zlib releases. An independent run on Python 3.12.13 /
  //      Pillow 12.3.0 produced an icon-128.png whose SHA-256 differed from the
  //      committed file (a1360d47… vs 5dcbb236…) while the decoded RGBA pixels
  //      were bit-for-bit identical. The 16/32/48 px files encoded identically
  //      on that run — luck, not a guarantee.
  //
  // So the generator is held to PIXEL determinism, which is the property that
  // actually matters and which it does guarantee: same portrait in, same
  // decoded RGBA out, on any machine. Requiring byte-identical PNG encoding
  // across unspecified Pillow/zlib versions would fail for reasons that have
  // nothing to do with the artwork.
  //
  // The comparison is: dimensions, mode after canonical convert("RGBA"), and
  // SHA-256 of convert("RGBA").tobytes(). Generation goes to a temporary
  // directory via --output-dir, so assets/icons/ is never written.
  const res = probe([
    'import json, hashlib, os, subprocess, sys, tempfile',
    'from PIL import Image',
    '',
    'def describe(path):',
    '    with Image.open(path) as im:',
    '        rgba = im.convert("RGBA")',
    '        return {',
    '            "size": list(rgba.size),',
    '            "mode": rgba.mode,',
    '            "pixels_sha256": hashlib.sha256(rgba.tobytes()).hexdigest(),',
    '            "file_sha256": hashlib.sha256(open(path, "rb").read()).hexdigest(),',
    '        }',
    '',
    'tmp = tempfile.mkdtemp(prefix="sbe-icons-")',
    'subprocess.run([sys.executable, "tools/make-icons.py", "--output-dir", tmp],',
    '               check=True, capture_output=True)',
    'out = {"sizes": {}, "env": {',
    '    "python": sys.version.split()[0],',
    '    "pillow": __import__("PIL").__version__,',
    '}}',
    'for s in [16, 32, 48, 128]:',
    '    name = "icon-%d.png" % s',
    '    out["sizes"][str(s)] = {',
    '        "approved": describe(os.path.join("assets", "icons", name)),',
    '        "generated": describe(os.path.join(tmp, name)),',
    '    }',
    'print(json.dumps(out))'
  ].join('\n'));

  for (const size of SIZES) {
    const { approved, generated } = res.sizes[String(size)];
    const label = 'icon-' + size + '.png';

    // 1. dimensions
    assert.deepEqual(generated.size, approved.size,
      label + ': dimensions differ');
    assert.deepEqual(generated.size, [size, size],
      label + ': must be ' + size + 'x' + size);

    // 2. mode after canonical conversion
    assert.equal(generated.mode, 'RGBA', label + ': canonical mode must be RGBA');
    assert.equal(generated.mode, approved.mode, label + ': mode differs');

    // 3. decoded pixels — the assertion that matters
    assert.equal(generated.pixels_sha256, approved.pixels_sha256,
      label + ': DECODED PIXELS DIFFER from the approved icon.\n' +
      '  approved  pixels sha256: ' + approved.pixels_sha256 + '\n' +
      '  generated pixels sha256: ' + generated.pixels_sha256 + '\n' +
      'This is a real visual regression, not an encoder difference. The icon ' +
      'artwork is approved and must not change.');
  }
});

test('encoded PNG bytes are deliberately NOT asserted', () => {
  // Guard against someone "tightening" this file back into a byte comparison.
  // The rationale has to stay visible next to the thing it protects.
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(self.includes('PIXEL determinism'),
    'the pixel-vs-byte rationale must stay documented in this file');
  assert.ok(self.includes('pixels_sha256'),
    'the reproducibility test must compare decoded pixels');
  assert.equal(/before\[i\]\.equals\(after\[i\]\)/.test(self), false,
    'file-byte comparison of generated PNGs has been reintroduced');
  // And the generator must document it too, so the constraint is discoverable
  // from either end.
  const gen = fs.readFileSync(path.join(REPO_ROOT, 'tools', 'make-icons.py'), 'utf8');
  assert.ok(/not.{0,20}byte-deterministic/i.test(gen),
    'tools/make-icons.py must state that byte-identical encoding is not guaranteed');
});

test('running the suite does not mutate the approved icon files', () => {
  // The previous version of the reproducibility test wrote into assets/icons/
  // as a side effect. This asserts the new one does not: each approved file
  // must be byte-identical to what it was when this module loaded, after the
  // pixel-comparison test above has already run.
  const changed = [];
  for (const s of SIZES) {
    const f = path.join(ICON_DIR, 'icon-' + s + '.png');
    const now = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    if (now !== APPROVED_AT_START[s]) {
      changed.push('icon-' + s + '.png: ' + APPROVED_AT_START[s] + ' -> ' + now);
    }
  }
  assert.deepEqual(changed, [],
    'the test suite modified approved icon file(s):\n  ' + changed.join('\n  ') +
    '\nGeneration must go to a temporary --output-dir.');
});

test('the generator accepts --output-dir and leaves assets/icons alone', () => {
  const gen = fs.readFileSync(path.join(REPO_ROOT, 'tools', 'make-icons.py'), 'utf8');
  assert.ok(gen.includes('--output-dir'),
    'the generator must support writing elsewhere so tests need not overwrite');
  assert.ok(/args\.output_dir or OUT_DIR/.test(gen),
    'the default must remain assets/icons/ when no --output-dir is given');
});
