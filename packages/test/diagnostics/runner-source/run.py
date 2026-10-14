import os,json,pathlib,subprocess,sys,time,signal
repo=pathlib.Path(__file__).resolve().parents[4];src=pathlib.Path(__file__).resolve().parent
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
versions={'bun':subprocess.check_output(['bun','--revision'],text=True).strip(),'uname':subprocess.check_output(['uname','-a'],text=True).strip(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()}
assert versions['bun'].startswith('1.4.0'),versions
(out/'runtime.json').write_text(json.dumps(versions,indent=2))
manifest={x['name']:x for x in json.loads((src/'fixtures.json').read_text())}
jobs=[]
for source in ['source','bundle']:
 for runner in ['test','standalone']:
  # Use the unchanged original path for the source/bun:test anchor.
  key=f'runner-{source}-{runner}'
  for n in range(2):jobs.append((key,n+1))
  jobs.append((key+'-retained',1))
jobs += [('runner-source-test-idle-adapter',1),('runner-source-test-idle-adapter',2),('runner-body-test',1),('runner-body-standalone',1),('runner-hook-test',1),('runner-hook-standalone',1),('runner-body-test-retained',1),('runner-hook-test-retained',1)]
assert len(jobs)==20
results=[]
for name,rep in jobs:
 folder=out/f'{name}-{rep}';folder.mkdir()
 file=repo/manifest[name]['file']
 if name=='runner-source-test':file=repo/'packages/valdres/test/retention/closed-cursors.test.ts'
 cmd=['bun']+(['test'] if '-test' in name else [])+[str(file)]
 env=os.environ.copy();env.update(VALDRES_RETENTION_CAPTURE_DIR=str(folder/'capture'),RUNNER_RESULT=str(folder/'standalone-result.json'))
 cwd=repo/'packages/valdres'
 (folder/'command.json').write_text(json.dumps({'argv':cmd,'cwd':str(cwd),'env':{k:env[k]for k in ['VALDRES_RETENTION_CAPTURE_DIR','RUNNER_RESULT']}},indent=2))
 begin=time.monotonic();timeout=False
 with (folder/'stdout.log').open('w') as stdout,(folder/'stderr.log').open('w') as stderr:
  child=subprocess.Popen(cmd,cwd=cwd,env=env,stdout=stdout,stderr=stderr,start_new_session=True)
  try:code=child.wait(timeout=20)
  except subprocess.TimeoutExpired:
   timeout=True;os.killpg(child.pid,signal.SIGKILL);code=child.wait()
 result={'name':name,'repetition':rep,'exit':code,'parentTimeout':timeout,'seconds':time.monotonic()-begin}
 results.append(result);(folder/'result.json').write_text(json.dumps(result,indent=2));(out/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(result),flush=True)
