import { describe, expect, test } from "bun:test"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { index } from "../indexConstructor"

// Differential soundness fuzzer for atom-family × scope × transaction
// propagation — the deliverable backbone of the propagation audit, distilled
// to a bounded CI guard. Random membership churn (single set/del, batched txn,
// scope-shadowed and cross-scope txn) drives the engine; after every committed
// op an independent membership oracle checks that get(family), a sum/count
// selector over the family, and index() per-term results match a from-scratch
// recompute in BOTH the root and a scope.
//
// Constraints that keep the oracle exact without weakening coverage of the
// audited paths (see audit notes):
//  - member values are 1..9 (never the family default 0) so `set` is always an
//    unambiguous create/update (no equality short-circuit);
//  - a deleted key is retired (never re-created) because deleteFamilyAtom calls
//    family.release(...), minting a fresh identity whose key↔identity mapping is
//    ambiguous across stores;
//  - root and scope mutate DISJOINT key spaces so deleteFamilyAtom's GLOBAL
//    release can't strand the other context on a stale identity (the scope still
//    inherits the root's members read-through, so inheritance is fully exercised).

const NTERMS = 3
const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type Which = { kind: "sum" | "count" } | { kind: "index"; term: number }
type Op =
    | { t: "set"; ctx: "r" | "c"; k: number; val: number }
    | { t: "del"; ctx: "r" | "c"; k: number }
    | { t: "txn"; ctx: "r" | "c"; sets: { k: number; val: number }[]; dels: number[] }
    | { t: "sub" | "unsub"; ctx: "r" | "c"; which: Which }

const runSeed = (seed: number): string | null => {
    const rnd = mulberry32(seed * 2654435761)
    const K = 4 + Math.floor(rnd() * 6)
    const KR = Math.max(1, Math.floor(K / 2)) // root keys [0,KR), scope keys [KR,K)
    const useScope = rnd() < 0.7
    const steps = 30 + Math.floor(rnd() * 30)

    const fam = atomFamily<number, [string]>(() => 0, { name: `fam${seed}` })
    const key = (k: number) => `k${k}`
    const sumSel = selector(get => (get(fam) as any[]).reduce((a, m) => (a + (get(m) | 0)) | 0, 0), { name: "sum" })
    const countSel = selector(get => (get(fam) as any[]).length, { name: "count" })
    const idx = index<number, number, [string]>(fam, (v, term) => (((v | 0) % NTERMS) + NTERMS) % NTERMS === term, { name: "byMod" })
    const idxSel = Array.from({ length: NTERMS }, (_, term) => idx(term))

    const root = store(undefined, { enumerable: true })
    const child: any = useScope ? root.scope("child") : null

    const rootM = new Map<number, number>()
    const scopeCreated = new Map<number, number>()
    const scopeDeleted = new Set<number>()
    const retired = new Set<number>()
    const subs = new Map<string, () => void>()
    const subKey = (ctx: string, w: Which) => `${ctx}:${w.kind}${w.kind === "index" ? w.term : ""}`

    const scopeKeys = (): Set<number> => {
        const out = new Set<number>()
        for (const k of rootM.keys()) if (!scopeDeleted.has(k)) out.add(k)
        for (const k of scopeCreated.keys()) if (!scopeDeleted.has(k)) out.add(k)
        return out
    }
    const scopeVal = (k: number) => (scopeCreated.has(k) ? scopeCreated.get(k)! : rootM.get(k)!)
    const memberKeys = (arr: any[]) => new Set(arr.map(a => a.familyArgs[0]))
    const setEq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(x => b.has(x))

    const applyLogical = (ctx: "r" | "c", op: "set" | "del", k: number, val?: number) => {
        if (ctx === "r") {
            if (op === "set") rootM.set(k, val!)
            else rootM.delete(k)
        } else if (op === "set") {
            scopeCreated.set(k, val!); scopeDeleted.delete(k)
        } else {
            scopeDeleted.add(k); scopeCreated.delete(k)
        }
    }
    const stOf = (ctx: "r" | "c") => (ctx === "r" ? root : child)

    const verify = (): string | null => {
        const ctxs: { label: string; data: any; keys: () => Set<number>; val: (k: number) => number }[] = [
            { label: "root", data: root.data, keys: () => new Set(rootM.keys()), val: k => rootM.get(k)! },
        ]
        if (useScope) ctxs.push({ label: "scope", data: child.data, keys: scopeKeys, val: scopeVal })
        for (const c of ctxs) {
            const keys = c.keys()
            if (c.data.values.has(fam)) {
                const expected = new Set([...keys].map(key))
                if (!setEq(memberKeys(c.data.values.get(fam)), expected))
                    return `${c.label} membership: got {${[...memberKeys(c.data.values.get(fam))].sort()}} expected {${[...expected].sort()}}`
            }
            if (c.data.values.has(sumSel)) {
                const exp = [...keys].reduce((a, k) => (a + (c.val(k) | 0)) | 0, 0)
                if (c.data.values.get(sumSel) !== exp) return `${c.label} sum: ${c.data.values.get(sumSel)} != ${exp}`
            }
            if (c.data.values.has(countSel) && c.data.values.get(countSel) !== keys.size)
                return `${c.label} count: ${c.data.values.get(countSel)} != ${keys.size}`
            for (let term = 0; term < NTERMS; term++) {
                if (!c.data.values.has(idxSel[term])) continue
                const got = memberKeys(c.data.values.get(idxSel[term]))
                const exp = new Set([...keys].filter(k => (((c.val(k) | 0) % NTERMS) + NTERMS) % NTERMS === term).map(key))
                if (!setEq(got, exp)) return `${c.label} idx(${term}): got {${[...got].sort()}} expected {${[...exp].sort()}}`
            }
        }
        return null
    }

    for (let step = 0; step < steps; step++) {
        const ctx: "r" | "c" = useScope && rnd() < 0.5 ? "c" : "r"
        const lo = ctx === "r" ? 0 : KR
        const hi = ctx === "r" ? KR : K
        const settable = () => {
            for (let t = 0; t < 12; t++) {
                const k = lo + Math.floor(rnd() * (hi - lo))
                if (!retired.has(k)) return k
            }
            return -1
        }
        const delK = () => lo + Math.floor(rnd() * (hi - lo))
        const roll = rnd()
        if (roll < 0.32) {
            const k = settable()
            if (k >= 0) {
                const val = 1 + Math.floor(rnd() * 9)
                applyLogical(ctx, "set", k, val)
                stOf(ctx).set(fam(key(k)), val)
            }
        } else if (roll < 0.46) {
            const k = delK(); retired.add(k); applyLogical(ctx, "del", k); stOf(ctx).del(fam(key(k)))
        } else if (roll < 0.82) {
            const ns = 1 + Math.floor(rnd() * 3), nd = Math.floor(rnd() * 3)
            const sets = Array.from({ length: ns }, () => ({ k: settable(), val: 1 + Math.floor(rnd() * 9) })).filter(s => s.k >= 0)
            const setKeys = new Set(sets.map(s => s.k))
            const dels = Array.from({ length: nd }, () => delK()).filter(d => !setKeys.has(d))
            for (const s of sets) applyLogical(ctx, "set", s.k, s.val)
            for (const d of dels) { retired.add(d); applyLogical(ctx, "del", d) }
            if (ctx === "r") root.txn((t: any) => { for (const s of sets) t.set(fam(key(s.k)), s.val); for (const d of dels) t.del(fam(key(d))) })
            else root.txn((t: any) => t.scope("child", (ct: any) => { for (const s of sets) ct.set(fam(key(s.k)), s.val); for (const d of dels) ct.del(fam(key(d))) }))
        } else {
            const r2 = rnd()
            const which: Which = r2 < 0.34 ? { kind: "sum" } : r2 < 0.67 ? { kind: "count" } : { kind: "index", term: Math.floor(rnd() * NTERMS) }
            const sk = subKey(ctx, which)
            if (rnd() < 0.6) {
                if (!subs.has(sk)) {
                    const sel = which.kind === "sum" ? sumSel : which.kind === "count" ? countSel : idxSel[which.term]
                    subs.set(sk, stOf(ctx).sub(sel, () => {}))
                }
            } else { const u = subs.get(sk); if (u) { u(); subs.delete(sk) } }
        }
        const err = verify()
        if (err) return `seed ${seed} step ${step}: ${err}`
    }
    for (const u of subs.values()) u()
    return null
}

describe("scope × family × txn differential fuzz", () => {
    test("incremental store matches the membership/selector oracle", () => {
        for (let seed = 1; seed <= 400; seed++) {
            const failure = runSeed(seed)
            expect(failure).toBeNull()
        }
    }, 30_000)
})
