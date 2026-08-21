import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { globalAtom } from "../globalAtom"
import { selector } from "../selector"
import { store } from "../store"
import { getStoreData } from "./getStoreData"

const memberIds = (members: readonly any[]) =>
    members.map(member => member.familyArgs[0]).sort()

describe("scope.unsetAll", () => {
    test("every shadowed atom re-inherits and resumes tracking the parent", () => {
        const title = atom("root title")
        const count = atom(0)
        const untouched = atom("untouched")
        const root = store()
        const draft = root.scope("draft")
        draft.set(title, "draft title")
        draft.set(count, 7)

        const seen: string[] = []
        draft.sub(title, () => seen.push(`title=${draft.get(title)}`))
        draft.sub(count, () => seen.push(`count=${draft.get(count)}`))

        draft.unsetAll()

        expect(draft.get(title)).toBe("root title")
        expect(draft.get(count)).toBe(0)
        expect(draft.get(untouched)).toBe("untouched")
        expect(seen).toStrictEqual(["title=root title", "count=0"])

        // Tracking the parent again is the half a plain re-read cannot prove.
        root.set(title, "root title 2")
        expect(draft.get(title)).toBe("root title 2")
        expect(seen).toStrictEqual([
            "title=root title",
            "count=0",
            "title=root title 2",
        ])
    })

    test("notifies every atom it dropped, as unset does — equal or not", () => {
        // `unset` notifies unconditionally once an own value was actually
        // removed, even when the effective value is unchanged (see unsetValue).
        // unsetAll IS that operation applied to the whole scope, so it inherits
        // the rule rather than adding an equality gate of its own.
        const same = atom("shared")
        const differs = atom("root")
        const neverShadowed = atom("root")
        const root = store()
        const draft = root.scope("draft")
        draft.set(same, "shared")
        draft.set(differs, "draft")

        const seen: string[] = []
        draft.sub(same, () => seen.push("same"))
        draft.sub(differs, () => seen.push("differs"))
        draft.sub(neverShadowed, () => seen.push("neverShadowed"))

        draft.unsetAll()

        expect(seen).toStrictEqual(["same", "differs"])
        expect(draft.get(same)).toBe("shared")
        expect(draft.get(differs)).toBe("root")
    })

    test("is one commit, whatever the scope owns", () => {
        const a = atom("a")
        const b = atom("b")
        const root = store()
        const draft = root.scope("draft")
        draft.set(a, "a-draft")
        draft.set(b, "b-draft")

        let commits = 0
        root.onCommitEnd(() => commits++)
        draft.sub(a, () => {})
        draft.sub(b, () => {})

        draft.unsetAll()

        expect(commits).toBe(1)
    })

    test("is idempotent and a no-op on a scope that owns nothing", () => {
        const a = atom("a")
        const root = store()
        const draft = root.scope("draft")

        let commits = 0
        root.onCommitEnd(() => commits++)
        const seen: string[] = []
        draft.sub(a, () => seen.push("a"))

        draft.unsetAll()
        expect(commits).toBe(0)

        draft.set(a, "a-draft")
        commits = 0
        draft.unsetAll()
        // Proves the counter is wired at all, so the zeros around it mean
        // "nothing happened" rather than "nothing was being counted".
        expect(commits).toBe(1)
        seen.length = 0
        commits = 0

        draft.unsetAll()
        expect(commits).toBe(0)
        expect(seen).toStrictEqual([])
    })

    test("dependent selectors recompute against the inherited values", () => {
        const first = atom("root-first")
        const last = atom("root-last")
        const fullName = selector(get => `${get(first)} ${get(last)}`)
        const root = store()
        const draft = root.scope("draft")
        draft.set(first, "draft-first")
        draft.set(last, "draft-last")

        const seen: string[] = []
        draft.sub(fullName, () => seen.push(draft.get(fullName)))
        expect(draft.get(fullName)).toBe("draft-first draft-last")

        draft.unsetAll()

        expect(draft.get(fullName)).toBe("root-first root-last")
        expect(seen).toStrictEqual(["root-first root-last"])
    })

    test("keeps the scope alive, leased, and reusable", () => {
        const a = atom("root")
        const root = store()
        const draft = root.scope("draft")
        const secondConsumer = root.scope("draft")
        draft.set(a, "draft")

        // A subscription taken before the revert must survive it: the scope is
        // emptied, not torn down.
        const seen: string[] = []
        const unsubscribe = secondConsumer.sub(a, () =>
            seen.push(secondConsumer.get(a)),
        )

        draft.unsetAll()

        expect(seen).toStrictEqual(["root"])
        expect(secondConsumer.get(a)).toBe("root")
        // The other lease still reads through the same live scope...
        draft.set(a, "draft again")
        expect(secondConsumer.get(a)).toBe("draft again")
        expect(seen).toStrictEqual(["root", "draft again"])
        expect(root.get(a)).toBe("root")
        unsubscribe()
        secondConsumer.detach()
        draft.detach()
    })

    test("throws on a root store", () => {
        const root = store("root-id")
        expect(() => (root as any).unsetAll()).toThrow(
            /only available on a scope, and store 'root-id' is a root store/,
        )
    })

    test("reachable on a borrowed scope, without taking a lease", () => {
        const a = atom("root")
        const root = store()
        const lease = root.scope("draft")
        lease.set(a, "draft")

        root.scope("draft", scope => scope.unsetAll())

        expect(lease.get(a)).toBe("root")
    })
})

describe("scope.unsetAll — atom families", () => {
    test("members the scope added leave its membership", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("kept"), "root value")
        const draft = root.scope("draft")
        draft.set(entity("draft-only"), "draft value")
        expect(memberIds(draft.get(entity))).toStrictEqual([
            "draft-only",
            "kept",
        ])

        draft.unsetAll()

        expect(memberIds(draft.get(entity))).toStrictEqual(["kept"])
        expect(memberIds(root.get(entity))).toStrictEqual(["kept"])
    })

    test("members the scope deleted come back", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("a"), "a-root")
        root.set(entity("b"), "b-root")
        const draft = root.scope("draft")
        draft.del(entity("a"))
        expect(memberIds(draft.get(entity))).toStrictEqual(["b"])

        draft.unsetAll()

        expect(memberIds(draft.get(entity))).toStrictEqual(["a", "b"])
        expect(draft.get(entity("a"))).toBe("a-root")
    })

    test("a shadowed member reverts in value AND stops being locally owned", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("x"), "x-root")
        const draft = root.scope("draft")
        draft.set(entity("x"), "x-draft")

        draft.unsetAll()

        expect(draft.get(entity("x"))).toBe("x-root")
        // Local ownership is what makes a scope ignore a later parent delete.
        // Reverting has to give that up too, or membership silently diverges
        // again on the next root change.
        root.del(entity("x"))
        expect(memberIds(root.get(entity))).toStrictEqual([])
        expect(memberIds(draft.get(entity))).toStrictEqual([])
    })

    test("delete-then-recreate of a stable key survives the revert", () => {
        // The singleton case: a bare, reusable ref rather than a snowflake id.
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("OrgSettings"), "v1")
        const draft = root.scope("draft")
        draft.del(entity("OrgSettings"))

        draft.unsetAll()

        root.del(entity("OrgSettings"))
        root.set(entity("OrgSettings"), "v2")

        expect(memberIds(draft.get(entity))).toStrictEqual(["OrgSettings"])
        expect(draft.get(entity("OrgSettings"))).toBe("v2")
    })

    test("family subscribers and family selectors see the reverted membership", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const ids = selector(get => memberIds(get(entity)))
        const root = store()
        root.set(entity("kept"), "root")
        const draft = root.scope("draft")
        draft.set(entity("draft-only"), "draft")

        const seen: string[][] = []
        draft.sub(ids, () => seen.push(draft.get(ids)))
        expect(draft.get(ids)).toStrictEqual(["draft-only", "kept"])

        draft.unsetAll()

        expect(draft.get(ids)).toStrictEqual(["kept"])
        expect(seen).toStrictEqual([["kept"]])
    })

    test("the scope keeps following parent membership afterwards", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("a"), "a-root")
        const draft = root.scope("draft")
        draft.set(entity("draft-only"), "draft")

        draft.unsetAll()

        root.set(entity("added-later"), "later")
        expect(memberIds(draft.get(entity))).toStrictEqual(["a", "added-later"])
        expect(draft.get(entity("added-later"))).toBe("later")
    })

    test("clears the scope's index-key register", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const plain = atom("root")
        const root = store()
        const draft = root.scope("draft")
        draft.set(plain, "draft")
        draft.set(entity("one"), "one")
        draft.set(entity("two"), "two")

        const draftData = getStoreData(draft)
        expect(draftData.scopeIndexKeys!.size).toBe(4) // 3 atoms + the family

        draft.unsetAll()

        // Only the (now pass-through) family index stays registered: dropping
        // it would break initFamilyIndex's ancestor invariant. Every atom is
        // released — which is what stops a long-lived scope from pinning them.
        expect([...draftData.scopeIndexKeys!]).toStrictEqual([entity as any])
        expect(draftData.values.has(plain)).toBe(false)
        expect(draftData.values.has(entity("one"))).toBe(false)
    })
})

describe("scope.unsetAll — nested scopes", () => {
    test("a nested scope keeps its own values and re-inherits the rest", () => {
        const shared = atom("root")
        const nestedOwn = atom("root-2")
        const root = store()
        const draft = root.scope("draft")
        const nested = draft.scope("nested")
        draft.set(shared, "draft")
        draft.set(nestedOwn, "draft-2")
        nested.set(nestedOwn, "nested-2")
        expect(nested.get(shared)).toBe("draft")

        draft.unsetAll()

        expect(nested.get(shared)).toBe("root")
        expect(nested.get(nestedOwn)).toBe("nested-2")
        expect(draft.get(nestedOwn)).toBe("root-2")
    })

    test("a nested scope's family membership still resolves through the chain", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("root-member"), "root")
        const draft = root.scope("draft")
        const nested = draft.scope("nested")
        draft.set(entity("draft-member"), "draft")
        nested.set(entity("nested-member"), "nested")
        expect(memberIds(nested.get(entity))).toStrictEqual([
            "draft-member",
            "nested-member",
            "root-member",
        ])

        draft.unsetAll()

        expect(memberIds(draft.get(entity))).toStrictEqual(["root-member"])
        expect(memberIds(nested.get(entity))).toStrictEqual([
            "nested-member",
            "root-member",
        ])

        root.set(entity("added-later"), "later")
        expect(memberIds(nested.get(entity))).toStrictEqual([
            "added-later",
            "nested-member",
            "root-member",
        ])
    })
})

describe("transaction.unsetAll", () => {
    test("lands in the enclosing commit, atomically with the transaction's own writes", () => {
        const applied = atom("root applied")
        const draftTitle = atom("root title")
        const root = store()
        const draft = root.scope("draft")
        draft.set(draftTitle, "draft title")

        let commits = 0
        root.onCommitEnd(() => commits++)
        const observed: string[] = []
        draft.sub(draftTitle, () => observed.push(draft.get(draftTitle)))
        root.sub(applied, () => observed.push(`applied=${root.get(applied)}`))

        root.txn(txn => {
            txn.set(applied, "published")
            txn.scope("draft", scoped => scoped.unsetAll())
        })

        expect(commits).toBe(1)
        expect(observed).toStrictEqual(["applied=published", "root title"])
        expect(draft.get(draftTitle)).toBe("root title")
    })

    test("drops values staged for the scope earlier in the same transaction", () => {
        const a = atom("root")
        const root = store()
        const draft = root.scope("draft")

        root.txn(txn => {
            txn.scope("draft", scoped => {
                scoped.set(a, "staged")
                scoped.unsetAll()
            })
        })

        expect(draft.get(a)).toBe("root")
        expect(getStoreData(draft).values.has(a)).toBe(false)
    })

    test("a set after unsetAll re-establishes the shadow", () => {
        const a = atom("root")
        const root = store()
        const draft = root.scope("draft")
        draft.set(a, "draft")

        root.txn(txn => {
            txn.scope("draft", scoped => {
                scoped.unsetAll()
                scoped.set(a, "draft again")
            })
        })

        expect(draft.get(a)).toBe("draft again")
        root.set(a, "root 2")
        expect(draft.get(a)).toBe("draft again")
    })

    test("a member read during the same transaction is not re-registered", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        const draft = root.scope("draft")
        draft.set(entity("draft-only"), "draft")

        root.txn(txn => {
            txn.scope("draft", scoped => {
                scoped.get(entity("draft-only"))
                scoped.unsetAll()
            })
        })

        expect(memberIds(draft.get(entity))).toStrictEqual([])
    })

    test("an aborted transaction reverts nothing", () => {
        const a = atom("root")
        const root = store()
        const draft = root.scope("draft")
        draft.set(a, "draft")

        expect(() =>
            root.txn(txn => {
                txn.scope("draft", scoped => scoped.unsetAll())
                throw new Error("nope")
            }),
        ).toThrow("nope")

        expect(draft.get(a)).toBe("draft")
    })

    test("throws on a root transaction", () => {
        const root = store("root-id")
        expect(() => root.txn(txn => txn.unsetAll())).toThrow(
            /only available on a scope/,
        )
    })

    test("two scopes revert in the same commit", () => {
        const a = atom("root")
        const root = store()
        const one = root.scope("one")
        const two = root.scope("two")
        one.set(a, "one")
        two.set(a, "two")

        let commits = 0
        root.onCommitEnd(() => commits++)

        root.txn(txn => {
            txn.scope("one", scoped => scoped.unsetAll())
            txn.scope("two", scoped => scoped.unsetAll())
        })

        expect(commits).toBe(1)
        expect(one.get(a)).toBe("root")
        expect(two.get(a)).toBe("root")
    })
})

describe("scope.unsetAll — at depth", () => {
    test("reverts to the MID scope's values, not the root's", () => {
        const title = atom("root")
        const root = store()
        const mid = root.scope("mid")
        const leaf = mid.scope("leaf")
        mid.set(title, "mid")
        leaf.set(title, "leaf")

        const seen: string[] = []
        leaf.sub(title, () => seen.push(leaf.get(title)))

        leaf.unsetAll()

        expect(leaf.get(title)).toBe("mid")
        expect(seen).toStrictEqual(["mid"])

        // ...and it tracks the MID scope from here, not the root.
        mid.set(title, "mid 2")
        expect(leaf.get(title)).toBe("mid 2")
        root.set(title, "root 2")
        expect(leaf.get(title)).toBe("mid 2")
        expect(seen).toStrictEqual(["mid", "mid 2"])
    })

    test("family membership at depth reverts to the mid scope's", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        const mid = root.scope("mid")
        const leaf = mid.scope("leaf")
        root.set(entity("root-member"), "r")
        mid.set(entity("mid-member"), "m")
        leaf.set(entity("leaf-member"), "l")
        leaf.del(entity("mid-member"))

        leaf.unsetAll()

        expect(memberIds(leaf.get(entity))).toStrictEqual([
            "mid-member",
            "root-member",
        ])
        expect(memberIds(mid.get(entity))).toStrictEqual([
            "mid-member",
            "root-member",
        ])
    })
})

describe("scope.unsetAll — isolation", () => {
    test("no cross-talk: the root and a sibling scope stay silent", () => {
        const title = atom("root")
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("shared"), "r")
        const draft = root.scope("draft")
        const sibling = root.scope("sibling")
        draft.set(title, "draft")
        draft.set(entity("draft-only"), "d")

        const noise: string[] = []
        root.sub(title, () => noise.push("root:title"))
        root.sub(entity, (...args: any[]) => noise.push(`root:fam:${args}`))
        sibling.sub(title, () => noise.push("sibling:title"))
        sibling.sub(entity, (...args: any[]) =>
            noise.push(`sibling:fam:${args}`),
        )

        draft.unsetAll()

        expect(noise).toStrictEqual([])
        expect(root.get(title)).toBe("root")
        expect(memberIds(root.get(entity))).toStrictEqual(["shared"])
    })

    test("a subscriber sees the WHOLE scope already reverted", () => {
        // The one-commit claim is only meaningful if no callback can observe a
        // half-reverted scope, so the callback reads everything else.
        const a = atom("a-root")
        const b = atom("b-root")
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        const draft = root.scope("draft")
        draft.set(a, "a-draft")
        draft.set(b, "b-draft")
        draft.set(entity("draft-only"), "d")

        const observed: string[] = []
        draft.sub(a, () =>
            observed.push(
                `a=${draft.get(a)} b=${draft.get(b)} members=${memberIds(
                    draft.get(entity),
                ).join(",")}`,
            ),
        )

        draft.unsetAll()

        expect(observed).toStrictEqual(["a=a-root b=b-root members="])
    })
})

describe("scope.unsetAll — lifecycle and batching", () => {
    test("throws on a disposed scope", () => {
        const root = store()
        const draft = root.scope("draft")
        draft.detach()
        expect(() => draft.unsetAll()).toThrow(/disposed/i)
    })

    test("batchUpdates: a staged write is flushed, then reverted", async () => {
        const a = atom("root")
        const root = store({ batchUpdates: true })
        const draft = root.scope("draft")

        draft.set(a, "draft")
        draft.unsetAll()

        expect(draft.get(a)).toBe("root")
        await Promise.resolve()
        expect(draft.get(a)).toBe("root")
    })

    test("batchUpdates: a write after the revert still lands", async () => {
        const a = atom("root")
        const root = store({ batchUpdates: true })
        const draft = root.scope("draft")
        draft.set(a, "draft")
        await Promise.resolve()

        draft.unsetAll()
        draft.set(a, "draft again")

        await Promise.resolve()
        expect(draft.get(a)).toBe("draft again")
        expect(root.get(a)).toBe("root")
    })
})

describe("scope.unsetAll — global atoms", () => {
    test("a shadowed global atom behaves exactly as under unset", () => {
        // A global atom holds ONE value for the whole tree, so a scope's write
        // to it is not a shadow that can be reverted — the parent's value moved
        // too. That is global-atom semantics, not something a revert can undo,
        // and the contract that matters is that `unsetAll` does neither more nor
        // less than `unset` here. Asserted differentially so the two can never
        // drift apart silently.
        const run = (revert: (scope: any, atom: any) => void, name: string) => {
            const flag = globalAtom("root", { name })
            const root = store()
            const draft = root.scope("draft")
            draft.set(flag, "draft")
            const seen: string[] = []
            draft.sub(flag, () => seen.push(draft.get(flag)))

            revert(draft, flag)
            const afterRevert = [draft.get(flag), root.get(flag)]

            root.set(flag, "root 2")
            const afterRootWrite = [draft.get(flag), root.get(flag)]
            root.dispose()
            return { afterRevert, afterRootWrite, seen }
        }

        expect(
            run(
                (scope, atom) => scope.unsetAll(),
                "unsetAll/test/flag-all",
            ),
        ).toStrictEqual(
            run(
                (scope, atom) => scope.unset(atom),
                "unsetAll/test/flag-one",
            ),
        )
    })
})

describe("scope.unsetAll — reentrancy", () => {
    test("called from inside a subscriber", () => {
        const trigger = atom("root")
        const shadowed = atom("root")
        const root = store()
        const draft = root.scope("draft")
        draft.set(shadowed, "draft")

        let reverted = false
        draft.sub(trigger, () => {
            if (reverted) return
            reverted = true
            draft.unsetAll()
        })

        root.set(trigger, "root 2")

        expect(reverted).toBe(true)
        expect(draft.get(shadowed)).toBe("root")
    })

    test("called from inside an onSet hook", () => {
        const shadowed = atom("root")
        const root = store()
        let draft: ReturnType<typeof root.scope>
        const trigger = atom("root", {
            onSet: () => {
                draft.unsetAll()
            },
        })
        draft = root.scope("draft")
        draft.set(shadowed, "draft")

        root.set(trigger, "fired")

        expect(draft.get(shadowed)).toBe("root")
    })
})
