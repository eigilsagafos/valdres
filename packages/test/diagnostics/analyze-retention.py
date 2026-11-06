"""Offline only: identify marked targets and bounded reverse paths in saved graphs."""
import collections
import json
from pathlib import Path
import sys

directory = Path(sys.argv[1])
results = []
known_path = False
for manifest_path in sorted(directory.rglob("manifest.json")):
    manifest = json.loads(manifest_path.read_text())
    for record in manifest["snapshots"]:
        path = manifest_path.parent / record["file"]
        data = json.loads(path.read_text())
        assert data["type"] == "Inspector" and data["version"] == 3
        nodes = {data["nodes"][i]: data["nodeClassNames"][data["nodes"][i + 2]] for i in range(0, len(data["nodes"]), 4)}
        reverse = collections.defaultdict(list)
        properties = collections.defaultdict(list)
        for i in range(0, len(data["edges"]), 4):
            origin, target, kind, name = data["edges"][i:i + 4]
            kind = data["edgeTypes"][kind]
            name = data["edgeNames"][name] if kind in {"Property", "Variable"} else str(name)
            edge = {"from": origin, "fromClass": nodes[origin], "to": target, "type": kind, "name": name}
            reverse[target].append(edge)
            if kind == "Property":
                properties[name].append(edge)
        for target in manifest["targets"]:
            markers = properties[target["property"]]
            ids = {edge["from"] for edge in markers} if target["match"] == "marker" else {
                edge["from"] for marker in markers for edge in reverse[marker["to"]]
                if edge["type"] == "Property" and edge["name"] == "key"
            }
            entry = {"snapshot": str(path.relative_to(directory)), **record, **target, "candidateCount": len(ids), "candidates": []}
            for identifier in sorted(ids)[:20]:
                queue = collections.deque([(identifier, [])])
                seen = set()
                roots = []
                control_paths = []
                ancestors = []
                depth_cut = False
                while queue and len(seen) < 20_000:
                    node, chain = queue.popleft()
                    if node in seen:
                        continue
                    seen.add(node)
                    if node == 0:
                        roots.append(chain)
                        continue
                    if len(chain) >= 32:
                        depth_cut = True
                        continue
                    for edge in reverse[node]:
                        if len(chain) < 4:
                            ancestors.append(edge)
                        next_chain = [edge] + chain
                        if edge["name"] == "__valdresDeliberatelyRetainedCommitCallback":
                            control_paths.append(next_chain)
                            known_path = True
                        queue.append((edge["from"], next_chain))
                entry["candidates"].append({
                    "id": identifier, "class": nodes[identifier], "reportedRootPaths": roots[:10],
                    "knownControlPaths": control_paths, "nearAncestors": ancestors[:100],
                    "visited": len(seen), "searchTruncated": bool(queue) or depth_cut,
                })
            results.append(entry)
report = {
    "limitation": "No reported root is not proof of no root. Conservative roots may be omitted; bounded search may truncate. Scalar-key matches are candidates, not cross-domain identities.",
    "knownRetainedCallbackPathFound": known_path, "results": results,
}
(directory / "analysis.json").write_text(json.dumps(report, indent=2))
print(json.dumps({"snapshotsAndTargets": len(results), "knownRetainedCallbackPathFound": known_path}))
if "--require-control-path" in sys.argv and not known_path:
    sys.exit("Saved snapshots did not identify the known callback retaining path")
