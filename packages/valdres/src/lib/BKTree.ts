/**
 * A BK-tree (Burkhard–Keller tree) over strings for sublinear fuzzy
 * lookup under a metric distance (here: Levenshtein edit distance).
 *
 * It replaces the O(vocabulary) linear edit-distance walk that
 * `atomFamilySearch`'s `tolerance` expansion used to do: instead of
 * measuring the query against every indexed word, the triangle inequality
 * lets us prune whole subtrees. For a node at distance `d` from the query
 * and a tolerance of `k`, only children reachable through an edge labelled
 * in `[d - k, d + k]` can contain a match — everything else is skipped.
 *
 * Membership is refcounted by the caller (the search vocabulary), so the
 * tree only ever sees add/remove of DISTINCT words. Removal tombstones the
 * node rather than deleting it (deleting an internal BK-tree node would
 * orphan its subtrees); the tree rebuilds itself from the live set once
 * tombstones outnumber live nodes, bounding the wasted traversal.
 *
 * The distance function must be a true metric (Levenshtein is) — the
 * pruning is only correct under the triangle inequality. It is called with
 * the FULL distance (no early-exit cutoff) because banding needs the exact
 * value at each visited node.
 */
export type BKTree = {
    add: (word: string) => void
    remove: (word: string) => void
    /**
     * Every live word within `maxDistance` edits of `query`, paired with
     * its distance. Excludes distance 0 (the query word itself) — callers
     * score the exact term on its own path.
     */
    search: (
        query: string,
        maxDistance: number,
    ) => { word: string; distance: number }[]
    /** Live (non-tombstoned) word count. Introspection / tests. */
    size: () => number
}

type BKNode = {
    word: string
    live: boolean
    /** Edge label (distance to child) → child node. */
    children: Map<number, BKNode>
}

const mkNode = (word: string): BKNode => ({
    word,
    live: true,
    children: new Map(),
})

export const createBKTree = (
    /** Bounded edit distance: returns the true distance if ≤ `max`, else a
     *  value > `max`. Banding needs the EXACT distance at internal nodes, so
     *  those are measured with `max = maxlen` (no cutoff); leaf nodes only
     *  need a membership test and use the tight `maxDistance` cutoff, which
     *  lets the early-exit DP bail fast. */
    distance: (a: string, b: string, max: number) => number,
): BKTree => {
    let root: BKNode | null = null
    let liveCount = 0
    let deadCount = 0

    const exact = (a: string, b: string): number =>
        distance(a, b, a.length > b.length ? a.length : b.length)

    const add = (word: string): void => {
        if (!root) {
            root = mkNode(word)
            liveCount++
            return
        }
        let node = root
        // Walk down following the edge labelled by the exact distance,
        // creating a child when the slot is free. A word already present
        // (distance 0) just gets re-activated if it had been tombstoned.
        for (;;) {
            const d = exact(word, node.word)
            if (d === 0) {
                if (!node.live) {
                    node.live = true
                    deadCount--
                    liveCount++
                }
                return
            }
            const child = node.children.get(d)
            if (!child) {
                node.children.set(d, mkNode(word))
                liveCount++
                return
            }
            node = child
        }
    }

    const remove = (word: string): void => {
        let node: BKNode | null = root
        while (node) {
            const d = exact(word, node.word)
            if (d === 0) {
                if (node.live) {
                    node.live = false
                    liveCount--
                    deadCount++
                    // Rebuild when tombstones dominate, so a long churn of
                    // rewrites doesn't leave the tree mostly-dead and slow.
                    // The `> 32` floor avoids thrashing at tiny sizes.
                    if (deadCount > liveCount && deadCount > 32) rebuild()
                }
                return
            }
            node = node.children.get(d) ?? null
        }
    }

    const rebuild = (): void => {
        const live: string[] = []
        const stack: BKNode[] = root ? [root] : []
        while (stack.length) {
            const n = stack.pop() as BKNode
            if (n.live) live.push(n.word)
            for (const c of n.children.values()) stack.push(c)
        }
        root = null
        liveCount = 0
        deadCount = 0
        for (const w of live) add(w)
    }

    const search = (
        query: string,
        maxDistance: number,
    ): { word: string; distance: number }[] => {
        const results: { word: string; distance: number }[] = []
        if (!root) return results
        const stack: BKNode[] = [root]
        while (stack.length) {
            const node = stack.pop() as BKNode
            if (node.children.size === 0) {
                // Leaf: no banding needed, so a tight cutoff lets the
                // early-exit DP bail as soon as the budget is blown.
                if (node.live) {
                    const d = distance(query, node.word, maxDistance)
                    if (d > 0 && d <= maxDistance) {
                        results.push({ word: node.word, distance: d })
                    }
                }
                continue
            }
            // Internal: need the exact distance to band the children.
            const d = exact(query, node.word)
            if (d > 0 && d <= maxDistance && node.live) {
                results.push({ word: node.word, distance: d })
            }
            const lo = d - maxDistance
            const hi = d + maxDistance
            for (const [edge, child] of node.children) {
                if (edge >= lo && edge <= hi) stack.push(child)
            }
        }
        return results
    }

    return { add, remove, search, size: () => liveCount }
}
