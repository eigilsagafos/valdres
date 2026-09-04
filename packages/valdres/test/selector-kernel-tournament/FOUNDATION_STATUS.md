# Foundation implementation status

The initial checkout matched the required specification merge exactly:
`20dddc5c307a1213f3888ab0dabc60a59a165b36`.

This is incomplete foundation work, not an eligible tournament report. No
candidate implementation, public kernel interface, candidate workspace, winner,
or promotion decision exists. The beta.36 runtime tree remains
`35a20a12ff1087140b08622f9057c857900d17e5`.

| Work order | Status                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0         | Implemented and verified against the current v1 inventory. Includes the specifically authorized empty Changeset and specification hash update.                                              |
| F1         | Shipping build/pack driver, separate counter-marker build, installed Node/Bun probes, and admission self-tests implemented. Actual common-counter instrumentation belongs to unfinished F2. |
| F2         | Independent exhaustive graph oracle implemented; complete semantic runner blocked by the normative defects below.                                                                           |
| F3–F6      | Not started; sequential dependencies remain unsatisfied.                                                                                                                                    |
| F7         | No green control bundle exists. Packed probes are diagnostic evidence only.                                                                                                                 |
| F8         | Not complete. Current unit mutations do not constitute the required full red proof bundle.                                                                                                  |
| F9         | Not complete. Independent defect/artifact reviews are not the final neutrality/statistics review. No merge or candidate launch is permitted.                                                |

## Recorded normative defects

Independent read-only review reproduced these facts against the installed
production beta.36 tarball under Node and Bun. Existing tests and ceilings have
not been changed to accommodate them.

1. **Global atoms are outside the public rewrite.** `M-GLOBAL-FANOUT` imports
   legacy `src/lib/globalAtom` through `architecture.memory.ts`. The packed root
   exports no `globalAtom`. The user confirmed that global atoms are outside
   this rewrite; the normative inventory still requires a recorded correction.
2. **Native async settlement is unsupported by the frozen root.** Returning a
   Promise from a selector throws `InvalidSynchronousSelectorResultError`.
   Selector callback context, `Store.onChange`, and `Store.onCommitEnd` are
   absent. The required `A-ASYNC-001`, `P-ASYNC-SETTLE-OBSERVED`, and
   `M-STORE-DISPOSAL-ASYNC-CANCELLATION` instead target legacy behavior.
   Clarifying whether native async settlement is also outside scope remains
   pending.
3. **Missing hydration readers are a synthetic TestHost feature.**
   `test/v1-selector-evaluator/evaluator.test.ts` constructs
   `MISSING_SERVER_READER` inside its TestHost. The public adapter accepts only
   `(store, state)` and reads committed leaves in a disposable selector host.
   Catching an invalid-state TypeError permits the selector to return a
   fallback; that is not a sticky missing-reader fault. `A-HYDRATE-001`
   conflates these distinct contracts. Disposable hydration isolation must
   remain covered.
4. **A1's path rotation contradicts the frozen independent oracle.** For
   `a -> b -> a`, the circular cause blames `b` but records `[a, b, a]`. The
   public read wraps that cause in `SelectorDependencyError` and
   `SelectorGetterError`. The frozen `V1M-SEL-ORACLE-004` test explicitly pins
   this blame and path; A1 instead requires `[b, a, b]`. The new invariant
   validator deliberately retains A1 as written and rejects the rotated path,
   exposing the contradiction instead of silently relaxing it.

Importing legacy runtime source would not measure the shipping control. Adding
these capabilities would violate the foundation source/public-surface boundary.
Removing required assertions without a recorded normative correction would
violate the work order. These facts must be resolved before calling F2/F7 green.

## Reproduction

Run input and self-test checks from a clean checkout:

```sh
bun scripts/selector-kernel-tournament/inputs.mjs check
bun scripts/selector-kernel-tournament/inputs.mjs protected
cd packages/valdres
bun run test:selector-kernel-tournament
```

Pack into a new, nonexistent absolute directory at the shared evidence root:

```sh
bun scripts/selector-kernel-tournament/artifact.mjs pack \
  1c03f126ba714d0765c3386e613f4c892b89829b /absolute/new-control timed
bun scripts/selector-kernel-tournament/artifact.mjs smoke /absolute/new-control
```

Repeat with a different directory and `counter` for the separate marker build.
Both commands reject output reuse. These are shipping artifact checks, not
latency measurements. The smoke verifies the resolved production entry and its
hash, including root/adapter singleton compatibility.

To reproduce the contract facts, copy
`scripts/selector-kernel-tournament/control-contract-probe.mjs` into either
installed `consumer-node` or `consumer-bun` directory, then run that file with
the corresponding runtime. It outputs diagnostics and never a conformance or
eligibility pass.

Development artifacts and the diagnostic bundle live under:

```text
~/.gstack/projects/eigilsagafos-valdres/selector-kernel-tournament/foundation-development/
```

This path is explicitly outside the authoritative candidate-run layout. No
candidate workspace is permitted next; this foundation workspace must first
resolve the specification defects, finish F0–F9, record green/red proofs, and
have its PR merged.
