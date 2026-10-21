# Bun 1.4.3 toolchain mitigation

## Decision and scope

On 2026-10-16, the owner approved the exact `complete-proposal.patch` from
`.context/bun143-approved-validation/`, SHA-256
`498467130983031b526977c5dfd35c1257b81d2933dfc84589d806967baeda8f`.
The proposal applies to candidate `99fb011c6d579f6fb4985281908c7318623c2f1d`
on main `843e68a67034e5bd375a75d9f1ebe315ac783f8c`.

This is an upgrade mitigation for nondeterministic retention-test timeouts,
not a demonstrated repair of their historical cause. Both the onCommit
capture-retention and ownership-retention investigations remain open. The
original failures, portable reproduction, rejected isolation/workaround
experiments and bounded comparison evidence remain preserved in the workspace.

The repository toolchain and current Bun runtime, retention, scheduler and
consumer tests use Bun 1.4.3. Only regeneration of the unchanged frozen beta.23
historical test inventory executes with isolated Bun 1.4.0 through
`npm exec --yes --package=bun@1.4.0 -- bun`. That generator still enforces its
original runner and immutable inventory. The remaining contract checks run on
1.4.3. Node, TypeScript, dependencies, the lockfile and supported consumer engine
ranges are unchanged. No Valdres runtime source, retention assertion, deadline,
suite ordering or test selection changes are part of this mitigation.

The separately approved accessor-valued `Error.stackTraceLimit` diagnostic
exception and its independent native Error controls are recorded in
[the C1 design](selector-failure-propagation.md). Ordinary/default and read-only
numeric framed-stack guarantees remain independent of that exception.

## Approved certification changes

| Protection | Previous | Approved |
| --- | ---: | ---: |
| Core-retaining raw allowance | 5779 | 5783 |
| Collection raw fixture | 112029 | 112033 |
| All-exports raw fixture | 144603 | 144607 |
| Query raw fixture | 118443 | 118447 |
| Query-development raw fixture | 118443 | 118447 |
| External-atom raw fixture | 92940 | 92944 |

The size-policy toolchain, collection certification metadata and packed-consumer
certification entrypoint move from 1.4.0 to 1.4.3. The compiler fingerprint changes
from `53117b769a309358cd357e39bcb47271251a4a7f63a25679eac5d39da6edf6e7` to
`b861c7702a2933527bc0d265c7a65a22777892a23ab0db19872cda8951dc4c50`, measured
identically across three clean builds. Immutable ordinary baselines remain fixed.
**No gzip budget increases are approved.** The packed gzip ceiling remains
**146862 bytes**, and the core gzip allowance remains 2322 bytes.

Identical-source/lockfile release-artifact measurements were 545201 raw / 146710
canonical gzip bytes for the actual prospective `valdres@1.0.0-beta.45` package
built with 1.4.3, versus 546183 / 146862 with 1.4.0. The Store consumer changes
from 72063 / 19590 to 72067 / 19587. All 47 declaration files, packed export maps,
versions and engine ranges are byte-identical. These are compiler-output
measurements, not a promise of application performance or a new runtime floor.

## Validation evidence and limitations

Two independent normal-suite jobs on native Linux x64 with Bun 1.4.3 passed all
1149 runtime and 39 built-output tests in
[run 38973857234](https://github.com/eigilsagafos/valdres/actions/runs/38973857234).
The associated controls detected all seven intended defects: retained committed
callback, retained Present/Absent/scope objects, and premature Present/Absent/scope
release. Current normal-suite accumulated-state coverage remains mandatory.
Passing finite runs do not establish that the original cause is fixed.

The approval is conditional on full uninterrupted pinned verification, the package
gate and its negative controls, actual artifact/installed-consumer checks and
normal exact-head PR CI. A new substantive failure or additional protected change
requires investigation; rerunning merely to obtain green is not authorized.

## Release sequence

The empty `bun143-stack-compatibility` Changeset satisfies the ordinary PR gate
and declares no version bump. Its presence nevertheless selects the Changesets
action's empty-changesets early return, which neither creates a version PR nor
attempts publication. Therefore landing this
PR alone must not be treated as publication of the already-versioned beta.45.

After separate landing authorization, run the normal checks on the upgrade merge.
Then remove the empty Changeset in a separate cleanup PR through normal checks;
its removal is itself a Changeset change for the PR gate. Recheck main, the exact
release contents and registry state before landing that cleanup. With no remaining
Changesets, fresh main CI can use the normal publish path for the already-versioned
beta.45. Any retention failure is a stop, not authorization for a retry. No manual
version bump, publication, tag change or release retry is part of this upgrade PR.
Both retention investigations remain open after any eventual publication.
