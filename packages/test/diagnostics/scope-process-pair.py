"""One fresh-process pair; no retries, production edits or assertion changes."""
import hashlib,json,os,re,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parents[3]
package=root/'packages/valdres'
output=Path(os.environ['VALDRES_PAIR_DIR'])
output.mkdir(parents=True,exist_ok=True)
files=json.loads((Path(__file__).parent/'recorded-prefix-files.json').read_text())
target='scope disposal releases pins and detaches MembershipRecord routes exactly once'
excluded=['cold RowViews and their inherited route do not retain row definitions','releases a successful row lane retained by its closed cursor and writer','keeps same-domain definitions isolated across Store disposal','materializes, settles, and disposes a deep inheritance chain iteratively']
pattern='^(?!.*(?:'+'|'.join(re.escape(x) for x in excluded)+'))'
expected_names=json.loads((Path(__file__).parent/'recorded-prefix-test-names.json').read_text())
results=[]
for mode,selected,selection in [('isolated',[files[-1]],target),('prefix',files,pattern)]:
 dest=output/mode;dest.mkdir()
 command=['bun','test','--reporter=dots',*selected,'--reporter=junit','--reporter-outfile='+str(dest/'junit.xml'),'-t',selection]
 env={**os.environ,'VALDRES_RETENTION_CAPTURE_DIR':str(dest/'capture')}
 (dest/'command.json').write_text(json.dumps({'command':command,'cwd':str(package),'env':{'VALDRES_RETENTION_CAPTURE_DIR':env['VALDRES_RETENTION_CAPTURE_DIR']}},indent=2))
 start=time.monotonic()
 with (dest/'test.log').open('w') as log:
  result=subprocess.run(command,cwd=package,env=env,stdout=log,stderr=subprocess.STDOUT)
 text=(dest/'test.log').read_text()
 actual=re.findall(r'(?:^|::group::)(test/[^\n]+\.test\.tsx?):',text,re.M)
 passed=re.findall(r'\(pass\) (.*?) \[.*?ms\]',text)
 failed=re.findall(r'\(fail\) (.*?) \[.*?ms\]',text)
 row={'mode':mode,'seconds':time.monotonic()-start,'exitCode':result.returncode,'actualFileOrder':actual,'expectedFileOrder':selected,'fileOrderMatches':actual==selected,'passed':len(passed),'precedingTestOrderMatches':passed[:len(expected_names)]==expected_names if mode=='prefix' else None,'failed':failed,'targetResultLines':[line for line in text.splitlines() if target in line]}
 results.append(row)
 (dest/'result.json').write_text(json.dumps(row,indent=2))
 print(json.dumps(row),flush=True)
print(json.dumps(results,indent=2))
(output/'pair-results.json').write_text(json.dumps(results,indent=2))
sys.exit(1 if any(r['exitCode'] or not r['fileOrderMatches'] or (r['mode']=='prefix' and not r['precedingTestOrderMatches']) for r in results) else 0)
