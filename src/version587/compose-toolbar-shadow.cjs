'use strict';

const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {parseDFM} = require('../inspect-dfm-palette.cjs');
const {readResources} = require('../pe-resource-utils.cjs');
const {verifyByteDelta} = require('./verify-byte-delta.cjs');

const imageBase = 0x400000;
const registrationVA = 0xd12758;
const originalCall = 'e87376b5ff';
const disabledCall = '9090909090';

const guards = [
  ['Compose FormCreate', 0xd12318, 0x4bf, 'c4643a5c7ed9e8fd809548e31c65be41834e531349f0f4fb2d3520e139348b1b'],
  ['Shadow registration', 0x869dd0, 0x55, '028120f6f83ce92944a718c3db455662379f8e004314b490ad3f9946bdc545c7'],
  ['FMCtrlShadowWnd creation', 0x86a160, 0x83, '8e773d59a63f800bc17cb7670f45334f0aead178eb053a28ff133b6a8f80fc51'],
  ['Shadow target lookup', 0x6463a8, 0x4b, '23b5ad48c27e0cc824382b3b4d6635887e8712f3ab659ae1143c18d10b4332ed'],
  ['Shadow removal with missing-target guard', 0x869e28, 0x5e, '33f6322c462fb2c6cefcdd80e409fd3c4121e48e20f18b20fe961429f08829b6'],
  ['Shadow refresh with missing-target guard', 0x869e88, 0x44, 'a5051a817d8190aa9854bbc4bb5bd10cf059bd5b9d355d87bdbbb24582ca4a3b']
];

function patchBuffer(input) {
  assert(Buffer.isBuffer(input), 'Expected the 587 EXE bytes');
  const {resources, pe, op} = readResources(input);
  assert.equal(input.toString('ascii', pe, pe + 4), 'PE\0\0');
  assert.equal(input.readUInt16LE(pe + 4), 0x14c);
  assert.equal(input.readUInt32LE(op + 28), imageBase);
  const table = op + input.readUInt16LE(pe + 20);
  const codeSections = Array.from({length: input.readUInt16LE(pe + 6)}, (_, i) => table + 40 * i)
    .filter(at => input.toString('ascii', at, at + 8) === 'CODE\0\0\0\0');
  assert.equal(codeSections.length, 1, 'Expected the 587 native CODE section');
  const code = codeSections[0];
  const codeVA = imageBase + input.readUInt32LE(code + 12);
  const codeSize = input.readUInt32LE(code + 16);
  const codeOffset = input.readUInt32LE(code + 20);
  assert(codeOffset + codeSize <= input.length, 'Invalid native CODE bounds');
  function offset(va, length) {
    const relative = va - codeVA;
    assert(relative >= 0 && relative + length <= codeSize, 'Patch or guard outside native CODE');
    return codeOffset + relative;
  }
  function expect(va, hex) {
    const start = offset(va, hex.length / 2);
    assert.equal(input.toString('hex', start, start + hex.length / 2), hex, 'Unexpected bytes at VA ' + va.toString(16));
  }

  const forms = resources.filter(r => r.type === 10 && r.name === 'TFOXCOMPOSEFORM');
  assert.equal(forms.length, 1);
  const {offset: resourceOffset, size} = forms[0];
  const form = parseDFM(input.subarray(resourceOffset, resourceOffset + size));
  assert.equal(form.className, 'TFoxComposeForm');
  const docks = form.children.filter(child => child.name === 'tbDock');
  assert.equal(docks.length, 1);
  const dock = docks[0];
  assert.equal(dock.className, 'TTBXDock');
  function expectEvent(control, name, handler) {
    const values = control.properties.filter(property => property.name === name);
    assert.equal(values.length, 1, name);
    assert.equal(values[0].type, 7, name);
    assert.equal(values[0].value, handler, name);
  }
  expectEvent(form, 'OnCreate', 'FormCreate');
  expectEvent(form, 'OnDestroy', 'FormDestroy');
  expectEvent(dock, 'OnResize', 'tbDockResize');

  // Bind the published methods and the Self+418 cleanup/refresh call sites.
  expect(0xd0b916, '11001823d1000a466f726d437265617465');
  expect(0xd0b95b, '1200bc9bd1000b466f726d44657374726f79');
  expect(0xd0c710, '13003475d2000c7462446f636b526573697a65');
  expect(0xd19c05, '8b45fc8b8018040000e81502b5ff');
  expect(0xd27584, '8b45fc8b8018040000e8f628b4ff59595dc3');
  for (const [label, va, length, digest] of guards) {
    const at = offset(va, length);
    assert.equal(createHash('sha256').update(input.subarray(at, at + length)).digest('hex'), digest, label);
  }

  // This call registers tbDock's independent top-level decorative shadow.
  // It has no stack arguments and its caller immediately reloads Self.
  // Resize and destroy already tolerate an unregistered dock.
  expect(registrationVA, originalCall);
  const start = offset(registrationVA, 5);
  const buffer = Buffer.from(input);
  buffer.write(disabledCall, start, 'hex');
  const changedBytes = verifyByteDelta(input, buffer, [[start, start + 5]]);
  assert.equal(changedBytes, 5);
  const reversed = Buffer.from(buffer);
  reversed.write(originalCall, start, 'hex');
  assert(reversed.equals(input), 'Restoring the registration call must restore the exact input');
  return {
    buffer,
    changes: [{kind: 'compose-toolbar-shadow', va: registrationVA, offset: start, size: 5, beforeHex: originalCall, afterHex: disabledCall}],
    changedBytes,
    reverseRestoresExactInput: true
  };
}

module.exports = {patchBuffer};
