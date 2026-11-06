"""Static fixed-software account drawing metadata; no process or user data."""
import importlib.util, hashlib, struct
from pathlib import Path

source = Path(__file__).parent.parent / 'native-whitebars.py'
spec = importlib.util.spec_from_file_location('account_static', source)
n = importlib.util.module_from_spec(spec)
spec.loader.exec_module(n)
assert hashlib.sha256(n.b).hexdigest() == 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'

for cls in ['TAccountOptionFrame', 'TFMGroupBox']:
    v, = n.classes(cls)
    print(cls, hex(v), 'size', n.read(v-40))
    table = n.read(v-48)
    if table:
        count = struct.unpack_from('<H', n.b, n.off(table))[0]
        assert count < 4096
        for i in range(count):
            message = struct.unpack_from('<H', n.b, n.off(table+2+2*i))[0]
            if message in [15, 20, 0x85, 0x317, 0x318]:
                slot = table+2+2*count+4*i
                print('DMT', hex(message), 'slot', hex(slot), 'target', hex(n.read(slot)))

# Parent background handler sends WM_ERASEBKGND to Self+0x30.
proof = n.b[n.off(0x112796f):n.off(0x112797f)]
assert proof.hex() == 'ba140000008b45fc8b4030e8b5550000'
print('Parent+30 Perform(WM_ERASEBKGND)', proof.hex())
