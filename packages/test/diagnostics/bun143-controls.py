import json,os,pathlib,re,subprocess,time
root=pathlib.Path.cwd();out=root/'.context/bun143-c1-native';out.mkdir(parents=True,exist_ok=True);rows=[]
for mode in ['retained-committed','retained-present','retained-absent','premature-present','premature-absent','retained-scope','premature-scope']:
 target=out/('control-'+mode);env={**os.environ,'VALDRES_RETENTION_CAPTURE_DIR':str(target)}
 start=time.monotonic()
 with (out/(mode+'.log')).open('w') as log:
  result=subprocess.run(['python3','packages/test/diagnostics/retention-control.py',mode],env=env,stdout=log,stderr=subprocess.STDOUT)
 text=(target/'control.log').read_text() if (target/'control.log').exists() else (out/(mode+'.log')).read_text()
 expected='true' if mode.startswith('premature') or mode=='retained-committed' else 'false'
 received='false' if expected=='true' else 'true'
 row={'mode':mode,'exit':result.returncode,'seconds':time.monotonic()-start,'assertionFailure':'expect(received).toBe(expected)' in text,'timeout':'timed out' in text,'expected':re.findall(r'Expected: (true|false)',text),'received':re.findall(r'Received: (true|false)',text)}
 rows.append(row);(out/'controls.json').write_text(json.dumps(rows,indent=2));print(json.dumps(row),flush=True)
 if result.returncode!=1 or not row['assertionFailure'] or expected not in row['expected'] or received not in row['received'] or row['timeout']:raise SystemExit('Control did not prove its intended assertion; stop adoption and inspect.')
