"""Audit source and final ZIP, extract and verify all hashes, no credentials needed."""
from pathlib import Path, PurePosixPath
import hashlib, importlib.util, json, re, tempfile, zipfile
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('builder', ROOT/'build-portable.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)

def audit():
    issues=[]
    def check(name,data):
        parts=PurePosixPath(name).parts
        if any(x in {'.env','config.json','bridge-token.txt','plugin.js','canvas','screenshots','logs','node_modules'} for x in parts) or name.endswith('.local.json'):
            issues.append('private file: '+name)
        patterns=[rb'[A-Za-z]:[/\\]+Users[/\\]+(?!Public)[^/\\\s"\']+',rb'\bsk-[A-Za-z0-9_-]{30,}',rb'\bgh[pousr]_[A-Za-z0-9]{30,}',rb'-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----']
        for pattern in patterns:
            if re.search(pattern,data,re.I):issues.append('identity/credential pattern: '+name)
    for p in builder.source_files():check(p.relative_to(ROOT).as_posix(),p.read_bytes())
    archives=sorted((ROOT/'release-assets').glob('*.zip'))
    assert len(archives)==1, 'Build one current release first'
    archive=archives[0]
    with zipfile.ZipFile(archive) as z:
        names=z.namelist();assert len(names)==len(set(names))
        prefix=names[0].split('/')[0]+'/'
        manifest=json.loads(z.read(prefix+'MANIFEST.sha256.json'))
        assert set(names)=={prefix+n for n in manifest}|{prefix+'MANIFEST.sha256.json'}
        with tempfile.TemporaryDirectory(prefix='cowart-audit-') as tmp:
            for n in names:
                assert not PurePosixPath(n).is_absolute() and '..' not in PurePosixPath(n).parts
                data=z.read(n);check(n,data)
            z.extractall(tmp)
            for n,h in manifest.items():
                assert hashlib.sha256(z.read(prefix+n)).hexdigest()==h,n
                assert hashlib.sha256((Path(tmp)/prefix/n).read_bytes()).hexdigest()==h,n
    report={'archive':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':len(names),'issues':sorted(set(issues)),'scope':'All source and ZIP bytes; heuristic credential/identity scan, not a legal or exhaustive security audit; extracted manifest verified.'}
    (ROOT/'release-assets/AUDIT.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report,indent=2));assert not issues
if __name__=='__main__':audit()
