// Correctness checks for an application draft store's REBASE sequence (public API +
// experimental `resetAll`). Uses the "typical" fixture of workload.mjs.
import { buildWorkload } from "./reset-all-draft-rebase.workload.mjs"

const keys = rows => rows.map(r => r.key).join(",")
const check = (results, name, ok, detail) =>
    results.push({
        name,
        ok: Boolean(ok),
        ...(ok || detail === undefined ? {} : { detail }),
    })

/** Observable state of the subscribed targets, for "changed?" comparisons. */
const observe = (w, scope) => {
    const out = new Map()
    for (const id of w.counts.keys()) {
        const [who, kind, key] = id.split(":")
        const s = who === "a" ? w.kids[0] : (w.kids[1] ?? w.kids[0])
        out.set(
            id,
            kind === "entities"
                ? s.get(w.entities)
                : kind === "tasks"
                  ? s.get(w.tasks)
                  : kind === "mutations"
                    ? s.get(w.mutations)
                    : kind === "markerVersion"
                      ? s.get(w.markerVersion)
                      : kind === "markerEpoch"
                        ? s.get(w.markerEpoch)
                        : kind === "row"
                          ? s.get(w.entities(key))
                          : kind === "lookup"
                            ? s.get(w.lookup(key))
                            : s.get(w.initialized(key)),
        )
    }
    return out
}

/** Child views must equal the draft view (order + sampled values). */
const sameAsDraft = (w, draftView, childView) =>
    keys(childView.get(w.entities)) === keys(draftView.get(w.entities)) &&
    keys(childView.get(w.tasks)) === keys(draftView.get(w.tasks)) &&
    keys(childView.get(w.mutations)) === keys(draftView.get(w.mutations)) &&
    childView.get(w.markerVersion) === draftView.get(w.markerVersion) &&
    childView.get(w.entities("e2"))?.title ===
        draftView.get(w.entities("e2"))?.title

export const draftRebase = V => {
    const results = []
    const w = buildWorkload(V, "typical", { subscriptions: "full" })
    const {
        root,
        draft,
        kids,
        entities,
        tasks,
        markerVersion,
        markerEpoch,
        DRAFT_ROOT,
    } = w
    // previous rebase (version 1) committed; the draft holds its overrides
    root.txn(tx => w.rebase(tx, 1))
    const draftHandle = draft
    const kidHandles = [...kids]
    // a root entity created after the historical version: absent from the
    // snapshot, so the application must tombstone it explicitly
    const LATE = "late-root-entity"
    const before = observe(w)
    w.takeCounts()
    let coherentFailures = 0
    const coherent = scope => {
        if (
            scope.get(markerVersion) !== 2 ||
            scope.get(entities(DRAFT_ROOT)).parents.version !== 2
        )
            coherentFailures++
    }
    // re-register coherence probes on both children for every target kind
    w.subscribe(kids[0], "a:probe:entities", entities, coherent)
    w.subscribe(kids[1], "b:probe:markerEpoch", markerEpoch, coherent)
    const reads = {}
    root.txn(tx => {
        // caller-supplied transaction: unrelated caller work first
        tx.set(entities(LATE), {
            id: LATE,
            type: "task",
            title: "created on root after the snapshot version",
        })
        // 1. root target-version write
        w.writeRootVersion(tx, 2)
        const d = tx.scope(draft)
        const k0 = d.scope(kids[0])
        reads.versionSeenByDraft = d.get(entities(DRAFT_ROOT)).parents.version
        reads.preClearRowE2 = d.get(entities("e2")).title
        // 2. clear
        w.clear(tx)
        reads.afterClear = {
            draftEqualsRoot:
                keys(d.get(entities)) === keys(tx.get(entities)) &&
                keys(d.get(tasks)) === keys(tx.get(tasks)),
            childEqualsDraft: sameAsDraft(w, d, k0),
            lateVisible: d.get(entities(LATE)) !== undefined,
            historicalOnlyAbsent: d.get(entities("h0")) === undefined,
            rowE2: d.get(entities("e2")).title,
        }
        // 3. seed (with the LATE tombstone) and 4. replay
        w.seed(tx, 2, { extraTombstones: [LATE] })
        reads.afterSeed = {
            lateHidden: d.get(entities(LATE)) === undefined,
            childEqualsDraft: sameAsDraft(w, d, k0),
        }
        w.replay(tx, 2)
        reads.afterRebuild = {
            childEqualsDraft:
                sameAsDraft(w, d, k0) && sameAsDraft(w, d, d.scope(kids[1])),
            order: keys(d.get(entities)),
        }
    })
    const counts = w.takeCounts()
    const after = observe(w)
    check(
        results,
        "root target-version write seen by the draft in the same txn",
        reads.versionSeenByDraft === 2,
    )
    check(
        results,
        "after clear (in txn): draft equals the CURRENT root view, order included",
        reads.afterClear.draftEqualsRoot,
    )
    check(
        results,
        "after clear (in txn): never-written child equals the draft",
        reads.afterClear.childEqualsDraft,
    )
    check(
        results,
        "after clear (in txn): the late root entity is visible (clear restores current-root inheritance)",
        reads.afterClear.lateVisible,
    )
    check(
        results,
        "after clear (in txn): historical-only rows are gone until reseeded",
        reads.afterClear.historicalOnlyAbsent,
    )
    check(
        results,
        "after clear (in txn): previously overridden row reads the root value",
        reads.afterClear.rowE2 === "current 2" &&
            reads.preClearRowE2 !== "current 2",
        reads.afterClear.rowE2,
    )
    check(
        results,
        "after seed (in txn): explicit tombstone hides the late root entity",
        reads.afterSeed.lateHidden,
    )
    check(
        results,
        "after seed (in txn): never-written child equals the draft",
        reads.afterSeed.childEqualsDraft,
    )
    check(
        results,
        "after rebuild (in txn): both never-written children equal the draft",
        reads.afterRebuild.childEqualsDraft,
    )
    check(
        results,
        "committed order equals the in-txn rebuilt order",
        keys(draft.get(entities)) === reads.afterRebuild.order,
    )
    check(
        results,
        "committed: late root entity hidden in draft and children, present on root",
        draft.get(entities(LATE)) === undefined &&
            kids.every(k => k.get(entities(LATE)) === undefined) &&
            root.get(entities(LATE)) !== undefined,
    )
    check(
        results,
        "committed: rewritten state (previously overridden) carries the new version",
        draft.get(entities("e2")).title.startsWith("v") &&
            draft.get(markerVersion) === 2,
    )
    check(
        results,
        "same draft and child Store handles (no scope creation/disposal)",
        root.scope("draft:1") === draftHandle &&
            kids.every(
                (k, i) => k === kidHandles[i] && draft.scope(`ui:${i}`) === k,
            ),
    )
    // per-subscription notification accounting
    const changed = [...after.keys()].filter(
        id =>
            !id.includes(":probe:") &&
            !Object.is(after.get(id), before.get(id)),
    )
    const unchanged = [...after.keys()].filter(
        id =>
            !id.includes(":probe:") && Object.is(after.get(id), before.get(id)),
    )
    const notifiedTwice = [...counts].filter(([, n]) => n > 1)
    check(
        results,
        "every affected subscription notified exactly once",
        changed.every(id => counts.get(id) === 1),
        changed.filter(id => counts.get(id) !== 1).slice(0, 5),
    )
    check(
        results,
        "unaffected subscriptions not notified",
        unchanged.every(id => counts.get(id) === 0),
        unchanged.filter(id => counts.get(id) !== 0).slice(0, 5),
    )
    check(
        results,
        "no subscription notified more than once",
        notifiedTwice.length === 0,
        notifiedTwice.slice(0, 5),
    )
    check(
        results,
        "every notification observed the final coherent state",
        coherentFailures === 0,
        coherentFailures,
    )
    // later parent and draft updates still reach the never-written children
    w.takeCounts()
    root.txn(tx => {
        tx.set(entities("zz-later"), {
            id: "zz-later",
            type: "task",
            title: "later root row",
        })
        tx.delete(entities("e3"))
    })
    draft.set(entities("e5"), {
        id: "e5",
        type: "task",
        title: "later draft edit",
    })
    const later = w.takeCounts()
    check(
        results,
        "after later parent+draft updates: children equal the draft (order + values)",
        kids.every(k => sameAsDraft(w, draft, k)) &&
            keys(kids[0].get(entities)).endsWith("zz-later") &&
            kids[0].get(entities("e5")).title === "later draft edit",
    )
    // one root transaction changed membership (entities + tasks fire once each);
    // the later draft edit is value-only on an unsubscribed row
    check(
        results,
        "after later updates: children's subscriptions still fire, once per change",
        later.get("a:entities") === 1 && later.get("a:tasks") === 1,
        { entities: later.get("a:entities"), tasks: later.get("a:tasks") },
    )
    w.stop()
    return {
        results,
        notifications: {
            subscriptions: counts.size,
            affected: changed.length,
            unaffected: unchanged.length,
            callbacks: [...counts.values()].reduce((a, b) => a + b, 0),
        },
    }
}

/** Without the explicit tombstone the late root entity shows through. */
export const draftRebaseMissingTombstone = V => {
    const w = buildWorkload(V, "typical", { subscriptions: "none" })
    w.root.txn(tx => w.rebase(tx, 1))
    w.root.txn(tx => {
        tx.set(w.entities("late"), { id: "late", type: "task", title: "late" })
        w.rebase(tx, 2) // no extraTombstones
    })
    return { lateVisibleInDraft: w.draft.get(w.entities("late")) !== undefined }
}

/** Draft-store-shaped rollback: a failure during replay leaves everything intact. */
export const draftRebaseRollback = V => {
    const w = buildWorkload(V, "typical", { subscriptions: "full" })
    w.root.txn(tx => w.rebase(tx, 1))
    const order = w.draft.get(w.entities)
    const version = w.root.get(w.entities(w.DRAFT_ROOT)).parents.version
    w.takeCounts()
    let thrown
    try {
        w.root.txn(tx => {
            w.writeRootVersion(tx, 2)
            w.clear(tx)
            w.seed(tx, 2)
            throw new Error("replay failed")
        })
    } catch (error) {
        thrown = error
    }
    const counts = w.takeCounts()
    return {
        errorPropagated: thrown?.message === "replay failed",
        rootVersionUnchanged:
            w.root.get(w.entities(w.DRAFT_ROOT)).parents.version === version,
        draftArrayIdentical: w.draft.get(w.entities) === order,
        notifications: [...counts.values()].reduce((a, b) => a + b, 0),
    }
}
