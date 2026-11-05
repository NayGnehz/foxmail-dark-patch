"""Numeric-only schema-4 diagnostic summary; standard library only.

Usage: python summarize-native-report.py [report.json] [--complete] [--all-processes]
Without --complete the snapshot is explicitly treated as still collecting.
"""
import argparse
import collections
import datetime
import json
from pathlib import Path

COLORS = ('bkColor', 'textColor', 'brushColor', 'pixelTopLeft',
          'pixelTopRight', 'pixelBottomLeft', 'pixelBottomRight')


def valid_color(value):
    return isinstance(value, int) and 0 <= value <= 0xffffff


def summarize(report, complete=False, all_processes=False):
    events = report.get('events', [])
    times = [e['elapsedMs'] for e in events if isinstance(e.get('elapsedMs'), (int, float))]
    result = {
        'schema': report.get('schema'),
        'status': 'collection complete (caller asserted)' if complete else 'still collecting; snapshot only',
        'eventElapsedMsRange': [min(times), max(times)] if times else None,
        'recordTiming': 'Ring records have sequence only; event range is not the paint time range.',
        'errors': report.get('errors', []),
        'processes': [],
        'emptyProcesses': {'count': 0, 'disconnectedCount': 0,
                           'droppedQueueRecords': 0, 'errors': []},
        'limits': [
            'Nearest preceding unmatched site9 with same process/Self/HDC is a heuristic pair; no thread context.',
            'Sites9/10 do not establish WM_PRINTCLIENT (318) association or causation.',
            'Four bitmap corner samples cannot exclude white elsewhere or within a child/clip.',
            'dropped counts reader queue evictions only; missed ring samples are not fully accounted for.',
            'Positive memory bright/white samples can include normal light text and do not establish a flash.',
            'All-white sampled points describe those points at that moment, not the entire window or a cause.',
        ],
    }
    for process in report.get('paintPhases', []):
        data = process.get('data', {})
        rows = sorted(data.get('records', []), key=lambda r: r.get('sequence', 0))
        if not rows:
            empty = result['emptyProcesses']
            empty['count'] += 1
            empty['disconnectedCount'] += data.get('connected') is False
            empty['droppedQueueRecords'] += data.get('dropped', 0)
            if data.get('error'):
                empty['errors'].append({'pid': process.get('pid'), 'error': data['error']})
            if not all_processes:
                continue
        counts = collections.Counter(r.get('site') for r in rows)
        names = {s['id']: s.get('name') for s in data.get('sites', [])}
        pending = collections.defaultdict(list)
        transitions = collections.Counter()
        pairs = changed = unmatched_after = unavailable = 0
        examples = []
        aggregates = {}
        for row in rows:
            site = row.get('site')
            # Old reports lack these named fields; do not reinterpret reserved slots.
            if 'sampleKind' in row:
                sample_key = (site, row.get('sampleKind'))
                if sample_key not in aggregates:
                    aggregates[sample_key] = {
                        'site': site, 'sampleKind': sample_key[1], 'records': 0,
                        'validSampledRecords': 0, 'sampleCountSum': 0,
                        'brightCountSum': 0, 'whiteCountSum': 0,
                        'allWhiteEvents': 0, 'allWhiteSequencesFirst20': [],
                        'skips': 0, 'notEntered': 0, 'invalidOrUnknownStatus': 0,
                    }
                aggregate = aggregates[sample_key]
                aggregate['records'] += 1
                status = row.get('sampleStatus')
                n, bright, white = (row.get(f) for f in ('sampleCount', 'brightCount', 'whiteCount'))
                if status == 1:
                    aggregate['skips'] += 1
                elif status is None:
                    aggregate['notEntered'] += 1
                elif (status == 0 and sample_key[1] in (1, 2)
                      and all(isinstance(v, int) for v in (n, bright, white))
                      and 0 < n <= 9 and 0 <= white <= bright <= n):
                    aggregate['validSampledRecords'] += 1
                    aggregate['sampleCountSum'] += n
                    aggregate['brightCountSum'] += bright
                    aggregate['whiteCountSum'] += white
                    if white == n:
                        aggregate['allWhiteEvents'] += 1
                        if len(aggregate['allWhiteSequencesFirst20']) < 20:
                            aggregate['allWhiteSequencesFirst20'].append(row.get('sequence'))
                else:
                    aggregate['invalidOrUnknownStatus'] += 1
            key = (row.get('self'), row.get('memoryHdc'))
            if site == 9:
                pending[key].append(row)
            elif site == 10:
                if not pending[key] or key[0] is None or key[1] is None:
                    unmatched_after += 1
                    continue
                before = pending[key].pop()
                pairs += 1
                changes = {}
                for field in COLORS:
                    a, b = before.get(field), row.get(field)
                    if not (valid_color(a) and valid_color(b)):
                        unavailable += 1
                        continue
                    if a != b:
                        # COLORREF is 0x00BBGGRR, deliberately retain numeric encoding.
                        changes[field] = [f'0x{a:06X}', f'0x{b:06X}']
                        transitions[(field, a, b)] += 1
                if changes:
                    changed += 1
                    if len(examples) < 8:
                        examples.append({'sequences': [before['sequence'], row['sequence']],
                                         'self': key[0], 'hdc': key[1], 'changesCOLORREF': changes})
        result['processes'].append({
            'pid': process.get('pid'), 'connected': data.get('connected'),
            'error': data.get('error'), 'droppedQueueRecords': data.get('dropped', 0),
            'latest': data.get('latest'), 'records': len(rows),
            'sequenceRange': [rows[0]['sequence'], rows[-1]['sequence']] if rows else None,
            'sites': [{'site': site, 'name': names.get(site), 'count': counts[site]}
                      for site in sorted(set(range(12)) | set(names) | set(counts))],
            'sampleAggregates': list(aggregates.values()),
            'site8WM_PRINTCLIENT': sum(r.get('site') == 8 and r.get('messageId') == 318 for r in rows),
            'site11TreeRecords': counts[11],
            'nativePairs': pairs, 'pairsWithObservedColorChange': changed,
            'unmatchedBefore': sum(map(len, pending.values())), 'unmatchedAfter': unmatched_after,
            'unavailableColorComparisons': unavailable,
            'colorTransitionsCOLORREF': [{'field': f, 'before': f'0x{a:06X}', 'after': f'0x{b:06X}', 'count': n}
                                        for (f, a, b), n in transitions.most_common()],
            'changeExamples': examples,
        })
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', nargs='?', default=str(Path(__file__).with_name('Foxmail预绘制诊断结果.json')))
    parser.add_argument('--complete', action='store_true', help='Assert independently that capture has finished')
    parser.add_argument('--all-processes', action='store_true', help='Expand processes with no paint-phase records')
    args = parser.parse_args()
    path = Path(args.report)
    report = json.loads(path.read_text(encoding='utf-8-sig'))
    result = summarize(report, args.complete, args.all_processes)
    result['fileModifiedUTC'] = datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc).isoformat()
    print(json.dumps(result, ensure_ascii=False, indent=2))
