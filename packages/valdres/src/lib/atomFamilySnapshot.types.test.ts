import { test } from "bun:test"
import { atomFamily } from "../atomFamily"
import { store } from "../store"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"

type Expect<T extends true> = T
type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false

test("family membership snapshots are readonly", () => {
    const family = atomFamily<number, [string]>(0)
    const members = store().get(family)

    type _ = Expect<
        Equal<typeof members, readonly AtomFamilyAtom<number, [string]>[]>
    >

    if (false) {
        // @ts-expect-error family membership snapshots cannot be mutated
        members.push(family("a"))
    }
})
