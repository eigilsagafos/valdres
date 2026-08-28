export const COLLECTION_SENTINEL = "D431_COLLECTION_SENTINEL_7M4Q2X9K6P1V8R5C"

const rowsSlot = Symbol("d43.1 collection rows")

export function collection(rows) {
    const snapshot = Object.freeze(rows.map(row => Object.freeze({ ...row })))
    const byKey = new Map(snapshot.map(row => [row.id, row]))
    const member = key => byKey.get(key)

    Object.defineProperties(member, {
        [rowsSlot]: { value: snapshot },
        __d431CollectionMarker: { value: COLLECTION_SENTINEL },
    })
    return member
}

export function readRows(target) {
    return target[rowsSlot]
}

export function inspectCollection(target) {
    const rows = readRows(target)
    return {
        kind: "collection",
        marker: target.__d431CollectionMarker,
        count: rows.length,
        first: target("m1").title,
    }
}
