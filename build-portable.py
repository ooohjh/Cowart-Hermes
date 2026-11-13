"""Offline, deterministic packaging; no installation, network or live profile access."""
from pathlib import Path
import hashlib
import json
import zipfile
ROOT = Path(__file__).resolve().parent
EXCLUDE = {'.git', 'release-assets', '.validation', '__pycache__'}
PRIVATE = {'config.json', 'bridge-token.txt', 'plugin.js', '.env'}

def source_files():
    return sorted(p for p in ROOT.rglob('*') if p.is_file()
                  and not any(x in EXCLUDE for x in p.relative_to(ROOT).parts)
                  and p.name not in PRIVATE and not p.name.endswith(('.local.json', '.pyc', '.log')))

def build():
    version = json.loads((ROOT / 'package.json').read_text())['version']
    prefix = f'Cowart-Hermes-Windows-{version}-source'
    out = ROOT / 'release-assets'; out.mkdir(exist_ok=True)
    files = {p.relative_to(ROOT).as_posix(): p.read_bytes() for p in source_files()}
    manifest = {n: hashlib.sha256(b).hexdigest() for n, b in files.items()}
    files['MANIFEST.sha256.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    target = out / (prefix + '.zip')
    # ZIP_STORED avoids compression-library-version differences across Python releases.
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_STORED) as z:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(prefix + '/' + name, (2020, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            z.writestr(info, data)
    sha = hashlib.sha256(target.read_bytes()).hexdigest()
    (out / 'SHA256SUMS.txt').write_text(f'{sha}  {target.name}\n', encoding='utf8')
    print(json.dumps({'artifact': target.name, 'sha256': sha, 'files': len(files), 'bytes': target.stat().st_size}))
    return target

if __name__ == '__main__':
    build()
