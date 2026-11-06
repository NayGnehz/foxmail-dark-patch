"""Find diagnostic path literals in software binaries; no report/dump content."""
import re,json,hashlib
from pathlib import Path
root=Path(r'D:\Users\Public\Downloads\Foxmail')
for relative in ['Foxmail.exe','7.2.25.587/TxBugReport.exe','7.2.25.587/FoxBugReport.dll']:
 p=root/relative;b=p.read_bytes()
 if relative=='Foxmail.exe':assert hashlib.sha256(b).hexdigest()=='f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
 strings=[]
 for pattern,encoding in [(rb'[\x20-\x7e]{5,220}', 'ascii'),(rb'(?:[\x20-\x7e]\x00){5,220}','utf-16le')]:
  for m in re.finditer(pattern,b):
   s=m.group().decode(encoding)
   if re.search(r'\.dmp\b|\.mdmp\b|bugreport|crashdump|\\crash|Report\.xml',s,re.I) and not s.startswith('<assembly'):strings.append(s)
 print(json.dumps({'software':relative,'literals':list(dict.fromkeys(strings))[:45]}))
