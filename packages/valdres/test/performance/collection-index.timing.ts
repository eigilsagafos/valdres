/** ShiftX-shaped EntityRef -> Entity workload. Advisory elapsed times; exact
 * complexity is enforced by collection-index.performance.test.ts. */
import { collection, selector, store } from "../../src/index"
import { query } from "../../src/query"
type EntityRef = `entity:${number}`
type Entity = { kind: "task" | "person" | "document"; title: string }
const measure = (action: () => void, count = 1) => {
    const start = performance.now()
    for (let i = 0; i < count; i++) action()
    return ((performance.now() - start) * 1000) / count
}
for (const size of [1000, 5000, 20000]) {
    for (const mode of ["native", "selector-shim"] as const) {
        let extracts = 0
        const entities = collection<
            EntityRef,
            Entity,
            EntityRef,
            { kind: Entity["kind"] }
        >({
            indexes: {
                kind: value => {
                    extracts++
                    return value.kind
                },
            },
        })
        const s = store()
        s.txn(tx => {
            for (let i = 0; i < size; i++)
                tx.set(entities(`entity:${i}`), {
                    kind: i < 10 ? "task" : "document",
                    title: "initial",
                })
        })
        const result =
            mode === "native"
                ? query(entities, { where: { kind: { eq: "task" } } })
                : selector(get =>
                      get(entities).filter(row => {
                          extracts++
                          return get(row)?.kind === "task"
                      }),
                  )
        const initialUs = measure(() => {
            s.get(result)
        })
        const extra = entities(`entity:${size}`)
        // Warm both write/read paths before the measured paired loops.
        for (let i = 0; i < 20; i++) {
            s.set(extra, { kind: "task", title: "warm" })
            s.get(result)
            s.delete(extra)
            s.get(result)
        }
        let insertUs = 0,
            updateUs = 0,
            deleteUs = 0
        const before = extracts,
            loops = 100
        for (let i = 0; i < loops; i++) {
            insertUs += measure(() => {
                s.set(extra, { kind: "task", title: "insert" })
                s.get(result)
            })
            updateUs += measure(() => {
                s.set(extra, { kind: "task", title: "update" })
                s.get(result)
            })
            deleteUs += measure(() => {
                s.delete(extra)
                s.get(result)
            })
        }
        const lookupUs = measure(() => {
            s.get(result)
        }, 10000)
        console.log(
            JSON.stringify({
                runtime: typeof Bun === "undefined" ? "node" : "bun",
                size,
                mode,
                initialUs,
                insertUs: insertUs / loops,
                updateUs: updateUs / loops,
                deleteUs: deleteUs / loops,
                lookupUs,
                steadyExtractorCalls: extracts - before,
            }),
        )
        s.dispose()
    }
}
