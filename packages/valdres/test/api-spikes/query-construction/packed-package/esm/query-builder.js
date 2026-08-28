import { executeQuery } from "./query-engine.js"

export const BUILDER_SENTINEL = "D431_BUILDER_SENTINEL_5R8P1X4K7V2M9Q6C"

const node = value => Object.freeze(value)

const scalarOps = field => ({
    eq: value => node({ kind: "eq", field, value }),
    anyOf: values =>
        node({ kind: "anyOf", field, values: Object.freeze([...values]) }),
    facet: options =>
        node({
            field,
            options: options ? node({ ...options }) : undefined,
            multi: false,
        }),
})

const orderedOps = field => ({
    ...scalarOps(field),
    gt: value => node({ kind: "gt", field, value }),
    gte: value => node({ kind: "gte", field, value }),
    lt: value => node({ kind: "lt", field, value }),
    lte: value => node({ kind: "lte", field, value }),
    between: (lower, upper) => node({ kind: "between", field, lower, upper }),
    asc: () => node({ field, direction: "asc" }),
    desc: () => node({ field, direction: "desc" }),
})

const multiValueOps = field => ({
    has: value => node({ kind: "has", field, value }),
    hasAny: values =>
        node({ kind: "hasAny", field, values: Object.freeze([...values]) }),
    hasAll: values =>
        node({ kind: "hasAll", field, values: Object.freeze([...values]) }),
    facet: options =>
        node({
            field,
            options: options ? node({ ...options }) : undefined,
            multi: true,
        }),
})

const builder = Object.freeze({
    index: Object.freeze({
        genre: Object.freeze(scalarOps("genre")),
        tags: Object.freeze(multiValueOps("tags")),
        rating: Object.freeze(orderedOps("rating")),
        releasedAt: Object.freeze(orderedOps("releasedAt")),
    }),
    all: (...terms) => node({ kind: "and", terms: Object.freeze(terms) }),
    any: (...terms) => node({ kind: "or", terms: Object.freeze(terms) }),
    not: term => node({ kind: "not", term }),
})

export function query(target, define) {
    const input = define(builder)
    const definition = Object.freeze({
        ...input,
        orderBy: Object.freeze(
            input.orderBy == null
                ? []
                : Array.isArray(input.orderBy)
                  ? [...input.orderBy]
                  : [input.orderBy],
        ),
        facets: Object.freeze({ ...(input.facets ?? {}) }),
    })

    return Object.freeze({
        read: () => executeQuery(target, definition, BUILDER_SENTINEL),
    })
}
