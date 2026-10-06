// Draft-store-shaped REBASE workload on public valdres APIs + the experimental
// `Transaction.resetAll()`. Synthetic data only; no application data.
//
// Model (as supplied by the application):
//   - one root Store; drafts are existing named children of it;
//   - rebase keeps the same parent and runs inside a CALLER-SUPPLIED
//     transaction (no scope creation/disposal, no nested txn);
//   - the root draft entity's parents.version is written on the root;
//   - the draft is cleared, seeded with the historical snapshot as overrides,
//     then its full mutation history is replayed, writing mutation rows,
//     mutation-initialization flags, touched lookup atoms and two markers.
//
// IMPORTANT (the application's responsibility): clearing restores inheritance from the
// CURRENT root, not a historical snapshot. Root entities that are absent from
// the historical snapshot must be hidden explicitly with `delete(row)`
// (a local tombstone). The rebase input therefore carries `tombstones`.

import { query } from "valdres/query"

export const SIZES = {
    // total distinct draft overrides after rebuild:
    // snapshot rows + tombstones + mutation rows + init flags + created rows
    // + lookup atoms + 2 markers
    typical: {
        rootEntities: 2000,
        snapshot: 400,
        tombstones: 40,
        mutations: 240,
        created: 40,
        lookups: 238,
        subscriptionScale: 0.4,
    },
    large: {
        rootEntities: 5000,
        snapshot: 1000,
        tombstones: 100,
        mutations: 600,
        created: 100,
        lookups: 598,
        subscriptionScale: 1,
    },
    "large-root20k": {
        rootEntities: 20000,
        snapshot: 1000,
        tombstones: 100,
        mutations: 600,
        created: 100,
        lookups: 598,
        subscriptionScale: 1,
    },
}
export const totalOverrides = s =>
    s.snapshot + s.tombstones + 2 * s.mutations + s.created + s.lookups + 2

/** Builds the stores, draft, read-only children and subscriptions. */
export const buildWorkload = (
    V,
    sizeName,
    { subscriptions = "full", children = 2 } = {},
) => {
    const { atom, collection, family, store } = V
    const size = SIZES[sizeName]
    const entities = collection({
        name: "entities",
        indexes: { type: entity => entity.type },
    })
    const tasks = query(entities, { where: { type: { eq: "task" } } })
    const mutations = collection({ name: "mutations" })
    const lookup = family(key => atom(null, { name: "lookup" }))
    const initialized = family(id =>
        atom(false, { name: "mutation-initialized" }),
    )
    const markerVersion = atom(null, { name: "marker:version" })
    const markerEpoch = atom(0, { name: "marker:epoch" })
    const DRAFT_ROOT = "draft-root"

    const root = store()
    root.txn(tx => {
        tx.set(entities(DRAFT_ROOT), {
            id: DRAFT_ROOT,
            type: "draft",
            title: "draft",
            parents: { version: 0 },
        })
        for (let i = 0; i < size.rootEntities; i++)
            tx.set(entities(`e${i}`), {
                id: `e${i}`,
                type: i % 3 ? "task" : "note",
                title: `current ${i}`,
            })
    })
    const draft = root.scope("draft:1") // existing named child
    const kids = Array.from({ length: children }, (_, i) =>
        draft.scope(`ui:${i}`),
    ) // never written

    // --- historical snapshot + mutation history for a version -----------------
    // Every 25th snapshot row existed only historically (absent from the root).
    const snapshotId = i => (i % 25 === 0 ? `h${i}` : `e${i * 2}`)
    // Snapshot rows override existing entities (some with historical values),
    // plus rows that only existed historically. Tombstones hide root entities
    // created after the version (absent from the snapshot).
    const snapshotFor = (version, reuse) => {
        const rows = []
        for (let i = 0; i < size.snapshot; i++) {
            const id = snapshotId(i)
            const changed = (i + version) % 5 === 0 // ~20% differ between versions
            rows.push({
                id,
                value: reuse
                    ? cached(id, changed ? version : 0)
                    : {
                          id,
                          type: i % 3 ? "task" : "note",
                          title: `v${changed ? version : 0} ${id}`,
                      },
            })
        }
        const tombstones = []
        for (let i = 0; i < size.tombstones; i++)
            tombstones.push(`e${size.rootEntities - 1 - i}`)
        return { rows, tombstones }
    }
    const cache = new Map()
    const cached = (id, v) => {
        const key = `${id}@${v}`
        let value = cache.get(key)
        if (!value)
            cache.set(key, (value = { id, type: "task", title: `v${v} ${id}` }))
        return value
    }
    const history = []
    for (let m = 0; m < size.mutations; m++)
        history.push({
            id: `m${m}`,
            seq: m,
            // effects: edit a snapshot row, create a row, or touch a lookup
            edit: snapshotId(m % size.snapshot), // always a snapshot row
            create: m < size.created ? `c${m}` : undefined,
            lookups: [
                `k${m % size.lookups}`,
                ...(m + size.mutations < size.lookups
                    ? [`k${m + size.mutations}`]
                    : []),
            ],
        })

    // The four rebase steps, each on the caller's root transaction cursor `tx`.
    const writeRootVersion = (tx, version) =>
        tx.set(entities(DRAFT_ROOT), {
            id: DRAFT_ROOT,
            type: "draft",
            title: "draft",
            parents: { version },
        })
    const clear = tx => tx.scope(draft).resetAll()
    const seed = (
        tx,
        version,
        { reuse = false, includeTombstones = true, extraTombstones = [] } = {},
    ) => {
        const d = tx.scope(draft)
        const snapshot = snapshotFor(version, reuse)
        for (const { id, value } of snapshot.rows) d.set(entities(id), value)
        if (includeTombstones)
            for (const id of [...snapshot.tombstones, ...extraTombstones])
                d.delete(entities(id))
    }
    const replay = (tx, version) => {
        const d = tx.scope(draft)
        for (const m of history) {
            d.set(mutations(m.id), { id: m.id, seq: m.seq, version })
            d.set(initialized(m.id), true)
            d.update(entities(m.edit), current => ({
                ...current,
                title: `${current.title} +${m.id}`,
            }))
            if (m.create)
                d.set(entities(m.create), {
                    id: m.create,
                    type: "task",
                    title: `created by ${m.id}`,
                })
            for (const key of m.lookups) d.set(lookup(key), `${key}:${m.seq}`)
        }
        d.set(markerVersion, version)
        d.update(markerEpoch, epoch => epoch + 1)
    }

    /** The whole rebase body, run inside the caller's transaction. */
    const rebase = (tx, version, options = {}) => {
        const phases = options.phases
        const heap = () => (phases?.heap ? process.memoryUsage().heapUsed : 0)
        const h0 = heap()
        const t0 = phases ? performance.now() : 0
        writeRootVersion(tx, version)
        clear(tx)
        const t1 = phases ? performance.now() : 0
        const h1 = heap()
        seed(tx, version, options)
        replay(tx, version)
        if (phases) {
            phases.clear += t1 - t0
            phases.rebuild += performance.now() - t1
            if (phases.heap) phases.heapMarks = [h0, h1, heap()]
        }
    }

    // --- subscriptions on the read-only children ------------------------------
    const counts = new Map() // subscription id -> callbacks since last reset
    const stops = []
    const subscribe = (scope, id, state, coherent) => {
        counts.set(id, 0)
        stops.push(
            scope.sub(state, () => {
                counts.set(id, counts.get(id) + 1)
                if (coherent) coherent(scope)
            }),
        )
    }
    const scale = size.subscriptionScale
    if (subscriptions !== "none" && kids.length) {
        const [a, b = a] = kids
        subscribe(a, "a:entities", entities)
        subscribe(b, "b:markerVersion", markerVersion)
        subscribe(b, "b:markerEpoch", markerEpoch)
        if (subscriptions === "full") {
            subscribe(a, "a:tasks", tasks)
            subscribe(b, "b:mutations", mutations)
            for (let i = 0; i < Math.round(600 * scale); i++) {
                const id =
                    i % 3 === 0 ? `e${i * 2}` : `e${size.snapshot * 2 + i}`
                subscribe(a, `a:row:${id}`, entities(id))
            }
            for (let i = 0; i < Math.round(300 * scale); i++)
                subscribe(b, `b:lookup:k${i}`, lookup(`k${i}`))
            for (let i = 0; i < Math.round(95 * scale); i++)
                subscribe(b, `b:init:m${i}`, initialized(`m${i}`))
        }
    }
    const takeCounts = () => {
        const snapshot = new Map(counts)
        for (const k of counts.keys()) counts.set(k, 0)
        return snapshot
    }
    return {
        V,
        size,
        root,
        draft,
        kids,
        entities,
        tasks,
        mutations,
        lookup,
        initialized,
        markerVersion,
        markerEpoch,
        DRAFT_ROOT,
        rebase,
        writeRootVersion,
        clear,
        seed,
        replay,
        subscribe,
        takeCounts,
        counts,
        subscriptionCount: () => counts.size,
        stop: () => stops.forEach(stop => stop()),
    }
}
