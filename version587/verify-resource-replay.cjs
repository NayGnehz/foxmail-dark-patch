'use strict';

// Replay the adopted resource/DFM stages against the frozen inputs. Only the
// replay's output groups are redirected, so previous validation stays intact.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const paths = require('../foxmail-paths.cjs');
const {verifyByteDelta} = require('./verify-byte-delta.cjs');

const before = Buffer.alloc(9);
const after = Buffer.from([0, 1, 1, 1, 0, 1, 0, 0, 0]);
assert.equal(verifyByteDelta(before, after, [[5, 6], [2, 4], [1, 3]]), 4);
assert.equal(verifyByteDelta(before, before, [[0, 0], [9, 9]]), 0);
assert.throws(() => verifyByteDelta(before, after, [[1, 4], [6, 8]]), /outside patch ranges/);
assert.throws(() => verifyByteDelta(before, after, [[1, 4]]), /outside patch ranges/);
assert.throws(() => verifyByteDelta(before, after.subarray(1), []), /File length changed/);
assert.throws(() => verifyByteDelta(before, before, [[0, 10]]), /Invalid patch range/);

const steps = [
  ['group-border-rgba', ['group-border-rgba.cjs']],
  ['search-style', ['search-style.cjs', 'check-search-style.cjs']],
  ['ui-followups', ['ui-followups.cjs']],
  ['search-alignment', ['search-alignment.cjs']],
  ['address-followup', ['check-address-followup.cjs']],
  ['ui-refinement', ['merge-ui-refinement.cjs']]
];
const templates = [
  ['compose-screen-colors', 'HtmlEditor', 'compose-screen-colors.cjs', 'verify-compose-screen-colors.cjs',
    'HtmlEditor/Common/HtmlEditor.html'],
  ['address-html', 'Frame', 'address-book-html.cjs', 'verify-address-book-html.cjs', 'AddrNoteInfo/Frame.html']
];
const originalOutput = paths.output;
const replay = fs.mkdtempSync(path.join(originalOutput('version587-resource-replay'), 'run-'));
const redirected = new Map();
for (const [name] of [...templates, ...steps]) {
  const group = 'version587-' + name;
  const directory = path.join(replay, group);
  fs.mkdirSync(directory);
  redirected.set(group, directory);
}

const exeName = 'Foxmail深色.exe';
const payload = path.join(paths.workspace, '_releases', 'foxmail', '5.0', 'payload');
const runBrowser = process.argv.includes('--browser');
paths.output = group => redirected.get(group) ?? originalOutput(group);
try {
  for (const [name, file, generator, verifier, relative] of templates) {
    const group = 'version587-' + name;
    const preimage = file + '.before.html';
    fs.copyFileSync(path.join(originalOutput(group), preimage), path.join(paths.output(group), preimage));
    require('./' + generator);
    const bytes = fs.readFileSync(path.join(paths.output(group), file + '.html'));
    assert(bytes.equals(fs.readFileSync(path.join(payload, '7.2.25.587/Template', relative))));
    if (runBrowser) require('./' + verifier);
  }
  if (!runBrowser) {
    const group = 'version587-address-html';
    const report = 'html-tests.json';
    // The merger verifies the retained proof against the exact template bytes
    // and current verifier source. Browser replay remains separately opt-in.
    fs.copyFileSync(path.join(originalOutput(group), report), path.join(paths.output(group), report));
  }
  for (const [name, scripts] of steps) {
    for (const script of scripts) require('./' + script);
    const group = 'version587-' + name;
    const current = fs.readFileSync(path.join(paths.output(group), exeName));
    const accepted = fs.readFileSync(path.join(originalOutput(group), exeName));
    assert(current.equals(accepted), 'Frozen stage bytes changed: ' + group);
  }
  const sealed = fs.readFileSync(path.join(payload, exeName));
  const final = fs.readFileSync(path.join(paths.output('version587-ui-refinement'), exeName));
  assert(final.equals(sealed), 'Sealed 5.0 EXE changed');
} finally {
  paths.output = originalOutput;
}
console.log(JSON.stringify({passed: true, identicalStages: steps.length, identicalTemplates: templates.length,
  sealedEXEIdentical: true, browserReplayed: runBrowser, replay}));
