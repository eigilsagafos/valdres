# Follow-up implementation prompt: synthetic shared source hub

Start after the ExternalAtom model and implementation stack is merged and its
packed core/React certification is green. Fetch `origin/main` and record its
SHA. Read `docs/external-atom.md`, `docs/howto-external-atom.md`, and the approved
decisions in `docs/designs/external-atom-implementation.md` before editing.

Implement one small synthetic shared hub as an integration fixture/example for
the public `externalAtom` API. Use the existing browser keyboard package only
as a read-only precedent for a persistent physical hub. Do not migrate its
legacy API, introduce a public Valdres publisher, or port other browser packages.

The hub owns synchronous truth, a stable snapshot reference, and one simulated
physical listener. Export a single stable ExternalAtom definition. Attach the
physical listener on the first hub listener and remove it after the last hub
listener leaves. Source updates replace the snapshot before invalidation.
Fan out to a frozen listener snapshot, attempt every listener even if one
throws, and report failures in occurrence order using a hub-owned policy.
Do not deduplicate failures by object identity.

Use only public `valdres`, `valdres-react`, and optional inspection entries.
Keep physical-hub ownership distinct from each root Store's independently
retained projection. No kernel changes should be needed; report any required
kernel or contract change before broadening the task.

Prove the following with isolated fixtures:

- Two root Stores retain the same definition: two source listeners, one
  physical listener, independent settlement and notification failures.
- Multiple scopes/selectors in one root share one source listener.
- Dormant reads sample without attaching; retained reads never poll.
- Dynamic dependency removal, unsubscribe, and Store disposal release the
  correct listener; old invalidators cannot publish after release.
- StrictMode cleanup/re-setup and Store/State rebinding leave no listener leak.
- Server rendering uses deterministic request-local server data and performs
  zero physical attachment. Hydration preserves initial server data, then
  catches up to current live truth. Ordinary Store writes do not race pending
  hydration boundaries.
- A failing Store listener does not prevent another Store receiving the change.
  Repeated identical error objects remain separate failure occurrences.

Validate the example against packed packages under Node/Bun and React 18/19,
and run the existing ExternalAtom contract suites. Keep this follow-up's
consumer size measurement separate from the immutable ordinary baselines.
Document source ownership and cleanup. Add a changeset only if a publishable
package changes; do not bump package versions or edit changelogs. Prepare a
separate PR with the core ExternalAtom stack as its prerequisite. Do not merge.
