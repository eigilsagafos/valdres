import os, json, pathlib, subprocess, sys, time
repo=pathlib.Path(__file__).resolve().parents[4]
src=pathlib.Path(__file__).resolve().parent
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
versions={}
for engine,args in [("bun",["bun","--revision"]),("node",["node","--version"])]:
    versions[engine]=subprocess.check_output(args,text=True).strip()
versions["uname"]=subprocess.check_output(["uname","-a"],text=True).strip()
versions["head"]=subprocess.check_output(["git","rev-parse","HEAD"],cwd=repo,text=True).strip()
(out/"runtime.json").write_text(json.dumps(versions,indent=2))
assert versions["bun"].startswith("1.4.0"),versions
assert versions["node"]=="v24.16.0",versions
jobs=[]
for fixture in ["fixture-bundle", "fixture-queue", "fixture-direct", "fixture-released", "fixture-queue-retained"]:
    for engine in ["bun","node"]:
        path=str(src/f"{fixture}.test.{'ts' if engine=='bun' else 'mjs'}")
        cmd=["bun","test",path] if engine=="bun" else ["node","--expose-gc","--test",path]
        jobs.append((engine,fixture,fixture.endswith("retained"),cmd))
jobs.append(("bun","valdres",False,["bun","test",str(src/"portable-source.test.ts")]))
results=[]
for engine,stage,retain,cmd in jobs:
    cwd=repo/"packages/valdres" if engine=="bun" else repo
    name=f"{engine}-{stage}-{'retained' if retain else 'released'}"
    folder=out/name; folder.mkdir()
    env=os.environ.copy();env.update(REPRO_STAGE=stage,REPRO_RETAIN="1" if retain else "0",VALDRES_RETENTION_CAPTURE_DIR=str(folder/"capture"))
    (folder/"command.json").write_text(json.dumps({"argv":cmd,"cwd":str(cwd),"env":{k:env[k] for k in ["REPRO_STAGE","REPRO_RETAIN","VALDRES_RETENTION_CAPTURE_DIR"]}},indent=2))
    begin=time.monotonic()
    with (folder/"stdout.log").open("w") as stdout,(folder/"stderr.log").open("w") as stderr:
        try:
            r=subprocess.run(cmd,cwd=cwd,env=env,stdout=stdout,stderr=stderr,timeout=20)
            code=r.returncode
        except subprocess.TimeoutExpired: code="parent-timeout"
    result={"name":name,"exit":code,"seconds":time.monotonic()-begin,"deliberateRetention":retain}
    results.append(result);(folder/"result.json").write_text(json.dumps(result,indent=2))
    (out/"results.json").write_text(json.dumps(results,indent=2))
    print(json.dumps(result),flush=True)
# Experimental failures are data, not assertions that the product/gate passes.
# Each child exit/log remains preserved; no release path invokes this script.
