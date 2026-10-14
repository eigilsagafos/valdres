from pathlib import Path
import sys,re,shutil,json,hashlib,subprocess
repo=Path(__file__).resolve().parents[4];out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
source=repo/'packages/valdres/src';todo=[source/'index.ts'];seen=set()
while todo:
 p=todo.pop()
 if p in seen:continue
 seen.add(p)
 for match in re.finditer(r"(?:from\s+|import\s*)[\"']([^\"']+)[\"']",p.read_text()):
  v=match.group(1)
  if not v.startswith('.'):raise RuntimeError(('unexpected external source dependency',v))
  base=p.parent/v;found=next((f.resolve() for f in [base,base.with_suffix('.ts'),base/'index.ts'] if f.is_file()),None)
  if not found:raise RuntimeError(('unresolved dependency',p,v))
  todo.append(found)
files=set(seen)
for relative in ['LICENSE','package.json','tsconfig.json','packages/valdres/package.json','packages/valdres/tsconfig.json','packages/test/package.json','packages/test/src/LeakDetector.ts','packages/test/src/retentionCapture.ts','packages/valdres/test/retention/closed-cursors.test.ts']:
 files.add(repo/relative)
files.update((repo/'packages/valdres/test/retention').glob('runner-*.ts'))
for name in ['standalone.ts','empty.ts','valdres.mjs','PLAN.md','PLAN-B.md','run-portable.py','UPSTREAM.md']:
 files.add(repo/'packages/test/diagnostics/runner-source'/name)
records=[]
for p in sorted(files):
 rel=p.relative_to(repo);dest=out/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
 records.append({'file':str(rel),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(out/'SOURCE.json').write_text(json.dumps({'baseline':'348c943f4a3c73fca170de766776aed4b471c344','diagnosticHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),'bun':'1.4.0','bunRevision':'34cbb9a40b4bd1bd767d134a7065e66c2432a676','sourceFiles':len(seen),'files':records},indent=2))
shutil.copy2(repo/'packages/test/diagnostics/runner-source/UPSTREAM.md',out/'README.md')
print(json.dumps({'files':len(records),'sourceFiles':len(seen),'out':str(out)}))
