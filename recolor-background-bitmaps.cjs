'use strict';
// Application resource palette conversion. No mail files, PNG icons, or executable code changes.
// Usage: node recolor-background-bitmaps.cjs input.exe output.exe
// Undo:  node recolor-background-bitmaps.cjs --restore patched.exe output.bitmap-undo.json restored.exe
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { readResources } = require('./pe-resource-utils.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const allowed = new Set([
  'SKIN_FORM_TABWINDOWBKG_BMP', 'SKIN_FORM_WINDOW_BKG_BMP',
  'SKIN_FORM_WINDOW_BKG_UNFOCUS_BMP', 'SKIN_OTHER_PLUG_IN_BAR_BMP',
  'SKIN_OTHER_TOOLBAR_BMP', 'PLUG-IN-BAR_BMP', 'TOOLBAR_BMP', 'WINDOWBKG_BMP', 'WINDOWBKG_UNFOCUS_BMP'
]);
if (process.argv[2] === '--restore') {
  const [, , , source, undoFile, dest] = process.argv;
  if (!source || !undoFile || !dest || path.resolve(source) === path.resolve(dest)) throw new Error('Restore requires distinct input/output files');
  const b = fs.readFileSync(source), undo = JSON.parse(fs.readFileSync(undoFile, 'utf8'));
  if (sha(b) !== undo.outputSHA256) throw new Error('Patched image changed; refusing restore');
  for (const r of undo.changedRanges) Buffer.from(r.originalBase64, 'base64').copy(b, r.offset);
  if (sha(b) !== undo.inputSHA256) throw new Error('Restore verification failed');
  fs.writeFileSync(dest, b); console.log('Restored byte-for-byte original input: ' + dest); process.exit(0);
}
const [, , source, dest] = process.argv;
if (!source || !dest || path.resolve(source) === path.resolve(dest)) throw new Error('Supply distinct input and output paths');
const before = fs.readFileSync(source), b = Buffer.from(before), { resources, op } = readResources(b);
const changedRanges = [], report = [];
function recolor(r, g, blue) {
  // Preserve the magenta transparency key, saturated non-blue accents, dark outline pixels.
  if (r >= 200 && blue >= 200 && g < 110) return null;
  const low = Math.min(r, g, blue), high = Math.max(r, g, blue);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * blue;
  const neutral = high - low <= 55 && low >= 75;
  const blueBackground = blue >= g && g >= r && blue - r <= 135 && r >= 35 && lum >= 65;
  if (!neutral && !blueBackground) return null;
  // Restrained gradient around #262b32, preserving the original nine-slice shapes.
  const delta = Math.max(-4, Math.min(5, Math.round((lum - 170) / 18)));
  return [40 + delta, 40 + delta, 40 + delta];
}
for (const resource of resources.filter(r => r.type === 2 && allowed.has(r.name))) {
  const start = resource.offset, dib = b.subarray(start, start + resource.size);
  const header = dib.readUInt32LE(0), width = dib.readInt32LE(4), height = Math.abs(dib.readInt32LE(8));
  const bits = dib.readUInt16LE(14), compression = dib.readUInt32LE(16);
  if (header !== 40 || compression !== 0 || ![8,24,32].includes(bits) || width <= 0 || height <= 0) throw new Error('Unsupported DIB: ' + resource.name);
  const paletteCount = bits === 8 ? (dib.readUInt32LE(32) || 256) : 0;
  const pixelOffset = header + paletteCount * 4, stride = Math.ceil(width * bits / 32) * 4;
  if (pixelOffset + stride * height > dib.length) throw new Error('DIB pixel bounds invalid: ' + resource.name);
  const original = Buffer.from(dib), used = new Map(), pixelChanges = new Set();
  let pixelsChanged = 0, keyPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = bits === 8 ? header + dib[pixelOffset + y * stride + x] * 4 : pixelOffset + y * stride + x * bits / 8;
    used.set(p, (used.get(p) || 0) + 1);
  }
  for (const [p, count] of used) {
    const blue = original[p], g = original[p + 1], r = original[p + 2];
    if (r >= 200 && blue >= 200 && g < 110) keyPixels += count;
    const c = recolor(r, g, blue); if (!c) continue;
    dib[p] = c[2]; dib[p + 1] = c[1]; dib[p + 2] = c[0];
    pixelChanges.add(p); pixelsChanged += count;
  }
  if (pixelsChanged) changedRanges.push({ offset: start, name: resource.name, lang: resource.lang, originalBase64: original.toString('base64') });
  let remainingCandidates = 0;
  for (const [p, count] of used) if (recolor(dib[p + 2], dib[p + 1], dib[p])) remainingCandidates += count;
  report.push({ name: resource.name, lang: resource.lang, width, height, bits, pixelsChanged, totalPixels: width * height, transparencyKeyPixelsPreserved: keyPixels, remainingCandidates, resourceBytes: resource.size });
}
if (!report.length) throw new Error('No allowlisted background resources found');
for (const [offset, size] of [[op + 64,4],[op + 128,8]]) {
  const original = Buffer.from(b.subarray(offset, offset + size));
  if (original.some(x => x !== 0)) { changedRanges.push({ offset, name: 'PE checksum/signature metadata', originalBase64: original.toString('base64') }); b.fill(0, offset, offset + size); }
}
fs.writeFileSync(dest, b);
const metadata = { source, dest, inputSHA256: sha(before), outputSHA256: sha(b), fileSizeUnchanged: before.length === b.length, resources: report, changedRanges };
fs.writeFileSync(dest + '.bitmap-undo.json', JSON.stringify(metadata, null, 2));
fs.writeFileSync(dest + '.bitmap-report.json', JSON.stringify({ ...metadata, changedRanges: changedRanges.map(({offset,name,lang}) => ({offset,name,lang})) }, null, 2));
console.log(JSON.stringify({ fileSizeUnchanged: metadata.fileSizeUnchanged, resources: report }, null, 2));
