'use strict';

const assert = require('node:assert/strict');

// Ranges are half-open. Compare unchanged spans in native Buffer code and
// count the actual differences only where a patch is allowed to write.
function verifyByteDelta(before, after, allowed) {
  assert.equal(after.length, before.length, 'File length changed');
  let cursor = 0;
  let changedBytes = 0;
  for (const [start, end] of [...allowed].sort(([a], [b]) => a - b)) {
    assert(Number.isInteger(start) && Number.isInteger(end) &&
      start >= 0 && end >= start && end <= before.length, 'Invalid patch range');
    if (start === end) continue;
    if (cursor < start) {
      assert(before.subarray(cursor, start).equals(after.subarray(cursor, start)),
        'Unexpected delta outside patch ranges');
    }
    for (let at = Math.max(cursor, start); at < end; at++) {
      if (before[at] !== after[at]) changedBytes++;
    }
    cursor = Math.max(cursor, end);
  }
  assert(before.subarray(cursor).equals(after.subarray(cursor)), 'Unexpected delta outside patch ranges');
  return changedBytes;
}

module.exports = {verifyByteDelta};
