from pathlib import Path
import difflib,json,hashlib
repo=Path(__file__).resolve().parents[4]
p=Path(__file__).resolve().parent
folder=repo/"packages/valdres/test/retention"
original=(folder/"closed-cursors.test.ts").read_text()
shim='../../../test/diagnostics/runner-source/standalone'
bundle='../../../test/diagnostics/runner-source/valdres.mjs'
fixtures={}
for source in ("source","bundle"):
 for runner in ("test","standalone"):
  name=f"runner-{source}-{runner}"
  text=original
  if source=="bundle":text=text.replace('from "../../src/index"',f'from "{bundle}"')
  if runner=="standalone":text=text.replace('from "bun:test"',f'from "{shim}"')
  fixtures[name]=text
  fixtures[name+"-retained"]=text.replace('tx.onCommit(() => {','tx.onCommit((globalThis as any).__runnerRetainedEffect = () => {')
fixtures["runner-source-test-idle-adapter"]='import "'+shim+'"\n'+original
start=original.index('                tx.onCommit(() => {')
end=original.index('                if (abort)',start)
bodyonly=original[:start]+original[end:]
bodyonly=bodyonly.replace('if (abort) throw new Error("abort")','if (abort) throw new Error("abort")\n                return payload.n')
fixtures['runner-body-test']=bodyonly
fixtures['runner-body-standalone']=bodyonly.replace('from "bun:test"',f'from "{shim}"')
fixtures['runner-body-test-retained']=bodyonly.replace('s.txn(tx => {','s.txn((globalThis as any).__runnerRetainedBody = tx => {')
helper='''function registerHook(s: ReturnType<typeof store>, cursors: Transaction[], abort: boolean, callback: (() => unknown) | undefined) {
    try {
        s.txn(tx => {
            cursors.push(tx)
            tx.onCommit(callback!)
            if (abort) throw new Error("abort")
        })
    } finally { callback = undefined }
}
'''
hookonly=original.replace('const tick = ',helper+'const tick = ')
a=hookonly.index('            s.txn(tx => {');b=hookonly.index('        } catch {}',a)
hookonly=hookonly[:a]+'''            registerHook(s, cursors, abort, () => {
                retentionPhase(abort ? "aborted" : "committed", "callback-start")
                return payload.n
            })
'''+hookonly[b:]
fixtures['runner-hook-test']=hookonly
fixtures['runner-hook-standalone']=hookonly.replace('from "bun:test"',f'from "{shim}"')
fixtures['runner-hook-test-retained']=hookonly.replace('registerHook(s, cursors, abort, () => {','registerHook(s, cursors, abort, (globalThis as any).__runnerRetainedEffect = () => {')
manifest=[]
for name,text in fixtures.items():
 suffix='.test.ts' if '-test' in name else '.ts'
 file=folder/(name+suffix);file.write_text(text)
 patch=''.join(difflib.unified_diff(original.splitlines(True),text.splitlines(True),fromfile='closed-cursors.test.ts',tofile=file.name))
 (p/(name+'.patch')).write_text(patch)
 manifest.append({'name':name,'file':str(file.relative_to(repo)),'sha256':hashlib.sha256(text.encode()).hexdigest()})
# Strong check: first standalone changes only the runner import, not body/layout.
assert fixtures['runner-source-standalone'].replace('from "'+shim+'"','from "bun:test"')==original
(p/'fixtures.json').write_text(json.dumps(manifest,indent=2))
