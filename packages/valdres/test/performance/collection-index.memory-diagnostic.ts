/** Advisory retained heap measurement; deterministic allocation/work gates live
 * in collection-index.performance.test.ts. Run with Bun in a fresh process. */
import { heapStats } from "bun:jsc"
import { collection, store } from "../../src/index"
import { query } from "../../src/query"
const collect = async () => {
    for (let i = 0; i < 5; i++) {
        await Bun.sleep(0)
        Bun.gc(true)
    }
    return heapStats().heapSize
}
for (const cardinality of [2, 20000]) {
    const entities = collection<
        string,
        { kind: number },
        string,
        { kind: number }
    >({ indexes: { kind: value => value.kind } })
    const s = store()
    s.txn(tx => {
        for (let i = 0; i < 20000; i++)
            tx.set(entities(String(i)), { kind: i % cardinality })
    })
    const lookup = query(entities, { where: { kind: { eq: 0 } } })
    const before = await collect()
    const rows = s.get(lookup)
    const materialized = await collect()
    console.log(
        JSON.stringify({
            cardinality,
            rows: 20000,
            matchingRows: rows.length,
            before,
            materialized,
            indexHeapDelta: materialized - before,
        }),
    )
    s.dispose()
}
