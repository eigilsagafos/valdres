import Ajv2020 from "ajv/dist/2020.js"
import type { AnySchema } from "ajv"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

type ActionMode = "retain" | "replace" | "move" | "retire"
type OwnerId =
    | "v1-contract-model"
    | "pure-dag"
    | "kernel-v1"
    | "shiftx-packed-canary"
    | "package-adapter-extraction"

interface InventorySubject {
    readonly origin: "published-beta.23"
    readonly kind: "production-file"
    readonly path: string
}

interface InventoryEntry {
    readonly id: string
    readonly subject: InventorySubject
}

interface Action {
    readonly mode: ActionMode
    readonly responsibility: string
    readonly publicApiIds: readonly string[]
    readonly contractIds: readonly string[]
    readonly decisionIds: readonly string[]
    readonly destinations: readonly string[]
    readonly implementationOwnerId: OwnerId | null
    readonly evidenceOwnerIds: readonly OwnerId[]
}

interface Classification {
    readonly actions: readonly Action[]
    readonly review:
        | {
              readonly classification: "straightforward"
              readonly reasons: readonly []
          }
        | {
              readonly classification:
                  | "mixed-needs-review"
                  | "uncertain-needs-review"
              readonly reasons: readonly string[]
          }
}

const directory = dirname(fileURLToPath(import.meta.url))
const inventoryPath = join(directory, "frozen-test-inventory.json")
const ledgerPath = join(directory, "production-source-dispositions.jsonl")
const schemaPath = join(
    directory,
    "schemas/production-source-dispositions.schema.json",
)
const publicManifestPath = join(directory, "public-api.json")
const contractCatalogPath = join(directory, "contract-catalog.json")

const owners = [
    {
        recordType: "owner",
        id: "v1-contract-model",
        role: "review",
        description:
            "Owns frozen-source classification and approval evidence, but no production engine edits.",
    },
    {
        recordType: "owner",
        id: "pure-dag",
        role: "implementation",
        description:
            "Owns the reusable selector evaluator and its private host boundary.",
    },
    {
        recordType: "owner",
        id: "kernel-v1",
        role: "implementation",
        description:
            "Owns the v1 StoreTree kernel, graph, lifecycle, scopes, and transactions.",
    },
    {
        recordType: "owner",
        id: "shiftx-packed-canary",
        role: "evidence",
        description:
            "Owns current ShiftX migration and packed-artifact evidence without editing the kernel.",
    },
    {
        recordType: "owner",
        id: "package-adapter-extraction",
        role: "implementation",
        description:
            "Owns preserved ESM, adapter boundaries, and optional-package extraction.",
    },
] as const

const decisions = [
    decision(
        "source.sync-core",
        "Synchronous stable core",
        "The stable Store and State contract is synchronous.",
    ),
    decision(
        "source.one-evaluator",
        "One selector evaluator",
        "Committed, scratch, and hydration hosts share one evaluator implementation.",
    ),
    decision(
        "source.one-mutation-kernel",
        "One mutation kernel",
        "Direct writes and transactions use one draft, preflight, apply, propagation, and notification path.",
    ),
    decision(
        "source.one-tree-transaction",
        "One StoreTree transaction",
        "Transactions are synchronous, flat, and limited to one StoreTree.",
    ),
    decision(
        "source.scope-lifecycle",
        "Primitive scope ownership",
        "Scopes use parent-local identity, explicit ownership, and deterministic disposal.",
    ),
    decision(
        "source.runtime-domains",
        "Isolated runtime domains",
        "Nominal handles reject mixed runtime ownership before work without global adoption.",
    ),
    decision(
        "source.family-identity",
        "Identity-only family",
        "Stable family is an identity combinator without hidden Store membership.",
    ),
    decision(
        "source.collection-kernel",
        "Collection-owned membership",
        "Rows, membership, structural indexes, and exact queries belong to collection boundaries.",
    ),
    decision(
        "source.cache-companion",
        "Cache companion extraction",
        "Loader, stale, max-age, and SWR policy leave the stable State and Store internals.",
    ),
    decision(
        "source.inspect-companion",
        "Inspection companion extraction",
        "Snapshots, change streams, and tooling observation do not branch the ordinary Store runtime.",
    ),
    decision(
        "source.schema-companion",
        "Schema companion extraction",
        "Validation and codecs are optional boundaries rather than constructor semantics in the stable core.",
    ),
    decision(
        "source.transfer-artifacts",
        "Explicit artifact boundary",
        "Transfer and persistence use explicit artifacts instead of Store hydration or ambient registries.",
    ),
    decision(
        "source.remove-globals",
        "Remove writable globals",
        "Writable cross-StoreTree globals and process-wide Store registries are removed.",
    ),
    decision(
        "source.remove-async-state",
        "Remove async State settlement",
        "Promise values, late dependencies, and async selector settlement are outside the stable State contract.",
    ),
    decision(
        "source.adapter-boundary",
        "Narrow adapter boundary",
        "Adapters consume a versioned capability boundary and do not receive manual core lifecycle machinery.",
    ),
    decision(
        "source.packaging-boundary",
        "Preserved package boundaries",
        "Stable, optional, and private code remain independently reachable from packed preserved ESM entrypoints.",
    ),
    decision(
        "source.remove-legacy-graph",
        "Remove legacy graph modes",
        "Fixed points, cold validation, twin evaluators, and orphan sidecars are not ported.",
    ),
    decision(
        "source.application-initialization",
        "Application-owned initialization",
        "Initialization happens in explicit owner code, not Provider render or an implicit Store interpreter.",
    ),
] as const

const retainedFiles = new Set(["lib/IS_PROD.ts", "lib/isFunction.ts"])

const mixedFiles = new Set([
    "adapter-internals/v1.ts",
    "index.ts",
    "indexConstructor.ts",
    "store.ts",
    "lib/createStoreData.ts",
    "lib/equal.ts",
    "lib/getStoreRuntime.ts",
    "lib/initSelector.ts",
    "lib/normalizeStagedValue.ts",
    "lib/propagateUpdatedAtoms.ts",
    "lib/setValueInData.ts",
    "lib/storeFromStoreData.ts",
    "lib/storeRuntimeKey.ts",
    "lib/transaction.ts",
    "types/EqualFunc.ts",
    "types/Store.ts",
    "types/StoreData.ts",
    "types/StoreOptions.ts",
    "types/Transaction.ts",
    "types/TransactionInterface.ts",
])

const retiredExactFiles = new Set([
    "lib/asyncAtomCoordinatorRegistry.ts",
    "lib/asyncDependencyTracking.ts",
    "lib/commitForest.ts",
    "lib/commitPlans.ts",
    "lib/coordinateAsyncWrite.ts",
    "lib/nativeAsyncSelectorError.ts",
    "lib/namedStateIndex.ts",
    "lib/registerName.ts",
    "lib/reportAsyncSchemaError.ts",
    "lib/resolvePendingDefault.ts",
    "lib/storeCancellableKey.ts",
    "lib/valdresGlobal.ts",
    "types/CommitForestSettleFn.ts",
    "types/CommitPlan.ts",
    "types/DepsChange.ts",
    "types/SelectorSettleFn.ts",
    "types/SettleFlags.ts",
    "types/SettleFn.ts",
])

const inspectionFiles = new Set([
    "lib/hasAtomCommitObservers.ts",
    "lib/notifyChangeListeners.ts",
    "lib/onStoreChange.ts",
    "lib/snapshot.ts",
    "types/SnapshotEntry.ts",
    "types/StoreChange.ts",
    "types/StoreChangeCallback.ts",
    "types/StoreChangeMeta.ts",
    "types/StoreChangeSource.ts",
])

const transferFiles = new Set([
    "lib/wireCodec.ts",
    "types/DehydratedState.ts",
    "utils/dehydrate.ts",
    "utils/hydrate.ts",
])

function decision(id: string, title: string, rationale: string) {
    return {
        recordType: "architecture-decision",
        id,
        title,
        source: ".context/valdres-1.0-recovery-plan.md",
        rationale,
    } as const
}

function action(
    mode: ActionMode,
    responsibility: string,
    options: Readonly<{
        publicApiIds?: readonly string[]
        contractIds?: readonly string[]
        decisionIds: readonly string[]
        destinations?: readonly string[]
        implementationOwnerId?: OwnerId | null
        evidenceOwnerIds?: readonly OwnerId[]
    }>,
): Action {
    return {
        mode,
        responsibility,
        publicApiIds: options.publicApiIds ?? [],
        contractIds: options.contractIds ?? [],
        decisionIds: options.decisionIds,
        destinations: options.destinations ?? [],
        implementationOwnerId: options.implementationOwnerId ?? null,
        evidenceOwnerIds: options.evidenceOwnerIds ?? [],
    }
}

const replaceKernel = (responsibility: string): Action =>
    action("replace", responsibility, {
        publicApiIds: ["core.store"],
        contractIds: ["store.object-identity"],
        decisionIds: ["source.sync-core", "source.one-mutation-kernel"],
        destinations: ["boundary:valdres"],
        implementationOwnerId: "kernel-v1",
    })

const replaceSelector = (responsibility: string): Action =>
    action("replace", responsibility, {
        publicApiIds: ["core.selector"],
        contractIds: ["selector.pure-sync-dag", "selector.one-evaluator"],
        decisionIds: ["source.one-evaluator"],
        destinations: [
            "path:packages/valdres/src/v1-internal/selector-evaluator",
        ],
        implementationOwnerId: "pure-dag",
    })

const retireAsync = (responsibility: string): Action =>
    action("retire", responsibility, {
        publicApiIds: ["core.selector"],
        contractIds: ["selector.pure-sync-dag"],
        decisionIds: ["source.remove-async-state"],
    })

const retireGlobal = (responsibility: string): Action =>
    action("retire", responsibility, {
        publicApiIds: ["core.global-atom", "core.global-store"],
        contractIds: ["no-writable-cross-tree-state"],
        decisionIds: ["source.remove-globals"],
        evidenceOwnerIds: ["shiftx-packed-canary"],
    })

const replaceFamily = (responsibility: string): Action =>
    action("replace", responsibility, {
        publicApiIds: ["core.family"],
        contractIds: [
            "family.no-membership",
            "family.same-value-zero",
            "family.variadic-primitive-identity",
        ],
        decisionIds: ["source.family-identity"],
        destinations: ["boundary:valdres#family"],
        implementationOwnerId: "kernel-v1",
        evidenceOwnerIds: ["shiftx-packed-canary"],
    })

const retireFamilyMembership = (responsibility: string): Action =>
    action("retire", responsibility, {
        publicApiIds: ["core.family"],
        contractIds: ["family.no-membership"],
        decisionIds: ["source.family-identity", "source.collection-kernel"],
    })

function classify(path: string): Classification {
    const relative = path.slice("packages/valdres/src/".length)

    if (relative.startsWith("errors/")) return classifyError(relative)
    if (relative === "lib/adapterTransaction.ts") {
        return straightforward(
            action("retire", "manual adapter Transaction lifecycle", {
                decisionIds: [
                    "source.one-tree-transaction",
                    "source.adapter-boundary",
                ],
            }),
        )
    }
    if (relative === "utils/applyInitialize.ts") {
        return straightforward(
            action("retire", "Store and Provider initialization interpreter", {
                decisionIds: [
                    "source.application-initialization",
                    "source.adapter-boundary",
                ],
            }),
        )
    }
    if (relative === "utils/setAtomPairs.ts") {
        return straightforward(
            action("retire", "implicit initialization pair interpreter", {
                decisionIds: ["source.application-initialization"],
            }),
        )
    }
    if (relative === "utils/deepFreeze.ts") {
        return straightforward(
            action(
                "retire",
                "default recursive deep-freeze policy and public utility",
                {
                    decisionIds: [
                        "source.sync-core",
                        "source.packaging-boundary",
                    ],
                },
            ),
        )
    }
    if (relative === "utils/isSelector.ts") {
        return straightforward(
            action("retire", "public selector-shape predicate", {
                decisionIds: [
                    "source.one-evaluator",
                    "source.packaging-boundary",
                ],
            }),
        )
    }

    if (mixedFiles.has(relative)) return classifyMixed(relative)

    if (retainedFiles.has(relative)) {
        return straightforward(
            action("retain", "small environment-independent utility", {
                decisionIds: ["source.sync-core"],
                destinations: [`path:${path}`],
                implementationOwnerId: "kernel-v1",
            }),
        )
    }

    if (isGlobal(relative)) {
        return straightforward(
            retireGlobal("writable global state or ambient Store registry"),
        )
    }

    if (retiredExactFiles.has(relative)) {
        const isAsync = /async|pending|settle|cancellable|coordinate/u.test(
            relative,
        )
        return straightforward(
            isAsync
                ? retireAsync("async State or late-settlement machinery")
                : action("retire", "legacy internal coordination machinery", {
                      decisionIds: [
                          "source.one-mutation-kernel",
                          "source.remove-legacy-graph",
                      ],
                  }),
        )
    }

    if (isCache(relative)) {
        return straightforward(
            action("move", "cache, stale, max-age, or SWR policy", {
                publicApiIds: ["beta.cache-companion"],
                contractIds: [
                    "cache.client-owned-entries",
                    "cache.no-store-internals",
                ],
                decisionIds: ["source.cache-companion"],
                destinations: ["package:beta-cache-companion"],
                implementationOwnerId: "package-adapter-extraction",
                evidenceOwnerIds: ["shiftx-packed-canary"],
            }),
        )
    }

    if (isSchema(relative)) {
        return straightforward(
            action("move", "schema validation or codec policy", {
                decisionIds: ["source.schema-companion"],
                destinations: ["package:@valdres/schema"],
                implementationOwnerId: "package-adapter-extraction",
            }),
        )
    }

    if (inspectionFiles.has(relative)) {
        return straightforward(
            action("move", "snapshot, change-stream, or inspection behavior", {
                decisionIds: ["source.inspect-companion"],
                destinations: ["package:@valdres/inspect"],
                implementationOwnerId: "package-adapter-extraction",
            }),
        )
    }

    if (transferFiles.has(relative)) {
        return straightforward(
            action(
                "move",
                "transfer, hydration, or serialized artifact policy",
                {
                    contractIds: ["collection.artifact-boundary"],
                    decisionIds: ["source.transfer-artifacts"],
                    destinations: ["boundary:valdres/collection/artifacts"],
                    implementationOwnerId: "package-adapter-extraction",
                },
            ),
        )
    }

    if (isFamily(relative)) {
        return mixed(
            [
                replaceFamily("stable identity-only family construction"),
                retireFamilyMembership(
                    "legacy family-backed State membership and manual release",
                ),
            ],
            "The beta family module mixes reusable identity with Store-backed membership that moves to collections or disappears.",
        )
    }

    if (relative.startsWith("lib/graph/")) {
        if (
            relative.endsWith("evaluationOutcome.ts") ||
            relative.endsWith("inheritedDependencyBranches.ts")
        ) {
            return straightforward(
                replaceSelector("DAG outcome or scope-route graph support"),
            )
        }
        return mixed(
            [
                replaceSelector("minimal DAG edge and evaluation support"),
                action("retire", "legacy cold, cyclic, or orphan graph mode", {
                    contractIds: ["selector.pure-sync-dag"],
                    decisionIds: ["source.remove-legacy-graph"],
                }),
            ],
            "The graph file may contain both required DAG support and legacy lifecycle, cold-validation, cycle, or orphan machinery.",
        )
    }

    if (isSelector(relative)) {
        return straightforward(
            replaceSelector(
                "selector definition, evaluation, or outcome typing",
            ),
        )
    }

    if (isTransaction(relative)) {
        return classifyTransaction()
    }

    if (isScopeOrLifecycle(relative)) {
        return straightforward(
            action("replace", "scope ownership, subscription, or lifecycle", {
                publicApiIds: ["core.store", "core.store.scope"],
                contractIds: [
                    "scope.explicit-disposal",
                    "scope.live-inheritance",
                    "lifecycle.synchronous-cleanup",
                ],
                decisionIds: ["source.scope-lifecycle"],
                destinations: ["boundary:valdres#StoreTree"],
                implementationOwnerId: "kernel-v1",
                evidenceOwnerIds: ["shiftx-packed-canary"],
            }),
        )
    }

    if (isAtomOrMutation(relative)) {
        return straightforward(
            action("replace", "Atom definition or synchronous mutation", {
                publicApiIds: ["core.atom", "core.store"],
                contractIds: [
                    "atom.exact-value",
                    "atom.object-is-default",
                    "mutation.value-vs-updater",
                ],
                decisionIds: ["source.sync-core", "source.one-mutation-kernel"],
                destinations: ["boundary:valdres"],
                implementationOwnerId: "kernel-v1",
            }),
        )
    }

    if (isRuntimeBoundary(relative)) {
        return straightforward(
            action("replace", "runtime ownership or private Store capability", {
                publicApiIds: ["core.runtime-mismatch-error", "core.store"],
                contractIds: [
                    "runtime.before-work-owner-check",
                    "runtime.isolated-domains",
                ],
                decisionIds: ["source.runtime-domains"],
                destinations: ["boundary:valdres#runtime-domain"],
                implementationOwnerId: "kernel-v1",
            }),
        )
    }

    return uncertain(
        [replaceKernel("unresolved stable-core implementation responsibility")],
        "No path rule proves whether this module belongs to the v1 kernel, an extracted package, or retirement; inspect its exports and callers.",
    )
}

function classifyError(relative: string): Classification {
    if (relative === "errors/lib/errorBrand.ts") {
        return straightforward(
            action("retire", "cross-copy instanceof branding", {
                decisionIds: ["source.runtime-domains"],
            }),
        )
    }

    if (relative === "errors/SchemaValidationError.ts") {
        return straightforward(
            action("move", "schema validation error", {
                decisionIds: ["source.schema-companion"],
                destinations: ["package:@valdres/schema"],
                implementationOwnerId: "package-adapter-extraction",
            }),
        )
    }

    if (relative === "errors/lib/generateSelectorTrace.ts") {
        return mixed(
            [
                action("replace", "safe selector diagnostic construction", {
                    decisionIds: ["source.sync-core", "source.one-evaluator"],
                    destinations: ["boundary:valdres#selector-errors"],
                    implementationOwnerId: "pure-dag",
                }),
                action("retire", "exact beta trace formatting and wording", {
                    decisionIds: ["source.one-evaluator"],
                }),
            ],
            "Selector diagnostics remain public, but their exact empty-trace text and formatting are not catalogued as a v1 contract.",
        )
    }

    if (
        relative === "errors/SelectorEvaluationError.ts" ||
        relative === "errors/SelectorCircularDependencyError.ts"
    ) {
        return mixed(
            [
                action("replace", "stable public selector error", {
                    decisionIds: ["source.sync-core", "source.one-evaluator"],
                    destinations: ["boundary:valdres#selector-errors"],
                    implementationOwnerId: "pure-dag",
                }),
                action(
                    "retire",
                    "cross-copy instanceof branding and exact legacy trace shape",
                    {
                        decisionIds: [
                            "source.runtime-domains",
                            "source.one-evaluator",
                        ],
                    },
                ),
            ],
            "The error class name remains in the target surface, while cross-copy instanceof and exact legacy trace/message shape do not; the missing error contract must be frozen before approval.",
        )
    }

    if (relative === "errors/StoreDisposedError.ts") {
        return mixed(
            [
                action("replace", "stable terminal Store disposal error", {
                    decisionIds: ["source.sync-core", "source.scope-lifecycle"],
                    destinations: ["boundary:valdres#StoreDisposedError"],
                    implementationOwnerId: "kernel-v1",
                }),
                action(
                    "retire",
                    "public Store ID diagnostics and cross-copy instanceof branding",
                    {
                        decisionIds: [
                            "source.runtime-domains",
                            "source.scope-lifecycle",
                        ],
                    },
                ),
            ],
            "StoreDisposedError remains public, but its beta constructor message exposes removed Store.id data and its exact v1 error contract is not catalogued.",
        )
    }

    return uncertain(
        [replaceKernel("unresolved public error responsibility")],
        `The public-error catalog has no specific decomposition for ${relative}; inspect it before approval.`,
    )
}

function classifyMixed(relative: string): Classification {
    if (relative === "adapter-internals/v1.ts") {
        return mixed(
            [
                action(
                    "replace",
                    "versioned adapter read and subscription boundary",
                    {
                        decisionIds: ["source.adapter-boundary"],
                        destinations: ["boundary:valdres/adapter-internals/v1"],
                        implementationOwnerId: "package-adapter-extraction",
                    },
                ),
                action("retire", "manual adapter Transaction lifecycle", {
                    publicApiIds: ["react.use-transaction"],
                    contractIds: ["react.direct-store-transactions"],
                    decisionIds: [
                        "source.one-tree-transaction",
                        "source.adapter-boundary",
                    ],
                }),
            ],
            "The adapter entrypoint contains both retained adapter capabilities and a manual Transaction surface scheduled for removal.",
        )
    }

    if (relative === "index.ts") {
        return mixed(
            [
                action("replace", "stable root exports", {
                    publicApiIds: [
                        "core.atom",
                        "core.selector",
                        "core.store",
                        "core.family",
                    ],
                    decisionIds: ["source.sync-core"],
                    destinations: ["boundary:valdres"],
                    implementationOwnerId: "package-adapter-extraction",
                }),
                action("move", "optional root capabilities", {
                    publicApiIds: ["beta.cache-companion"],
                    decisionIds: [
                        "source.cache-companion",
                        "source.inspect-companion",
                        "source.schema-companion",
                    ],
                    destinations: [
                        "package:beta-cache-companion",
                        "package:@valdres/inspect",
                        "package:@valdres/schema",
                    ],
                    implementationOwnerId: "package-adapter-extraction",
                }),
                action("retire", "removed root exports", {
                    publicApiIds: ["core.global-atom", "core.global-store"],
                    decisionIds: [
                        "source.remove-globals",
                        "source.remove-async-state",
                    ],
                }),
            ],
            "The beta root barrel mixes stable, moved, and removed surfaces; declaration and packed reachability must be reviewed export by export.",
        )
    }

    if (relative === "indexConstructor.ts") {
        return mixed(
            [
                action("replace", "structural collection index declarations", {
                    publicApiIds: ["core.collection"],
                    contractIds: ["collection.row-identity"],
                    decisionIds: ["source.collection-kernel"],
                    destinations: ["boundary:valdres#collection-index"],
                    implementationOwnerId: "kernel-v1",
                }),
                action("retire", "legacy family-membership query semantics", {
                    publicApiIds: ["core.family"],
                    contractIds: ["family.no-membership"],
                    decisionIds: [
                        "source.family-identity",
                        "source.collection-kernel",
                    ],
                }),
            ],
            "The current index constructor is family-backed, while v1 indexes are collection-owned and structurally declared.",
        )
    }

    if (
        relative === "store.ts" ||
        relative === "types/Store.ts" ||
        relative === "types/StoreOptions.ts" ||
        relative === "types/StoreData.ts" ||
        relative === "lib/createStoreData.ts" ||
        relative === "lib/storeFromStoreData.ts"
    ) {
        return mixed(
            [
                action(
                    "replace",
                    "explicit StoreTree ownership and operations",
                    {
                        publicApiIds: [
                            "core.store",
                            "core.store.scope",
                            "core.store.txn",
                        ],
                        contractIds: [
                            "store.explicit-owner",
                            "store.object-identity",
                            "scope.parent-local-name",
                            "transaction.one-tree-draft",
                        ],
                        decisionIds: [
                            "source.one-mutation-kernel",
                            "source.one-tree-transaction",
                            "source.scope-lifecycle",
                        ],
                        destinations: ["boundary:valdres#StoreTree"],
                        implementationOwnerId: "kernel-v1",
                        evidenceOwnerIds: ["shiftx-packed-canary"],
                    },
                ),
                action(
                    "retire",
                    "ambient registries, public string Store identity, lease, async, and inspection fields",
                    {
                        publicApiIds: [
                            "core.global-store",
                            "core.store.on-dispose",
                        ],
                        decisionIds: [
                            "source.remove-globals",
                            "source.remove-async-state",
                            "source.inspect-companion",
                        ],
                    },
                ),
            ],
            "The beta Store facade and StoreData aggregate retained primitives with most of the semantic planes being removed or extracted.",
        )
    }

    if (relative === "lib/equal.ts" || relative === "types/EqualFunc.ts") {
        return mixed(
            [
                action(
                    "replace",
                    "Object.is default and explicit comparators",
                    {
                        publicApiIds: ["core.atom", "core.selector"],
                        contractIds: ["atom.object-is-default"],
                        decisionIds: ["source.sync-core"],
                        destinations: ["boundary:valdres#equality"],
                        implementationOwnerId: "kernel-v1",
                    },
                ),
                action(
                    "retire",
                    "default deep or trigger-provenance equality",
                    {
                        contractIds: ["atom.object-is-default"],
                        decisionIds: ["source.sync-core"],
                    },
                ),
            ],
            "The legacy equality helper combines the retained comparator hook with default structural and trigger-provenance behavior.",
        )
    }

    if (
        relative === "lib/getStoreRuntime.ts" ||
        relative === "lib/storeRuntimeKey.ts"
    ) {
        return mixed(
            [
                action("replace", "module-local runtime ownership token", {
                    publicApiIds: ["core.runtime-mismatch-error"],
                    contractIds: [
                        "runtime.before-work-owner-check",
                        "runtime.isolated-domains",
                    ],
                    decisionIds: ["source.runtime-domains"],
                    destinations: ["boundary:valdres#runtime-domain"],
                    implementationOwnerId: "kernel-v1",
                }),
                action("retire", "same-version global runtime adoption", {
                    decisionIds: [
                        "source.runtime-domains",
                        "source.remove-globals",
                    ],
                }),
            ],
            "A fixed inert recognition key remains, but mutable process-global runtime adoption does not.",
        )
    }

    if (relative === "lib/initSelector.ts") {
        return mixed(
            [
                replaceSelector("pure synchronous selector evaluation"),
                action(
                    "retire",
                    "late, async, cyclic, and cold-validation modes",
                    {
                        contractIds: ["selector.pure-sync-dag"],
                        decisionIds: [
                            "source.remove-async-state",
                            "source.remove-legacy-graph",
                        ],
                    },
                ),
            ],
            "The beta evaluator contains both the retained synchronous read shape and the removed async, cycle, and cold-cache semantics.",
        )
    }

    if (relative === "lib/normalizeStagedValue.ts") {
        return mixed(
            [
                action(
                    "replace",
                    "guarded synchronous staged value resolution",
                    {
                        publicApiIds: ["core.atom", "core.store"],
                        contractIds: [
                            "atom.exact-value",
                            "mutation.value-vs-updater",
                        ],
                        decisionIds: [
                            "source.sync-core",
                            "source.one-mutation-kernel",
                        ],
                        destinations: ["boundary:valdres#mutation-kernel"],
                        implementationOwnerId: "kernel-v1",
                    },
                ),
                action("move", "schema validation policy", {
                    decisionIds: ["source.schema-companion"],
                    destinations: ["package:@valdres/schema"],
                    implementationOwnerId: "package-adapter-extraction",
                }),
                action(
                    "retire",
                    "Promise exemption and default recursive deep-freeze policy",
                    {
                        decisionIds: [
                            "source.remove-async-state",
                            "source.sync-core",
                        ],
                    },
                ),
            ],
            "The staging helper combines the retained synchronous mutation boundary with schema extraction and removed Promise/deep-freeze policy.",
        )
    }

    if (relative === "lib/setValueInData.ts") {
        return mixed(
            [
                action("replace", "canonical synchronous source apply", {
                    publicApiIds: ["core.atom", "core.store"],
                    contractIds: [
                        "atom.exact-value",
                        "mutation.value-vs-updater",
                    ],
                    decisionIds: [
                        "source.sync-core",
                        "source.one-mutation-kernel",
                        "source.scope-lifecycle",
                    ],
                    destinations: ["boundary:valdres#mutation-kernel"],
                    implementationOwnerId: "kernel-v1",
                }),
                action("move", "inline cache freshness bookkeeping", {
                    publicApiIds: ["beta.cache-companion"],
                    contractIds: [
                        "cache.client-owned-entries",
                        "cache.no-store-internals",
                    ],
                    decisionIds: ["source.cache-companion"],
                    destinations: ["package:beta-cache-companion"],
                    implementationOwnerId: "package-adapter-extraction",
                    evidenceOwnerIds: ["shiftx-packed-canary"],
                }),
                action(
                    "retire",
                    "default deep-freeze, hidden family membership, and cold-revision repair branches",
                    {
                        contractIds: ["family.no-membership"],
                        decisionIds: [
                            "source.sync-core",
                            "source.family-identity",
                            "source.remove-legacy-graph",
                        ],
                    },
                ),
            ],
            "The write helper mixes retained source apply with removed deep-freeze/family/cold-graph branches and extracted cache policy.",
        )
    }

    if (relative === "lib/propagateUpdatedAtoms.ts") {
        return mixed(
            [
                action(
                    "replace",
                    "affected-DAG propagation after source apply",
                    {
                        contractIds: [
                            "notification.after-stability",
                            "selector.one-evaluator",
                        ],
                        decisionIds: [
                            "source.one-evaluator",
                            "source.one-mutation-kernel",
                        ],
                        destinations: ["boundary:valdres#propagation"],
                        implementationOwnerId: "kernel-v1",
                    },
                ),
                action("retire", "cycle repair and legacy validation passes", {
                    contractIds: ["selector.pure-sync-dag"],
                    decisionIds: ["source.remove-legacy-graph"],
                }),
            ],
            "The propagation file mixes required affected-DAG work with cycle repair and cold-validation machinery.",
        )
    }

    if (
        relative === "lib/transaction.ts" ||
        relative.startsWith("types/Transaction")
    ) {
        return classifyTransaction()
    }

    return uncertain(
        [replaceKernel("mixed Store implementation responsibility")],
        `The mixed-file catalog has no specific decomposition for ${relative}; inspect it before approval.`,
    )
}

function classifyTransaction(): Classification {
    return mixed(
        [
            action("replace", "synchronous one-StoreTree transaction", {
                publicApiIds: ["core.store.txn"],
                contractIds: [
                    "transaction.one-tree-draft",
                    "transaction.sync-derived-reads",
                ],
                decisionIds: ["source.one-tree-transaction"],
                destinations: ["boundary:valdres#Store.txn"],
                implementationOwnerId: "kernel-v1",
                evidenceOwnerIds: ["shiftx-packed-canary"],
            }),
            action(
                "retire",
                "manual, async, nested-savepoint, or cross-root transaction machinery",
                {
                    decisionIds: [
                        "source.one-tree-transaction",
                        "source.remove-async-state",
                    ],
                },
            ),
        ],
        "The beta transaction surface combines the retained synchronous draft with removed lifecycle and ownership modes.",
    )
}

function straightforward(...actions: readonly Action[]): Classification {
    return {
        actions,
        review: { classification: "straightforward", reasons: [] },
    }
}

function mixed(actions: readonly Action[], reason: string): Classification {
    return {
        actions,
        review: { classification: "mixed-needs-review", reasons: [reason] },
    }
}

function uncertain(actions: readonly Action[], reason: string): Classification {
    return {
        actions,
        review: {
            classification: "uncertain-needs-review",
            reasons: [reason],
        },
    }
}

function isGlobal(path: string): boolean {
    return /(?:^|\/)(?:create)?global|GlobalAtom|valdresGlobal/u.test(path)
}

function isCache(path: string): boolean {
    return /cache|CacheEntry|CacheController/u.test(path)
}

function isSchema(path: string): boolean {
    return /schema|Schema|StandardSchema/u.test(path)
}

function isFamily(path: string): boolean {
    return /family|Family|WeakSelectorCache|WeakValueMap/u.test(path)
}

function isSelector(path: string): boolean {
    return /selector|Selector|collectDependents|hasCommittedValue|stateRevisions/u.test(
        path,
    )
}

function isTransaction(path: string): boolean {
    return /transaction|Transaction|mutationDraft|MutationDraft|commitIntent|CommitIntent/u.test(
        path,
    )
}

function isScopeOrLifecycle(path: string): boolean {
    return /scope|Scope|subscribe|Subscribe|Subscription|unsubscribe|Lifecycle|dispose|Dispose|notifySubscribers|trackScope|treeTriggerGroups/u.test(
        path,
    )
}

function isAtomOrMutation(path: string): boolean {
    return /atom|Atom|setValue|SetAtom|reset|Reset|unset|write|Write|commitEngine|commitErrors|normalizeStagedValue|runOnSets|resolveAtomDefaultValue|initAtom/u.test(
        path,
    )
}

function isRuntimeBoundary(path: string): boolean {
    return /Runtime|runtime|storeDataAccessToken|getStoreData|storeAdapter/u.test(
        path,
    )
}

function buildSeed(inventoryBytes: Uint8Array): {
    readonly records: readonly unknown[]
    readonly source: string
} {
    const inventory = JSON.parse(new TextDecoder().decode(inventoryBytes)) as {
        readonly entries: readonly InventoryEntry[]
    }
    const productionEntries = inventory.entries
        .filter(entry => entry.subject.kind === "production-file")
        .sort((left, right) =>
            left.subject.path.localeCompare(right.subject.path),
        )
    assert(
        productionEntries.length === 190,
        `expected 190 frozen production subjects, got ${productionEntries.length}`,
    )
    const sha256 = createHash("sha256").update(inventoryBytes).digest("hex")
    const header = {
        $schema: "./schemas/production-source-dispositions.schema.json",
        recordType: "header",
        schemaVersion: 1,
        completeness: "partial",
        baseline: { package: "valdres", version: "1.0.0-beta.23" },
        inventory: {
            catalogPath: "contracts/v1/frozen-test-inventory.json",
            sha256,
            subjectKind: "production-file",
            expectedSubjects: 190,
        },
        notes: [
            "Production source uses retain/replace/move/retire lifecycle actions, never the behavior-oriented A/B/C/D/E test taxonomy.",
            "Every source row is proposed. Mixed and uncertain path-based classifications require human review before approval.",
            "Run bun contracts/v1/generate-production-source-dispositions.ts --check to validate schema, provenance, joins, and exact 190-subject parity.",
        ],
    }
    const rows = productionEntries.map(entry => {
        const classification = classify(entry.subject.path)
        return {
            recordType: "source-disposition",
            id: entry.id,
            subject: entry.subject,
            reviewStatus: "proposed",
            reviewOwnerId: "v1-contract-model",
            actions: classification.actions,
            review: classification.review,
            rationale:
                classification.review.classification === "straightforward"
                    ? "The frozen path maps to one reviewed v1 responsibility; approval still requires a human source review."
                    : "The beta module spans or may span more than one v1 responsibility; review every action before approval.",
        }
    })
    const records = [header, ...owners, ...decisions, ...rows]
    return {
        records,
        source: `${records.map(record => JSON.stringify(record)).join("\n")}\n`,
    }
}

function validateLedger(
    records: readonly any[],
    inventoryBytes: Uint8Array,
): void {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as AnySchema
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    const validate = ajv.compile(schema)
    assert(
        validate(records),
        `production source ledger schema failed: ${ajv.errorsText(validate.errors, { separator: "; " })}`,
    )

    const [header, ...rest] = records
    assert(header?.recordType === "header", "ledger header must be first")
    const ownerRows = rest.filter(record => record.recordType === "owner")
    const decisionRows = rest.filter(
        record => record.recordType === "architecture-decision",
    )
    const sourceRows = rest.filter(
        record => record.recordType === "source-disposition",
    )
    assertUnique(
        ownerRows.map(owner => owner.id),
        "owner",
    )
    assertUnique(
        decisionRows.map(item => item.id),
        "architecture decision",
    )
    assertUnique(
        sourceRows.map(row => row.id),
        "source disposition",
    )
    assertExactSet(
        new Set(ownerRows.map(owner => owner.id)),
        new Set(owners.map(owner => owner.id)),
        "owner catalog",
    )
    assertExactSet(
        new Set(decisionRows.map(item => item.id)),
        new Set(decisions.map(item => item.id)),
        "architecture decision catalog",
    )

    const ownerById = new Map(ownerRows.map(owner => [owner.id, owner]))
    const decisionIds = new Set(decisionRows.map(item => item.id))
    const publicIds = new Set(
        (
            JSON.parse(readFileSync(publicManifestPath, "utf8")) as {
                readonly entries: readonly { readonly id: string }[]
            }
        ).entries.map(entry => entry.id),
    )
    const contractIds = new Set(
        (
            JSON.parse(readFileSync(contractCatalogPath, "utf8")) as {
                readonly contractIds: readonly string[]
            }
        ).contractIds,
    )
    const inventory = JSON.parse(new TextDecoder().decode(inventoryBytes)) as {
        readonly entries: readonly InventoryEntry[]
    }
    const productionEntries = inventory.entries.filter(
        entry => entry.subject.kind === "production-file",
    )
    const inventoryById = new Map(
        productionEntries.map(entry => [entry.id, entry]),
    )

    assert(
        header.inventory.sha256 ===
            createHash("sha256").update(inventoryBytes).digest("hex"),
        "ledger inventory SHA-256 differs from exact frozen bytes",
    )
    assert(
        sourceRows.length === 190,
        `expected 190 rows, got ${sourceRows.length}`,
    )
    assertExactSet(
        new Set(sourceRows.map(row => row.id)),
        new Set(productionEntries.map(entry => entry.id)),
        "production source ID",
    )
    if (header.completeness === "complete") {
        assert(
            sourceRows.every(row => row.reviewStatus === "approved"),
            "a complete production ledger cannot contain proposed rows",
        )
    }

    for (const row of sourceRows) {
        const inventoryEntry = inventoryById.get(row.id)
        assert(
            inventoryEntry !== undefined,
            `${row.id} is absent from inventory`,
        )
        assert(
            JSON.stringify(row.subject) ===
                JSON.stringify(inventoryEntry.subject),
            `${row.id} subject differs from frozen inventory`,
        )
        assert(
            ownerById.get(row.reviewOwnerId)?.role === "review",
            `${row.id} review owner is missing or has the wrong role`,
        )
        if (row.reviewStatus === "approved") {
            assert(
                row.review.classification === "straightforward" &&
                    row.review.reasons.length === 0,
                `${row.id} cannot be approved while review blockers remain`,
            )
        }
        for (const item of row.actions) {
            for (const id of item.publicApiIds) {
                assert(publicIds.has(id), `${row.id} has unknown API ID ${id}`)
            }
            for (const id of item.contractIds) {
                assert(
                    contractIds.has(id),
                    `${row.id} has unknown contract ID ${id}`,
                )
            }
            for (const id of item.decisionIds) {
                assert(
                    decisionIds.has(id),
                    `${row.id} has unknown decision ID ${id}`,
                )
            }
            if (item.mode === "retire") {
                assert(
                    item.implementationOwnerId === null &&
                        item.destinations.length === 0,
                    `${row.id} retire action cannot carry an implementation destination`,
                )
            } else {
                assert(
                    ownerById.get(item.implementationOwnerId)?.role ===
                        "implementation",
                    `${row.id} action has no implementation owner`,
                )
                assert(
                    item.destinations.length > 0,
                    `${row.id} action has no destination`,
                )
            }
            for (const ownerId of item.evidenceOwnerIds) {
                assert(
                    ownerById.get(ownerId)?.role === "evidence",
                    `${row.id} evidence owner ${ownerId} has the wrong role`,
                )
            }
        }
    }
}

function parseJsonl(source: string): readonly unknown[] {
    return source
        .split(/\r?\n/u)
        .filter(line => line.trim().length > 0)
        .map((line, index) => {
            try {
                return JSON.parse(line) as unknown
            } catch (error) {
                const detail =
                    error instanceof Error ? error.message : String(error)
                throw new Error(`ledger line ${index + 1}: ${detail}`)
            }
        })
}

function assertUnique(values: readonly string[], label: string): void {
    const seen = new Set<string>()
    for (const value of values) {
        assert(!seen.has(value), `duplicate ${label} ${value}`)
        seen.add(value)
    }
}

function assertExactSet(
    actual: ReadonlySet<string>,
    expected: ReadonlySet<string>,
    label: string,
): void {
    const missing = [...expected].filter(value => !actual.has(value))
    const unexpected = [...actual].filter(value => !expected.has(value))
    assert(
        missing.length === 0 && unexpected.length === 0,
        `${label} parity failed; missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}`,
    )
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

function run(args: readonly string[]): void {
    const inventoryBytes = new TextEncoder().encode(
        readFileSync(inventoryPath, "utf8"),
    )
    const seed = buildSeed(inventoryBytes)
    const write = args.includes("--write")
    const force = args.includes("--force")
    const checkSeed = args.includes("--check-seed")

    if (write) {
        assert(
            force || !existsSync(ledgerPath),
            "production source ledger already exists; pass --force only for an intentional seed reset",
        )
        validateLedger(seed.records, inventoryBytes)
        writeFileSync(ledgerPath, seed.source)
    }

    assert(existsSync(ledgerPath), "production source ledger does not exist")
    const ledgerSource = readFileSync(ledgerPath, "utf8")
    const records = parseJsonl(ledgerSource)
    validateLedger(records, inventoryBytes)
    if (checkSeed) {
        assert(
            ledgerSource === seed.source,
            "ledger differs from deterministic proposed seed",
        )
        assert(
            buildSeed(inventoryBytes).source === seed.source,
            "production source seed is nondeterministic",
        )
    }

    const rows = records.filter(
        (record: any) => record.recordType === "source-disposition",
    ) as readonly any[]
    const actionCounts = new Map<ActionMode, number>()
    for (const row of rows) {
        for (const item of row.actions) {
            actionCounts.set(
                item.mode,
                (actionCounts.get(item.mode as ActionMode) ?? 0) + 1,
            )
        }
    }
    const mixed = rows.filter(
        row => row.review.classification === "mixed-needs-review",
    ).length
    const uncertain = rows.filter(
        row => row.review.classification === "uncertain-needs-review",
    ).length
    console.log(
        `production source ledger ${write ? "written and " : ""}verified: ` +
            `${rows.length} proposed rows; ` +
            `actions retain=${actionCounts.get("retain") ?? 0}, ` +
            `replace=${actionCounts.get("replace") ?? 0}, ` +
            `move=${actionCounts.get("move") ?? 0}, ` +
            `retire=${actionCounts.get("retire") ?? 0}; ` +
            `mixed=${mixed}, uncertain=${uncertain}`,
    )
}

if (import.meta.main) run(process.argv.slice(2))
