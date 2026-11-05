'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
let src=fs.readFileSync(path.join(__dirname,'../print-native-gate/read-gate-status.py'),'utf8');
function edit(a,b){assert(src.includes(a));src=src.replace(a,b);}
edit('stats_rva=None;route_rva=None;print_rva=None','stats_rva=None;route_rva=None;print_rva=None;compose_rva=None');
edit("    if name=='FxGateStats':", "    if name=='FxComposeGateStats':compose_rva=u32(funcs+u16(ords+i*2)*4)\n    if name=='FxGateStats':");
edit("if print_rva is None:","if compose_rva is None:raise RuntimeError('compose stats export missing')\nif print_rva is None:");
edit("                entry['print']=print_stats;break",`                entry['print']=print_stats
                compose_buf=(c.c_ubyte*16)();got=c.c_size_t()
                if not k.ReadProcessMemory(h,module+compose_rva,compose_buf,16,c.byref(got)) or got.value!=16:raise OSError(c.get_last_error(),'ReadProcessMemory compose counters')
                compose_stats=dict(zip(['size','version','calls','acquired'],struct.unpack('<4I',bytes(compose_buf))))
                if compose_stats['size']!=16 or compose_stats['version']!=1:raise RuntimeError('Unexpected compose stats ABI')
                entry['compose']=compose_stats;break`);
fs.writeFileSync(path.join(__dirname,'../compose-native-gate/read-gate-status.py'),src);
console.log('Prepared read-only compose-counter reader for candidate DLL.');
