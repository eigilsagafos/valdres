# Releasing Valdres v1

This is the release gate for the first stable Valdres release. A green build is
necessary but is not, by itself, approval to publish. The release owner must be
able to check every item below against the exact commit and npm artifacts being
promoted.

The public compatibility decisions that this process protects are documented in
the [v1 compatibility contract](https://valdres.dev/guides/compatibility).

## Current prerelease state

The repository is still in Changesets prerelease mode. At the time this runbook
was written, `.changeset/pre.json` has `"mode": "pre"` and `"tag": "beta"`. Do
not assume that merging a Version Packages PR will publish to `latest` while
that is true: Changesets publishes prereleases to the tag in this file.

The v1 beta release cohort is exactly `valdres` and `valdres-react`. Angular,
Vue, Svelte, Solid, feature packages, and compatibility packages stay on their
last legacy beta versions until each is migrated and certified. The cohort is
enforced in `.changeset/config.json`, `scripts/ci-publish.sh`, and
`scripts/verify-publish.ts`; widening any one list is not a release decision.

This release intentionally continues the existing `1.0.0-beta.N` train with a
breaking runtime and API cutover. Already-published legacy packages commonly
declare ranges such as `^1.0.0-beta.19`, which npm may satisfy with the new core
even though those packages are incompatible with it. The release cohort is a
certification boundary, not a semver-resolution boundary: only the new core and
React packages are supported together. Do not combine beta.24 or later with a
deferred adapter, plugin, or compatibility package until that package is
migrated.

The authored manifests remain at the package versions currently published on the
beta tag. Changesets keeps prerelease counters package-local, so the two
checked-in minor Changesets generate:

```text
valdres@1.0.0-beta.27
valdres-react@1.0.0-beta.6
```

`changesets/action` must first consume both minor Changesets into its generated
Version Packages PR. The live publish script accepts only the exact beta.27 and
beta.6 tuple above; dry runs accept either those targets or the authored
beta.26/beta.5 predecessors so feature PRs can validate prepack and cleanup. In
the generated PR, verify the exact target versions, the React peer
`valdres: ^1.0.0-beta.27`, and that release metadata changes are limited to the
two certified packages before merging it.

To move from the beta stream to the release-candidate stream, use Changesets; do
not hand-edit `pre.json`, package versions, or changelogs:

```bash
bunx changeset pre exit
bunx changeset pre enter rc
```

Review and commit the resulting `.changeset/pre.json` change in its own release
PR. These commands only change prerelease mode. Add a non-empty patch Changeset
for both certified packages after entering `rc`; the normal Version Packages PR
then advances each package independently to `1.0.0-rc.N`. Before that PR may
publish, update and review the live prerelease guard in `scripts/ci-publish.sh`,
which intentionally accepts only `beta` today, and prove the cohort policy still
matches the intended RC. Each prerelease counter continues from that package's
beta history, so the first RC is not necessarily `rc.0`; it is the RC1 milestone
in this document.

Changesets keeps every changeset it has already versioned into a prerelease in
`.changeset/pre/`, not in `pre.json`. Those files survive
`pre exit`/`pre enter`. Certified core+React histories are consumed into their
stable release; the ignored `*-deferred.md` histories remain for the packages
that did not join this cohort. Treat that folder as release state: don't
bulk-delete it, and only remove an individual file if the change it describes
genuinely no longer applies to its eventual release.

The intended stable destination is `1.0.0`, but do not leave prerelease mode
while legacy packages can silently resolve an incompatible core. Before stable,
migrate, retire, or explicitly deprecate every deferred package and prove that
fresh npm resolution cannot present an unsupported combination as compatible.
Only after that compatibility work and the stable-release conditions below are
met may the release owner leave prerelease mode:

```bash
bunx changeset pre exit
```

Commit the generated `pre.json` change. Let the Version Packages PR produce the
stable versions. Do not run `bun run version-packages` on an ordinary feature
branch or edit the generated release files by hand.

## Gates for every candidate

Every RC and any future stable candidate must pass all required CI checks, plus
these release-specific gates.

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
  as the v1 API snapshot.
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

For betas, each exact package version must be on `beta` and `latest` must remain
the previous stable release. For RCs, the new version must be on `rc` and
`latest` must remain unchanged. For the v1 stable release, `valdres@latest` and
`dist-tags.latest` must both resolve to exactly `1.0.0`. Repeat the checks for
every package listed as published by Changesets. A version that exists only by
explicit lookup has not completed the intended release.

Install the published tag (`valdres@beta`, `valdres@rc`, or `valdres@latest`)
into a clean consumer after the tag has converged and run one final import/type
smoke test. If a publish is partial, stop: reconcile the versions and tags
before retrying the workflow.

## RC1: API freeze

RC1 is the first candidate with the intended v1 public API. It requires:

- [ ] all ordinary CI checks green on the candidate commit;
- [ ] E3 green on the exact packed tarball;
- [ ] the normalized `dist/types` snapshot committed;
- [ ] `api-snapshot / semver-diff` required and green;
- [ ] the public v1 compatibility contract reviewed against the artifact; and
- [ ] no unresolved public-API decision.

After RC1, feature work and opportunistic refactors stop. Only release-blocking
fixes, tests, and documentation corrections enter the candidate branch. An API
change resets the freeze and the quiet-period clock.

### Quiet-period clock

The quiet period is a minimum of 14 consecutive calendar days. The clock starts
when RC1—or a replacement API-freeze candidate—is published to the `rc` dist-tag
and every candidate gate is green.

Any change to a published package's runtime JavaScript, declarations, export or
package metadata, dependency graph, or release behavior restarts the full 14-day
clock when the replacement candidate is published. A public API change also
invalidates the RC1 freeze as described above. Changes limited to tests,
documentation, burn-in evidence, or CI observation do not restart the clock when
they cannot alter the packed artifacts or publish behavior.

The burn-in checklist may be exercised throughout the quiet period, but RC2
cannot be approved until both the 14 days and every checklist item are complete.

## RC2: burn-in

RC2 is not a ceremonial republish. It begins only after RC1 has had a quiet
period and the following behavior has been exercised from packed packages in
real applications, with evidence linked from the release issue:

- [ ] SSR: concurrent request stores render and hydrate without cross-request
      state leakage, and request stores are disposed;
- [ ] HMR: ordinary modules update as expected, duplicate runtime graphs fail
      clearly, and the module-owned runtime domain behaves as documented across
      reload boundaries;
- [ ] high-cardinality State handles: creation, lookup, subscription churn,
      release, and garbage-collection behavior are exercised at realistic
      cardinality;
- [ ] scopes: inheritance, shadowing, reset/unset, transactions, and disposal
      are exercised across nested scopes;
- [ ] React adapter in a real application.

This is the burn-in checklist for the core+React prerelease cohort. Vue, Svelte,
Solid, Angular, and the deferred plugins are not certified against this train.
Their legacy peer ranges may allow npm to resolve the new packages, but that
combination is unsupported and does not count as burn-in evidence. Every package
retained for stable must be migrated and gain its own real-application burn-in
item before stable approval; packages that will not be migrated must be retired
or explicitly deprecated first.

Record the app or fixture, runtime and framework versions, scenario, result, and
candidate tarball version for every item. A unit test or source-workspace demo
alone is not burn-in evidence.

The quiet period is deliberate. The external review's point stands: the core
source has accumulated well over 16,000 inserted lines since
`valdres@1.0.0-beta.17`. Reproduce the current count from the tagged release
with:

```bash
git diff --numstat valdres@1.0.0-beta.17..HEAD -- packages/valdres/src packages/valdres/types | awk '{ insertions += $1 } END { print insertions }'
```

RC2 exists to let that change settle under realistic workloads, not to create a
deadline for more changes.

## Future stable approval

The present `1.0.0-beta.N` cutover does not authorize publishing stable `1.0.0`.
Before leaving prerelease mode, migrate, retire, or deprecate every deferred
legacy package and resolve its npm range so a fresh install cannot silently
present an incompatible combination as supported. Update `valdres-react`'s plain
core peer range to the approved stable range as part of the stable release;
`bumpVersionsWithWorkspaceProtocolOnly` will not rewrite it automatically. A
disposable `changeset version` proof must assert both package versions are
exactly `1.0.0`, the packed React peer metadata is correct, and no deferred
package changed unexpectedly. Publish stable only when all of the following are
true:

- [ ] there are zero known P0 or P1 defects;
- [ ] there were no public API changes between the accepted RC1 freeze point and
      RC2;
- [ ] RC2 completed the full burn-in checklist and quiet period;
- [ ] every deferred package was migrated and certified, or explicitly retired
      or deprecated with incompatible resolution paths addressed;
- [ ] all candidate gates, including E3 and `api-snapshot / semver-diff`, are
      green on the exact stable commit;
- [ ] `.changeset/pre.json` was moved out of `rc` prerelease mode with
      `bunx changeset pre exit` and the resulting Version Packages PR contains
      only expected release metadata; and
- [ ] `valdres@1.0.0` and `valdres-react@1.0.0` resolve from npm's `latest`
      dist-tag.

P0 means data loss, state corruption or isolation failure, a security issue, or
a broadly unusable package. P1 means a broken documented contract, a broken
supported runtime or adapter, or a common workflow with no reasonable
workaround. “Known” includes reproducible reports that have not yet been fully
root-caused; uncertainty is not a reason to remove an issue from the count.

If any condition fails, keep the release in RC. Do not move a prerelease to
`latest` manually to bypass the Version Packages and publish workflows.
