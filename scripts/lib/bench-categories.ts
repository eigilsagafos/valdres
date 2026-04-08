/**
 * Shared benchmark categorization used by both the regression checker
 * (PR comments) and the README updater.
 */

export const BENCH_CATEGORIES: [string, RegExp][] = [
    ["Atoms", /^(atom(?!Family)|store\.get|set\(atom|set \d+ atoms|get \d+ atoms)/],
    ["Selectors", /^(selector(?!Family)|set \+ read|chained)/],
    ["Transactions", /^txn:/],
    ["Store", /^(createStore|sub \+ unsub)/],
    ["Families", /^(atomFamily|selectorFamily)/],
]

export function categorizeBenchmark(name: string): string {
    for (const [cat, pattern] of BENCH_CATEGORIES) {
        if (pattern.test(name)) return cat
    }
    return "Other"
}

/**
 * Group items by category in deterministic order (BENCH_CATEGORIES order,
 * then "Other"). Items within each group preserve their original order.
 */
export function groupByCategory<T>(
    items: T[],
    getName: (item: T) => string,
): Map<string, T[]> {
    // Build groups
    const groups = new Map<string, T[]>()
    for (const item of items) {
        const cat = categorizeBenchmark(getName(item))
        if (!groups.has(cat)) groups.set(cat, [])
        groups.get(cat)!.push(item)
    }

    // Return in fixed category order
    const ordered = new Map<string, T[]>()
    for (const [cat] of BENCH_CATEGORIES) {
        if (groups.has(cat)) {
            ordered.set(cat, groups.get(cat)!)
            groups.delete(cat)
        }
    }
    // Append any remaining ("Other")
    for (const [cat, items] of groups) {
        ordered.set(cat, items)
    }
    return ordered
}
