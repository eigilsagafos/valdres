import { test } from "bun:test"
import { atomFamily } from "../atomFamily"
import { selectorFamily } from "../selectorFamily"

type Expect<T extends true> = T
type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false

test("family keyOf receives the declared argument tuple", () => {
    type Entity = { id: string; self?: Entity }

    atomFamily<string, [Entity]>(entity => entity.id, {
        keyOf: entity => {
            type _ = Expect<Equal<typeof entity, Entity>>
            return entity.id
        },
    })

    selectorFamily<string, [Entity, number]>(
        (entity, revision) => () => `${entity.id}:${revision}`,
        {
            keyOf: (entity, revision) => {
                type _1 = Expect<Equal<typeof entity, Entity>>
                type _2 = Expect<Equal<typeof revision, number>>
                return [entity.id, revision]
            },
        },
    )
})

test("family keyOf rejects unsupported key results", () => {
    atomFamily<string, [string]>(id => id, {
        // @ts-expect-error symbols do not have deterministic structural identity
        keyOf: id => Symbol(id),
    })
})
