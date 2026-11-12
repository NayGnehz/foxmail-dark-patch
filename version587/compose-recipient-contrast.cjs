'use strict';

// Patch the five compose-local font-application calls in sealed 5.0.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {verifyByteDelta} = require('./verify-byte-delta.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const baselineSHA256 = '24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c';
const originalVA = 0xe8d3a8;
const colorSetterVA = 0x68b0fc;
const defaultAttributesOffset = 0x238;
const color = 0xe6e6e6;
const sites = [
  [0xc1bc44, 'redtTos', 'create', '8b45fc8b50688b45fc8b8088020000b101e85f172700'],
  [0xc1bc5a, 'redtCcs', 'create', '8b45fc8b50688b45fc8b808c020000b101e849172700'],
  [0xc1d12e, 'redtBccs', 'expand', '8b45fc8b50688b45fc8b8090020000b101e875022700'],
  [0xc26260, 'redtTos', 'refresh', 'b1018b45fc8b50688b45fc8b8088020000e843712600'],
  [0xc26276, 'redtCcs', 'refresh', 'b1018b45fc8b50688b45fc8b808c020000e82d712600']
];
const guards = [
  [originalVA, 0xda, '1e85cf2aaebc4eae80e7173bdf81904d37161fc387e858be66bbccd597486eda', 'original font application'],
  [colorSetterVA, 0x4a, '73dedcec19e6b50ed309b50819d09632860f2a8af7bc6f00f994f7d698a933fb', 'TTextAttributes.SetColor'],
  [0x68afe8, 0x8a, '265392fbe0c7774868b9743fc9ca3e7ee69236fbe10f6ce5d918441c5c55b801', 'default scope and EM_SETCHARFORMAT'],
  [0x68c986, 0x37, '1356e33df8073805830f02765f4614f4db1a608a2d1414fecf0f2885a266c3de', 'TCustomRichEdit default attributes construction'],
  [0x68ce90, 0x24, 'bbc15e8b315aa119d4f7ca8556332feb64b75bafa3817d01a5f31b6c19a0a2b9', 'TCustomRichEdit font-change path'],
  [0x68b37c, 0x42, '3a51df0f29de07a7ef3898060591164dc32c1943e3c3993382384279a56010e0', 'TTextAttributes font-color assignment']
];
const errorApis = [
  [0x408038, 'ff25f4bd2f01', 'GetLastError'],
  [0x408320, 'ff2598bc2f01', 'SetLastError']
];

function patchBuffer(before) {
  assert([baselineSHA256, 'eee4f4bd6d0241aad5e86bfaf121fd2b4a4a1a32c45d04d9584f798f699f82be'].includes(sha(before)), 'Expected sealed 5.0 or the verified MSAA guard');
  const pe = before.readUInt32LE(0x3c);
  const op = pe + 24;
  const base = before.readUInt32LE(op + 28);
  assert.equal(before.toString('ascii', 0, 2), 'MZ');
  assert.equal(before.readUInt32LE(pe), 0x4550);
  assert.equal(before.readUInt16LE(pe + 4), 0x14c);
  assert.equal(before.readUInt16LE(op), 0x10b);
  assert.equal(base, 0x400000);
  const table = op + before.readUInt16LE(pe + 20);
  const sections = Array.from({length: before.readUInt16LE(pe + 6)}, (_, index) => {
    const header = table + index * 40;
    return {
      header,
      name: before.toString('ascii', header, header + 8).replace(/\0/g, ''),
      size: before.readUInt32LE(header + 8),
      rva: before.readUInt32LE(header + 12),
      rawSize: before.readUInt32LE(header + 16),
      raw: before.readUInt32LE(header + 20)
    };
  });
  function offset(va, size = 4) {
    const rva = va - base;
    const section = sections.find(s => rva >= s.rva && rva + size <= s.rva + s.rawSize);
    assert.equal(section?.name, 'CODE', 'Expected original CODE at ' + va.toString(16));
    return section.raw + rva - section.rva;
  }
  function bytesAt(va, size) {
    const raw = offset(va, size);
    return before.subarray(raw, raw + size);
  }
  const u32 = va => before.readUInt32LE(offset(va));
  const frameVmt = 0xc1a3f0;
  for (const [vmt, size, name] of [
    [frameVmt, 0x4fc, 'TFoxComposeFrame'],
    [0xb42b8c, 0x330, 'TFMZRichEdit'],
    [0x67b8ec, 0x288, 'TCustomRichEdit'],
    [0x67b604, 0x0c, 'TTextAttributes']
  ]) {
    assert.equal(u32(vmt - 76), vmt);
    assert.equal(u32(vmt - 40), size);
    assert.equal(bytesAt(u32(vmt - 44), name.length + 1).toString('ascii'), String.fromCharCode(name.length) + name);
  }

  const fields = new Map();
  let entry = offset(u32(frameVmt - 56), 6);
  const fieldCount = before.readUInt16LE(entry);
  entry += 6;
  for (let i = 0; i < fieldCount; i++) {
    const length = before[entry + 6];
    fields.set(before.toString('ascii', entry + 7, entry + 7 + length), before.readUInt32LE(entry));
    entry += 7 + length;
  }
  assert.equal(fields.get('redtTos'), 0x288);
  assert.equal(fields.get('redtCcs'), 0x28c);
  assert.equal(fields.get('redtBccs'), 0x290);
  for (const [va, size, hash, label] of guards) {
    assert.equal(sha(bytesAt(va, size)), hash, label);
  }
  for (const [va, bytes, label] of errorApis) {
    assert.equal(bytesAt(va, bytes.length / 2).toString('hex'), bytes, label + ' import thunk');
  }

  const unpatchedCaller = 0xfd1101;
  assert.equal(bytesAt(unpatchedCaller, 5).toString('hex'), 'e8a2c2ebff');
  const hooks = sites.map(([va, field, phase, context]) => {
    const length = context.length / 2;
    assert.equal(bytesAt(va + 5 - length, length).toString('hex'), context, field + ' ' + phase);
    const raw = offset(va, 5);
    assert.equal(before[raw], 0xe8);
    assert.equal(va + 5 + before.readInt32LE(raw + 1), originalVA);
    return {va, field, phase, raw, originalHex: before.subarray(raw, raw + 5).toString('hex')};
  });

  const tail = sections.at(-1);
  assert.equal(tail.name, '.fxcnca');
  assert.equal(tail.rva, Math.max(...sections.map(s => s.rva)));
  assert.equal(before.readUInt32LE(tail.header + 36), 0xe0000020);
  assert.equal(tail.raw + tail.rawSize, before.length);
  assert(tail.size <= tail.rawSize);
  const fileAlignment = before.readUInt32LE(op + 36);
  const sectionAlignment = before.readUInt32LE(op + 32);
  assert.equal(fileAlignment, 512);
  assert.equal(sectionAlignment, 4096);
  const align = (value, alignment) => Math.ceil(value / alignment) * alignment;
  const stubVA = base + tail.rva + tail.rawSize;
  const code = [];
  const emit = (...bytes) => code.push(...bytes);
  const dword = value => {
    const bytes = Buffer.alloc(4);
    bytes.writeInt32LE(value);
    emit(...bytes);
  };
  const call = target => {
    emit(0xe8);
    dword(target - (stubVA + code.length + 4));
  };
  const exits = [];
  const skipIfNull = () => {
    emit(0x85, 0xc0, 0x74, 0);
    exits.push(code.length - 1);
  };

  // Delphi register ABI. Keep the recipient object for the color pass and
  // preserve every output register, flags and LastError of the original call.
  emit(0x50);                                          // push eax
  call(originalVA);
  emit(0x9c, 0x60, 0x8b, 0x44, 0x24, 36);              // pushfd; pushad; mov eax,[esp+36]
  skipIfNull();
  emit(0x8b, 0x80); dword(defaultAttributesOffset);      // mov eax,[eax+238h]
  skipIfNull();
  emit(0x50);                                          // push eax
  call(errorApis[0][0]);
  emit(0x59, 0x50, 0x89, 0xc8, 0xba); dword(color);     // pop ecx; push eax; mov eax,ecx; mov edx,color
  call(colorSetterVA);                                 // SetColor(CFM_COLOR, SCF_DEFAULT)
  call(errorApis[1][0]);                                // stdcall removes saved LastError
  for (const at of exits) {
    assert(code.length - at - 1 <= 127);
    code[at] = code.length - at - 1;
  }
  emit(0x61, 0x9d, 0x8d, 0x64, 0x24, 4, 0xc3);        // popad; popfd; lea esp,[esp+4]; ret
  const stub = Buffer.from(code);

  const out = Buffer.alloc(align(before.length + stub.length, fileAlignment));
  before.copy(out);
  stub.copy(out, before.length);
  out.writeUInt32LE(tail.rawSize + stub.length, tail.header + 8);
  out.writeUInt32LE(out.length - tail.raw, tail.header + 16);
  out.writeUInt32LE(align(stubVA - base + stub.length, sectionAlignment), op + 56);
  out.writeUInt32LE(0, op + 64);
  for (const hook of hooks) {
    out.writeInt32LE(stubVA - hook.va - 5, hook.raw + 1);
    hook.siteHex = out.subarray(hook.raw, hook.raw + 5).toString('hex');
  }

  const allowed = [[tail.header + 8, tail.header + 12], [tail.header + 16, tail.header + 20],
    [op + 56, op + 60], [op + 64, op + 68], ...hooks.map(h => [h.raw + 1, h.raw + 5])];
  const changedBytes = verifyByteDelta(before, out.subarray(0, before.length), allowed);
  const reversed = Buffer.from(out.subarray(0, before.length));
  for (const [start, end] of allowed) before.copy(reversed, start, start, end);
  assert(reversed.equals(before), 'Reversing the PE extension and five call operands must restore 5.0');
  return {
    buffer: out, stub, changes: hooks, stubVA, stubRaw: before.length, changedBytes,
    candidateSHA256: sha(out), imageSize: out.readUInt32LE(op + 56), originalEntryUnchanged: true,
    originalOtherCallerUnchanged: unpatchedCaller, reverseRestoresExactInput: true
  };
}

module.exports = {patchBuffer};

if (require.main === module) {
  const paths = require('../foxmail-paths.cjs');
  const exe = 'Foxmail深色.exe';
  const guarded = process.argv.includes('--msaa-tray-guard');
  const input = guarded ? path.join(paths.temp, 'version587-msaa-tray-guard', 'Foxmail.exe') : path.join(paths.workspace, '_releases', 'foxmail', '5.0', 'payload', exe);
  const stage = paths.output(guarded ? 'version587-compose-recipient-msaa' : 'version587-compose-recipient-contrast');
  const dest = path.join(stage, exe);
  const {buffer, stub, ...result} = patchBuffer(fs.readFileSync(input));
  const report = {
    input, dest, baselineSHA256: sha(fs.readFileSync(input)), ...result, generatorSHA256: sha(fs.readFileSync(__filename)),
    originalVA, colorSetterVA, defaultAttributesOffset, color, stubHex: stub.toString('hex'),
    scope: 'Five exact compose recipient style calls. Preserve original font application and set only native default foreground for To/Cc/Bcc. No selection, token, subject, body, loading or reveal changes.'
  };
  fs.writeFileSync(dest, buffer);
  const base = 0x400000;
  const fixtureDefines = {
    IMAGE_SIZE: report.imageSize, STUB_RVA: report.stubVA - base, ORIGINAL_RVA: originalVA - base,
    GET_ERROR_RVA: errorApis[0][0] - base, SET_ERROR_RVA: errorApis[1][0] - base,
    SET_COLOR_RVA: colorSetterVA - base, DEFAULT_ATTR_OFFSET: defaultAttributesOffset,
    COLOR: color, SITE_COUNT: report.changes.length
  };
  const fixture = [
    ...Object.entries(fixtureDefines).map(([name, value]) => '#define FX_' + name + ' ' + value + 'u'),
    '#define FX_CANDIDATE_SHA "' + report.candidateSHA256 + '"',
    'static const U8 stub[] = {' + [...buffer.subarray(report.stubRaw, report.stubRaw + stub.length)].join(',') + '};',
    'static const struct {U32 rva; U8 bytes[5];} sites[] = {',
    ...report.changes.map(({va, raw}) =>
      '    {' + (va - base) + 'u, {' + [...buffer.subarray(raw, raw + 5)].join(',') + '}},'),
    '};'
  ].join('\n');
  report.fixtureHeaderSHA256 = sha(fixture + '\n');
  fs.writeFileSync(path.join(stage, 'recipient-contrast-fixture.h'), fixture + '\n');
  fs.writeFileSync(path.join(stage, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
