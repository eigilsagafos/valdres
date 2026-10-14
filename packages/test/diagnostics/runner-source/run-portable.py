import os,json,pathlib,subprocess,sys,time,signal
repo=pathlib.Path(__file__).resolve().parents[4]
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
native=sys.argv[2]=='native'
versions={'bun':subprocess.check_output(['bun','--revision'],text=True).strip(),'uname':subprocess.check_output(['uname','-a'],text=True).strip(),'source':json.loads((repo/'SOURCE.json').read_text()),'nodeModulesPresent':any(repo.rglob('node_modules'))}
assert versions['bun'].startswith('1.4.0'),versions
assert not versions['nodeModulesPresent']
(out/'runtime.json').write_text(json.dumps(versions,indent=2))
n=2 if native else 1
jobs=[('closed-cursors.test.ts',i+1)for i in range(n)]+[('runner-source-standalone.ts',i+1)for i in range(n)]+[('runner-source-test-retained.test.ts',1)]+[('runner-idle-empty.test.ts',i+1)for i in range(n)]+[('runner-idle-assert.test.ts',i+1)for i in range(n)]+[('runner-idle-adapter-retained.test.ts',1),('runner-body-test.test.ts',1),('runner-hook-test.test.ts',1)]
assert len(jobs)==(12 if native else 8)
results=[]
for name,rep in jobs:
 folder=out/f'{name}-{rep}';folder.mkdir()
 cmd=['bun']+(['test'] if name.endswith('.test.ts') else [])+[str(repo/'packages/valdres/test/retention'/name)]
 env=os.environ.copy();env.update(VALDRES_RETENTION_CAPTURE_DIR=str(folder/'capture'),RUNNER_RESULT=str(folder/'standalone-result.json'))
 cwd=repo/'packages/valdres'
 (folder/'command.json').write_text(json.dumps({'argv':cmd,'cwd':str(cwd),'env':{k:env[k]for k in ['VALDRES_RETENTION_CAPTURE_DIR','RUNNER_RESULT']}},indent=2))
 begin=time.monotonic();timeout=False
 with (folder/'stdout.log').open('w') as stdout,(folder/'stderr.log').open('w') as stderr:
  child=subprocess.Popen(cmd,cwd=cwd,env=env,stdout=stdout,stderr=stderr,start_new_session=True)
  try:code=child.wait(timeout=20)
  except subprocess.TimeoutExpired:timeout=True;os.killpg(child.pid,signal.SIGKILL);code=child.wait()
 result={'name':name,'repetition':rep,'exit':code,'parentTimeout':timeout,'seconds':time.monotonic()-begin}
 results.append(result);(folder/'result.json').write_text(json.dumps(result,indent=2));(out/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(result),flush=True)
