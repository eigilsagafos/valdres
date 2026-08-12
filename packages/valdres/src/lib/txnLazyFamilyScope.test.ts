import { describe, expect, test } from "bun:test"
import { store } from "../store"
import { atomFamily } from "../atomFamily"
import { atom } from "../atom"
import { selector } from "../selector"

const keys = (s: any, fam: any) =>
    s
        .get(fam)
        .map((a: any) => a.familyArgs[0])
        .sort()

describe("lazy family-member init inside scoped transactions", () => {
    // Cross-scope txn: a scope callback lazily reads a member. Membership must
    // match a direct scoped lazy read at every store level.
    test("cross-scope txn lazy read matches direct scoped read", () => {
        const famT = atomFamily<{ v: number }, [string]>({ v: 0 })
        const rootT = store()
        const St = rootT.scope("c")
        rootT.txn((t: any) => t.scope("c", (ct: any) => ct.get(famT("lazy"))))

        const famD = atomFamily<{ v: number }, [string]>({ v: 0 })
        const rootD = store()
        const Sd = rootD.scope("c")
        Sd.get(famD("lazy"))

        expect(keys(St, famT)).toStrictEqual(keys(Sd, famD))
        expect(keys(rootT, famT)).toStrictEqual(keys(rootD, famD))
        // The lazily-read member is visible from the scope in both.
        expect(keys(St, famT)).toStrictEqual(["lazy"])
    })

    // Standalone scope-store txn: same invariant.
    test("standalone scope txn lazy read matches direct scoped read", () => {
        const famT = atomFamily<{ v: number }, [string]>({ v: 0 })
        const rootT = store()
        const St = rootT.scope("c")
        St.txn((t: any) => t.get(famT("lazy")))

        const famD = atomFamily<{ v: number }, [string]>({ v: 0 })
        const rootD = store()
        const Sd = rootD.scope("c")
        Sd.get(famD("lazy"))

        expect(keys(St, famT)).toStrictEqual(keys(Sd, famD))
        expect(keys(rootT, famT)).toStrictEqual(keys(rootD, famD))
        expect(keys(St, famT)).toStrictEqual(["lazy"])
    })

    // Cross-scope abort: the scope callback's lazy read value survives, so its
    // membership must too — matching a direct scoped read.
    test("cross-scope txn abort still registers the scoped lazy member", () => {
        const famT = atomFamily<{ v: number }, [string]>({ v: 0 })
        const rootT = store()
        const St = rootT.scope("c")
        expect(() => {
            rootT.txn((t: any) => {
                t.scope("c", (ct: any) => ct.get(famT("lazy")))
                throw new Error("abort")
            })
        }).toThrow("abort")

        const famD = atomFamily<{ v: number }, [string]>({ v: 0 })
        const rootD = store()
        const Sd = rootD.scope("c")
        Sd.get(famD("lazy"))

        expect(keys(St, famT)).toStrictEqual(keys(Sd, famD))
        expect(keys(rootT, famT)).toStrictEqual(keys(rootD, famD))
    })
})

/** Final intent inside a SCOPE. A scope's `del`/`unset` of an inherited member
 *  touches no local value — the value lives in an ancestor — so neither the
 *  local delete set nor "does a value exist up the chain" can decide whether the
 *  member survives. The family index's tombstone is the authority. Each case is
 *  measured against the same operations performed directly on the scope. */
describe("scoped lazy init respects final intent", () => {
    const scoped = () => {
        const root = store()
        return {
            root,
            scope: root.scope("c"),
            fam: atomFamily<number, [string]>(() => 0),
        }
    }

    test("scoped get then del removes the member, like a direct scoped del", () => {
        const direct = scoped()
        direct.scope.get(direct.fam("m"))
        direct.scope.del(direct.fam("m"))

        const viaTxn = scoped()
        viaTxn.scope.txn((t: any) => {
            t.get(viaTxn.fam("m"))
            t.del(viaTxn.fam("m"))
        })

        expect(keys(viaTxn.scope, viaTxn.fam)).toStrictEqual(
            keys(direct.scope, direct.fam),
        )
        expect(keys(viaTxn.scope, viaTxn.fam)).toStrictEqual([])
    })

    test("scoped get then unset keeps the member, like a direct scoped unset", () => {
        const direct = scoped()
        direct.scope.get(direct.fam("m"))
        direct.scope.txn((t: any) => t.unset(direct.fam("m")))

        const viaTxn = scoped()
        viaTxn.scope.txn((t: any) => {
            t.get(viaTxn.fam("m"))
            t.unset(viaTxn.fam("m"))
        })

        expect(keys(viaTxn.scope, viaTxn.fam)).toStrictEqual(
            keys(direct.scope, direct.fam),
        )
        // unset resets the value but keeps membership.
        expect(keys(viaTxn.scope, viaTxn.fam)).toStrictEqual(["m"])
    })

    test("a scoped delete that applied is not resurrected by the repair pass", () => {
        const { scope, fam } = scoped()
        const trigger = atom(0)
        scope.sub(trigger, () => {
            throw new Error("subscriber boom")
        })
        expect(() => {
            scope.txn((t: any) => {
                t.get(fam("m"))
                t.del(fam("m"))
                t.set(trigger, 1)
            })
        }).toThrow("subscriber boom")
        // The tombstone landed, so the member stays deleted even though its
        // value still lives in the ancestor.
        expect(keys(scope, fam)).toStrictEqual([])
    })
})

/** An aborted tree settles as ONE forest pass, after every store's membership is
 *  registered — so a scope selector never sees an intermediate tree and never
 *  runs twice for one abort. */
describe("aborted cross-scope lazy init settles atomically", () => {
    test("a scope family selector evaluates once, against the final tree", () => {
        const root = store()
        const scope = root.scope("c")
        const fam = atomFamily<number, [string]>(() => 0)
        const evaluations: string[] = []
        const names = selector(get => {
            const value = get(fam)
                .map((a: any) => a.familyArgs[0])
                .sort()
                .join(",")
            evaluations.push(value)
            return value
        })
        scope.sub(names, () => {})
        evaluations.length = 0

        expect(() => {
            root.txn((t: any) => {
                t.get(fam("rootLazy"))
                t.scope("c", (ct: any) => ct.get(fam("scopeLazy")))
                throw new Error("abort")
            })
        }).toThrow("abort")

        // Exactly one evaluation, and it already saw both members — settling
        // store-by-store would evaluate against "rootLazy" first, then again.
        expect(evaluations).toStrictEqual(["rootLazy,scopeLazy"])
        expect(scope.get(names)).toBe("rootLazy,scopeLazy")
    })
})
