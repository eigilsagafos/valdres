declare const process: { env: { VALDRES_ENGINE_SELF_CHECKS?: string } }

import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type {
    CommitForestEntry,
    CommitForestSettleFn,
} from "../types/CommitForestSettleFn"
import type {
    CommitForestSettlement,
    CommitPlan,
    CommitSettlement,
    DeleteSettlement,
    GlobalEffectsApply,
    GlobalForestSettlement,
    LocalForestSettlement,
    NoSettlement,
    PlannedGlobalEffects,
    ReportingCommitPlan,
    SelectorSettlement,
    UnreportedCommitPlan,
    UpdateSettlement,
} from "../types/CommitPlan"
import type { DeferredGlobalSet } from "./globalAtomFanOut"
import type { InternalGlobalAtom } from "../types/InternalGlobalAtom"
import type { NonEmpty } from "../types/NonEmpty"
import type { Selector } from "../types/Selector"
import type { SelectorSettleFn } from "../types/SelectorSettleFn"
import type { SettleFlags } from "../types/SettleFlags"
import type { SettleFn } from "../types/SettleFn"
import type { StoreChangeSource } from "../types/StoreChangeSource"
import type { StoreData } from "../types/StoreData"
import type { DeferredOnSet } from "./runOnSets"
import { recordCommitPlanAllocations } from "./architectureInstrumentation"
import { IS_PROD } from "./IS_PROD"

/**
 * Typed constructors for the legal `CommitPlan` shapes, plus the legality
 * assertion the engine runs on every plan it is handed. That assertion is an
 * engine self-check: it is compiled out of the published bundle, so it costs
 * consumers nothing (see the guard in `commitEngine.ts`).
 *
 * Plans stay deliberately mutable — the hot commit shapes reuse a module-static
 * plan graph and the engine writes phase-two results back into the settlement —
 * so illegal states are excluded by CONSTRUCTION rather than by freezing. Every
 * forest literal in the core goes through `forestEntry`/`singleStoreForest`
 * here, so the shape of a commit forest is defined once.
 *
 * Each supporting-object constructor takes the commit's store as its first
 * argument to stamp the deterministic `commitPlanAllocations` counter. The
 * outer plan object itself has always been excluded from that counter, so
 * `createCommitPlan` preserves the existing contract while replacing its old
 * literal allocation sites. A module-static supporting graph passes
 * `undefined`: it is allocated once at module load, not per commit, and must
 * never inflate a measured commit's count.
 *
 * This module deliberately imports no propagation, fan-out, or write-path
 * module — `settle` and `apply` primitives arrive by injection — so it can
 * never join the core write-path import cycle (see test/import-cycles).
 */

// Same engine self-check budget as `assertPlanLegal`: `commitPlanAllocations`
// exists so valdres's own architecture gates can assert what a commit shape
// allocates, and it is compiled out of the published bundle by the define in
// `build.ts` (see the guard in `commitEngine.ts` for why the env read is
// written inline rather than behind a shared const).
//
// `!IS_PROD` stays FIRST, as at every other self-check site. Without the define
// — anyone bundling valdres from source, including this repo's own docs site —
// the env read ships raw, and `process` does not exist in a browser. Reading it
// first threw a ReferenceError on module load, because the module-static plan
// graph below counts its own allocations: one unguarded read took the entire
// bundle down. Leading with `!IS_PROD` short-circuits before it, since
// process-less runtimes default to production.
const count = (store: StoreData | undefined, allocations: number) => {
    if (
        !IS_PROD &&
        process.env.VALDRES_ENGINE_SELF_CHECKS !== "off" &&
        store?.architectureInstrumentation
    )
        recordCommitPlanAllocations(store, allocations)
}

/** Shared empty hook queue for plans whose write phase enqueues nothing.
 *  `runOnSets` only reads, so one instance serves every such plan; freezing
 *  makes an accidental enqueue fail loudly instead of leaking into the next
 *  plan that borrows it. */
export const NO_ON_SETS: DeferredOnSet[] = []
Object.freeze(NO_ON_SETS)

/** Guarded cleanup and freshness commits settle nothing. The shape carries no
 *  per-commit state, so one frozen instance serves all of them. */
export const NO_SETTLEMENT: NoSettlement = Object.freeze({
    kind: "none" as const,
})

/**
 * Build every CommitPlan through one allocation site and install every field
 * in one fixed order. The engine reads plans from many coordinators; keeping a
 * single complete object shape prevents those reads from becoming polymorphic
 * merely because one operation has an admission guard while another has a
 * boundary or cleanup phase.
 */
export function createCommitPlan(
    data: StoreData,
    settlement: CommitSettlement,
    onSets: DeferredOnSet[],
    errors: CommitPlan["errors"],
    report: UnreportedCommitPlan["report"],
    beforeSettle?: undefined,
    admit?: CommitPlan["admit"],
    apply?: CommitPlan["apply"],
    afterSettle?: CommitPlan["afterSettle"],
    flushReport?: CommitPlan["flushReport"],
    boundary?: CommitPlan["boundary"],
    afterCommit?: CommitPlan["afterCommit"],
    continueAfterError?: CommitPlan["continueAfterError"],
): UnreportedCommitPlan
export function createCommitPlan(
    data: StoreData,
    settlement: CommitSettlement,
    onSets: DeferredOnSet[],
    errors: CommitPlan["errors"],
    report: ReportingCommitPlan["report"],
    beforeSettle: ReportingCommitPlan["beforeSettle"],
    admit?: CommitPlan["admit"],
    apply?: CommitPlan["apply"],
    afterSettle?: CommitPlan["afterSettle"],
    flushReport?: CommitPlan["flushReport"],
    boundary?: CommitPlan["boundary"],
    afterCommit?: CommitPlan["afterCommit"],
    continueAfterError?: CommitPlan["continueAfterError"],
): ReportingCommitPlan
export function createCommitPlan(
    data: StoreData,
    settlement: CommitSettlement,
    onSets: DeferredOnSet[],
    errors: CommitPlan["errors"],
    report: CommitPlan["report"],
    beforeSettle?: ReportingCommitPlan["beforeSettle"],
    admit?: CommitPlan["admit"],
    apply?: CommitPlan["apply"],
    afterSettle?: CommitPlan["afterSettle"],
    flushReport?: CommitPlan["flushReport"],
    boundary?: CommitPlan["boundary"],
    afterCommit?: CommitPlan["afterCommit"],
    continueAfterError?: CommitPlan["continueAfterError"],
): CommitPlan {
    return {
        data,
        settlement,
        admit,
        apply,
        onSets,
        errors,
        beforeSettle,
        afterSettle,
        flushReport,
        boundary,
        afterCommit,
        continueAfterError,
        report,
    } as CommitPlan
}

/** Narrow a finished work list to the representation a forest entry accepts:
 *  an empty group is no work, and no work is `undefined`. */
export const workGroup = <T>(items: T[]): NonEmpty<T> | undefined =>
    items.length > 0 ? (items as NonEmpty<T>) : undefined

/** One store's slot in a commit forest. */
export const forestEntry = (
    data: StoreData,
    updatedAtoms: Atom<any>[],
    deleted: NonEmpty<AtomFamilyAtom<any, any>> | undefined,
    unsetAtoms: NonEmpty<Atom<any>> | undefined,
    children: CommitForestEntry[] | undefined,
    initAtoms?: NonEmpty<Atom<any>>,
    unsetMembershipDrops?: Set<AtomFamilyAtom<any, any>>,
    familyMemberDelta?: Map<AtomFamily<any>, Set<AtomFamilyAtom<any, any>>>,
    familyIndexReverts?: NonEmpty<AtomFamily<any>>,
): CommitForestEntry => {
    count(data, 1)
    return {
        data,
        updatedAtoms,
        deleted,
        unsetAtoms,
        unsetMembershipDrops,
        familyMemberDelta,
        familyIndexReverts,
        initAtoms,
        children,
    }
}

/** The one-entry, one-root forest every single-store commit uses — an ordinary
 *  direct global write, a reset, an async resolution, a cleanup transaction. */
export const singleStoreForest = (
    data: StoreData,
    updatedAtoms: Atom<any>[],
    deleted?: NonEmpty<AtomFamilyAtom<any, any>>,
    unsetAtoms?: NonEmpty<Atom<any>>,
    initAtoms?: NonEmpty<Atom<any>>,
    unsetMembershipDrops?: Set<AtomFamilyAtom<any, any>>,
    familyMemberDelta?: Map<AtomFamily<any>, Set<AtomFamilyAtom<any, any>>>,
    familyIndexReverts?: NonEmpty<AtomFamily<any>>,
): CommitForestEntry[] => {
    const entries = [
        forestEntry(
            data,
            updatedAtoms,
            deleted,
            unsetAtoms,
            undefined,
            initAtoms,
            unsetMembershipDrops,
            familyMemberDelta,
            familyIndexReverts,
        ),
    ]
    count(data, 1)
    return entries
}

/**
 * The settlement for a commit spanning one or more stores. `global` is the
 * whole discriminant: without it there is no fan-out and therefore no peer
 * `globalUpdates` to fold in; with it, the engine applies the effects before
 * hooks and writes the resulting peer groups back onto this same settlement.
 */
export function forestSettlement(
    store: StoreData | undefined,
    entries: CommitForestEntry[],
    global: undefined,
    settle: CommitForestSettleFn,
): LocalForestSettlement
export function forestSettlement(
    store: StoreData | undefined,
    entries: CommitForestEntry[],
    global: PlannedGlobalEffects,
    settle: CommitForestSettleFn,
): GlobalForestSettlement
export function forestSettlement(
    store: StoreData | undefined,
    entries: CommitForestEntry[],
    global: PlannedGlobalEffects | undefined,
    settle: CommitForestSettleFn,
): CommitForestSettlement
export function forestSettlement(
    store: StoreData | undefined,
    entries: CommitForestEntry[],
    global: PlannedGlobalEffects | undefined,
    settle: CommitForestSettleFn,
): CommitForestSettlement {
    count(store, 1)
    return {
        kind: "forest",
        entries,
        global,
        globalUpdates: undefined,
        settle,
    } as CommitForestSettlement
}

/** Ordered global fan-out over an already-finalized descriptor queue. */
export const globalEffects = (
    store: StoreData | undefined,
    sets: DeferredGlobalSet[],
    source: StoreChangeSource,
    apply: GlobalEffectsApply,
): PlannedGlobalEffects => {
    count(store, 1)
    return { sets, source, apply }
}

/** Global fan-out whose descriptors are collected by the plan's own write
 *  phase: the queue starts empty and `apply` fills it before hooks run. */
export const pendingGlobalEffects = (
    store: StoreData | undefined,
    source: StoreChangeSource,
    apply: GlobalEffectsApply,
): PlannedGlobalEffects => {
    count(store, 2)
    return { sets: [], source, apply }
}

/** The descriptor queue for a commit that writes ONE global atom. The ordered
 *  global sets and the deferred onSet queue describe the same write, so they
 *  share one triple and one queue instead of allocating a duplicate pair. */
export const globalWriteQueue = (
    atom: InternalGlobalAtom<any>,
    value: any,
    origin: StoreData,
): DeferredGlobalSet[] => {
    count(origin, 2)
    return [[atom, value, origin]]
}

export const updateSettlement = (
    store: StoreData | undefined,
    atoms: Atom<any>[],
    settle: SettleFn,
    flags: SettleFlags,
): UpdateSettlement => {
    count(store, 1)
    return { kind: "update", atoms, settle, flags }
}

export const deleteSettlement = (
    store: StoreData | undefined,
    atoms: AtomFamilyAtom<any, any>[],
    settle: DeleteSettlement["settle"],
): DeleteSettlement => {
    count(store, 1)
    return { kind: "delete", atoms, settle }
}

export const selectorSettlement = (
    store: StoreData | undefined,
    selector: Selector<any>,
    settle: SelectorSettleFn,
): SelectorSettlement => {
    count(store, 1)
    return { kind: "selector", selector, settle }
}

/**
 * The invariants, one terse phrase each. Kept short and shared because this
 * table is the only part of the dev-time backstop that ships as data:
 *
 *   0  report preparation with no delivery target
 *   1  a boundary that does not pair begin with end
 *   2  a plan missing its hook queue or error accumulator
 *   3  global fan-out on a settlement that is not the forest
 *   4  peer updates with no global effects to produce them, or already
 *      populated before the commit ran (a static settlement left dirty)
 *   5  global effects with no ordered descriptor queue
 *   6  an empty delete/unset work group, which must be `undefined`
 *   7  an update/delete settlement with no atom list
 */
const ILLEGAL = [
    "beforeSettle without report",
    "unpaired boundary",
    "no onSets/errors",
    "global effects outside a forest",
    "bad globalUpdates",
    "global effects without sets",
    "empty work group; use undefined",
    "settlement without atoms",
]

const illegal = (code: number): never => {
    throw new Error(`valdres: illegal CommitPlan — ${ILLEGAL[code]}`)
}

const assertEntryLegal = (entry: CommitForestEntry) => {
    if (
        entry.deleted?.length === 0 ||
        entry.unsetAtoms?.length === 0 ||
        entry.initAtoms?.length === 0
    )
        illegal(6)
    if (entry.children)
        for (const child of entry.children) assertEntryLegal(child)
}

/**
 * Re-check every invariant the plan types encode, on the plan the engine is
 * about to run. Dev-only: the types already exclude these states at every
 * ordinary call site, so this is the backstop for a plan assembled through a
 * cast, mutated mid-flight, or built by a module-static singleton whose fields
 * are reassigned per commit.
 */
export const assertPlanLegal = (plan: CommitPlan) => {
    if (plan.beforeSettle !== undefined && plan.report === undefined) illegal(0)
    const boundary = plan.boundary
    if (
        boundary !== undefined &&
        (typeof boundary.begin !== "function" ||
            typeof boundary.end !== "function")
    )
        illegal(1)
    if (!Array.isArray(plan.onSets) || !plan.errors) illegal(2)

    const settlement = plan.settlement
    // Read through the discriminant so a plan assembled by a cast — the only
    // way these arrangements can still occur — is caught rather than narrowed
    // away at compile time.
    const shape = settlement as {
        kind: string
        global?: { sets?: unknown }
        globalUpdates?: unknown
        atoms?: unknown
    }
    if (shape.kind === "forest") {
        // `globalUpdates` is phase-two output: without effects nothing can
        // produce it, and with them a value already present means the previous
        // commit's peer groups would settle again with this one.
        if (shape.globalUpdates !== undefined) illegal(4)
        if (shape.global !== undefined && !Array.isArray(shape.global.sets))
            illegal(5)
        for (const entry of (settlement as CommitForestSettlement).entries)
            assertEntryLegal(entry)
        return
    }
    if (shape.global !== undefined) illegal(3)
    if (
        (shape.kind === "update" || shape.kind === "delete") &&
        !Array.isArray(shape.atoms)
    )
        illegal(7)
}
