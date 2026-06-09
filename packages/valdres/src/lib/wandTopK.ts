/**
 * WAND (Weak AND / "Weighted AND") top-K retrieval.
 *
 * The standard IR technique for `limit`-K ranked queries over large posting
 * lists: instead of scoring every document a query term touches, it uses a
 * per-term upper bound on the term's contribution (`maxImpact`) to skip
 * documents that provably cannot enter the current top-K. As the top-K heap
 * fills, the threshold rises and more of the corpus is skipped.
 *
 * This module is the pure algorithm over an abstract cursor interface; the
 * caller supplies sorted postings (ascending document ordinals), the per-term
 * impact bound, and a `score(ordinal)` that returns the term's ACTUAL
 * contribution to a document. It is search-agnostic (no BM25 specifics) so it
 * can be unit-tested against a brute-force scorer.
 *
 * Correctness contract: `maxImpact` MUST be ≥ `score(d)` for every `d` in the
 * term's postings. With a valid bound the result is identical to scoring all
 * documents and taking the top-K (ties broken by the supplied comparator).
 */
export type WandTerm = {
    /** Document ordinals containing this term, ASCENDING. */
    postings: Int32Array
    /** Upper bound on `score(d)` across this term's postings (≥ every actual). */
    maxImpact: number
    /** This term's contribution to document `ordinal` (0 if not present). */
    score: (ordinal: number) => number
}

export type WandHit = { ordinal: number; score: number }

/**
 * @param terms   one cursor per query term
 * @param k       max results (top-K by total score)
 * @param tieBreak comparator for EQUAL total scores — return <0 if `a` should
 *                 rank before `b`. Applied both for the final ordering and for
 *                 deciding heap eviction at the threshold, so the output
 *                 matches a full sort by `(score desc, tieBreak asc)`.
 */
export const wandTopK = (
    terms: WandTerm[],
    k: number,
    tieBreak: (a: number, b: number) => number,
): WandHit[] => {
    if (k <= 0 || terms.length === 0) return []

    // Per-term cursor position into its postings array.
    const pos = new Int32Array(terms.length)
    const DONE = Number.MAX_SAFE_INTEGER
    const curDoc = (i: number): number =>
        pos[i] < terms[i].postings.length ? terms[i].postings[pos[i]] : DONE

    // Bounded max-heap-by-worst: we keep the K best hits. `worst` is the
    // current Kth (the eviction candidate); a doc enters only if it beats it.
    const heap: WandHit[] = []
    // Compare two hits the way the final ranking does: higher score first,
    // then tieBreak. Returns <0 if `a` outranks `b`.
    const better = (a: WandHit, b: WandHit): number =>
        b.score !== a.score ? b.score - a.score : tieBreak(a.ordinal, b.ordinal)

    // The pruning threshold: a doc whose total score is below the current
    // Kth-best can't make the cut. While the heap isn't full, threshold is
    // -Infinity (everything is a candidate). When full, it's the worst hit's
    // score — but a doc tying that score still has to beat it on tieBreak, so
    // we treat the threshold as "≥ worstScore" for the cheap impact gate and
    // resolve exact ties when we fully score.
    let worst: WandHit | undefined
    const recomputeWorst = () => {
        worst = heap[0]
        for (let i = 1; i < heap.length; i++) {
            if (better(heap[i], worst as WandHit) > 0) worst = heap[i]
        }
    }
    const threshold = (): number =>
        heap.length < k ? Number.NEGATIVE_INFINITY : (worst as WandHit).score

    const consider = (ordinal: number, score: number) => {
        const hit = { ordinal, score }
        if (heap.length < k) {
            heap.push(hit)
            if (heap.length === k) recomputeWorst()
            return
        }
        // Heap full — replace the worst if this hit outranks it.
        if (better(hit, worst as WandHit) < 0) {
            heap[heap.indexOf(worst as WandHit)] = hit
            recomputeWorst()
        }
    }

    // Order term indices by current doc; WAND picks the pivot by walking that
    // order and accumulating maxImpact until it exceeds the threshold.
    const order = Array.from({ length: terms.length }, (_, i) => i)

    for (;;) {
        order.sort((a, b) => curDoc(a) - curDoc(b))
        // Skip exhausted cursors (sorted to the end as DONE).
        let first = 0
        while (first < order.length && curDoc(order[first]) === DONE) first++
        if (first >= order.length) break

        const th = threshold()
        // Find the pivot term: smallest prefix whose summed maxImpact > th.
        let acc = 0
        let pivotIdx = -1
        for (let i = first; i < order.length; i++) {
            if (curDoc(order[i]) === DONE) break
            acc += terms[order[i]].maxImpact
            if (acc > th) {
                pivotIdx = i
                break
            }
        }
        if (pivotIdx === -1) break // no remaining doc can beat the threshold

        const pivotDoc = curDoc(order[pivotIdx])
        if (curDoc(order[first]) === pivotDoc) {
            // All cursors before the pivot are already at pivotDoc → score it
            // fully across every term, then advance those cursors past it.
            let total = 0
            for (let i = 0; i < terms.length; i++) {
                if (curDoc(i) === pivotDoc) total += terms[i].score(pivotDoc)
            }
            consider(pivotDoc, total)
            for (let i = 0; i < terms.length; i++) {
                if (curDoc(i) === pivotDoc) pos[i]++
            }
        } else {
            // Advance one lagging cursor (before the pivot) up to pivotDoc.
            for (let i = first; i < pivotIdx; i++) {
                const t = order[i]
                const arr = terms[t].postings
                let lo = pos[t]
                let hi = arr.length
                while (lo < hi) {
                    const mid = (lo + hi) >>> 1
                    if (arr[mid] < pivotDoc) lo = mid + 1
                    else hi = mid
                }
                pos[t] = lo
            }
        }
    }

    heap.sort(better)
    return heap
}
