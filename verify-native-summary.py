"""Small numeric fixture for schema-compatible sample aggregate summaries."""
import runpy
from pathlib import Path

summarize = runpy.run_path(str(Path(__file__).with_name('summarize-native-report.py')))['summarize']
rows = [dict(sequence=i, site=12, sampleKind=1, sampleStatus=0,
             sampleCount=9, brightCount=9, whiteCount=9) for i in range(1, 23)]
rows += [dict(sequence=23, site=12, sampleKind=1, sampleStatus=1),
         dict(sequence=24, site=12, sampleKind=None, sampleStatus=None),
         dict(sequence=25, site=2, sampleKind=2, sampleStatus=0,
              sampleCount=9, brightCount=3, whiteCount=1),
         dict(sequence=26, site=2, sampleKind=2, sampleStatus=0,
              sampleCount=0, brightCount=0, whiteCount=0)]
report = {'paintPhases': [{'pid': 1, 'data': {'records': rows}}]}
p = summarize(report)['processes'][0]
groups = {(g['site'], g['sampleKind']): g for g in p['sampleAggregates']}
early = groups[12, 1]
assert early['records'] == 23 and early['validSampledRecords'] == 22
assert early['sampleCountSum'] == early['brightCountSum'] == early['whiteCountSum'] == 198
assert early['allWhiteEvents'] == 22 and early['allWhiteSequencesFirst20'] == list(range(1, 21))
assert early['skips'] == 1 and groups[12, None]['notEntered'] == 1
memory = groups[2, 2]
assert memory['validSampledRecords'] == 1 and memory['invalidOrUnknownStatus'] == 1
assert (memory['sampleCountSum'], memory['brightCountSum'], memory['whiteCountSum']) == (9, 3, 1)
assert memory['allWhiteEvents'] == 0
assert next(s for s in p['sites'] if s['site'] == 12)['count'] == 24
legacy = summarize({'paintPhases': [{'pid': 1, 'data': {'records': [{'sequence': 1, 'site': 2, 'reserved0': 9}]}}]})
assert legacy['processes'][0]['sampleAggregates'] == []
print('native summary numeric fixtures passed')
