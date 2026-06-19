import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

type DepRef =
    | { kind: "atom"; index: number }
    | { kind: "selector"; index: number }

type DynamicSelectorDef = {
    ctrlA: number
    ctrlB: number
    even: DepRef[]
    odd: DepRef[]
}

const stateName = (state: any) => state?.name ?? "<anon>"

const assertLiveDependentCounts = (
    data: any,
    states: any[],
    label: string,
) => {
    const live = new Set<any>()
    for (const state of states) {
        const subs = data.subscriptions.get(state)
        if (subs && subs.size > 0) live.add(state)
    }

    const stack = [...live]
    while (stack.length > 0) {
        const state = stack.pop()
        const deps = data.stateDependencies.get(state)
        if (!deps) continue
        for (const dep of deps) {
            if (!states.includes(dep) || live.has(dep)) continue
            live.add(dep)
            stack.push(dep)
        }
    }

    const expected = new Map<any, number>()
    for (const state of live) {
        const deps = data.stateDependencies.get(state)
        if (!deps) continue
        for (const dep of deps) {
            if (states.includes(dep)) {
                expected.set(dep, (expected.get(dep) ?? 0) + 1)
            }
        }
    }

    const mismatches: string[] = []
    for (const state of states) {
        const actual = data.liveDependentCount.get(state) ?? 0
        const exp = expected.get(state) ?? 0
        if (actual !== exp) {
            const deps = [...(data.stateDependencies.get(state) ?? [])].map(stateName)
            const dependents = [...(data.stateDependents.get(state) ?? [])].map(stateName)
            mismatches.push(
                `${stateName(state)} expected liveDependentCount=${exp}, got ${actual}; deps=${JSON.stringify(deps)}; dependents=${JSON.stringify(dependents)}`,
            )
        }
    }

    if (mismatches.length > 0) {
        throw new Error(
            `${label}\n${mismatches.join("\n")}\nlive=${[...live].map(stateName).join(", ")}`,
        )
    }
}

const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const buildDynamicSpec = (seed: number, allowSelfCycles: boolean) => {
    const rnd = mulberry32(seed)
    const nAtoms = 2 + Math.floor(rnd() * 3)
    const nSelectors = 3 + Math.floor(rnd() * 6)
    const depFor = (selectorIndex: number): DepRef => {
        if (rnd() < 0.45) {
            return { kind: "atom", index: Math.floor(rnd() * nAtoms) }
        }
        let index = Math.floor(rnd() * nSelectors)
        if (!allowSelfCycles && index === selectorIndex) {
            index = (index + 1) % nSelectors
        }
        return { kind: "selector", index }
    }
    const depList = (selectorIndex: number) => {
        const n = Math.floor(rnd() * 4)
        const deps: DepRef[] = []
        const seen = new Set<string>()
        for (let i = 0; i < n * 3 && deps.length < n; i++) {
            const dep = depFor(selectorIndex)
            const key = `${dep.kind}:${dep.index}`
            if (seen.has(key)) continue
            seen.add(key)
            deps.push(dep)
        }
        return deps
    }

    return {
        nAtoms,
        nSelectors,
        defs: Array.from({ length: nSelectors }, (_, selectorIndex) => ({
            ctrlA: Math.floor(rnd() * nAtoms),
            ctrlB: Math.floor(rnd() * nAtoms),
            even: depList(selectorIndex),
            odd: depList(selectorIndex),
        })) satisfies DynamicSelectorDef[],
        rootIndexes: Array.from({ length: 1 + Math.floor(rnd() * 2) }, () =>
            Math.floor(rnd() * nSelectors),
        ),
        ops: Array.from({ length: 8 + Math.floor(rnd() * 8) }, () =>
            Array.from({ length: 1 + Math.floor(rnd() * nAtoms) }, () => ({
                atom: Math.floor(rnd() * nAtoms),
                value: Math.floor(rnd() * 4),
            })),
        ),
        initial: Array.from({ length: nAtoms }, () => Math.floor(rnd() * 4)),
    }
}

const runDynamicLiveCountSeed = (
    seed: number,
    options?: { allowSelfCycles?: boolean },
) => {
    const allowSelfCycles = options?.allowSelfCycles ?? false
    const spec = buildDynamicSpec(seed, allowSelfCycles)
    const prefix = `live-followup.${allowSelfCycles ? "self" : "noself"}.${seed}`
    const atoms = Array.from({ length: spec.nAtoms }, (_, i) =>
        atom(spec.initial[i], { name: `${prefix}.a${i}` }),
    )
    const selectors: any[] = []
    const readDep = (get: any, dep: DepRef): number => {
        if (dep.kind === "atom") return get(atoms[dep.index]) ?? 0
        if (dep.index >= selectors.length) return 0
        return get(selectors[dep.index]) ?? 0
    }

    for (let i = 0; i < spec.nSelectors; i++) {
        const def = spec.defs[i]
        selectors.push(
            selector(
                get => {
                    const ctrl =
                        (get(atoms[def.ctrlA]) ?? 0) +
                        (get(atoms[def.ctrlB]) ?? 0)
                    let acc = ctrl + i
                    const deps = ctrl % 2 === 0 ? def.even : def.odd
                    for (const dep of deps) acc += readDep(get, dep)
                    return acc
                },
                { name: `${prefix}.s${i}` },
            ),
        )
    }

    const s = store(prefix)
    for (let i = 0; i < spec.nAtoms; i++) s.set(atoms[i], spec.initial[i])

    const unsubs: Array<() => void> = []
    try {
        for (const root of spec.rootIndexes) {
            unsubs.push(s.sub(selectors[root], () => {}, false))
        }

        const states = [...atoms, ...selectors]
        for (const root of spec.rootIndexes) s.get(selectors[root])
        assertLiveDependentCounts(s.data, states, `seed ${seed} init`)

        for (let step = 0; step < spec.ops.length; step++) {
            s.txn(t => {
                for (const op of spec.ops[step]) {
                    t.set(atoms[op.atom], op.value)
                }
            })
            assertLiveDependentCounts(s.data, states, `seed ${seed} step ${step}`)
        }
    } finally {
        for (const unsub of unsubs) unsub()
    }
}

describe("liveDependentCount follow-up regressions", () => {
    test("dependency diff removes a stale dependency when a branch reads another dependency twice", () => {
        const useB = atom(true, { name: "live-followup.dup.use-b" })
        const a = atom(1, { name: "live-followup.dup.a" })
        const b = atom(2, { name: "live-followup.dup.b" })
        const root = selector(
            get => (get(useB) ? get(a) + get(b) : get(a) + get(a)),
            { name: "live-followup.dup.root" },
        )

        const s = store("live-followup.dup")
        s.sub(root, () => {}, false)
        s.set(useB, false)

        expect(s.data.stateDependencies.get(root)).not.toContain(b)
        expect(s.data.stateDependents.get(b) ?? new Set()).not.toContain(root)
        expect(s.data.liveDependentCount.get(b) ?? 0).toBe(0)
    })

    test("lazy reinitialization after a throwing dependency reconciles live counts", () => {
        const gate = atom(false, { name: "live-followup.throw.gate" })
        const ready = atom(false, { name: "live-followup.throw.ready" })
        const oldAtom = atom(1, { name: "live-followup.throw.old-atom" })
        const newAtom = atom(2, { name: "live-followup.throw.new-atom" })
        const oldBranch = selector(get => get(oldAtom), {
            name: "live-followup.throw.old-branch",
        })
        const newBranch = selector(
            get => {
                if (!get(ready)) throw new Error("new branch is not ready")
                return get(newAtom)
            },
            { name: "live-followup.throw.new-branch" },
        )
        const root = selector(
            get => (get(gate) ? get(newBranch) : get(oldBranch)),
            { name: "live-followup.throw.root" },
        )

        const s = store("live-followup.throw")
        s.sub(root, () => {}, false)
        s.set(gate, true)
        s.set(ready, true)

        expect(s.get(root)).toBe(2)
        expect(s.data.stateDependencies.get(root)).toContain(newBranch)
        expect(s.data.stateDependents.get(newBranch)).toContain(root)
        expect(s.data.liveDependentCount.get(newBranch) ?? 0).toBe(1)
        expect(s.data.liveDependentCount.get(oldBranch) ?? 0).toBe(0)
    })

    test("cyclic dynamic dependency churn preserves live counts", () => {
        runDynamicLiveCountSeed(882)
    })

    test("direct self-cycle dependency churn preserves live counts", () => {
        runDynamicLiveCountSeed(1255, { allowSelfCycles: true })
    })
})
