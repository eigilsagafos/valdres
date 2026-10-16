"""Run an intentionally failing copy of a maintained assertion, never in its suite.

The child exit status is deliberately propagated so CI proves that always-upload
also works for a failed job. No assertion, deadline or detector round is changed.
"""
import difflib
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
package = root / "packages/valdres"
mode = sys.argv[1]
output = Path(os.environ["VALDRES_RETENTION_CAPTURE_DIR"]).resolve()
output.mkdir(parents=True, exist_ok=True)
source_name = "on-commit-retention" if mode == "retained-committed" else "collection-lifecycle"
source = package / f"test/v1-committed-store-tree/{source_name}.test.ts"
original = source.read_text()
text = original
if mode == "retained-committed":
    text = text.replace("tx.onCommit(() => {", "const retainedCallback = () => {", 1)
    text = text.replace("                })\n                if (abort)", """                }
                if (!abort) Object.defineProperty(globalThis, "__valdresDeliberatelyRetainedCommitCallback", { value: retainedCallback })
                tx.onCommit(retainedCallback)
                if (abort)""", 1)
    test_name = "retained closed cursors do not retain aborted or drained callbacks"
elif mode in {"premature-present", "premature-absent", "retained-present", "retained-absent"}:
    kind = mode.split("-")[1]
    text = text.replace('"./collection-test-transaction"', '"../v1-committed-store-tree/collection-test-transaction"')
    if mode.startswith("premature"):
        owner = "rows" if kind == "present" else "rows.scope(child)"
        insertion = f'        runCollectionTransaction(domain, root, (_txn, rows) => {owner}.reset(sessions("{kind}")))\n'
    else:
        insertion = f'        Object.defineProperty(globalThis, "__valdresDeliberatelyRetainedRow", {{ value: sessions("{kind}") }})\n'
    point = f'        retentionPhase("{kind}-owned", "ownership-created")'
    assert text.count(point) == 1
    text = text.replace(point, insertion + point, 1)
    test_name = "pins Present and Absent owners until reset"
elif mode in {"retained-scope", "premature-scope"}:
    text = text.replace('"./collection-test-transaction"', '"../v1-committed-store-tree/collection-test-transaction"')
    point = '        await expectRetained(detector)'
    assert text.count(point) == 1
    insertion = ('        child.dispose()\n' if mode == "premature-scope" else
        '        Object.defineProperty(globalThis, "__valdresDeliberatelyRetainedRow", { value: sessions("owned") })\n')
    text = text.replace(point, insertion + point, 1)
    test_name = "scope disposal releases pins and detaches MembershipRecord routes exactly once"
else:
    raise ValueError(mode)
assert text != original
fixture = package / f"test/retention-capture-controls/{mode}.test.ts"
assert not fixture.exists(), "Refusing to overwrite an existing control"
fixture.parent.mkdir(exist_ok=True)
fixture.write_text(text)
(output / "control.test.ts").write_text(text)
(output / "control.patch").write_text("".join(difflib.unified_diff(
    original.splitlines(True), text.splitlines(True), fromfile=str(source.relative_to(root)), tofile=str(fixture.relative_to(root)),
)))
command = ["bun", "test", str(fixture.relative_to(package)), "-t", test_name]
try:
    with (output / "control.log").open("w") as log:
        result = subprocess.run(command, cwd=package, stdout=log, stderr=subprocess.STDOUT)
finally:
    fixture.unlink()
(output / "control-result.json").write_text(json.dumps({
    "mode": mode, "command": command, "cwd": str(package), "exitCode": result.returncode,
}, indent=2))
print((output / "control.log").read_text())
if result.returncode == 0:
    raise RuntimeError("Negative control unexpectedly passed")
sys.exit(result.returncode)
