# Releasing Valdres 1.0

This is the release gate for the first stable Valdres release. A green build is
necessary but is not, by itself, approval to publish. The release owner must be
able to check every item below against the exact commit and npm artifacts being
promoted.

The public compatibility decisions that this process protects are documented in
the [1.0 compatibility contract](https://valdres.dev/guides/compatibility).

## Current prerelease state

The repository is still in Changesets prerelease mode. At the time this runbook
was written, `.changeset/pre.json` has `"mode": "pre"` and `"tag": "beta"`. Do
not assume that merging a Version Packages PR will publish to `latest` while
that is true: Changesets publishes prereleases to the tag in this file.

To move from the beta stream to the release-candidate stream, use Changesets; do
not hand-edit `pre.json`, package versions, or changelogs:

```bash
bunx changeset pre exit
bunx changeset pre enter rc
```

Review and commit the resulting `.changeset/pre.json` change in its own release
PR. These commands only change prerelease mode. The normal Version Packages PR
does the versioning, and the publish workflow publishes after that PR merges.
The first `rc` prerelease may be numbered `1.0.0-rc.0` by Changesets; it is the
RC1 milestone in this document.

After RC2 has passed every gate and the stable-release conditions below are met,
leave prerelease mode once more:

```bash
bunx changeset pre exit
```

Commit the generated `pre.json` change. Let the Version Packages PR produce the
stable versions. Do not run `bun run version-packages` on an ordinary feature
branch or edit the generated release files by hand.

## Gates for every candidate

Every RC and the final 1.0 commit must pass all required CI checks, plus these
release-specific gates.

### E3: packed-tarball gate

E3 is the external-review name for the GitHub Actions job
`Valdres published-package gate`. It must be green on the exact candidate
commit:

```bash
bun run scripts/check-valdres-package.ts --build --self-test
```

This is the artifact gate, not another source-tree test. It builds `valdres`,
runs `npm pack` once, first proves that each validator rejects its targeted bad
tarball, and then sends the single intact tarball through manifest, exports,
types, runtime, consumer-build, side-effect, and size checks. Do not waive a
failure because source tests pass, and do not validate a separately packed
artifact.

### Public API snapshot and semver diff

This gate is not implemented in the current CI. It is release infrastructure
that must be built, made required on PRs, and proven green before RC1 can be
declared. Name the required check `api-snapshot / semver-diff` so release owners
can identify it consistently.

The API gate operates on the declarations that ship in `dist/types`, after the
declaration-import rewrite. It does not snapshot `src`, source `.ts` files, or
an editor's inferred types.

- At RC1, build the tarball and freeze its complete normalized `dist/types` tree
  as the 1.0 API snapshot.
- On every later PR, rebuild `dist/types` and semantically diff it against that
  snapshot.
- The check must report additions, removals, changed overloads, changed generic
  constraints/defaults, changed optionality, and changed exported types. A text
  diff alone is supporting evidence, not the semver decision.
- Before RC1, an intentional API difference must have an explicit semver
  classification. After RC1, any public declaration difference is a release
  blocker, even when the tool classifies it as additive.
- If a necessary API change is found after RC1, make the change in a new
  candidate, replace the frozen snapshot deliberately, and restart the RC quiet
  period. That candidate becomes the new API-freeze point.

The gate must compare the packed declaration surface for every public export,
including `valdres/adapter-internals/v1`, and must be green on the release
commit. RC1 cannot be declared until the committed snapshot and PR check exist.

### Publish and dist-tag verification

The publish workflow already runs the full build, type build, and
`bun run verify-publish` before Changesets publishes. Once npm reports success,
verify the registry rather than relying only on the workflow log. For each
published package, compare the expected version with both the explicit version
and its intended tag:

```bash
npm view valdres@<version> version
npm view valdres dist-tags --json
npm view valdres@latest version
```

For RCs, the new version must be on `rc` and `latest` must remain the previous
stable release. For 1.0, `valdres@latest` and `dist-tags.latest` must both
resolve to exactly `1.0.0`. Repeat the checks for every package listed as
published by Changesets. A version that exists only by explicit lookup has not
completed the stable release.

Install `valdres@latest` into a clean consumer after the tag has converged and
run one final import/type smoke test. If a publish is partial, stop: reconcile
the versions and tags before retrying the workflow.

## RC1: API freeze

RC1 is the first candidate with the intended 1.0 public API. It requires:

- [ ] all ordinary CI checks green on the candidate commit;
- [ ] E3 green on the exact packed tarball;
- [ ] the normalized `dist/types` snapshot committed;
- [ ] `api-snapshot / semver-diff` required and green;
- [ ] the public 1.0 compatibility contract reviewed against the artifact; and
- [ ] no unresolved public-API decision.

After RC1, feature work and opportunistic refactors stop. Only release-blocking
fixes, tests, and documentation corrections enter the candidate branch. An API
change resets the freeze and the quiet-period clock.

## RC2: burn-in

RC2 is not a ceremonial republish. It begins only after RC1 has had a quiet
period and the following behavior has been exercised from packed packages in
real applications, with evidence linked from the release issue:

- [ ] SSR: concurrent request stores render and hydrate without cross-request
      state leakage, and request stores are disposed;
- [ ] HMR: ordinary modules update as expected, duplicate runtime graphs fail
      clearly, and global-name singletons preserve their documented first
      definition until a full reload;
- [ ] high-cardinality families: creation, lookup, subscription churn, release,
      and garbage-collection behavior are exercised at realistic cardinality;
- [ ] async cancellation: superseded, unmounted, and disposed selector work is
      aborted without stale commits or unhandled rejections;
- [ ] scopes: inheritance, shadowing, reset/unset, transactions, and disposal
      are exercised across nested scopes;
- [ ] React adapter in a real application;
- [ ] Vue adapter in a real application;
- [ ] Svelte adapter in a real application;
- [ ] Solid adapter in a real application; and
- [ ] Angular adapter in a real application.

Record the app or fixture, runtime and framework versions, scenario, result, and
candidate tarball version for every item. A unit test or source-workspace demo
alone is not burn-in evidence.

The quiet period is deliberate. The external review's point stands: roughly
16,000 lines have been inserted since `valdres@1.0.0-beta.17`. RC2 exists to let
that change settle under realistic workloads, not to create a deadline for more
changes.

## Stable 1.0 approval

Publish 1.0 only when all of the following are true:

- [ ] there are zero known P0 or P1 defects;
- [ ] there were no public API changes between the accepted RC1 freeze point and
      RC2;
- [ ] RC2 completed the full burn-in checklist and quiet period;
- [ ] all candidate gates, including E3 and `api-snapshot / semver-diff`, are
      green on the exact stable commit;
- [ ] `.changeset/pre.json` was moved out of `rc` prerelease mode with
      `bunx changeset pre exit` and the resulting Version Packages PR contains
      only expected release metadata; and
- [ ] the published 1.0 versions resolve from npm's `latest` dist-tag.

P0 means data loss, state corruption or isolation failure, a security issue, or
a broadly unusable package. P1 means a broken documented contract, a broken
supported runtime or adapter, or a common workflow with no reasonable
workaround. “Known” includes reproducible reports that have not yet been fully
root-caused; uncertainty is not a reason to remove an issue from the count.

If any condition fails, keep the release in RC. Do not move a prerelease to
`latest` manually to bypass the Version Packages and publish workflows.
