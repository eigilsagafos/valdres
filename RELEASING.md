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

The isolated v1 beta cohort is exactly `valdres` and `valdres-react`. Angular,
Vue, Svelte, Solid, feature packages, and compatibility packages stay on their
last legacy beta versions until each is migrated and certified. The cohort is
enforced in `.changeset/config.json`, `scripts/ci-publish.sh`, and
`scripts/verify-publish.ts`; widening any one list is not a release decision.

The first cutover release deliberately starts a new prerelease base so the
already-published legacy peer range `^1.0.0-beta.19` cannot silently accept the
incompatible core while it remains prerelease. This isolates the `1.1.0-beta.N`
and `1.1.0-rc.N` trains only: npm semver allows that legacy range to accept a
future stable `1.1.0`. For this one cutover, both authored package versions are
seeded at unpublished `1.0.0` and the checked-in minor Changeset generates:

```text
valdres@1.1.0-beta.0
valdres-react@1.1.0-beta.0
```

Do not publish the temporary `1.0.0` manifests. `changesets/action` must first
consume the minor Changeset into its generated Version Packages PR, and the live
publish script independently rejects any certified package version that is not
`x.y.z-beta.N`. Dry runs may prepack the seed solely to validate cleanup. After
the generated PR, verify that its package metadata changes are limited to the
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
then advances them to `1.1.0-rc.N`. Before that PR may publish, update and
review the live prerelease guard in `scripts/ci-publish.sh`, which intentionally
accepts only `beta` today, and prove the cohort policy still matches the
intended RC. The prerelease counter continues from the beta history, so the
first RC is not necessarily `rc.0`; it is the RC1 milestone in this document.

Changesets keeps every changeset it has already versioned into a prerelease in
`.changeset/pre/`, not in `pre.json`. Those files survive `pre exit`/`pre enter`
and are consumed by the release that leaves prerelease mode, which is what makes
the stable changelog cover the whole beta and rc history. Treat that folder as
release state: don't bulk-delete it, and only remove an individual file if the
change it describes genuinely no longer applies to the stable release.

Do not leave prerelease mode under the current isolation strategy. A stable
`1.1.0` would again satisfy the old adapters' `^1.0.0-beta.19` peer range. After
RC2, make an explicit stable-cutover decision: either use a `2.0.0` major
barrier or migrate/deprecate every legacy package and prove that resolving the
new core is safe. Only after that decision and the stable-release conditions
below are met may the release owner leave prerelease mode:

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

For RCs, the new version must be on `rc` and `latest` must remain the previous
stable release. For a future v1 stable release, `valdres@latest` and
`dist-tags.latest` must both resolve to the exact version approved by the
stable-cutover decision. Repeat the checks for every package listed as published
by Changesets. A version that exists only by explicit lookup has not completed
the stable release.

Install `valdres@latest` into a clean consumer after the tag has converged and
run one final import/type smoke test. If a publish is partial, stop: reconcile
the versions and tags before retrying the workflow.

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

This is the burn-in checklist for the isolated core+React prerelease cohort.
Vue, Svelte, Solid, and Angular cannot be tested against this train because
their deferred legacy peer ranges reject it. If the future stable-cutover
decision is to migrate every adapter rather than use a major semver barrier,
each migrated adapter must gain its own real-application burn-in item before
stable approval.

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

The present `1.1.0-beta.N` isolation does not authorize publishing stable
`1.1.0`. First choose and document the stable semver barrier described above. If
the decision is the `2.0.0` barrier, `pre exit` is insufficient: add a major
Changeset for both certified packages and prove in a disposable version run that
the generated Version Packages PR produces exactly `2.0.0`. Update
`valdres-react`'s plain core peer range to the approved 2.x range as part of
that decision; `bumpVersionsWithWorkspaceProtocolOnly` will not rewrite it. The
disposable proof must assert both package versions and the packed React peer
metadata. If the decision is migration instead, certify every formerly deferred
package and its peer range before leaving prerelease mode. Publish that approved
stable version only when all of the following are true:

- [ ] there are zero known P0 or P1 defects;
- [ ] there were no public API changes between the accepted RC1 freeze point and
      RC2;
- [ ] RC2 completed the full burn-in checklist and quiet period;
- [ ] all candidate gates, including E3 and `api-snapshot / semver-diff`, are
      green on the exact stable commit;
- [ ] `.changeset/pre.json` was moved out of `rc` prerelease mode with
      `bunx changeset pre exit` and the resulting Version Packages PR contains
      only expected release metadata; and
- [ ] the approved stable versions resolve from npm's `latest` dist-tag.

P0 means data loss, state corruption or isolation failure, a security issue, or
a broadly unusable package. P1 means a broken documented contract, a broken
supported runtime or adapter, or a common workflow with no reasonable
workaround. “Known” includes reproducible reports that have not yet been fully
root-caused; uncertainty is not a reason to remove an issue from the count.

If any condition fails, keep the release in RC. Do not move a prerelease to
`latest` manually to bypass the Version Packages and publish workflows.
