import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { getStoreData } from "./getStoreData"

/**
 * What a revert must TELL the world, as opposed to what it leaves behind.
 *
 * `unsetAll.test.ts` asserts the resulting state; these assert the observation
 * of getting there. They are separated because the first three cases here were
 * all shipped-and-wrong once: the state was already correct while nobody was
 * told about it, which is indistinguishable from a working store until a UI is
 * attached. The differential fuzz could not catch them either — its oracle
 * reads, and a silent-but-correct store reads correctly.
 */

const memberIds = (members: readonly any[]) =>
    members.map(member => member.familyArgs[0]).sort()

describe("unsetAll notification", () => {
    test("a family subscriber fires when a shadowed member reverts", () => {
        // The member's VALUE changes (scope value -> inherited value) while the
        // rendered membership list does not. Family subscriptions are
        // member-change subscriptions, so they fire for a value-only change —
        // exactly as they do for a plain per-member `unset`.
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("x"), "x-root")

        const viaUnset = root.scope("via-unset")
        viaUnset.set(entity("x"), "x-draft")
        const unsetSeen: string[][] = []
        viaUnset.sub(entity, (...args: any[]) => unsetSeen.push(args))
        viaUnset.unset(entity("x"))

        const viaUnsetAll = root.scope("via-unset-all")
        viaUnsetAll.set(entity("x"), "x-draft")
        const unsetAllSeen: string[][] = []
        viaUnsetAll.sub(entity, (...args: any[]) => unsetAllSeen.push(args))
        viaUnsetAll.unsetAll()

        expect(unsetSeen).toStrictEqual([["x"]])
        // unsetAll IS unset applied to the whole scope: same notification.
        expect(unsetAllSeen).toStrictEqual([["x"]])
    })

    test("a family subscriber fires when a scope-local delete is reverted", () => {
        // Here membership really does change — the member comes back — but the
        // restored member carries no value write of its own (its value lives in
        // the parent), so nothing but the revert can report it.
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("a"), "a-root")
        const draft = root.scope("draft")
        draft.del(entity("a"))
        expect(memberIds(draft.get(entity))).toStrictEqual([])

        const seen: string[][] = []
        draft.sub(entity, (...args: any[]) => seen.push(args))

        draft.unsetAll()

        expect(memberIds(draft.get(entity))).toStrictEqual(["a"])
        expect(seen).toStrictEqual([["a"]])
    })

    test("a family selector recomputes when a scope-local delete is reverted", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const ids = selector(get => memberIds(get(entity)).join(","))
        const root = store()
        root.set(entity("a"), "a-root")
        const draft = root.scope("draft")
        draft.del(entity("a"))

        const seen: string[] = []
        draft.sub(ids, () => seen.push(draft.get(ids)))
        expect(draft.get(ids)).toBe("")

        draft.unsetAll()

        expect(draft.get(ids)).toBe("a")
        expect(seen).toStrictEqual(["a"])
    })

    test("onChange reports a restored member, not just silence", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("a"), "a-root")
        const draft = root.scope("draft")
        draft.del(entity("a"))

        const changes: any[] = []
        root.onChange(reported => changes.push(...reported))

        draft.unsetAll()

        // The scope dropped a local override (its delete tombstone) and now
        // reads the parent again — the same shape `unset` reports.
        expect(changes).toStrictEqual([
            {
                type: "atom",
                kind: "unset",
                state: entity("a"),
                value: "a-root",
                scope: ["draft"],
            },
        ])
    })

    test("a member that LEFT is reported exactly once, not twice", () => {
        // The member's value drop already reports it through the unset channel.
        // The membership delta exists only for members no other channel can
        // carry, so it must not re-emit this one.
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("kept"), "r")
        const draft = root.scope("draft")
        draft.set(entity("draft-only"), "d")

        const changes: any[] = []
        root.onChange(reported => changes.push(...reported))

        draft.unsetAll()

        expect(changes).toStrictEqual([
            {
                type: "atom",
                kind: "unset",
                state: entity("draft-only"),
                value: "default:draft-only",
                scope: ["draft"],
            },
        ])
    })

    test("a family subscriber still hears about a member that left, once", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        const draft = root.scope("draft")
        draft.set(entity("draft-only"), "d")

        const seen: string[][] = []
        draft.sub(entity, (...args: any[]) => seen.push(args))

        draft.unsetAll()

        expect(seen).toStrictEqual([["draft-only"]])
    })

    test("a mixed revert reports each member exactly once", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("shadowed"), "root-shadowed")
        root.set(entity("deleted"), "root-deleted")
        const draft = root.scope("draft")
        draft.set(entity("shadowed"), "draft-shadowed")
        draft.set(entity("added"), "draft-added")
        draft.del(entity("deleted"))

        const changes: any[] = []
        root.onChange(reported => changes.push(...reported))

        draft.unsetAll()

        const perMember = changes.map(c => c.state.familyArgs[0]).sort()
        expect(perMember).toStrictEqual(["added", "deleted", "shadowed"])
    })

    test("a direct store.unsetAll() reports source 'unset'", () => {
        const title = atom("root")
        const root = store()
        const draft = root.scope("draft")
        draft.set(title, "draft")

        const sources: string[] = []
        root.onChange((_changes, meta) => sources.push(meta.source))

        draft.unsetAll()

        // Every sibling primitive tags its own commit: set -> "set",
        // del -> "delete", unset -> "unset". A revert is an unset.
        expect(sources).toStrictEqual(["unset"])
    })

    test("a revert inside a transaction still reports source 'transaction'", () => {
        const title = atom("root")
        const root = store()
        const draft = root.scope("draft")
        draft.set(title, "draft")

        const sources: string[] = []
        root.onChange((_changes, meta) => sources.push(meta.source))

        root.txn(txn => txn.scope("draft", scoped => scoped.unsetAll()))

        expect(sources).toStrictEqual(["transaction"])
    })
    test("a family subscriber tracks the parent again after the revert", () => {
        // A scope stops delegating its family subscription to the parent the
        // moment it shadows the family — otherwise a parent membership change
        // would notify it twice. The revert has to re-arm that delegate, or the
        // scope keeps its own (now pass-through) index and silently misses
        // every later parent membership change. Same contract as `unset`
        // re-delegating an atom's subscriptions.
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        const draft = root.scope("draft")
        const fresh = root.scope("never-written")
        draft.set(entity("draft-only"), "d")

        const draftSeen: string[][] = []
        const freshSeen: string[][] = []
        draft.sub(entity, (...args: any[]) => draftSeen.push(args))
        fresh.sub(entity, (...args: any[]) => freshSeen.push(args))

        draft.unsetAll()
        draftSeen.length = 0
        freshSeen.length = 0

        root.set(entity("added-at-root"), "r")

        // The reverted scope owns nothing, so it must hear exactly what a scope
        // that never owned anything hears.
        expect(draftSeen).toStrictEqual([["added-at-root"]])
        expect(draftSeen).toStrictEqual(freshSeen)
    })

    test("member subscribers also track the parent again after the revert", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        root.set(entity("x"), "x-root")
        const draft = root.scope("draft")
        draft.set(entity("x"), "x-draft")

        const seen: string[] = []
        draft.sub(entity("x"), () => seen.push(draft.get(entity("x"))))

        draft.unsetAll()
        seen.length = 0

        root.set(entity("x"), "x-root-2")
        expect(seen).toStrictEqual(["x-root-2"])
    })
})

describe("unsetAll nested-scope index linkage", () => {
    test("a nested scope's index is re-linked to the reverted parent index", () => {
        const entity = atomFamily<string, [string]>(id => `default:${id}`)
        const root = store()
        const subject = root.scope("subject")
        const control = root.scope("control")
        const subjectChild = subject.scope("child")
        const controlChild = control.scope("child")

        root.set(entity("a"), "a-root")
        // Each child materializes its own index and adds a member, so both hold
        // a real index whose parentIndex must track its parent's.
        subjectChild.set(entity("c"), "c-child")
        controlChild.set(entity("c"), "c-child")
        // The subject shadows an inherited member: its own rendered list does
        // not change, which is the case that skips the ordinary re-link.
        subject.set(entity("a"), "a-subject")

        subject.unsetAll()

        const subjectIndex = (getStoreData(subject).values.get(entity) as any)
            .__index
        const childIndex = (
            getStoreData(subjectChild).values.get(entity) as any
        ).__index
        expect(childIndex.parentIndex).toBe(subjectIndex)

        // Observable consequence of a stale link: membership ORDER diverges
        // from a never-reverted sibling, because the child renders against a
        // discarded index with different creation timestamps.
        expect(
            subjectChild.get(entity).map((m: any) => m.familyArgs[0]),
        ).toStrictEqual(
            controlChild.get(entity).map((m: any) => m.familyArgs[0]),
        )
    })
})
