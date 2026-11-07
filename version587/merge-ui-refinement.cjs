'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const paths = require('../foxmail-paths.cjs');
const addressColors = require('./patch-address-followup.cjs');
const addressSprites = require('./patch-address-sort-sprites.cjs');

const exeName = 'Foxmail深色.exe';
const baselineSHA256 = '3a3f9c385c3be8734c89b8b104cb18f2d2574ed4a790cf51c8ef637abfd44d5d';
const searchSHA256 = '9be98b95c82e9cc68e92235bea9404593a3808dd024dfa5950fee31c067ab736';
const addressSHA256 = 'df263ea1aed4175a2569c27f087a555cc9ee9aaa6eb96176afed0ce12e3da9b3';
const topOffset = 22085904;

function sha(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readCandidate(group, expected) {
  const directory = paths.output(group);
  const file = path.join(directory, exeName);
  const bytes = fs.readFileSync(file);
  assert.equal(sha(bytes), expected, group + ' artifact changed');
  return { directory, file, bytes };
}

const baseline = readCandidate('version587-ui-followups', baselineSHA256);
const search = readCandidate('version587-search-alignment', searchSHA256);
const address = readCandidate('version587-address-followup', addressSHA256);
const searchPlan = JSON.parse(fs.readFileSync(path.join(search.directory, 'validation.json')));
const addressPlan = JSON.parse(fs.readFileSync(path.join(address.directory, 'validation.json')));

const sourceBindings = [
  { file: 'search-alignment.cjs', sha256: searchPlan.generatorSHA256 },
  ...addressPlan.sourceBindings
];
assert.deepStrictEqual(sourceBindings.map(binding => binding.file), [
  'search-alignment.cjs',
  'patch-address-followup.cjs',
  'patch-address-sort-sprites.cjs',
  'check-address-followup.cjs'
]);
for (const binding of sourceBindings) {
  assert.equal(sha(fs.readFileSync(path.join(__dirname, binding.file))), binding.sha256, binding.file);
}

assert.equal(searchPlan.valueOffset, topOffset);
assert.equal(baseline.bytes[topOffset], 3);
const expectedSearch = Buffer.from(baseline.bytes);
expectedSearch[topOffset] = 4;
assert(expectedSearch.equals(search.bytes), 'Only the right button Top byte may change');

const colors = addressColors.patchBuffer(search.bytes);
const final = addressSprites.patchBuffer(colors.buffer).buffer;
assert.equal(address.bytes[topOffset], 3, 'Address patch overlaps search layout');
const expectedFinal = Buffer.from(address.bytes);
expectedFinal[topOffset] = 4;
assert(final.equals(expectedFinal), 'Combined output differs outside the independently audited deltas');
assert.equal(colors.changes.length, 6);
assert(colors.acceptedMailPaletteMatched);

const stage = paths.output('version587-ui-refinement');
const dest = path.join(stage, exeName);
const report = {
  input: baseline.file,
  dest,
  baselineSHA256,
  candidateSHA256: sha(final),
  searchSHA256,
  addressSHA256,
  sourceBindings,
  generatorSHA256: sha(fs.readFileSync(__filename)),
  searchTop: { offset: topOffset, before: 3, after: 4 },
  addressColorOperands: colors.changes.length,
  addressSprites: 2,
  combinedEqualsAuditedUnion: true,
  acceptedMailPaletteMatched: true
};
fs.writeFileSync(dest, final);
fs.writeFileSync(path.join(stage, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
