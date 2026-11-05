import importlib.util,struct
s=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
for name in ['OnAfterCreated','OnLoadStart','OnLoadEnd','OnLoadingStateChange','OnPaint','OnContextCreated','OnDocumentAvailableInMainFrame','OnLoadError']:
 needle=bytes([len(name)])+name.encode();at=n.b.find(needle)
 while at>=0:
  print(name,hex(n.va(at)),n.b[at-26:at].hex());at=n.b.find(needle,at+1)
