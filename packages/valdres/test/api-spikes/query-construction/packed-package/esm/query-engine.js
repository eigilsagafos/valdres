import { readRows } from "./collection.js"

export const ENGINE_SENTINEL = "D431_ENGINE_SENTINEL_9Q2M7V4K1X8P6R5C"

function matches(row, term) {
    if (term == null) return true
    if (term.kind === "and") return term.terms.every(next => matches(row, next))
    if (term.kind === "or") return term.terms.some(next => matches(row, next))
    if (term.kind === "not") return !matches(row, term.term)
    if (term.kind === "eq") return row[term.field] === term.value
    if (term.kind === "anyOf") return term.values.includes(row[term.field])
    if (term.kind === "has") return row[term.field].includes(term.value)
    if (term.kind === "hasAny")
        return term.values.some(value => row[term.field].includes(value))
    if (term.kind === "hasAll")
        return term.values.every(value => row[term.field].includes(value))
    if (term.kind === "gt") return row[term.field] > term.value
    if (term.kind === "gte") return row[term.field] >= term.value
    if (term.kind === "lt") return row[term.field] < term.value
    if (term.kind === "lte") return row[term.field] <= term.value
    if (term.kind === "between")
        return row[term.field] >= term.lower && row[term.field] <= term.upper
    throw new Error(`Unknown query term: ${term.kind}`)
}

function compareRows(orderBy, left, right) {
    for (const order of orderBy) {
        const direction = order.direction === "desc" ? -1 : 1
        if (left[order.field] < right[order.field]) return -1 * direction
        if (left[order.field] > right[order.field]) return 1 * direction
    }
    return left.id.localeCompare(right.id)
}

function computeFacets(rows, facets) {
    const result = {}
    for (const [name, facet] of Object.entries(facets)) {
        const counts = new Map()
        for (const row of rows) {
            const values = facet.multi ? row[facet.field] : [row[facet.field]]
            for (const value of values) {
                counts.set(value, (counts.get(value) ?? 0) + 1)
            }
        }
        result[name] = [...counts]
            .sort(([left], [right]) =>
                String(left).localeCompare(String(right)),
            )
            .map(([value, count]) => ({ value, count }))
    }
    return result
}

export function executeQuery(target, definition, grammar) {
    const matchesDefinition = readRows(target).filter(row =>
        matches(row, definition.where),
    )
    const ordered = [...matchesDefinition].sort((left, right) =>
        compareRows(definition.orderBy, left, right),
    )
    const offset = definition.offset ?? 0
    const limit = definition.limit ?? ordered.length

    return Object.freeze({
        rows: Object.freeze(
            ordered.slice(offset, offset + limit).map(row => row.id),
        ),
        total: matchesDefinition.length,
        facets: Object.freeze(
            computeFacets(matchesDefinition, definition.facets ?? {}),
        ),
        engine: ENGINE_SENTINEL,
        grammar,
    })
}
