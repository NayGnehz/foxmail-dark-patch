'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..');
let src=fs.readFileSync(path.join(root,'reveal-gate-v2/read-gate-status.py'),'utf8');
function edit(before,after){assert(src.includes(before));src=src.replace(before,after);}
edit('stats_rva=None;route_rva=None','stats_rva=None;route_rva=None;print_rva=None');
edit("    if name=='FxGateStats':", "    if name=='FxPrintGateStats':print_rva=u32(funcs+u16(ords+i*2)*4)\n    if name=='FxGateStats':");
edit("if stats_rva is None:","if print_rva is None:raise RuntimeError('print stats export missing')\nif stats_rva is None:");
edit("                entry['routes']=routes;break",`                entry['routes']=routes
                print_buf=(c.c_ubyte*16)();got=c.c_size_t()
                if not k.ReadProcessMemory(h,module+print_rva,print_buf,16,c.byref(got)) or got.value!=16:raise OSError(c.get_last_error(),'ReadProcessMemory print counters')
                print_stats=dict(zip(['size','version','calls','acquired'],struct.unpack('<4I',bytes(print_buf))))
                if print_stats['size']!=16 or print_stats['version']!=1:raise RuntimeError('Unexpected print stats ABI')
                entry['print']=print_stats;break`);
fs.writeFileSync(path.join(root,'secondary-windows/print-native-gate/read-gate-status.py'),src);
console.log('Prepared read-only numeric print-counter reader.');
