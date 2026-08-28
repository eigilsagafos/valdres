import { executeQuery } from "./query-engine.js"

export const OBJECT_SENTINEL = "D431_OBJECT_SENTINEL_2V9K6P3R8M1X7Q5C"

const node = value => Object.freeze(value)

function normalizeWhere(input) {
    const terms = Object.entries(input).map(([field, constraint]) => {
        if (field === "$all")
            return node({
                kind: "and",
                terms: Object.freeze(constraint.map(normalizeWhere)),
            })
        if (field === "$any")
            return node({
                kind: "or",
                terms: Object.freeze(constraint.map(normalizeWhere)),
            })
        if (field === "$not")
            return node({ kind: "not", term: normalizeWhere(constraint) })

        const [operator, value] = Object.entries(constraint)[0]
        if (
            operator === "hasAny" ||
            operator === "hasAll" ||
            operator === "anyOf"
        ) {
            return node({
                kind: operator,
                field,
                values: Object.freeze([...value]),
            })
        }
        if (operator === "between") {
            return node({
                kind: operator,
                field,
                lower: value[0],
                upper: value[1],
            })
        }
        return node({ kind: operator, field, value })
    })
    return terms.length === 1
        ? terms[0]
        : node({ kind: "and", terms: Object.freeze(terms) })
}

function normalizeOrderBy(input) {
    return Object.freeze(
        Object.entries(input).map(([field, direction]) =>
            node({ field, direction }),
        ),
    )
}

function normalizeFacets(input = {}) {
    return Object.freeze(
        Object.fromEntries(
            Object.entries(input).map(([name, definition]) => [
                name,
                node({
                    field: definition.field ?? name,
                    multi: name === "tags",
                    options: node({ ...definition }),
                }),
            ]),
        ),
    )
}

export function query(target, definition) {
    const normalized = Object.freeze({
        where: normalizeWhere(definition.where),
        orderBy: normalizeOrderBy(definition.orderBy),
        facets: normalizeFacets(definition.facets),
        offset: definition.offset,
        limit: definition.limit,
    })

    return Object.freeze({
        read: () => executeQuery(target, normalized, OBJECT_SENTINEL),
    })
}
