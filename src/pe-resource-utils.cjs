'use strict';
function readResources(b) {
  if (b.readUInt16LE(0) !== 0x5a4d) throw new Error('Not a PE image');
  const pe = b.readUInt32LE(0x3c), op = pe + 24;
  if (b.readUInt16LE(op) !== 0x10b) throw new Error('Expected PE32');
  const count = b.readUInt16LE(pe + 6), so = op + b.readUInt16LE(pe + 20), sections = [];
  for (let i = 0; i < count; i++) { const p = so + i * 40; sections.push({ rva: b.readUInt32LE(p + 12), size: b.readUInt32LE(p + 16), raw: b.readUInt32LE(p + 20) }); }
  const offset = rva => { const s = sections.find(s => rva >= s.rva && rva < s.rva + s.size); if (!s) throw new Error('Unmapped RVA ' + rva.toString(16)); return s.raw + rva - s.rva; };
  const root = offset(b.readUInt32LE(op + 112)), resources = [];
  const label = n => { if (!(n & 0x80000000)) return n; const p = root + (n & 0x7fffffff); return b.toString('utf16le', p + 2, p + 2 + 2 * b.readUInt16LE(p)); };
  function walk(relative, path) {
    if (path.length > 3) throw new Error('Unexpected resource depth');
    const p = root + relative, n = b.readUInt16LE(p + 12) + b.readUInt16LE(p + 14);
    for (let i = 0; i < n; i++) {
      const e = p + 16 + i * 8, key = label(b.readUInt32LE(e)), dest = b.readUInt32LE(e + 4), next = path.concat(key);
      if (dest & 0x80000000) walk(dest & 0x7fffffff, next);
      else { const d = root + dest, size = b.readUInt32LE(d + 4), raw = offset(b.readUInt32LE(d)); if (raw + size > b.length) throw new Error('Resource exceeds image'); resources.push({ type: next[0], name: next[1], lang: next[2], size, offset: raw, dataEntry: d }); }
    }
  }
  walk(0, []); return { resources, pe, op };
}
module.exports = { readResources };
