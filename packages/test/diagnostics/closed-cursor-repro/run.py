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
jobs=[("bun","unchanged",False,["bun","test","packages/valdres/test/retention/closed-cursors.test.ts"])]
for stage in ["valdres","queue","direct","released"]:
    for engine in ["bun","node"]:
        for retain in [False,True]:
            cmd=["bun","test",str(src/"bun.test.ts")] if engine=="bun" else ["node","--expose-gc","--test",str(src/"node.test.mjs")]
            jobs.append((engine,stage,retain,cmd))
results=[]
for engine,stage,retain,cmd in jobs:
    name=f"{engine}-{stage}-{'retained' if retain else 'released'}"
    folder=out/name; folder.mkdir()
    env=os.environ.copy();env.update(REPRO_STAGE=stage,REPRO_RETAIN="1" if retain else "0",VALDRES_RETENTION_CAPTURE_DIR=str(folder/"capture"))
    (folder/"command.json").write_text(json.dumps({"argv":cmd,"cwd":str(repo),"env":{k:env[k] for k in ["REPRO_STAGE","REPRO_RETAIN","VALDRES_RETENTION_CAPTURE_DIR"]}},indent=2))
    begin=time.monotonic()
    with (folder/"stdout.log").open("w") as stdout,(folder/"stderr.log").open("w") as stderr:
        try:
            r=subprocess.run(cmd,cwd=repo,env=env,stdout=stdout,stderr=stderr,timeout=20)
            code=r.returncode
        except subprocess.TimeoutExpired: code="parent-timeout"
    result={"name":name,"exit":code,"seconds":time.monotonic()-begin,"deliberateRetention":retain}
    results.append(result);(folder/"result.json").write_text(json.dumps(result,indent=2))
    (out/"results.json").write_text(json.dumps(results,indent=2))
    print(json.dumps(result),flush=True)
# Experimental failures are data, not assertions that the product/gate passes.
# Each child exit/log remains preserved; no release path invokes this script.
