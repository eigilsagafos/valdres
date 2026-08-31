import {
    collection as createCollection,
    inspectCollection,
} from "./collection.js"
import { query } from "./query-object.js"

export { inspectCollection }

export function collection(rows) {
    const target = createCollection(rows)
    Object.defineProperty(target, "query", {
        value: definition => query(target, definition),
    })
    return target
}
