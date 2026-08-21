import { describe, expect, test } from "../../test/performance/test-compat"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { getStoreData } from "./getStoreData"
import { checkStoreInvariants } from "../../test/invariants/checkStoreInvariants"

/**
 * Differential fuzz for `unsetAll`.
 *
 * The oracle is the definition itself: a scope that owns nothing reads exactly
 * what it inherits. So a scope put through arbitrary writes and then reverted
 * must be observationally identical to a SIBLING scope of the same parent that
 * was never written to — for every atom value, every family membership list,
 * every selector, every subscriber notification, and for every parent write
 * that follows.
 *
 * Two halves matter independently, and each has caught a different class of bug:
 *
 *   - READS. Reverting the values is easy; giving up local OWNERSHIP so later
 *     parent writes and deletes reach the scope again is where scope/family/txn
 *     bookkeeping has gone wrong. The sibling notices, because it never owned
 *     anything.
 *   - NOTIFICATIONS. A store can be left perfectly correct and completely
 *     silent, which reads as working right up until a UI is attached. Three
 *     bugs of exactly that shape survived an earlier, read-only version of this
 *     fuzz; subscribers are part of the oracle now for that reason.
 */

const mulberry32 = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const ATOM_COUNT = 4
const MEMBER_KEYS = ["m0", "m1", "m2", "m3", "m4"]

const memberIds = (members: readonly any[]) =>
    members.map(member => member.familyArgs[0]).sort()

type World = ReturnType<typeof createWorld>

const createWorld = () => {
    const atoms = Array.from({ length: ATOM_COUNT }, (_, i) =>
        atom(`root-${i}`),
    )
    const family = atomFamily<string, [string]>(id => `default:${id}`)
    // One selector over values and one over membership: the two ways a revert
    // can be observed indirectly.
    const joined = selector(get => atoms.map(a => get(a)).join("|"))
    const memberList = selector(get => memberIds(get(family)).join(","))
    // Deliberately never subscribed. A COLD selector is not recomputed by
    // propagation — it keeps a cached value and revalidates on read against a
    // snapshot of its dependencies' revisions — so it exercises a completely
    // different invalidation path from the two above, and one where a scope
    // dropping its own value is the awkward case (the store stops holding the
    // value whose revision moved).
    const coldJoined = selector(
        get => `cold:${atoms.map(a => get(a)).join("|")}`,
    )
    const coldMembers = selector(
        get => `cold:${memberIds(get(family)).join(",")}`,
    )
    return { atoms, family, joined, memberList, coldJoined, coldMembers }
}

/** Everything a consumer of `scope` can see, WITHOUT perturbing it. Member
 *  values are read only for keys already in this scope's membership: reading a
 *  member nothing ever wrote lazily initializes it and registers it as a member
 *  of the READING store, which would quietly give the control scope its own
 *  values and blunt the oracle. */
const observe = (world: World, scope: any) => {
    const members = memberIds(scope.get(world.family))
    return {
        values: world.atoms.map(a => scope.get(a)),
        members,
        memberValues: members.map(key => scope.get(world.family(key))),
        joined: scope.get(world.joined),
        memberList: scope.get(world.memberList),
        coldJoined: scope.get(world.coldJoined),
        coldMembers: scope.get(world.coldMembers),
    }
}

/** A subscriber on every observable surface, recording what each callback SAW
 *  (not merely that it ran), so two scopes can be compared on delivery as well
 *  as on state. */
const watch = (world: World, scope: any) => {
    const seen: string[] = []
    const unsubscribes = [
        ...world.atoms.map((a, i) =>
            scope.sub(a, () => seen.push(`atom${i}=${scope.get(a)}`)),
        ),
        scope.sub(world.family, (...args: any[]) =>
            seen.push(`family:${args.join(",")}`),
        ),
        scope.sub(world.joined, () =>
            seen.push(`joined=${scope.get(world.joined)}`),
        ),
        scope.sub(world.memberList, () =>
            seen.push(`members=${scope.get(world.memberList)}`),
        ),
    ]
    return {
        // Sorted: both scopes settle the same set of changes, but ordering
        // ACROSS independent subscriptions is not part of the contract.
        drain: () => seen.splice(0).sort(),
        release: () => unsubscribes.forEach(unsub => unsub()),
    }
}

/** One random mutation against `target`, drawn from every op that can make a
 *  store own something (or stop owning it). `readsParent` ops are excluded for
 *  the nested scopes, whose two parents are deliberately NOT equivalent until
 *  the revert happens. */
const applyRandomOp = (
    world: World,
    target: any,
    random: () => number,
    label: string,
    readsParent = true,
) => {
    const roll = random()
    const atomIndex = Math.floor(random() * ATOM_COUNT)
    const key = MEMBER_KEYS[Math.floor(random() * MEMBER_KEYS.length)]!
    if (roll < 0.3) {
        target.set(world.atoms[atomIndex]!, `${label}-${random()}`)
    } else if (roll < 0.45) {
        // A write whose value EQUALS what the store already reads: it still has
        // to create the shadow, and the revert still has to drop it.
        if (readsParent) {
            target.set(
                world.atoms[atomIndex]!,
                target.get(world.atoms[atomIndex]!),
            )
        } else {
            target.set(world.atoms[atomIndex]!, `${label}-fixed`)
        }
    } else if (roll < 0.7) {
        target.set(world.family(key), `${label}-member-${random()}`)
    } else if (roll < 0.85) {
        target.del(world.family(key))
    } else {
        target.unset(world.atoms[atomIndex]!)
    }
}

/** What the subject scope actually owned at revert time, read straight off its
 *  bookkeeping — the fuzz measuring its own coverage, so a later tweak to the
 *  op weights cannot quietly turn these seeds into vacuous no-ops. */
const ownedByScope = (world: World, scope: any) => {
    const data = getStoreData(scope)
    let atoms = 0
    let created = 0
    let deleted = 0
    for (const key of data.scopeIndexKeys!) {
        if (key === world.family) {
            const index = (data.values.get(key) as any)?.__index
            if (index) {
                created += index.created.size
                deleted += index.deleted.size
            }
        } else atoms++
    }
    return { atoms, created, deleted }
}

/** Entries appearing more than once — one commit must report a given state in a
 *  given scope at most once, whatever internal channel carried it. */
const duplicatesIn = (entries: string[]): string[] => {
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const entry of entries) {
        if (seen.has(entry)) duplicates.push(entry)
        else seen.add(entry)
    }
    return duplicates
}

type Coverage = {
    ownedSomething: number
    ownedAtoms: number
    ownedCreated: number
    ownedDeleted: number
    notifiedOnRevert: number
    reportedOnRevert: number
}

const runSeed = (seed: number, viaTransaction: boolean, coverage: Coverage) => {
    const random = mulberry32(seed)
    const world = createWorld()
    const root = store(`fuzz-${seed}`)
    const subject = root.scope("subject")
    // Created up front so both scopes exist for the whole run; never written.
    const control = root.scope("control")
    // Nested scopes given IDENTICAL own writes. Their parents diverge until the
    // revert, so these notice both a revert that leaves the family-index
    // ancestor chain unable to reach a descendant AND a revert that reaches too
    // far and takes a descendant's own values with it.
    const subjectChild = subject.scope("child")
    const controlChild = control.scope("child")

    const opCount = 3 + Math.floor(random() * 12)
    for (let i = 0; i < opCount; i++) {
        const target = random() < 0.45 ? root : subject
        applyRandomOp(world, target, random, target === root ? "root" : "sub")
    }
    const childOpCount = Math.floor(random() * 4)
    for (let i = 0; i < childOpCount; i++) {
        // The same op replayed from a fresh generator for each child, so the two
        // stay each other's mirror.
        applyRandomOp(
            world,
            subjectChild,
            mulberry32(seed * 7919 + i),
            `child-${i}`,
            false,
        )
        applyRandomOp(
            world,
            controlChild,
            mulberry32(seed * 7919 + i),
            `child-${i}`,
            false,
        )
    }

    const owned = ownedByScope(world, subject)
    if (owned.atoms || owned.created || owned.deleted) coverage.ownedSomething++
    if (owned.atoms) coverage.ownedAtoms++
    if (owned.created) coverage.ownedCreated++
    if (owned.deleted) coverage.ownedDeleted++

    // Prime the COLD selectors on both sides before the revert. This is what
    // creates the condition the revert has to invalidate: a cache recorded
    // while the subject still owned its values. Only the cold selectors are
    // read here — they touch atoms and the family's membership list, neither of
    // which materializes anything in the reading store, so the control is not
    // perturbed (reading a member's VALUE would be, which is why `observe` is
    // still held back until after the revert).
    for (const scope of [subject, control, subjectChild, controlChild]) {
        scope.get(world.coldJoined)
        scope.get(world.coldMembers)
    }

    const subjectWatch = watch(world, subject)
    const controlWatch = watch(world, control)
    const subjectChildWatch = watch(world, subjectChild)
    const controlChildWatch = watch(world, controlChild)

    // Every change the revert reports. Checked for DUPLICATES rather than
    // against the control (which reports nothing, having changed nothing): a
    // commit that carries one member through two channels is invisible to a
    // read-based oracle and to subscribers — a subscription fires once per
    // commit regardless — but it reaches an onChange consumer twice.
    const reported: string[] = []
    const stopReporting = root.onChange(changes => {
        for (const change of changes) {
            const state: any = change.state
            const id = state?.familyArgs
                ? `member:${state.familyArgs.join(",")}`
                : `atom:${world.atoms.indexOf(state)}`
            reported.push(
                `${(change as any).kind}|${id}|${change.scope.join("/")}`,
            )
        }
    })

    let mixedWrite = false
    if (viaTransaction) {
        root.txn(txn => {
            // Mixed with an unrelated write about half the time: landing in
            // someone else's commit is the staged form's whole point.
            if (random() < 0.5) {
                mixedWrite = true
                txn.set(world.atoms[0]!, `applied-${random()}`)
            }
            txn.scope("subject", scoped => scoped.unsetAll())
        })
    } else {
        subject.unsetAll()
    }

    stopReporting()
    expect({ seed, duplicates: duplicatesIn(reported) }).toStrictEqual({
        seed,
        duplicates: [],
    })
    if (reported.length > 0) coverage.reportedOnRevert++

    if (subjectWatch.drain().length > 0) coverage.notifiedOnRevert++
    // Nothing touched the control, so nothing may reach its subscribers — the
    // one exception being the transaction arm's root write, which legitimately
    // reaches every scope.
    const controlRevertSeen = controlWatch.drain()
    if (!mixedWrite) {
        expect({ seed, controlRevertSeen }).toStrictEqual({
            seed,
            controlRevertSeen: [],
        })
    }
    subjectChildWatch.drain()
    controlChildWatch.drain()

    const agree = (step: number) => {
        expect({ seed, step, ...observe(world, subject) }).toStrictEqual({
            seed,
            step,
            ...observe(world, control),
        })
        expect({ seed, step, ...observe(world, subjectChild) }).toStrictEqual({
            seed,
            step,
            ...observe(world, controlChild),
        })
    }

    agree(-1)
    // The shared structural checker: the revert must leave the store's own
    // graph/index bookkeeping self-consistent, not merely reading correctly.
    for (const scope of [root, subject, control, subjectChild, controlChild]) {
        const violations = checkStoreInvariants(scope)
        expect({ seed, violations }).toStrictEqual({ seed, violations: [] })
    }
    // ...and they stay in agreement as the parent keeps changing — in state AND
    // in what their subscribers were told. Ownership the revert failed to
    // release, or a notification it failed to send, surfaces here.
    for (let i = 0; i < 6; i++) {
        applyRandomOp(world, root, random, `after-${i}`)
        agree(i)
        expect({ seed, i, seen: subjectWatch.drain() }).toStrictEqual({
            seed,
            i,
            seen: controlWatch.drain(),
        })
        expect({ seed, i, seen: subjectChildWatch.drain() }).toStrictEqual({
            seed,
            i,
            seen: controlChildWatch.drain(),
        })
    }

    subjectWatch.release()
    controlWatch.release()
    subjectChildWatch.release()
    controlChildWatch.release()
    subjectChild.detach()
    controlChild.detach()
    control.detach()
    subject.detach()
    root.dispose()
}

const emptyCoverage = (): Coverage => ({
    ownedSomething: 0,
    ownedAtoms: 0,
    ownedCreated: 0,
    ownedDeleted: 0,
    notifiedOnRevert: 0,
    reportedOnRevert: 0,
})

const SEEDS = 2000

/** Floors, not exact counts: they fail loudly if a change to the op weights
 *  drains a path, without pinning the generator's exact behavior. */
const assertCoverage = (coverage: Coverage) => {
    expect(coverage.ownedSomething).toBeGreaterThan(SEEDS * 0.9)
    expect(coverage.ownedAtoms).toBeGreaterThan(SEEDS * 0.5)
    expect(coverage.ownedCreated).toBeGreaterThan(SEEDS * 0.5)
    expect(coverage.ownedDeleted).toBeGreaterThan(SEEDS * 0.3)
    expect(coverage.notifiedOnRevert).toBeGreaterThan(SEEDS * 0.5)
    expect(coverage.reportedOnRevert).toBeGreaterThan(SEEDS * 0.5)
}

describe("unsetAll differential fuzz", () => {
    test("a reverted scope reads and notifies like a never-written sibling (direct)", () => {
        const coverage = emptyCoverage()
        for (let seed = 0; seed < SEEDS; seed++) runSeed(seed, false, coverage)
        assertCoverage(coverage)
    })

    test("a reverted scope reads and notifies like a never-written sibling (transaction)", () => {
        const coverage = emptyCoverage()
        for (let seed = 0; seed < SEEDS; seed++) runSeed(seed, true, coverage)
        assertCoverage(coverage)
    })
})
