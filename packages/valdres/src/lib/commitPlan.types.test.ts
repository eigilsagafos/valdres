import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { CommitForestEntry } from "../types/CommitForestSettleFn"
import type { CommitPlan, PlannedGlobalEffects } from "../types/CommitPlan"
import type { StoreData } from "../types/StoreData"
import type { DeferredOnSet } from "./runOnSets"

/**
 * Type-level gates for the CommitPlan legality rules. Every `@ts-expect-error`
 * below marks a plan the engine must never be handed: the encoding is what
 * makes it unbuildable, and `bun run typecheck:types` is what enforces that.
 * The runtime `assertPlanLegal` backstop — for plans assembled through a cast —
 * is covered in commitPlans.test.ts.
 *
 * Nothing here executes: the fixtures are `undefined as unknown as T`.
 */
const data = undefined as unknown as StoreData
const someAtom = undefined as unknown as Atom<number>
const someMember = undefined as unknown as AtomFamilyAtom<number, [string]>
const injected = undefined as any
const errors = undefined as unknown as CommitPlan["errors"]
const onSets: DeferredOnSet[] = []
const base = { data, onSets, errors }
const global = undefined as unknown as PlannedGlobalEffects

const assertReportIsRequiredForPreparation = () => {
    const legal: CommitPlan = {
        ...base,
        settlement: { kind: "none" },
        report: "set",
        beforeSettle: () => {},
    }
    // @ts-expect-error `beforeSettle` prepares a report the plan does not carry
    const missingReport: CommitPlan = {
        ...base,
        settlement: { kind: "none" },
        report: undefined,
        beforeSettle: () => {},
    }
    void legal
    void missingReport
}

const assertGlobalEffectsRequireAForest = () => {
    const legal: CommitPlan = {
        ...base,
        settlement: {
            kind: "forest",
            entries: [],
            global,
            globalUpdates: undefined,
            settle: injected,
        },
        report: undefined,
    }
    const onScalarSettlement: CommitPlan = {
        ...base,
        settlement: {
            kind: "update",
            atoms: [someAtom],
            settle: injected,
            flags: injected,
            // @ts-expect-error global fan-out belongs to the forest settlement
            global,
        },
        report: undefined,
    }
    const onPlan: CommitPlan = {
        ...base,
        settlement: { kind: "none" },
        report: undefined,
        // @ts-expect-error a plan no longer owns global effects; the forest does
        globalEffects: global,
    }
    void legal
    void onScalarSettlement
    void onPlan
}

const assertPeerUpdatesRequireGlobalEffects = () => {
    const orphanUpdates: CommitPlan = {
        ...base,
        settlement: {
            kind: "forest",
            entries: [],
            global: undefined,
            // @ts-expect-error no global effects can ever produce these
            globalUpdates: new Map(),
            settle: injected,
        },
        report: undefined,
    }
    void orphanUpdates
}

const assertWorkGroupsAreNonEmpty = () => {
    const legal: CommitForestEntry = {
        data,
        updatedAtoms: [],
        deleted: [someMember],
        unsetAtoms: [someAtom],
        children: undefined,
    }
    const emptyDeleted: CommitForestEntry = {
        data,
        updatedAtoms: [],
        // @ts-expect-error an empty delete group must be undefined, not []
        deleted: [],
        unsetAtoms: undefined,
        children: undefined,
    }
    const emptyUnset: CommitForestEntry = {
        data,
        updatedAtoms: [],
        deleted: undefined,
        // @ts-expect-error an empty unset group must be undefined, not []
        unsetAtoms: [],
        children: undefined,
    }
    const maybeEmpty: Atom<any>[] = []
    const unnarrowed: CommitForestEntry = {
        data,
        updatedAtoms: [],
        deleted: undefined,
        // @ts-expect-error a possibly-empty list must go through `workGroup`
        unsetAtoms: maybeEmpty,
        children: undefined,
    }
    void legal
    void emptyDeleted
    void emptyUnset
    void unnarrowed
}

const assertBoundariesArePaired = () => {
    const openOnly: CommitPlan = {
        ...base,
        settlement: { kind: "none" },
        report: undefined,
        // @ts-expect-error a boundary that only opens can never be closed
        boundary: { begin: (store: StoreData) => store.tree },
    }
    const closeOnly: CommitPlan = {
        ...base,
        settlement: { kind: "none" },
        report: undefined,
        // @ts-expect-error a boundary that only closes was never opened
        boundary: { end: () => {} },
    }
    const unpaired: CommitPlan = {
        ...base,
        settlement: { kind: "none" },
        report: undefined,
        // @ts-expect-error begin/end are one capability, not two plan fields
        beginCommit: (store: StoreData) => store.tree,
    }
    void openOnly
    void closeOnly
    void unpaired
}

void assertReportIsRequiredForPreparation
void assertGlobalEffectsRequireAForest
void assertPeerUpdatesRequireGlobalEffects
void assertWorkGroupsAreNonEmpty
void assertBoundariesArePaired
