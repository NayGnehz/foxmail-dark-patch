# FOXMAIL_RETIRED_BASELINE_CLI: provenance source only; shared owner maintains pinned archives.
if __name__ == '__main__':
    raise SystemExit('Historical downloader retired. Reuse the verified shared Zig archive; no per-project download or extraction.')
import urllib.request, concurrent.futures as cf, pathlib, time, hashlib, json, zipfile
BASE=pathlib.Path(r'D:\Workspace\Foxmail\native-toolchain')
URL='https://files.pythonhosted.org/packages/e0/0c/66f4710aedf5544e15779ff9c6e770322986e15daf9299b1a4df0be19e09/ziglang-0.13.0-py3-none-win_amd64.whl'
SIZE=80418705
SHA='b64b2aa936ebbfeecfbb2611df331a5474edebe1246b98c2f56d6ae4d58b71fc'
PART=2*1024*1024
endtime=time.monotonic()+300
parts=BASE/'wheel-parts'; parts.mkdir(exist_ok=True)
def get(i):
 a=i*PART; b=min(SIZE,a+PART)-1; path=parts/str(i)
 for attempt in range(2):
  try:
   remaining=endtime-time.monotonic()
   if remaining<=0: raise TimeoutError('overall deadline')
   req=urllib.request.Request(URL,headers={'Range':f'bytes={a}-{b}','Accept-Encoding':'identity'})
   with urllib.request.urlopen(req,timeout=min(120,remaining)) as r:
    if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {a}-{b}/{SIZE}': raise RuntimeError('invalid range response')
    data=r.read(b-a+2)
   if len(data)!=b-a+1: raise RuntimeError('range length mismatch')
   path.write_bytes(data)
   print(f'part {i+1}/39 verified',flush=True)
   return path
  except Exception as e:
   if attempt or time.monotonic()>=endtime: raise
with cf.ThreadPoolExecutor(max_workers=12) as ex:
 results=list(ex.map(get,range((SIZE+PART-1)//PART)))
out=BASE/'ziglang-parallel.whl'
h=hashlib.sha256()
with out.open('wb') as f:
 for p in results:
  data=p.read_bytes(); h.update(data); f.write(data)
if h.hexdigest()!=SHA: raise RuntimeError('archive SHA256 mismatch')
(BASE/'zig-wheel-provenance.txt').write_text(f'URL: {URL}\nMetadata: https://pypi.org/pypi/ziglang/0.13.0/json\nSHA256: {SHA}\n')
with zipfile.ZipFile(out) as z: z.extractall(BASE/'zig-wheel')
print('VERIFIED EXTRACTED '+str(BASE/'zig-wheel'/'ziglang'/'zig.exe'),flush=True)
