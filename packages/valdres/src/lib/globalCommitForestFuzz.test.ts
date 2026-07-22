import { describe, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"
import { checkStoreInvariants } from "../../test/invariants/checkStoreInvariants"
import { getStoreData } from "./getStoreData"

const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

describe("global commit-forest root/scope/shadow fuzz", () => {
    test("every seeded operation preserves values, selectors, and invariants", () => {
        for (let seed = 1; seed <= 80; seed++) {
            const random = mulberry32(seed * 2654435761)
            const shared = atom(0, { global: true })
            const local = atom(0)
            const roots = Array.from({ length: 3 }, () => store())
            const scopes = roots.map(root => root.scope("child"))
            const allStores = roots.flatMap((root, index) => [
                root,
                scopes[index]!,
            ])
            const derived = allStores.map(target =>
                selector(get => get(shared) * 100 + get(local)),
            )
            const cleanups = allStores.map((target, index) =>
                target.sub(derived[index]!, () => {}),
            )
            const rootLocal = [0, 0, 0]
            const scopeLocal: (number | undefined)[] = [
                undefined,
                undefined,
                undefined,
            ]
            let globalValue = 0
            let operation = ""
            const history: string[] = []

            for (let step = 0; step < 45; step++) {
                const rootIndex = Math.floor(random() * roots.length)
                const root = roots[rootIndex]!
                const scope = scopes[rootIndex]!
                const value = 1 + Math.floor(random() * 20)
                switch (Math.floor(random() * 9)) {
                    case 0:
                        operation = `root ${rootIndex} set global ${value}`
                        root.set(shared, value)
                        globalValue = value
                        break
                    case 1:
                        operation = `scope ${rootIndex} set global ${value}`
                        scope.set(shared, value)
                        globalValue = value
                        break
                    case 2:
                        operation = `root ${rootIndex} txn global ${value}`
                        root.txn(txn => txn.set(shared, value))
                        globalValue = value
                        break
                    case 3: {
                        const nextLocal = 1 + Math.floor(random() * 20)
                        operation = `root/scope ${rootIndex} cross txn global ${value}`
                        root.txn(txn => {
                            txn.set(local, nextLocal)
                            txn.scope("child", child =>
                                child.set(shared, value),
                            )
                        })
                        rootLocal[rootIndex] = nextLocal
                        globalValue = value
                        break
                    }
                    case 4:
                        operation = `scope ${rootIndex} reset global`
                        scope.reset(shared)
                        globalValue = 0
                        break
                    case 5:
                        operation = "resetSelf"
                        shared.resetSelf()
                        globalValue = 0
                        break
                    case 6:
                        operation = `root ${rootIndex} set local ${value}`
                        root.set(local, value)
                        rootLocal[rootIndex] = value
                        break
                    case 7:
                        operation = `scope ${rootIndex} set local ${value}`
                        scope.set(local, value)
                        scopeLocal[rootIndex] = value
                        break
                    case 8:
                        operation = `scope ${rootIndex} unset local`
                        scope.unset(local)
                        scopeLocal[rootIndex] = undefined
                        break
                }
                history.push(operation)

                for (let index = 0; index < roots.length; index++) {
                    const rootGlobal = roots[index]!.get(shared)
                    const scopeGlobal = scopes[index]!.get(shared)
                    if (
                        rootGlobal !== globalValue ||
                        scopeGlobal !== globalValue
                    ) {
                        const labels = new Map(
                            allStores.map((target, targetIndex) => [
                                getStoreData(target),
                                `s${targetIndex}`,
                            ]),
                        )
                        const attached = [...(shared as any).stores].map(
                            data => labels.get(data) ?? "other",
                        )
                        throw new Error(
                            `seed ${seed} step ${step} (${operation}) store ${index}: root=${rootGlobal} scope=${scopeGlobal} expected=${globalValue}; attached=${attached.join(",")}; history=${history.join(" | ")}`,
                        )
                    }
                    const expectedRoot = globalValue * 100 + rootLocal[index]!
                    const expectedScope =
                        globalValue * 100 +
                        (scopeLocal[index] ?? rootLocal[index]!)
                    const rootDerived = roots[index]!.get(derived[index * 2]!)
                    const scopeDerived = scopes[index]!.get(
                        derived[index * 2 + 1]!,
                    )
                    if (
                        rootDerived !== expectedRoot ||
                        scopeDerived !== expectedScope
                    ) {
                        throw new Error(
                            `seed ${seed} step ${step} (${operation}) selector ${index}: root=${rootDerived}/${expectedRoot} scope=${scopeDerived}/${expectedScope}; history=${history.join(" | ")}`,
                        )
                    }
                    const violations = checkStoreInvariants(roots[index]!, {
                        states: [shared, local, ...derived],
                    })
                    if (violations.length > 0) {
                        throw new Error(
                            `seed ${seed} step ${step} (${operation}) invariant ${index}: ${violations[0]}; history=${history.join(" | ")}`,
                        )
                    }
                }
            }

            for (const cleanup of cleanups) cleanup()
            for (const root of roots) root.dispose()
        }
    }, 30_000)
})
