import type { StoreData } from "../types/StoreData"
import { recordDependencyEdgeVisit } from "./architectureInstrumentation"
import { IS_PROD } from "./IS_PROD"

// The two set-union primitives every settlement phase collects through.
//
// `addDependentsToSet` is the ONLY way a settlement walks a
// `data.stateDependents` bucket into a work set, so the `dependencyEdgeVisits`
// counter is incremented in exactly one place per traversal style rather than
// once per call site. `addSetToSet` is the uncounted twin for everything that
// is not a dependency edge (subscription sets, trigger unions, ordered
// delivery sets).
//
// Leaf module: instrumentation and the dev/prod flag only, so it can never
// join the core write-path import cycle (see test/import-cycles).

export const addSetToSet = (fromSet: Set<any> | undefined, toSet: Set<any>) => {
    if (fromSet && fromSet.size > 0) {
        for (const item of fromSet) {
            toSet.add(item)
        }
    }
}

export const addDependentsToSet = (
    fromSet: Set<any> | undefined,
    toSet: Set<any>,
    data: StoreData,
) => {
    if (IS_PROD || !data.architectureInstrumentation) {
        addSetToSet(fromSet, toSet)
        return
    }
    if (fromSet && fromSet.size > 0) {
        for (const item of fromSet) {
            recordDependencyEdgeVisit(data)
            toSet.add(item)
        }
    }
}
