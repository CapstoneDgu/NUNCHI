import sys
import os
import glob

try:
    import pefile
except ImportError:
    print("pefile not installed -> run: py -3-32 -m pip install pefile")
    sys.exit(1)

root = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~")
print("scanning DLLs under:", root)
print("(looking for exports containing Msr / MSR / Track)")
print("-" * 56)

found = 0
for p in glob.glob(os.path.join(root, "**", "*.dll"), recursive=True):
    try:
        pe = pefile.PE(p, fast_load=True)
        pe.parse_data_directories(
            directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_EXPORT"]]
        )
        exp = getattr(pe, "DIRECTORY_ENTRY_EXPORT", None)
        if exp:
            names = [s.name.decode(errors="ignore") for s in exp.symbols if s.name]
            hits = [n for n in names if "Msr" in n or "MSR" in n or "Track" in n]
            if hits:
                found += 1
                print("DLL :", os.path.basename(p))
                print("PATH:", p)
                print("FNS :", hits)
                print("-" * 56)
        pe.close()
    except Exception:
        pass

print("done. matches:", found)
if found == 0:
    print("no MSR dll found under that path. try passing the HW-test tool folder:")
    print('  py -3-32 find_msr_dll.py "C:\\path\\to\\hwtest\\folder"')
