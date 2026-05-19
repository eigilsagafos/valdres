/**
 * BM25(F) ranking parameters and scoring function. valdres uses BM25F as
 * the single ranking algorithm for `atomFamilySearch` — same opinionated
 * choice Orama made — so the `score` function here is invoked once per
 * (atom, field, query-term) triple, with the per-field results summed
 * after multiplying by the field's boost.
 *
 * The formula matches Orama's implementation byte-for-byte:
 *
 *   idf = ln(1 + (N - df + 0.5) / (df + 0.5))
 *   score = (idf * (d + tf * (k1 + 1))) /
 *           (tf + k1 * (1 - b + (b * dl) / avgdl))
 *
 * The `d` term is the BM25+ correction; it stops very short documents
 * from being penalised into near-zero scores. Defaults match Orama's
 * defaults (which are the values the BM25+ paper recommends).
 */
export type BM25Params = {
    /** Term-frequency saturation. Higher = TF matters more before
     *  saturating. Typical range 1.2–2.0. */
    k1: number
    /** Length-normalization strength. 0 = no length penalty, 1 = full. */
    b: number
    /** BM25+ correction. Floors scores so very short matching documents
     *  aren't penalised into irrelevance. */
    d: number
}

export const DEFAULT_BM25: BM25Params = {
    k1: 1.2,
    b: 0.75,
    d: 0.5,
}

/**
 * Compute the BM25(+) score for one (term, document, field) triple.
 *
 * @param tf     term frequency in the document/field
 * @param df     document frequency for this term across the corpus
 * @param N      total document count
 * @param dl     document/field length (in the same units as tf — tokens
 *               for exact/prefix mode, trigrams for trigram mode)
 * @param avgdl  average document/field length across the corpus
 * @param p      `{ k1, b, d }` tuning knobs
 */
export const bm25Score = (
    tf: number,
    df: number,
    N: number,
    dl: number,
    avgdl: number,
    p: BM25Params,
): number => {
    if (tf <= 0) return 0
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
    const normalizedLength = avgdl > 0 ? dl / avgdl : 1
    return (
        (idf * (p.d + tf * (p.k1 + 1))) /
        (tf + p.k1 * (1 - p.b + p.b * normalizedLength))
    )
}
