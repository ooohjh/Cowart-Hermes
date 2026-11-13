"""Run zero-paid adapter tests with target-independent, isolated runtime paths."""
from pathlib import Path
import json, os, re, subprocess, tempfile
ROOT=Path(__file__).resolve().parents[1]

def main():
    base=Path(os.environ.get('TMPDIR',ROOT/'.validation'));base.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='cowart-validation-',dir=base) as tmp:
        env=os.environ.copy()
        for key in ('HOME','USERPROFILE','HERMES_HOME','TMPDIR','TMP','TEMP'):
            env[key]=tmp
        tests=sorted(str(p) for p in (ROOT/'tests').glob('*.test.mjs'))
        assert tests,'No tests discovered'
        result=subprocess.run(['node','--test','--test-reporter=tap',*tests],cwd=ROOT,env=env,text=True,encoding='utf8',errors='replace',stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        output=result.stdout;print(output)
        assert result.returncode==0,'Adapter tests failed'
        counts={k:int(v) for k,v in re.findall(r'# (tests|pass|fail|cancelled|skipped) (\d+)',output)}
        assert counts.get('tests',0)>0 and counts.get('fail')==0,counts
        smoke=subprocess.run(['node','tests/storage-real-mcp.mjs'],cwd=ROOT,env=env,text=True,capture_output=True,encoding='utf8')
        print(smoke.stdout);assert smoke.returncode==0,smoke.stderr
        report={'adapter':counts,'realVendoredMcpStorage':'passed','paidRequests':0,'liveProfileModified':False,'scope':'adapter unit tests plus isolated real vendored MCP input/output/asset-read; no GUI, installation or compatible core end-to-end acceptance'}
        out=ROOT/'release-assets';out.mkdir(exist_ok=True)
        (out/'VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
        print(json.dumps(report,indent=2))
if __name__=='__main__':main()
