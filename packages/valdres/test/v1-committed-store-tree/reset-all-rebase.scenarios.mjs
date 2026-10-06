// Public-API scenarios for the experimental `Transaction.resetAll()`.
// Every function takes the imported `valdres` module so the same code runs
// against the candidate and the baseline artifact. Only `resetAll` is new.

const keys = rows => rows.map(r => r.key).join(",")
const check = (results, name, ok, detail) =>
    results.push({
        name,
        ok: Boolean(ok),
        ...(detail === undefined ? {} : { detail }),
    })

export const hasResetAll = V => {
    const root = V.store()
    const child = root.scope("probe")
    let available = false
    root.txn(tx => {
        available = typeof tx.scope(child).resetAll === "function"
    })
    return available
}

/** A draft whose old state differs from the rebuilt one in values, membership,
 * order, a family member and a plain atom. */
const setupDraft = V => {
    const { atom, collection, family, selector, store } = V
    const todos = collection({ name: "todos" })
    const title = atom("root title", { name: "title" })
    const lookup = family(id => atom(null, { name: `lookup:${id}` }))
    const root = store()
    for (const k of ["a", "b", "c", "d"]) root.set(todos(k), { text: k })
    const draft = root.scope("draft")
    // old draft content
    draft.delete(todos("b"))
    draft.set(todos("c"), { text: "c (old draft)" })
    draft.set(todos("x"), { text: "x (old draft)" })
    draft.set(title, "old draft title")
    draft.set(lookup("k"), "old")
    const summary = selector(get => ({
        title: get(title),
        order: keys(get(todos)),
        c: get(todos("c"))?.text,
        k: get(lookup("k")),
    }))
    return { root, draft, todos, title, lookup, summary }
}

/** Snapshot of everything a UI would render from the draft. */
const view = (s, { todos, title, lookup }) => ({
    order: keys(s.get(todos)),
    values: Object.fromEntries(
        ["a", "b", "c", "d", "e", "x", "y"].map(k => [
            k,
            s.get(todos(k))?.text ?? null,
        ]),
    ),
    title: s.get(title),
    k: s.get(lookup("k")),
})

const subscribeAll = (draft, env) => {
    const log = []
    const stops = [
        ["membership", env.todos],
        ["title", env.title],
        ["row c", env.todos("c")],
        ["lookup k", env.lookup("k")],
        ["summary", env.summary],
    ].map(([label, state]) =>
        draft.sub(state, () => log.push({ label, seen: view(draft, env) })),
    )
    return { log, stop: () => stops.forEach(stop => stop()) }
}

/** 1. clear -> rebuild -> commit, on the same Store with live subscriptions. */
export const rebaseDemo = V => {
    const results = []
    const env = setupDraft(V)
    const { root, draft, todos, title, lookup } = env
    const handle = root.scope("draft")
    check(results, "named scope handle is the existing Store", handle === draft)
    const before = view(draft, env)
    const subs = subscribeAll(draft, env)
    const reads = {}
    root.txn(tx => {
        const d = tx.scope(draft)
        reads.beforeClear = view(d, env)
        tx.set(todos("e"), { text: "e (new on root)" }) // parent change in the same txn
        d.resetAll()
        reads.afterClear = view(d, env)
        // rebuild the draft from its (new) operation log
        d.delete(todos("a"))
        d.set(todos("c"), { text: "c (rebased)" })
        d.set(todos("y"), { text: "y (rebased)" })
        d.set(title, "rebased title")
        d.set(lookup("k"), "new")
        reads.afterRebuild = view(d, env)
    })
    const after = view(draft, env)
    check(
        results,
        "in-txn read before clear equals old draft",
        JSON.stringify(reads.beforeClear) === JSON.stringify(before),
        reads.beforeClear,
    )
    check(
        results,
        "in-txn read after clear equals the parent view",
        reads.afterClear.order === "a,b,c,d,e" &&
            reads.afterClear.title === "root title" &&
            reads.afterClear.k === null &&
            reads.afterClear.values.x === null,
        reads.afterClear,
    )
    check(
        results,
        "in-txn read after rebuild equals the committed result",
        JSON.stringify(reads.afterRebuild) === JSON.stringify(after),
        reads.afterRebuild,
    )
    check(
        results,
        "committed rebased state",
        after.order === "b,c,d,e,y" &&
            after.values.c === "c (rebased)" &&
            after.title === "rebased title" &&
            after.k === "new",
        after,
    )
    check(
        results,
        "same Store handle after commit",
        root.scope("draft") === draft,
    )
    const labels = subs.log.map(entry => entry.label).sort()
    check(
        results,
        "each changed target notified exactly once",
        JSON.stringify(labels) ===
            JSON.stringify([
                "lookup k",
                "membership",
                "row c",
                "summary",
                "title",
            ]),
        labels,
    )
    check(
        results,
        "every notification observed only the final coherent state",
        subs.log.every(
            entry => JSON.stringify(entry.seen) === JSON.stringify(after),
        ),
    )
    // subscriptions keep working afterwards
    subs.log.length = 0
    root.set(todos("z"), { text: "z (root later)" })
    check(
        results,
        "later parent write reaches draft subscribers",
        subs.log.some(e => e.label === "membership") &&
            keys(draft.get(todos)) === "b,c,d,e,y,z",
        keys(draft.get(todos)),
    )
    subs.log.length = 0
    draft.set(title, "edited after rebase")
    check(
        results,
        "later draft write reaches draft subscribers",
        subs.log.some(e => e.label === "title"),
    )
    subs.stop()
    return results
}

/** Throw before apply: the old draft (values, arrays, history) is intact. */
export const rebaseRollback = V => {
    const results = []
    const env = setupDraft(V)
    const { root, draft, todos, title } = env
    const before = view(draft, env)
    const membership = draft.get(todos)
    const subs = subscribeAll(draft, env)
    const failure = new Error("rebuild failed")
    let thrown
    try {
        root.txn(tx => {
            const d = tx.scope(draft)
            d.resetAll()
            d.set(title, "half-rebuilt")
            throw failure
        })
    } catch (error) {
        thrown = error
    }
    check(results, "the callback error propagates", thrown === failure)
    check(
        results,
        "old draft values and order intact",
        JSON.stringify(view(draft, env)) === JSON.stringify(before),
    )
    check(
        results,
        "membership array identity intact",
        draft.get(todos) === membership,
    )
    check(results, "no notifications", subs.log.length === 0, subs.log.length)
    subs.stop()
    return results
}

/** A rebase whose final served values and membership are unchanged.
 * mode "bulk" = resetAll; mode "loop" = existing per-state resets of the
 * same owned states (today's public API), for comparison. */
export const unchangedRebase = (V, mode) => {
    const env = setupDraft(V)
    const { root, draft, todos, title, lookup } = env
    const cRow = draft.get(todos("c"))
    const xRow = draft.get(todos("x"))
    const membership = draft.get(todos)
    const subs = subscribeAll(draft, env)
    root.txn(tx => {
        const d = tx.scope(draft)
        if (mode === "bulk") d.resetAll()
        else
            for (const s of [
                todos("b"),
                todos("c"),
                todos("x"),
                title,
                lookup("k"),
            ])
                d.reset(s)
        // rebuild exactly the same content, same object references
        d.delete(todos("b"))
        d.set(todos("c"), cRow)
        d.set(todos("x"), xRow)
        d.set(title, "old draft title")
        d.set(lookup("k"), "old")
    })
    return {
        mode,
        order: keys(draft.get(todos)),
        membershipArrayReused: draft.get(todos) === membership,
        notified: subs.log.map(e => e.label).sort(),
    }
}

/** Descendant behaviour matrix. The ancestor `draft` hides b and overrides d;
 * a descendant `desc` of each kind sits below it. The ancestor is then
 * cleared (bulk, or the existing per-state loop) and the root later adds z. */
export const descendantMatrix = (V, mode) => {
    const kinds = {
        untouched: () => {},
        "value override on existing row": (desc, rows) =>
            desc.set(rows("a"), { text: "a (desc)" }),
        "additions and deletions": (desc, rows) => {
            desc.set(rows("n"), { text: "n (desc)" })
            desc.delete(rows("c"))
        },
        "individually reset (historical order)": (desc, rows) => {
            desc.delete(rows("a"))
            desc.reset(rows("a"))
        },
    }
    const out = {}
    for (const [kind, prepare] of Object.entries(kinds)) {
        const { collection, store } = V
        const rows = collection()
        const root = store()
        for (const k of ["a", "b", "c", "d"]) root.set(rows(k), { text: k })
        const draft = root.scope("draft")
        draft.delete(rows("b"))
        draft.set(rows("d"), { text: "d (draft)" })
        const desc = draft.scope("desc")
        prepare(desc, rows)
        const counts = { membership: 0, "row a": 0, "row b": 0, "row d": 0 }
        desc.sub(rows, () => counts.membership++)
        desc.sub(rows("a"), () => counts["row a"]++)
        desc.sub(rows("b"), () => counts["row b"]++)
        desc.sub(rows("d"), () => counts["row d"]++)
        let previous = desc.get(rows)
        const snap = () => {
            const current = desc.get(rows)
            const row = {
                ancestorOrder: keys(draft.get(rows)),
                order: keys(current),
                values: Object.fromEntries(
                    ["a", "b", "c", "d", "n", "z"].map(k => [
                        k,
                        desc.get(rows(k))?.text ?? null,
                    ]),
                ),
                arrayReused: current === previous,
                notifications: { ...counts },
            }
            previous = current
            for (const k of Object.keys(counts)) counts[k] = 0
            return row
        }
        const steps = { before: snap() }
        root.txn(tx => {
            const d = tx.scope(draft)
            if (mode === "bulk") d.resetAll()
            else for (const s of [rows("b"), rows("d")]) d.reset(s)
        })
        steps.afterAncestorClear = snap()
        root.set(rows("z"), { text: "z (root later)" })
        steps.afterParentAddsZ = snap()
        out[kind] = steps
    }
    return out
}
