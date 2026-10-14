# Diagnostic orchestration only. Never imported by a tested process.
import hashlib,json,os,pathlib,platform,signal,subprocess,sys,tarfile,time,urllib.request,zipfile
source=pathlib.Path(__file__).resolve().parent
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
assert platform.system()=='Linux' and platform.machine()=='x86_64'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
archive=source/'runner-upstream-portable.tar.gz'
assert sha(archive)=='b2b69e623694b0224df05c234e1c70e1b9fa70775fbb2264c1ceb4171f8b20ad'
with tarfile.open(archive) as t:t.extractall(out/'portable')
repo=out/'portable/runner-upstream-portable'
manifest=json.loads((repo/'SOURCE.json').read_text())
def verify():
 for f in manifest['files']:assert sha(repo/f['file'])==f['sha256'],f
 assert not any(repo.rglob('node_modules'))
 return {'copiedFilesVerified':len(manifest['files']),'wholeTree':{str(p.relative_to(repo)):sha(p) for p in sorted(repo.rglob('*')) if p.is_file()}}
before=verify();(out/'source-before.json').write_text(json.dumps(before,indent=2))
versions={}
for v,a in json.loads((source/'assets.json').read_text()).items():
 folder=out/'binaries'/v;folder.mkdir(parents=True)
 z=folder/'bun-linux-x64.zip';urllib.request.urlretrieve(a['browser_download_url'],z)
 assert z.stat().st_size==a['size'] and 'sha256:'+sha(z)==a['digest']
 with zipfile.ZipFile(z) as f:f.extractall(folder)
 binary=folder/'bun-linux-x64/bun';binary.chmod(0o755)
 version=subprocess.check_output([binary,'--version'],text=True).strip()
 revision=subprocess.check_output([binary,'--revision'],text=True).strip()
 assert version==v and a['revision'].startswith(revision.split('+')[-1]),revision
 versions[v]={'binary':str(binary),'version':version,'revision':revision,'binarySha256':sha(binary),'archiveSha256':sha(z),'release':a}
runtime={'versions':versions,'uname':platform.uname()._asdict(),'python':sys.version,'cpu':pathlib.Path('/proc/cpuinfo').read_text(),'limits':pathlib.Path('/proc/self/limits').read_text(),'selectedEnvironment':{k:v for k,v in os.environ.items() if k in ['CI','RUNNER_OS','RUNNER_ARCH','ImageOS','ImageVersion','LANG','LC_ALL','NODE_OPTIONS'] or k.startswith(('BUN_','JSC_'))}}
(out/'runtime.json').write_text(json.dumps(runtime,indent=2))
normal=['closed-cursors.test.ts','runner-idle-empty.test.ts','runner-idle-assert.test.ts','runner-source-standalone.ts']
controls=['runner-source-test-retained.test.ts','runner-source-standalone-retained.ts','runner-body-test-retained.test.ts','runner-idle-adapter-retained.test.ts']
pairs=[(n,r,False) for r in range(1,4) for n in normal]+[(n,1,True) for n in controls]
jobs=[]
for i,(name,rep,control) in enumerate(pairs):
 for v in (['1.4.0','1.4.3'] if i%2==0 else ['1.4.3','1.4.0']):jobs.append((v,name,rep,control))
assert len(jobs)==32
(out/'schedule.json').write_text(json.dumps(jobs,indent=2));results=[]
for index,(v,name,rep,control) in enumerate(jobs,1):
 folder=out/'cases'/f'{index:02d}-{v}-{name}-{rep}';folder.mkdir(parents=True)
 cmd=[versions[v]['binary']]+(['test'] if name.endswith('.test.ts') else [])+[str(repo/'packages/valdres/test/retention'/name)]
 env=os.environ.copy();env.update(VALDRES_RETENTION_CAPTURE_DIR=str(folder/'capture'),RUNNER_RESULT=str(folder/'standalone-result.json'))
 cwd=repo/'packages/valdres'
 (folder/'command.json').write_text(json.dumps({'argv':cmd,'cwd':str(cwd),'env':{k:env[k] for k in ['VALDRES_RETENTION_CAPTURE_DIR','RUNNER_RESULT']}},indent=2))
 begin=time.monotonic();timeout=False
 with (folder/'stdout.log').open('w') as stdout,(folder/'stderr.log').open('w') as stderr:
  child=subprocess.Popen(cmd,cwd=cwd,env=env,stdout=stdout,stderr=stderr,start_new_session=True)
  try:code=child.wait(timeout=20)
  except subprocess.TimeoutExpired:timeout=True;os.killpg(child.pid,signal.SIGKILL);code=child.wait()
 result={'index':index,'version':v,'name':name,'repetition':rep,'deliberateRetention':control,'exit':code,'parentTimeout':timeout,'seconds':time.monotonic()-begin,'folder':str(folder.relative_to(out))}
 results.append(result);(folder/'result.json').write_text(json.dumps(result,indent=2));(out/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(result),flush=True)
after=verify();assert after==before
(out/'source-after.json').write_text(json.dumps(after,indent=2))
print('Finished 32 planned processes; child failures are preserved evidence, not passing tests.',flush=True)
