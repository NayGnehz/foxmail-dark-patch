'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const paths = require('../foxmail-paths.cjs');
const recipient = require('./compose-recipient-contrast.cjs');
const shadow = require('./compose-toolbar-shadow.cjs');

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(file);
const exe = 'Foxmail深色.exe';
const baseline = path.join(paths.workspace, '_releases', 'foxmail', '5.0', 'payload', exe);
const before = read(baseline);
const baselineSHA256 = '24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c';
assert.equal(sha(before), baselineSHA256);

const sources = ['compose-polish.cjs', 'compose-recipient-contrast.cjs', 'compose-toolbar-shadow.cjs'];
const sourceSHA256 = Object.fromEntries(sources.map(file => [file, sha(read(path.join(__dirname, file)))]));
const recipientStage = paths.output('version587-compose-recipient-contrast');
const recipientReportBytes = read(path.join(recipientStage, 'validation.json'));
const abi = JSON.parse(read(path.join(recipientStage, 'abi-validation.json')).toString('utf8').replace(/^\uFEFF/, ''));
const styled = recipient.patchBuffer(before);
assert.equal(abi.passed, true);
assert.equal(abi.cases, 1280);
assert.equal(abi.candidateSHA256, styled.candidateSHA256);
assert.equal(abi.validationSHA256, sha(recipientReportBytes));
assert.equal(abi.generatorSHA256, sourceSHA256['compose-recipient-contrast.cjs']);
assert.equal(abi.fixtureSourceSHA256, sha(read(path.join(__dirname, 'verify-compose-recipient-contrast.c'))));
assert.equal(abi.fixtureSHA256, sha(read(path.join(recipientStage, 'verify-compose-recipient-contrast.exe'))));
assert(styled.buffer.equals(read(path.join(recipientStage, exe))));

const shadowOnly = shadow.patchBuffer(before);
const combined = shadow.patchBuffer(styled.buffer);
assert(shadowOnly.reverseRestoresExactInput && styled.reverseRestoresExactInput && combined.reverseRestoresExactInput);
assert.deepEqual(combined.changes, shadowOnly.changes);
const expected = Buffer.from(styled.buffer);
for (const {offset, size} of shadowOnly.changes) {
  assert(before.subarray(offset, offset + size).equals(styled.buffer.subarray(offset, offset + size)),
    'Recipient styling overlaps the independent toolbar shadow change');
  shadowOnly.buffer.copy(expected, offset, offset, offset + size);
}
assert(combined.buffer.equals(expected), 'Final output must equal the two independently verified deltas');

const stage = paths.output('version587-compose-polish');
const dest = path.join(stage, exe);
const report = {
  baseline, dest, baselineSHA256, candidateSHA256: sha(combined.buffer), sourceSHA256,
  independentUnionVerified: true, recipientCandidateSHA256: styled.candidateSHA256,
  recipientCalls: styled.changes, shadowChanges: shadowOnly.changes,
  recipientABI: abi,
};
fs.writeFileSync(dest, combined.buffer);
fs.writeFileSync(path.join(stage, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({candidateSHA256: report.candidateSHA256, dest, abiCases: abi.cases,
  recipientCalls: report.recipientCalls.length, shadowChanges: report.shadowChanges.length}));
