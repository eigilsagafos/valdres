import Ajv2020, {
    type ErrorObject,
    type ValidateFunction,
} from "ajv/dist/2020.js"
import type { AnySchema } from "ajv"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

type Completeness = "partial" | "complete"
type DecisionStatus =
    | "approved"
    | "pending-review"
    | "pending-experiment"
    | "evidence-required"
type Disposition = "A" | "B" | "C" | "D" | "E"
type ResultPolicy = "value-may-be-undefined" | "value-must-not-be-undefined"
type LegacyKind =
    | "runtime-export"
    | "type-export"
    | "property"
    | "method"
    | "overload"
    | "option"

interface LegacySurface {
    readonly kind: LegacyKind
    readonly package: string
    readonly subpath: string
    readonly owner?: string
    readonly name: string
    readonly baseline: string
}

interface PublicEntry {
    readonly id: string
    readonly owner: string
    readonly errorCode?: string
    readonly allowedValues?: readonly string[]
    readonly parameters?: readonly string[]
    readonly kind:
        | "runtime-export"
        | "type-export"
        | "method"
        | "option"
        | "subpath"
        | "package"
        | "error"
    readonly legacy: readonly LegacySurface[]
    readonly target: {
        readonly package: string | null
        readonly subpath: string | null
        readonly name: string | null
        readonly status:
            | "stable"
            | "experimental"
            | "internal"
            | "removed"
            | "pending"
    }
    readonly migration: {
        readonly mode: "keep" | "add" | "replace" | "remove" | "move"
        readonly replacementIds: readonly string[]
        readonly evidenceStatus:
            | "not-required"
            | "planned"
            | "historical-only"
            | "external-handoff-required"
            | "complete"
    }
    readonly contractIds: readonly string[]
    readonly decisionStatus: DecisionStatus
    readonly notes: string
}

interface PublicManifest {
    readonly schemaVersion: 1
    readonly completeness: Completeness
    readonly generatedAgainst: {
        readonly workspace: {
            readonly commit: string
            readonly packageVersion: string
        }
        readonly frozenLegacy: {
            readonly packageVersion: string
            readonly npmSpec: string
            readonly registryTarball: string
            readonly integrity: string
            readonly sha256: string
            readonly localAuditPath: string
        }
        readonly currentShiftX:
            | {
                  readonly status: "external-handoff-required" | "available"
                  readonly notes: string
              }
            | {
                  readonly status: "complete"
                  readonly notes: string
                  readonly evidence: {
                      readonly verdict: "pass"
                      readonly remote: string
                      readonly branch: string
                      readonly commit: string
                      readonly dirty: false
                      readonly lockfile: {
                          readonly path: string
                          readonly sha256: string
                      }
                      readonly packedArtifact: {
                          readonly path: string
                          readonly sha256: string
                      }
                      readonly report: {
                          readonly path: string
                          readonly sha256: string
                      }
                      readonly checkedPaths: readonly string[]
                  }
              }
    }
    readonly entries: readonly PublicEntry[]
}

interface CallbackEntry {
    readonly id: string
    readonly apiEntryId: string
    readonly role: string
    readonly phase: string
    readonly suppliedCapabilities: readonly string[]
    readonly allowedExternalWork: readonly string[]
    readonly rejectedCapturedOperations: readonly string[]
    readonly guardDomain: string
    readonly errorRule: string
    readonly thenableRule: string
    readonly resultBoundary: string
    readonly resultPolicy?: ResultPolicy
    readonly requiredContractIds: readonly string[]
    readonly decisionStatus: DecisionStatus
}

interface CallbackManifest {
    readonly schemaVersion: 1
    readonly completeness: Completeness
    readonly entries: readonly CallbackEntry[]
}

interface ContractCatalog {
    readonly schemaVersion: 1
    readonly completeness: Completeness
    readonly contractIds: readonly string[]
}

interface FrozenPublicCoordinate {
    readonly id: string
    readonly kind: PublicEntry["kind"]
    readonly package: string
    readonly subpath: string
    readonly name: string
    readonly errorCode?: string
    readonly allowedValues?: readonly string[]
    readonly parameters?: readonly string[]
}

interface TargetSurfaceCatalog {
    readonly schemaVersion: 1
    readonly completeness: Completeness
    readonly publicApiIds: readonly string[]
    readonly callbackIds: readonly string[]
    readonly independentBetaPublicApiIds: readonly string[]
    readonly frozenPublicCoordinates: readonly FrozenPublicCoordinate[]
    readonly pendingSurfaceDecisions: readonly {
        readonly id: string
        readonly category:
            | "alias-exports"
            | "query-grammar"
            | "adapter-protocol"
            | "error-names"
            | "option-spellings"
        readonly status: "pending"
    }[]
}

interface FrozenLegacyEntrypoint {
    readonly subpath: string
    readonly runtimeExports: readonly string[]
    readonly typeExports: readonly string[]
}

interface FrozenLegacyMember {
    readonly kind: "property" | "method" | "overload"
    readonly subpath: string
    readonly owner: string
    readonly name: string
}

interface FrozenLegacyOption {
    readonly kind: "option"
    readonly subpath: string
    readonly owner: string
    readonly name: string
}

interface FrozenLegacyBlob {
    readonly path: string
    readonly gitBlobSha1: string
}

interface FrozenLegacyPackage {
    readonly package: string
    readonly baseline: string
    readonly provenance: {
        readonly sourceRevision: string
        readonly releaseRevision: string
        readonly sourcePackageTreeSha1: string
        readonly releasePackageTreeSha1: string
        readonly sourceTreeSha1: string
        readonly sourcePackageJsonBlobSha1: string
        readonly releasePackageJsonBlobSha1: string
        readonly entrypointBlobs: readonly (FrozenLegacyBlob & {
            readonly subpath: string
        })[]
        readonly surfaceBlobs: readonly FrozenLegacyBlob[]
        readonly publishedArtifact:
            | {
                  readonly status: "verified"
                  readonly npmSpec: string
                  readonly integrity: string
                  readonly sha256: string
              }
            | {
                  readonly status: "not-audited"
                  readonly notes: string
              }
    }
    readonly entrypoints: readonly FrozenLegacyEntrypoint[]
    readonly members: readonly FrozenLegacyMember[]
    readonly options: readonly FrozenLegacyOption[]
}

interface FrozenLegacySurface {
    readonly schemaVersion: 2
    readonly packages: readonly FrozenLegacyPackage[]
}

interface LegacyDispositionEntry {
    readonly coordinate: LegacySurface
    readonly dispositionId: string
    readonly reviewStatus: "proposed" | "approved"
}

interface LegacyDispositionCatalog {
    readonly schemaVersion: 1
    readonly entries: readonly LegacyDispositionEntry[]
}

interface TestDispositionHeader {
    readonly recordType: "header"
    readonly schemaVersion: 1
    readonly completeness: Completeness
    readonly classificationScope: {
        readonly testCases: "complete"
        readonly testFiles: "complete"
        readonly productionFiles: "separate-artifact-pending"
    }
    readonly inventory:
        | {
              readonly status: "pending"
              readonly expectedDispositionIds: readonly string[]
          }
        | {
              readonly status: "frozen"
              readonly catalogPath: string
              readonly sha256: string
              readonly expectedDispositionIds: readonly string[]
          }
}

type FrozenTestDispositionInventory = Extract<
    TestDispositionHeader["inventory"],
    { readonly status: "frozen" }
>

interface TestSubject {
    readonly origin: "published-beta.23" | "workspace-recovery"
    readonly kind:
        | "production-file"
        | "test-file"
        | "test-case"
        | "infrastructure"
    readonly path: string
    readonly testName?: string
}

interface TestDispositionEntry {
    readonly recordType: "disposition"
    readonly id: string
    readonly subject: TestSubject
    readonly disposition: Disposition
    readonly reviewStatus: "proposed" | "approved"
    readonly contractIds: readonly string[]
    readonly ownerIds: readonly string[]
    readonly destination: string | null
    readonly rationale: string
    readonly needsReview?: {
        readonly status: "needs-human-judgment"
        readonly reasons: readonly Readonly<{
            code:
                | "destination-not-frozen"
                | "mixed-contract-subject"
                | "target-export-unresolved"
                | "exact-shape-not-catalogued"
            detail: string
        }>[]
    }
}

interface TestOwnerEntry {
    readonly recordType: "test-owner"
    readonly id: string
    readonly path: string
    readonly testName: string | null
    readonly contractIds: readonly string[]
    readonly status: "planned" | "implemented"
}

type TestDispositionLedger = readonly [
    TestDispositionHeader,
    ...(TestDispositionEntry | TestOwnerEntry)[],
]

interface FrozenTestInventory {
    readonly schemaVersion: 1
    readonly baseline: {
        readonly package: "valdres"
        readonly version: "1.0.0-beta.23"
    }
    readonly provenance: {
        readonly publishedPackage: {
            readonly npmSpec: string
            readonly tarballSha256: string
        }
        readonly testRegistration: {
            readonly files: number
            readonly registeredFiles: number
            readonly zeroRegistrationFiles: readonly string[]
            readonly tests: number
            readonly minimumAssertions: number
            readonly failures: 0
            readonly skipped: 0
        }
    }
    readonly counts: {
        readonly productionFiles: number
        readonly testFiles: number
        readonly testCases: number
        readonly total: number
    }
    readonly entries: readonly Readonly<{
        id: string
        subject: TestSubject
        evidence: Readonly<{
            gitBlobSha1: string
            sourceLine?: number
        }>
    }>[]
}

export interface TestDispositionInventoryEvidence {
    readonly catalogPath: string
    readonly bytes: Uint8Array
}

export interface TestOwnerEvidence {
    readonly path: string
    readonly source: string
    readonly passedTestNames: readonly string[]
}

export interface ContractSet {
    readonly publicManifest: unknown
    readonly callbackManifest: unknown
    readonly contractCatalog: unknown
    readonly frozenLegacySurface: unknown
    readonly legacyDispositionCatalog: unknown
    readonly targetSurfaceCatalog: unknown
    readonly testDispositionLedger: unknown
    readonly testDispositionInventoryEvidence?: TestDispositionInventoryEvidence | null
    readonly testOwnerEvidence?: readonly TestOwnerEvidence[] | null
}

const directory = dirname(fileURLToPath(import.meta.url))
const schemasDirectory = join(directory, "schemas")
const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
})
const validatePublic = compileSchema(
    join(schemasDirectory, "public-api.schema.json"),
)
const validateCallbacks = compileSchema(
    join(schemasDirectory, "callback-capabilities.schema.json"),
)
const validateCatalog = compileSchema(
    join(schemasDirectory, "contract-catalog.schema.json"),
)
const validateFrozenLegacySurface = compileSchema(
    join(schemasDirectory, "frozen-legacy-surface.schema.json"),
)
const validateLegacyDispositionCatalog = compileSchema(
    join(schemasDirectory, "legacy-disposition-catalog.schema.json"),
)
const validateTargetSurfaceCatalog = compileSchema(
    join(schemasDirectory, "target-surface-catalog.schema.json"),
)
const validateTestDispositions = compileSchema(
    join(schemasDirectory, "test-dispositions.schema.json"),
)
const validateFrozenTestInventory = compileSchema(
    join(schemasDirectory, "frozen-test-inventory.schema.json"),
)

const requiredPublicIds = new Set([
    "adapter.assert-store",
    "adapter.read",
    "adapter.read-hydration-snapshot",
    "adapter.subscribe",
    "adapter.v1-subpath",
    "core.atom",
    "core.atom.lazy",
    "core.atom-options.equal",
    "core.atom-options.name",
    "core.callback-capability-error",
    "core.selector",
    "core.selector-options.equal",
    "core.selector-options.name",
    "core.external-atom",
    "core.external-atom-options.name",
    "core.external-source-delivery-limit-error",
    "core.external-source-non-convergence-error",
    "core.dormant-external-read-error",
    "core.invalid-atom-comparator-result-error",
    "core.invalid-external-cleanup-error",
    "core.invalid-synchronous-atom-value-error",
    "core.invalid-transaction-callback-result-error",
    "core.server-snapshot-unavailable-error",
    "core.family",
    "core.family-options.encode-key",
    "core.collection",
    "core.collection-options.encode-key",
    "core.collection-options.indexes",
    "core.query-definition.where",
    "core.query-definition.order-by",
    "core.query-definition.offset",
    "core.query-definition.limit",
    "core.query-definition.facets",
    "core.facet-options.mode",
    "core.facet-options.order",
    "core.presence",
    "core.structural-query",
    "core.store",
    "core.store.txn",
    "core.store.update",
    "core.subscriber-notification-error",
    "react.provider",
    "react.use-store",
    "react.use-value",
    "core.runtime-mismatch-error",
    "core.selector-capability-error",
    "core.transaction-closed-error",
    "core.transaction-phase-error",
    "collection.operations-subpath",
    "collection.materialize",
    "collection.materialize-options.priority",
    "collection.scan",
    "collection.materialization-status",
    "collection.materialization-subscribe",
    "collection.artifacts-subpath",
    "collection.artifact-export",
    "collection.artifact-import",
])
const requiredCallbackIds = new Set([
    "callback.adapter-subscriber",
    "callback.atom-comparator",
    "callback.atom-lazy-initializer",
    "callback.selector-comparator",
    "callback.selector-getter",
    "callback.transaction",
    "callback.transaction-scope",
    "callback.atom-update",
    "callback.collection-row-update",
    "callback.family-create-node",
    "callback.family-encode-key",
    "callback.collection-encode-key",
    "callback.collection-index-extractor",
    "callback.external-get-snapshot",
    "callback.external-get-server-snapshot",
    "callback.external-subscribe",
    "callback.external-cleanup",
    "callback.store-subscriber",
    "callback.materialization-status-listener",
])
const requiredKinds = new Set<PublicEntry["kind"]>([
    "runtime-export",
    "type-export",
    "method",
    "option",
    "subpath",
    "package",
    "error",
])
const independentBetaOwner = "independent-beta"
const gitCoordinateCache = new Map<string, string>()
const frozenLegacyCoordinateInventorySha256 =
    "3d661c9b3ea5cb5e53202fc87c11aff36663abf269e5592701563170eeab986c"
const frozenLegacyProvenanceInventorySha256 =
    "5b01eda652cf7f3e281cc0b832eda76157d2939c9997dfc51eb6186b558e3f06"
const frozenReviewedLegacyDispositionSha256 =
    "e59fc2432d3402205d77cf96095b4b57ca870044d9db6c64bc908752d8fa01f8"
const frozenTargetCoordinateInventorySha256 =
    "dc24aae780a5197ffbaa307304163477842359a1970747eade36df8abc16d1c7"
const frozenReleaseTrackOwnershipSha256 =
    "3a8dbd8ffa92e0c43c87ebfbf8f860727250f003d35680fc2b7c964829c7130c"
const frozenWorkspaceBaseline = Object.freeze({
    commit: "ff1424bde13445eba07fcb426f5493dd43898f72",
    packageVersion: "1.0.0-beta.22",
})
// Current ShiftX is not available in this workspace. An external handoff may
// populate this only after its evidence payload has been independently
// reviewed. Until then, no inline manifest payload can open completion.
const frozenReviewedCurrentShiftXEvidenceSha256: string | null = null
const frozenLegacySubpaths = new Map([
    ["valdres", new Set([".", "./adapter-internals/v1"])],
    ["valdres-react", new Set(["."])],
] as const)
const requiredFrozenPublicCoordinates = new Map([
    [
        "adapter.assert-store",
        {
            package: "valdres",
            subpath: "./adapter-internals/v1",
            name: "assertStore",
        },
    ],
    [
        "adapter.read",
        {
            package: "valdres",
            subpath: "./adapter-internals/v1",
            name: "read",
        },
    ],
    [
        "adapter.read-hydration-snapshot",
        {
            package: "valdres",
            subpath: "./adapter-internals/v1",
            name: "readHydrationSnapshot",
        },
    ],
    [
        "adapter.subscribe",
        {
            package: "valdres",
            subpath: "./adapter-internals/v1",
            name: "subscribe",
        },
    ],
    [
        "adapter.v1-subpath",
        {
            package: "valdres",
            subpath: "./adapter-internals/v1",
            name: "valdres/adapter-internals/v1",
        },
    ],
    [
        "collection.artifact-export",
        {
            package: "valdres",
            subpath: "./collection/artifacts",
            name: "exportArtifact",
        },
    ],
    [
        "collection.artifact-import",
        {
            package: "valdres",
            subpath: "./collection/artifacts",
            name: "importArtifact",
        },
    ],
    [
        "collection.materialization-status",
        {
            package: "valdres",
            subpath: "./collection",
            name: "getMaterializationStatus",
        },
    ],
    [
        "collection.materialization-subscribe",
        {
            package: "valdres",
            subpath: "./collection",
            name: "subscribeMaterialization",
        },
    ],
    [
        "collection.materialize",
        {
            package: "valdres",
            subpath: "./collection",
            name: "materialize",
        },
    ],
    [
        "collection.materialize-options.priority",
        {
            package: "valdres",
            subpath: "./collection",
            name: "MaterializeOptions.priority",
        },
    ],
    [
        "collection.scan",
        { package: "valdres", subpath: "./collection", name: "scan" },
    ],
    [
        "core.atom-options.equal",
        { package: "valdres", subpath: ".", name: "AtomOptions.equal" },
    ],
    [
        "core.atom-options.name",
        { package: "valdres", subpath: ".", name: "AtomOptions.name" },
    ],
    [
        "core.callback-capability-error",
        { package: "valdres", subpath: ".", name: "CallbackCapabilityError" },
    ],
    [
        "core.collection-options.encode-key",
        {
            package: "valdres",
            subpath: ".",
            name: "CollectionOptions.encodeKey",
        },
    ],
    [
        "core.collection-options.indexes",
        {
            package: "valdres",
            subpath: ".",
            name: "CollectionOptions.indexes",
        },
    ],
    [
        "core.dormant-external-read-error",
        { package: "valdres", subpath: ".", name: "DormantExternalReadError" },
    ],
    [
        "core.external-atom-options.name",
        {
            package: "valdres",
            subpath: ".",
            name: "ExternalAtomOptions.name",
        },
    ],
    [
        "core.external-source-delivery-limit-error",
        {
            package: "valdres",
            subpath: ".",
            name: "ExternalSourceDeliveryLimitError",
        },
    ],
    [
        "core.external-source-non-convergence-error",
        {
            package: "valdres",
            subpath: ".",
            name: "ExternalSourceNonConvergenceError",
        },
    ],
    [
        "core.facet-options.mode",
        { package: "valdres", subpath: ".", name: "FacetOptions.mode" },
    ],
    [
        "core.facet-options.order",
        { package: "valdres", subpath: ".", name: "FacetOptions.order" },
    ],
    [
        "core.family-options.encode-key",
        { package: "valdres", subpath: ".", name: "FamilyOptions.encodeKey" },
    ],
    [
        "core.invalid-external-cleanup-error",
        {
            package: "valdres",
            subpath: ".",
            name: "InvalidExternalCleanupError",
        },
    ],
    [
        "core.invalid-atom-comparator-result-error",
        {
            package: "valdres",
            subpath: ".",
            name: "InvalidAtomComparatorResultError",
        },
    ],
    [
        "core.invalid-synchronous-atom-value-error",
        {
            package: "valdres",
            subpath: ".",
            name: "InvalidSynchronousAtomValueError",
        },
    ],
    [
        "core.invalid-transaction-callback-result-error",
        {
            package: "valdres",
            subpath: ".",
            name: "InvalidTransactionCallbackResultError",
        },
    ],
    [
        "core.invalid-transaction-target-error",
        {
            package: "valdres",
            subpath: ".",
            name: "InvalidTransactionTargetError",
        },
    ],
    [
        "core.query-definition.facets",
        { package: "valdres", subpath: ".", name: "QueryDefinition.facets" },
    ],
    [
        "core.query-definition.limit",
        { package: "valdres", subpath: ".", name: "QueryDefinition.limit" },
    ],
    [
        "core.query-definition.offset",
        { package: "valdres", subpath: ".", name: "QueryDefinition.offset" },
    ],
    [
        "core.query-definition.order-by",
        { package: "valdres", subpath: ".", name: "QueryDefinition.orderBy" },
    ],
    [
        "core.query-definition.where",
        { package: "valdres", subpath: ".", name: "QueryDefinition.where" },
    ],
    [
        "core.server-snapshot-unavailable-error",
        {
            package: "valdres",
            subpath: ".",
            name: "ServerSnapshotUnavailableError",
        },
    ],
    [
        "core.scope-not-found-error",
        { package: "valdres", subpath: ".", name: "ScopeNotFoundError" },
    ],
    [
        "core.selector-capability-error",
        { package: "valdres", subpath: ".", name: "SelectorCapabilityError" },
    ],
    [
        "core.selector-options.equal",
        { package: "valdres", subpath: ".", name: "SelectorOptions.equal" },
    ],
    [
        "core.selector-options.name",
        { package: "valdres", subpath: ".", name: "SelectorOptions.name" },
    ],
    [
        "core.subscriber-notification-error",
        {
            package: "valdres",
            subpath: ".",
            name: "SubscriberNotificationError",
        },
    ],
    [
        "core.store-disposed-error",
        { package: "valdres", subpath: ".", name: "StoreDisposedError" },
    ],
    [
        "core.store-tree-mismatch-error",
        { package: "valdres", subpath: ".", name: "StoreTreeMismatchError" },
    ],
    [
        "core.transaction-closed-error",
        { package: "valdres", subpath: ".", name: "TransactionClosedError" },
    ],
    [
        "core.transaction-phase-error",
        { package: "valdres", subpath: ".", name: "TransactionPhaseError" },
    ],
] as const)
const requiredFrozenErrorCodes = new Map([
    ["core.callback-capability-error", "VALDRES_CALLBACK_CAPABILITY"],
    ["core.dormant-external-read-error", "VALDRES_DORMANT_EXTERNAL_READ"],
    [
        "core.external-source-delivery-limit-error",
        "VALDRES_EXTERNAL_SOURCE_DELIVERY_LIMIT",
    ],
    [
        "core.external-source-non-convergence-error",
        "VALDRES_EXTERNAL_SOURCE_NON_CONVERGENCE",
    ],
    [
        "core.invalid-atom-comparator-result-error",
        "VALDRES_INVALID_ATOM_COMPARATOR_RESULT",
    ],
    ["core.invalid-external-cleanup-error", "VALDRES_INVALID_EXTERNAL_CLEANUP"],
    [
        "core.invalid-synchronous-atom-value-error",
        "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
    ],
    [
        "core.invalid-transaction-callback-result-error",
        "VALDRES_INVALID_TRANSACTION_CALLBACK_RESULT",
    ],
    [
        "core.invalid-transaction-target-error",
        "VALDRES_INVALID_TRANSACTION_TARGET",
    ],
    ["core.runtime-mismatch-error", "VALDRES_RUNTIME_MISMATCH"],
    ["core.scope-not-found-error", "VALDRES_SCOPE_NOT_FOUND"],
    [
        "core.server-snapshot-unavailable-error",
        "VALDRES_SERVER_SNAPSHOT_UNAVAILABLE",
    ],
    ["core.selector-capability-error", "VALDRES_SELECTOR_CAPABILITY_ERROR"],
    ["core.subscriber-notification-error", "VALDRES_SUBSCRIBER_NOTIFICATION"],
    ["core.store-disposed-error", "VALDRES_STORE_DISPOSED"],
    ["core.store-tree-mismatch-error", "VALDRES_STORE_TREE_MISMATCH"],
    ["core.transaction-closed-error", "VALDRES_TRANSACTION_CLOSED"],
    ["core.transaction-phase-error", "VALDRES_TRANSACTION_PHASE"],
] as const)
const requiredExecutionErrorContracts = new Map([
    [
        "core.invalid-atom-comparator-result-error",
        ["atom.object-is-default", "error.stable-name-and-code"],
    ],
    [
        "core.invalid-synchronous-atom-value-error",
        [
            "atom.exact-value",
            "atom.lazy.sync-per-tree-fallback",
            "error.stable-name-and-code",
            "mutation.value-vs-updater",
        ],
    ],
    [
        "core.invalid-transaction-callback-result-error",
        ["error.stable-name-and-code", "transaction.one-tree-draft"],
    ],
    [
        "core.invalid-transaction-target-error",
        [
            "error.stable-name-and-code",
            "runtime.before-work-owner-check",
            "transaction.one-tree-draft",
            "transaction.scope-cursor-no-savepoint",
        ],
    ],
    [
        "core.scope-not-found-error",
        [
            "error.stable-name-and-code",
            "runtime.before-work-owner-check",
            "scope.parent-local-name",
            "transaction.scope-cursor-no-savepoint",
        ],
    ],
    [
        "core.selector-capability-error",
        [
            "callback.revocable-capability",
            "error.stable-name-and-code",
            "selector.pure-sync-dag",
        ],
    ],
    [
        "core.transaction-closed-error",
        [
            "error.stable-name-and-code",
            "transaction.one-tree-draft",
            "transaction.scope-cursor-no-savepoint",
        ],
    ],
    [
        "core.transaction-phase-error",
        [
            "error.stable-name-and-code",
            "transaction.one-tree-draft",
            "transaction.scope-cursor-no-savepoint",
        ],
    ],
    [
        "core.store-disposed-error",
        [
            "error.stable-name-and-code",
            "runtime.before-work-owner-check",
            "scope.explicit-disposal",
            "store.explicit-owner-teardown",
        ],
    ],
    [
        "core.store-tree-mismatch-error",
        [
            "error.stable-name-and-code",
            "no-writable-cross-tree-state",
            "runtime.before-work-owner-check",
            "transaction.one-tree-draft",
            "transaction.scope-cursor-no-savepoint",
        ],
    ],
    [
        "core.subscriber-notification-error",
        [
            "callback.subscriber-quarantine",
            "error.stable-name-and-code",
            "notification.after-stability",
        ],
    ],
] as const)
const requiredFrozenAllowedValues = new Map([
    ["collection.materialize-options.priority", ["user-visible", "background"]],
    ["core.facet-options.mode", ["conjunctive", "disjunctive"]],
    ["core.facet-options.order", ["count-desc", "value-asc", "value-desc"]],
] as const)
const requiredFrozenParameters = new Map([["core.store", []]] as const)
const requiredFrozenTargetStatuses = new Map([
    ["adapter.assert-store", "internal"],
    ["adapter.read", "internal"],
    ["adapter.read-hydration-snapshot", "internal"],
    ["adapter.subscribe", "internal"],
    ["adapter.v1-subpath", "internal"],
] as const)
const requiredCallbackPhaseErrors = new Map([
    ["callback.selector-getter", "SelectorCapabilityError"],
    ["callback.selector-comparator", "SelectorCapabilityError"],
    ["callback.transaction", "TransactionPhaseError"],
    ["callback.transaction-scope", "TransactionPhaseError"],
] as const)
const requiredCallbackOutcomeErrors = new Map([
    ["callback.atom-lazy-initializer", "InvalidSynchronousAtomValueError"],
    ["callback.atom-comparator", "InvalidAtomComparatorResultError"],
    ["callback.atom-update", "InvalidSynchronousAtomValueError"],
    ["callback.transaction", "InvalidTransactionCallbackResultError"],
    ["callback.transaction-scope", "InvalidTransactionCallbackResultError"],
] as const)
const storeSubscriberContract = Object.freeze({
    role: "Invalidate one final settled subscription target after source and derived state stabilize; the callback receives no arguments.",
    suppliedCapabilities: Object.freeze([
        "zero-argument invalidation signal; no settled value argument",
        "idempotent unsubscribe for already-owned subscription",
        "committed reads that do not sample dormant external sources",
    ]),
    allowedExternalWork: Object.freeze([
        "Web Storage persistence",
        "DOM or application side effects outside Valdres",
    ]),
    rejectedCapturedOperations: Object.freeze([
        "same-domain Store mutation",
        "same-domain Store transaction",
        "new subscription",
        "scope access or creation",
        "Store disposal",
        "dormant external sampling",
    ]),
    errorRule:
        "Forbidden same-domain work throws CallbackCapabilityError; a read that would publish a dormant external source throws DormantExternalReadError. Subscriber throws are all collected in deterministic target-reaching and callback-insertion order without starving the remaining snapshot. Without an already-authoritative post-apply RuntimeMismatchError, they surface after idle as SubscriberNotificationError / VALDRES_SUBSCRIBER_NOTIFICATION with immutable cause equal to the exact first thrown value, frozen ordered causes, committed true, phase notifying, and lifecycle-free source owned-mutation. Delivery remains all-fire when that mismatch is already authoritative. If no subscriber throws, the exact RuntimeMismatchError surfaces directly after all callbacks are attempted. If subscriber throws coexist, SubscriberNotificationError is the required outer wrapper with cause equal to the exact RuntimeMismatchError and frozen causes equal to [mismatch, ...subscriber throws in delivery order]; every subscriber throw is retained as a secondary cause in delivery order, and the mismatch remains the semantic primary and is not replaced.",
    thenableRule:
        "Callback return values are ignored. A returned thenable receives exactly one stateless rejection-containment handler, is never awaited, and does not itself create a notification error. A thrown thenable receives exactly one stateless rejection-containment handler, is never awaited, and remains the exact ordered subscriber cause; no asynchronous Valdres capability survives delivery.",
    resultBoundary:
        "Store.sub(state, callback: () => void): () => void creates one independent registration even when callback identity repeats. Registration performs the same outcome materialization as get, but internally catches the public read throw of a successfully materialized ordinary current error outcome so it can register; only admission, disposal, or internal-publication failure registers nothing. A lifecycle-free registration does not notify. Changed target callback sets enter the frozen settlement snapshot in first-reaching order and callbacks within each target retain subscription insertion order; every snapshotted registration is attempted at most once. The returned unsubscribe is idempotent, removes future eligibility immediately, and cannot edit the current snapshot.",
    requiredContractIds: Object.freeze([
        "notification.after-stability",
        "callback.subscriber-quarantine",
        "error.stable-name-and-code",
    ]),
    storeNotes:
        "Store.sub(state, callback: () => void): () => void creates one independent synchronous zero-argument invalidation registration, even when callback identity repeats. Registration performs the same outcome materialization as get, but internally catches the public read throw of a successfully materialized ordinary current error outcome so it can register; only admission, disposal, or internal-publication failure registers nothing. A lifecycle-free registration does not notify. Changed target callback sets enter the frozen post-stability settlement snapshot in first-reaching order; callbacks within each target retain subscription insertion order; delivery is all-fire and each registration runs at most once. Without an already-authoritative post-apply RuntimeMismatchError, the first subscriber throw becomes the SubscriberNotificationError cause and later subscriber throws remain ordered causes. Delivery remains all-fire when that mismatch is already authoritative. If no subscriber throws, the exact RuntimeMismatchError surfaces directly after all callbacks are attempted. If subscriber throws coexist, SubscriberNotificationError is the required outer wrapper with cause equal to the exact RuntimeMismatchError and frozen causes equal to [mismatch, ...subscriber throws in delivery order]; every subscriber throw is retained as a secondary cause in delivery order, and the mismatch remains the semantic primary and is not replaced. The returned unsubscribe is idempotent, removes future eligibility immediately, and cannot edit the current snapshot.",
    typeNotes:
        "SubscribeFn is exactly <Value>(state: Atom<Value> | Selector<Value>, callback: () => void) => () => void. It returns one idempotent unsubscribe; family callback and deep-equality parameters are removed.",
    errorNotes:
        "SubscriberNotificationError / VALDRES_SUBSCRIBER_NOTIFICATION is the immutable post-commit delivery wrapper for subscriber throws. Without an already-authoritative post-apply RuntimeMismatchError, cause is the exact first thrown value and causes is a frozen readonly array of all subscriber-thrown values in deterministic delivery order; committed is exactly true; phase is exactly notifying; source is exactly owned-mutation for the lifecycle-free slice. Delivery remains all-fire when that mismatch is already authoritative. If no subscriber throws, the exact RuntimeMismatchError surfaces directly after all callbacks are attempted. If subscriber throws coexist, SubscriberNotificationError is the required outer wrapper with cause equal to the exact RuntimeMismatchError and frozen causes equal to [mismatch, ...subscriber throws in delivery order]; every subscriber throw is retained as a secondary cause in delivery order, and the mismatch remains the semantic primary and is not replaced. No external-source literal is frozen by this slice.",
})
const runtimeOwnedExternalErrorNames = [
    "ExternalSourceNonConvergenceError",
    "ExternalSourceDeliveryLimitError",
] as const

export function validateContractSet(input: ContractSet): Readonly<{
    publicEntries: number
    callbackEntries: number
    contractIds: number
    completeness: `${Completeness}/${Completeness}/${Completeness}/${Completeness}`
    testDispositions: number
    testDispositionCounts: Readonly<Record<Disposition, number>>
    testDispositionNeedsReview: number
    testOwners: number
    testDispositionCompleteness: Completeness
    testInventorySubjects: number | null
    testDispositionScopeSubjects: number | null
    testClassificationRemaining: number | null
    testCaseClassificationRemaining: number | null
    testFileClassificationRemaining: number | null
    productionSourceSubjects: number | null
}> {
    assertSchema(validatePublic, input.publicManifest, "public-api.json")
    assertSchema(
        validateCallbacks,
        input.callbackManifest,
        "callback-capabilities.json",
    )
    assertSchema(
        validateCatalog,
        input.contractCatalog,
        "contract-catalog.json",
    )
    assertSchema(
        validateFrozenLegacySurface,
        input.frozenLegacySurface,
        "frozen-legacy-surface.json",
    )
    assertSchema(
        validateLegacyDispositionCatalog,
        input.legacyDispositionCatalog,
        "legacy-disposition-catalog.json",
    )
    assertSchema(
        validateTargetSurfaceCatalog,
        input.targetSurfaceCatalog,
        "target-surface-catalog.json",
    )
    assertSchema(
        validateTestDispositions,
        input.testDispositionLedger,
        "test-dispositions.jsonl",
    )

    const publicManifest = input.publicManifest as PublicManifest
    const callbackManifest = input.callbackManifest as CallbackManifest
    const contractCatalog = input.contractCatalog as ContractCatalog
    const frozenLegacySurface = input.frozenLegacySurface as FrozenLegacySurface
    const legacyDispositionCatalog =
        input.legacyDispositionCatalog as LegacyDispositionCatalog
    const targetSurfaceCatalog =
        input.targetSurfaceCatalog as TargetSurfaceCatalog
    const testDispositionLedger =
        input.testDispositionLedger as TestDispositionLedger

    assertFrozenLegacySurface(frozenLegacySurface)
    const frozenCorePublishedArtifact = assertFrozenLegacyPublicArtifact(
        publicManifest,
        frozenLegacySurface,
    )

    assert(
        /^[0-9a-f]{40}$/.test(publicManifest.generatedAgainst.workspace.commit),
        "workspace commit must be a full Git SHA",
    )
    assert(
        publicManifest.generatedAgainst.workspace.commit ===
            frozenWorkspaceBaseline.commit &&
            publicManifest.generatedAgainst.workspace.packageVersion ===
                frozenWorkspaceBaseline.packageVersion,
        "workspace baseline differs from the independently pinned recovery input",
    )
    assertWorkspaceBaseline()
    assert(
        /^[0-9a-f]{64}$/.test(
            publicManifest.generatedAgainst.frozenLegacy.sha256,
        ),
        "frozen legacy SHA-256 must be complete",
    )
    assert(
        /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(
            publicManifest.generatedAgainst.frozenLegacy.integrity,
        ),
        "frozen legacy registry integrity must be a complete SHA-512 SRI",
    )

    const publicIds = uniqueIds(publicManifest.entries, "public API")
    const callbackIds = uniqueIds(
        callbackManifest.entries,
        "callback capability",
    )
    const catalogIds = uniqueStrings(contractCatalog.contractIds, "contract ID")
    const targetPublicIds = uniqueStrings(
        targetSurfaceCatalog.publicApiIds,
        "target public API",
    )
    const targetCallbackIds = uniqueStrings(
        targetSurfaceCatalog.callbackIds,
        "target callback capability",
    )
    const independentBetaPublicIds = uniqueStrings(
        targetSurfaceCatalog.independentBetaPublicApiIds,
        "independent beta public API",
    )
    uniqueIds(
        targetSurfaceCatalog.pendingSurfaceDecisions,
        "pending target surface decision",
    )
    assertContainsAll(
        targetPublicIds,
        independentBetaPublicIds,
        "target public API",
    )
    assertFrozenPublicCoordinates(
        publicManifest.entries,
        targetPublicIds,
        targetSurfaceCatalog.frozenPublicCoordinates,
    )
    const testDispositionResult = assertTestDispositionLedger(
        testDispositionLedger,
        catalogIds,
        input.testDispositionInventoryEvidence ?? null,
        input.testOwnerEvidence ?? null,
        frozenCorePublishedArtifact,
    )
    assertExactSet(publicIds, targetPublicIds, "public API target catalog")
    assertExactSet(callbackIds, targetCallbackIds, "callback target catalog")
    const frozenLegacyCoordinates = collectFrozenLegacyCoordinates(
        publicManifest,
        frozenLegacySurface,
    )
    assertLegacyDispositionCatalog(
        publicManifest.entries,
        publicIds,
        expectedFrozenLegacyCoordinates(frozenLegacySurface),
        legacyDispositionCatalog,
    )
    for (const entry of publicManifest.entries) {
        assertReleaseTrackInvariant(entry, independentBetaPublicIds)
        for (const replacementId of entry.migration.replacementIds) {
            assert(
                publicIds.has(replacementId),
                `${entry.id} refers to missing replacement ${replacementId}`,
            )
        }
        for (const contractId of entry.contractIds) {
            assert(
                catalogIds.has(contractId),
                `${entry.id} refers to uncatalogued contract ${contractId}`,
            )
        }
        assertTargetInvariant(entry)
    }

    for (const entry of callbackManifest.entries) {
        assert(
            publicIds.has(entry.apiEntryId),
            `${entry.id} refers to missing API entry ${entry.apiEntryId}`,
        )
        for (const contractId of entry.requiredContractIds) {
            assert(
                catalogIds.has(contractId),
                `${entry.id} refers to uncatalogued contract ${contractId}`,
            )
        }
    }
    assertCallbackErrorOwnership(callbackManifest.entries)
    assertStoreSubscriberContract(
        publicManifest.entries,
        callbackManifest.entries,
    )

    assertFrozenReleaseTrackOwnership(
        publicManifest,
        callbackManifest,
        targetSurfaceCatalog,
    )

    if (publicManifest.generatedAgainst.currentShiftX.status === "complete") {
        assertReviewedCurrentShiftXEvidence(
            publicManifest.generatedAgainst.currentShiftX.evidence,
        )
    }

    const completeness = [
        publicManifest.completeness,
        callbackManifest.completeness,
        contractCatalog.completeness,
        targetSurfaceCatalog.completeness,
    ] as const
    if (completeness.includes("complete")) {
        assert(
            completeness.every(value => value === "complete"),
            "public, callback, contract-catalog, and target-surface-catalog manifests must become complete together",
        )
        assertComplete(
            publicManifest,
            callbackManifest,
            contractCatalog,
            frozenLegacySurface,
            frozenLegacyCoordinates,
            legacyDispositionCatalog,
            targetSurfaceCatalog,
            independentBetaPublicIds,
        )
    }

    return {
        publicEntries: publicManifest.entries.length,
        callbackEntries: callbackManifest.entries.length,
        contractIds: contractCatalog.contractIds.length,
        completeness: completeness.join(
            "/",
        ) as `${Completeness}/${Completeness}/${Completeness}/${Completeness}`,
        ...testDispositionResult,
    }
}

function assertCallbackErrorOwnership(
    callbackEntries: readonly CallbackEntry[],
): void {
    const callbacksById = new Map(
        callbackEntries.map(entry => [entry.id, entry] as const),
    )
    for (const [id, requiredErrorName] of requiredCallbackPhaseErrors) {
        const entry = callbacksById.get(id)
        assert(entry !== undefined, `missing callback capability ${id}`)
        assert(
            entry.errorRule.includes(requiredErrorName) &&
                !entry.errorRule.includes("CallbackCapabilityError"),
            `${id} must retain ${requiredErrorName} instead of the generic callback capability error`,
        )
    }
    for (const [id, requiredErrorName] of requiredCallbackOutcomeErrors) {
        const entry = callbacksById.get(id)
        assert(entry !== undefined, `missing callback capability ${id}`)
        assert(
            entry.thenableRule.includes(requiredErrorName),
            `${id} must retain outcome error ${requiredErrorName}`,
        )
    }
    const atomComparator = callbacksById.get("callback.atom-comparator")!
    assert(
        atomComparator.resultBoundary.includes(
            "InvalidAtomComparatorResultError",
        ),
        "callback.atom-comparator must reject every non-boolean result as InvalidAtomComparatorResultError",
    )
    for (const entry of callbackEntries) {
        const serializedEntry = JSON.stringify(entry)
        for (const runtimeErrorName of runtimeOwnedExternalErrorNames) {
            assert(
                !serializedEntry.includes(runtimeErrorName),
                `${entry.id} cannot own runtime activity error ${runtimeErrorName}`,
            )
        }
    }
}

function assertStoreSubscriberContract(
    publicEntries: readonly PublicEntry[],
    callbackEntries: readonly CallbackEntry[],
): void {
    const publicById = new Map(
        publicEntries.map(entry => [entry.id, entry] as const),
    )
    const callback = callbackEntries.find(
        entry => entry.id === "callback.store-subscriber",
    )
    assert(callback !== undefined, "missing callback.store-subscriber")
    assert(
        callback.apiEntryId === "core.store.sub" &&
            callback.role === storeSubscriberContract.role &&
            callback.phase === "notifying" &&
            JSON.stringify(callback.suppliedCapabilities) ===
                JSON.stringify(storeSubscriberContract.suppliedCapabilities) &&
            JSON.stringify(callback.allowedExternalWork) ===
                JSON.stringify(storeSubscriberContract.allowedExternalWork) &&
            JSON.stringify(callback.rejectedCapturedOperations) ===
                JSON.stringify(
                    storeSubscriberContract.rejectedCapturedOperations,
                ) &&
            callback.guardDomain === "same-runtime-domain" &&
            callback.errorRule === storeSubscriberContract.errorRule &&
            callback.thenableRule === storeSubscriberContract.thenableRule &&
            callback.resultBoundary ===
                storeSubscriberContract.resultBoundary &&
            JSON.stringify(callback.requiredContractIds) ===
                JSON.stringify(storeSubscriberContract.requiredContractIds) &&
            callback.decisionStatus === "approved",
        "callback.store-subscriber differs from the frozen zero-argument invalidator, quarantine, ordering, all-fire, or unsubscribe contract",
    )

    const storeSub = publicById.get("core.store.sub")
    const subscribeFn = publicById.get("core.type.subscribe-fn")
    const notificationError = publicById.get(
        "core.subscriber-notification-error",
    )
    assert(
        storeSub?.notes === storeSubscriberContract.storeNotes &&
            subscribeFn?.notes === storeSubscriberContract.typeNotes,
        "Store.sub and SubscribeFn differ from the frozen zero-argument subscription signature or delivery contract",
    )
    assert(
        notificationError?.owner === "core" &&
            notificationError.kind === "error" &&
            notificationError.errorCode === "VALDRES_SUBSCRIBER_NOTIFICATION" &&
            notificationError.target.package === "valdres" &&
            notificationError.target.subpath === "." &&
            notificationError.target.name === "SubscriberNotificationError" &&
            notificationError.target.status === "stable" &&
            notificationError.notes === storeSubscriberContract.errorNotes &&
            JSON.stringify(notificationError.contractIds) ===
                JSON.stringify([
                    "callback.subscriber-quarantine",
                    "error.stable-name-and-code",
                    "notification.after-stability",
                ]) &&
            notificationError.decisionStatus === "approved",
        "SubscriberNotificationError differs from the frozen class, code, cause ledger, or committed notification metadata contract",
    )
}

function assertFrozenPublicCoordinates(
    publicEntries: readonly PublicEntry[],
    targetPublicIds: ReadonlySet<string>,
    coordinates: readonly FrozenPublicCoordinate[],
): void {
    const coordinatesById = new Map<string, FrozenPublicCoordinate>()
    for (const coordinate of coordinates) {
        assert(
            coordinate.errorCode === undefined || coordinate.kind === "error",
            `${coordinate.id} has an error code but is not an error coordinate`,
        )
        assert(
            coordinate.allowedValues === undefined ||
                coordinate.kind === "option",
            `${coordinate.id} has allowed values but is not an option coordinate`,
        )
        assert(
            coordinate.parameters === undefined ||
                coordinate.kind === "runtime-export",
            `${coordinate.id} has parameters but is not a runtime-export coordinate`,
        )
        assert(
            !coordinatesById.has(coordinate.id),
            `duplicate frozen public coordinate ${coordinate.id}`,
        )
        assert(
            targetPublicIds.has(coordinate.id),
            `frozen public coordinate ${coordinate.id} is absent from the target public API catalog`,
        )
        coordinatesById.set(coordinate.id, coordinate)
    }
    assertContainsAll(
        new Set(coordinatesById.keys()),
        new Set(requiredFrozenPublicCoordinates.keys()),
        "frozen standalone collection coordinate",
    )
    for (const [id, required] of requiredFrozenPublicCoordinates) {
        const coordinate = coordinatesById.get(id)!
        assert(
            coordinate.package === required.package &&
                coordinate.subpath === required.subpath &&
                coordinate.name === required.name,
            `${id} frozen target catalog coordinate differs from the required standalone spelling`,
        )
    }

    const publicEntriesById = new Map(
        publicEntries.map(entry => [entry.id, entry] as const),
    )
    for (const entry of publicEntries) {
        assert(
            entry.errorCode === undefined || entry.kind === "error",
            `${entry.id} has an error code but is not an error entry`,
        )
        assert(
            entry.allowedValues === undefined || entry.kind === "option",
            `${entry.id} has allowed values but is not an option entry`,
        )
        assert(
            entry.parameters === undefined || entry.kind === "runtime-export",
            `${entry.id} has parameters but is not a runtime-export entry`,
        )
    }
    assertExactSet(
        new Set(
            coordinates
                .filter(coordinate => coordinate.errorCode !== undefined)
                .map(coordinate => coordinate.id),
        ),
        new Set(requiredFrozenErrorCodes.keys()),
        "frozen error code coordinate",
    )
    assertExactSet(
        new Set(
            publicEntries
                .filter(entry => entry.errorCode !== undefined)
                .map(entry => entry.id),
        ),
        new Set(requiredFrozenErrorCodes.keys()),
        "public error code entry",
    )
    assertExactSet(
        new Set(
            coordinates
                .filter(coordinate => coordinate.allowedValues !== undefined)
                .map(coordinate => coordinate.id),
        ),
        new Set(requiredFrozenAllowedValues.keys()),
        "frozen finite option value coordinate",
    )
    assertExactSet(
        new Set(
            publicEntries
                .filter(entry => entry.allowedValues !== undefined)
                .map(entry => entry.id),
        ),
        new Set(requiredFrozenAllowedValues.keys()),
        "public finite option value entry",
    )
    assertExactSet(
        new Set(
            coordinates
                .filter(coordinate => coordinate.parameters !== undefined)
                .map(coordinate => coordinate.id),
        ),
        new Set(requiredFrozenParameters.keys()),
        "frozen call-parameter coordinate",
    )
    assertExactSet(
        new Set(
            publicEntries
                .filter(entry => entry.parameters !== undefined)
                .map(entry => entry.id),
        ),
        new Set(requiredFrozenParameters.keys()),
        "public call-parameter entry",
    )
    for (const entry of publicEntries) {
        if (
            entry.decisionStatus === "approved" &&
            ["stable", "experimental", "internal"].includes(entry.target.status)
        ) {
            assert(
                coordinatesById.has(entry.id),
                `${entry.id} has an approved ${entry.target.status} target absent from the independent target coordinate catalog`,
            )
        }
    }
    for (const coordinate of coordinates) {
        const entry = publicEntriesById.get(coordinate.id)
        assert(
            entry !== undefined,
            `frozen public coordinate ${coordinate.id} has no public manifest entry`,
        )
        const target = entry.target
        assert(
            entry.kind === coordinate.kind &&
                target.package === coordinate.package &&
                target.subpath === coordinate.subpath &&
                target.name === coordinate.name &&
                entry.errorCode === coordinate.errorCode &&
                JSON.stringify(entry.allowedValues) ===
                    JSON.stringify(coordinate.allowedValues) &&
                JSON.stringify(entry.parameters) ===
                    JSON.stringify(coordinate.parameters),
            `${coordinate.id} target coordinate differs from the frozen target catalog` +
                `; expected ${coordinate.kind}:${coordinate.package}:${coordinate.subpath}:${coordinate.name}` +
                `; received ${entry.kind}:${String(target.package)}:${String(target.subpath)}:${String(target.name)}`,
        )
    }
    const errorCodes = new Set<string>()
    for (const [id, requiredCode] of requiredFrozenErrorCodes) {
        const coordinate = coordinatesById.get(id)!
        const entry = publicEntriesById.get(id)!
        assert(
            coordinate.errorCode === requiredCode &&
                entry.errorCode === requiredCode,
            `${id} differs from the required stable error code ${requiredCode}`,
        )
        assert(
            !errorCodes.has(requiredCode),
            `duplicate frozen public error code ${requiredCode}`,
        )
        errorCodes.add(requiredCode)
    }
    for (const [id, requiredContractIds] of requiredExecutionErrorContracts) {
        const entry = publicEntriesById.get(id)!
        assert(
            JSON.stringify(entry.contractIds) ===
                JSON.stringify(requiredContractIds),
            `${id} differs from the required execution-error contract ownership`,
        )
    }
    for (const [id, requiredValues] of requiredFrozenAllowedValues) {
        const coordinate = coordinatesById.get(id)!
        const entry = publicEntriesById.get(id)!
        assert(
            JSON.stringify(coordinate.allowedValues) ===
                JSON.stringify(requiredValues) &&
                JSON.stringify(entry.allowedValues) ===
                    JSON.stringify(requiredValues),
            `${id} differs from the required finite option values ${JSON.stringify(requiredValues)}`,
        )
    }
    for (const [id, requiredParameters] of requiredFrozenParameters) {
        const coordinate = coordinatesById.get(id)!
        const entry = publicEntriesById.get(id)!
        assert(
            JSON.stringify(coordinate.parameters) ===
                JSON.stringify(requiredParameters) &&
                JSON.stringify(entry.parameters) ===
                    JSON.stringify(requiredParameters),
            `${id} differs from the required call parameters ${JSON.stringify(requiredParameters)}`,
        )
    }
    for (const [id, requiredStatus] of requiredFrozenTargetStatuses) {
        const entry = publicEntriesById.get(id)!
        assert(
            entry.target.status === requiredStatus,
            `${id} must remain ${requiredStatus}`,
        )
    }
    const inventorySha256 = createHash("sha256")
        .update(
            coordinates
                .map(coordinate =>
                    JSON.stringify([
                        coordinate.id,
                        coordinate.kind,
                        coordinate.package,
                        coordinate.subpath,
                        coordinate.name,
                        coordinate.errorCode ?? null,
                        coordinate.allowedValues ?? null,
                        coordinate.parameters ?? null,
                    ]),
                )
                .sort()
                .join("\n") + "\n",
        )
        .digest("hex")
    assert(
        inventorySha256 === frozenTargetCoordinateInventorySha256,
        "frozen target coordinate inventory differs from the independently pinned digest" +
            `; expected ${frozenTargetCoordinateInventorySha256}; received ${inventorySha256}`,
    )
}

function assertFrozenReleaseTrackOwnership(
    publicManifest: PublicManifest,
    callbackManifest: CallbackManifest,
    targetSurfaceCatalog: TargetSurfaceCatalog,
): void {
    const ownershipSha256 = createHash("sha256")
        .update(
            JSON.stringify({
                publicEntries: publicManifest.entries
                    .map(entry =>
                        JSON.stringify([
                            entry.id,
                            entry.owner,
                            entry.kind,
                            entry.target.status,
                            entry.migration.mode,
                            [...entry.migration.replacementIds].sort(),
                            entry.errorCode ?? null,
                            entry.allowedValues ?? null,
                            entry.parameters ?? null,
                        ]),
                    )
                    .sort(),
                callbackEntries: callbackManifest.entries
                    .map(entry => JSON.stringify([entry.id, entry.apiEntryId]))
                    .sort(),
                publicApiIds: [...targetSurfaceCatalog.publicApiIds].sort(),
                callbackIds: [...targetSurfaceCatalog.callbackIds].sort(),
                independentBetaPublicApiIds: [
                    ...targetSurfaceCatalog.independentBetaPublicApiIds,
                ].sort(),
                pendingSurfaceDecisions:
                    targetSurfaceCatalog.pendingSurfaceDecisions
                        .map(decision =>
                            JSON.stringify([
                                decision.id,
                                decision.category,
                                decision.status,
                            ]),
                        )
                        .sort(),
            }) + "\n",
        )
        .digest("hex")
    assert(
        ownershipSha256 === frozenReleaseTrackOwnershipSha256,
        "reviewed release-track ownership differs from the independently pinned digest" +
            `; expected ${frozenReleaseTrackOwnershipSha256}; received ${ownershipSha256}`,
    )
}

function assertTestDispositionLedger(
    ledger: TestDispositionLedger,
    catalogIds: ReadonlySet<string>,
    inventoryEvidence: TestDispositionInventoryEvidence | null,
    testOwnerEvidence: readonly TestOwnerEvidence[] | null,
    frozenCorePublishedArtifact: Readonly<{
        npmSpec: string
        sha256: string
    }>,
): Readonly<{
    testDispositions: number
    testDispositionCounts: Readonly<Record<Disposition, number>>
    testDispositionNeedsReview: number
    testOwners: number
    testDispositionCompleteness: Completeness
    testInventorySubjects: number | null
    testDispositionScopeSubjects: number | null
    testClassificationRemaining: number | null
    testCaseClassificationRemaining: number | null
    testFileClassificationRemaining: number | null
    productionSourceSubjects: number | null
}> {
    assert(
        ledger[0].recordType === "header",
        "test-disposition header must be the first JSONL record",
    )
    const [header, ...records] = ledger
    const dispositions = records.filter(
        (record): record is TestDispositionEntry =>
            record.recordType === "disposition",
    )
    const owners = records.filter(
        (record): record is TestOwnerEntry =>
            record.recordType === "test-owner",
    )
    const dispositionIds = uniqueIds(dispositions, "test disposition")
    const ownerIds = new Set<string>()
    const ownersById = new Map<string, TestOwnerEntry>()

    for (const owner of owners) {
        assert(!ownerIds.has(owner.id), `duplicate test owner ${owner.id}`)
        ownerIds.add(owner.id)
        ownersById.set(owner.id, owner)
        for (const contractId of owner.contractIds) {
            assert(
                catalogIds.has(contractId),
                `${owner.id} refers to uncatalogued contract ${contractId}`,
            )
        }
        if (owner.status === "planned") {
            assert(
                owner.testName === null,
                `${owner.id} planned test owner cannot claim a test name`,
            )
        } else {
            assert(
                typeof owner.testName === "string" &&
                    owner.testName.includes(owner.id),
                `${owner.id} implemented test name must contain its stable ID`,
            )
        }
    }
    assertImplementedTestOwners(owners, testOwnerEvidence)

    const dispositionCounts: Record<Disposition, number> = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        E: 0,
    }
    let needsReviewCount = 0
    const subjectCoordinates = new Set<string>()
    for (const entry of dispositions) {
        dispositionCounts[entry.disposition] += 1
        if (entry.needsReview !== undefined) {
            needsReviewCount += 1
            assert(
                entry.reviewStatus === "proposed",
                `${entry.id} cannot be approved while it needs human judgment`,
            )
        }
        if (entry.subject.kind === "test-case") {
            assert(
                typeof entry.subject.testName === "string",
                `${entry.id} test-case disposition requires a test name`,
            )
        } else {
            assert(
                entry.subject.testName === undefined,
                `${entry.id} non-test-case disposition cannot name a test`,
            )
        }
        const coordinate = JSON.stringify([
            entry.subject.origin,
            entry.subject.kind,
            entry.subject.path,
            entry.subject.testName ?? null,
        ])
        assert(
            !subjectCoordinates.has(coordinate),
            `${entry.id} duplicates a disposition subject ${coordinate}`,
        )
        subjectCoordinates.add(coordinate)

        for (const contractId of entry.contractIds) {
            assert(
                catalogIds.has(contractId),
                `${entry.id} refers to uncatalogued contract ${contractId}`,
            )
        }
        for (const ownerId of entry.ownerIds) {
            assert(
                ownerIds.has(ownerId),
                `${entry.id} refers to missing test owner ${ownerId}`,
            )
        }

        if (entry.reviewStatus !== "approved") continue
        if (entry.disposition === "A" || entry.disposition === "B") {
            assert(
                entry.contractIds.length > 0,
                `${entry.id} ${entry.disposition} disposition requires a contract`,
            )
            assert(
                entry.ownerIds.length > 0,
                `${entry.id} ${entry.disposition} disposition requires a test owner`,
            )
            const ownedContracts = new Set(
                entry.ownerIds.flatMap(
                    ownerId => ownersById.get(ownerId)?.contractIds ?? [],
                ),
            )
            assertContainsAll(
                ownedContracts,
                new Set(entry.contractIds),
                `${entry.id} owner contract`,
            )
        }
        if (entry.disposition === "C") {
            assert(
                entry.destination !== null,
                `${entry.id} C disposition requires a destination`,
            )
        }
    }

    const inventoryResult =
        header.inventory.status === "frozen"
            ? assertFrozenTestInventory(
                  header.inventory,
                  dispositions,
                  dispositionIds,
                  inventoryEvidence,
                  header.classificationScope,
                  frozenCorePublishedArtifact,
              )
            : null
    if (header.inventory.status !== "frozen") {
        assert(
            inventoryEvidence === null,
            "pending test-disposition inventory cannot carry frozen evidence",
        )
    }
    if (header.completeness === "complete") {
        assert(
            header.inventory.status === "frozen",
            "a complete test-disposition ledger requires a frozen source inventory",
        )
        assert(
            dispositions.length > 0,
            "a complete test-disposition ledger cannot be empty",
        )
        assert(
            dispositions.every(entry => entry.reviewStatus === "approved"),
            "a complete test-disposition ledger cannot contain proposed rows",
        )
        assert(
            owners.every(owner => owner.status === "implemented"),
            "a complete test-disposition ledger cannot contain planned test owners",
        )
        assert(
            inventoryResult?.classificationRemaining === 0,
            "a complete test-disposition ledger requires exact frozen test-subject parity",
        )
    }

    return {
        testDispositions: dispositions.length,
        testDispositionCounts: dispositionCounts,
        testDispositionNeedsReview: needsReviewCount,
        testOwners: owners.length,
        testDispositionCompleteness: header.completeness,
        testInventorySubjects: inventoryResult?.subjects ?? null,
        testDispositionScopeSubjects: inventoryResult?.scopeSubjects ?? null,
        testClassificationRemaining:
            inventoryResult?.classificationRemaining ?? null,
        testCaseClassificationRemaining:
            inventoryResult?.testCaseClassificationRemaining ?? null,
        testFileClassificationRemaining:
            inventoryResult?.testFileClassificationRemaining ?? null,
        productionSourceSubjects:
            inventoryResult?.productionSourceSubjects ?? null,
    }
}

function assertImplementedTestOwners(
    owners: readonly TestOwnerEntry[],
    evidence: readonly TestOwnerEvidence[] | null,
): void {
    const evidenceByPath = new Map<string, TestOwnerEvidence>()
    for (const entry of evidence ?? []) {
        assert(
            typeof entry.path === "string" &&
                typeof entry.source === "string" &&
                Array.isArray(entry.passedTestNames) &&
                entry.passedTestNames.every(name => typeof name === "string"),
            "test owner evidence must contain source and passed-test fields",
        )
        assert(
            !evidenceByPath.has(entry.path),
            `duplicate test owner evidence for ${entry.path}`,
        )
        evidenceByPath.set(entry.path, entry)
    }

    const canonicalNamesByPath = new Map<string, ReadonlySet<string>>()
    for (const owner of owners) {
        if (owner.status !== "implemented") continue
        const ownerEvidence = evidenceByPath.get(owner.path)
        assert(
            ownerEvidence !== undefined,
            `${owner.id} implemented test owner requires independently loaded source evidence for ${owner.path}`,
        )
        let canonicalNames = canonicalNamesByPath.get(owner.path)
        if (canonicalNames === undefined) {
            canonicalNames = collectCanonicalTestNames(
                owner.path,
                ownerEvidence.source,
            )
            canonicalNamesByPath.set(owner.path, canonicalNames)
        }
        assert(
            owner.testName !== null && canonicalNames.has(owner.testName),
            `${owner.id} implemented test name is not present in ${owner.path}: ${owner.testName ?? "null"}`,
        )
        assert(
            owner.testName !== null &&
                ownerEvidence.passedTestNames.includes(owner.testName),
            `${owner.id} implemented test did not execute and pass in ${owner.path}: ${owner.testName ?? "null"}`,
        )
    }
}

function collectCanonicalTestNames(
    path: string,
    source: string,
): ReadonlySet<string> {
    const sourceFile = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const names = new Set<string>()

    const visit = (node: ts.Node, describeNames: readonly string[]): void => {
        if (ts.isCallExpression(node)) {
            const callName = ts.isIdentifier(node.expression)
                ? node.expression.text
                : null
            const declaredName = literalText(node.arguments[0])
            if (callName === "describe" && declaredName !== null) {
                const callback = node.arguments[1]
                if (
                    callback !== undefined &&
                    (ts.isArrowFunction(callback) ||
                        ts.isFunctionExpression(callback)) &&
                    ts.isBlock(callback.body)
                ) {
                    const nestedNames = [...describeNames, declaredName]
                    ts.forEachChild(callback.body, child =>
                        visit(child, nestedNames),
                    )
                }
                return
            }
            if (
                (callName === "test" || callName === "it") &&
                declaredName !== null
            ) {
                names.add([...describeNames, declaredName].join(" > "))
                return
            }
        }
        ts.forEachChild(node, child => visit(child, describeNames))
    }

    visit(sourceFile, [])
    return names
}

function literalText(node: ts.Expression | undefined): string | null {
    return node !== undefined &&
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        ? node.text
        : null
}

function assertFrozenTestInventory(
    frozen: FrozenTestDispositionInventory,
    dispositions: readonly TestDispositionEntry[],
    dispositionIds: ReadonlySet<string>,
    evidence: TestDispositionInventoryEvidence | null,
    classificationScope: TestDispositionHeader["classificationScope"],
    frozenCorePublishedArtifact: Readonly<{
        npmSpec: string
        sha256: string
    }>,
): Readonly<{
    subjects: number
    scopeSubjects: number
    classificationRemaining: number
    testCaseClassificationRemaining: number
    testFileClassificationRemaining: number
    productionSourceSubjects: number
}> {
    assert(
        evidence !== null,
        "a frozen test-disposition inventory requires independently loaded catalog evidence",
    )
    assert(
        evidence.catalogPath === frozen.catalogPath,
        "test-disposition inventory evidence path does not match its frozen header",
    )
    assert(
        evidence.bytes instanceof Uint8Array,
        "test-disposition inventory evidence must contain exact file bytes",
    )
    const digest = createHash("sha256").update(evidence.bytes).digest("hex")
    assert(
        digest === frozen.sha256,
        "test-disposition inventory evidence does not match its frozen SHA-256",
    )

    let source: string
    try {
        source = new TextDecoder("utf-8", { fatal: true }).decode(
            evidence.bytes,
        )
    } catch {
        throw new Error("frozen test inventory is not valid UTF-8")
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(source) as unknown
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`frozen test inventory is invalid JSON: ${detail}`)
    }
    assertSchema(validateFrozenTestInventory, parsed, frozen.catalogPath)
    const inventory = parsed as FrozenTestInventory
    assert(
        inventory.provenance.publishedPackage.npmSpec ===
            frozenCorePublishedArtifact.npmSpec &&
            inventory.provenance.publishedPackage.tarballSha256 ===
                frozenCorePublishedArtifact.sha256,
        "frozen test inventory published package differs from the frozen legacy artifact",
    )
    uniqueIds(inventory.entries, "frozen test inventory")
    const inventoryTestSubjectIds = new Set(
        inventory.entries
            .filter(entry => entry.subject.kind !== "production-file")
            .map(entry => entry.id),
    )
    assertExactLedgerInventory(
        new Set(frozen.expectedDispositionIds),
        inventoryTestSubjectIds,
    )
    assertInventorySubset(dispositionIds, inventoryTestSubjectIds)
    assertExactLedgerInventory(dispositionIds, inventoryTestSubjectIds)

    const dispositionsById = new Map(dispositions.map(row => [row.id, row]))
    const sourceCoordinates = new Set<string>()
    for (const entry of inventory.entries) {
        const coordinate = subjectCoordinate(entry.subject)
        assert(
            !sourceCoordinates.has(coordinate),
            `${entry.id} duplicates a frozen inventory subject ${coordinate}`,
        )
        sourceCoordinates.add(coordinate)
        const disposition = dispositionsById.get(entry.id)
        if (disposition !== undefined) {
            assert(
                subjectCoordinate(disposition.subject) === coordinate,
                `${entry.id} disposition subject differs from frozen inventory`,
            )
        }
    }

    const productionFiles = inventory.entries.filter(
        entry => entry.subject.kind === "production-file",
    ).length
    const testFileEntries = inventory.entries.filter(
        entry => entry.subject.kind === "test-file",
    )
    const testFiles = testFileEntries.length
    const testCases = inventory.entries.filter(
        entry => entry.subject.kind === "test-case",
    ).length
    const inventoryTestCaseIds = new Set(
        inventory.entries
            .filter(entry => entry.subject.kind === "test-case")
            .map(entry => entry.id),
    )
    const dispositionTestCaseIds = new Set(
        dispositions
            .filter(entry => entry.subject.kind === "test-case")
            .map(entry => entry.id),
    )
    const inventoryTestFileIds = new Set(testFileEntries.map(entry => entry.id))
    const dispositionTestFileIds = new Set(
        dispositions
            .filter(entry => entry.subject.kind === "test-file")
            .map(entry => entry.id),
    )
    assertInventorySubset(dispositionTestCaseIds, inventoryTestCaseIds)
    assertInventorySubset(dispositionTestFileIds, inventoryTestFileIds)
    assertExactLedgerInventory(dispositionTestCaseIds, inventoryTestCaseIds)
    assertExactLedgerInventory(dispositionTestFileIds, inventoryTestFileIds)
    assert(
        classificationScope.testCases === "complete" &&
            classificationScope.testFiles === "complete" &&
            classificationScope.productionFiles === "separate-artifact-pending",
        "test-disposition classification scope differs from the frozen test-subject split",
    )
    assert(
        dispositions.every(
            entry =>
                entry.subject.kind === "test-case" ||
                entry.subject.kind === "test-file",
        ),
        "the test-subject ledger cannot classify production files owned by the separate production-source artifact",
    )
    assert(
        inventory.counts.productionFiles === productionFiles &&
            inventory.counts.testFiles === testFiles &&
            inventory.counts.testCases === testCases &&
            inventory.counts.total === inventory.entries.length &&
            productionFiles + testFiles + testCases ===
                inventory.entries.length,
        "frozen test inventory derived counts differ from its entries",
    )
    assert(
        inventory.provenance.testRegistration.tests === testCases,
        "frozen test inventory registration count differs from test-case entries",
    )
    assert(
        inventory.provenance.testRegistration.files ===
            inventory.provenance.testRegistration.registeredFiles +
                inventory.provenance.testRegistration.zeroRegistrationFiles
                    .length,
        "frozen test inventory test-file registration counts are inconsistent",
    )
    assertExactLedgerInventory(
        new Set(testFileEntries.map(entry => entry.subject.path)),
        new Set(inventory.provenance.testRegistration.zeroRegistrationFiles),
    )

    return {
        subjects: inventory.entries.length,
        scopeSubjects: inventoryTestSubjectIds.size,
        classificationRemaining:
            inventoryTestSubjectIds.size - dispositions.length,
        testCaseClassificationRemaining:
            inventoryTestCaseIds.size - dispositionTestCaseIds.size,
        testFileClassificationRemaining:
            inventoryTestFileIds.size - dispositionTestFileIds.size,
        productionSourceSubjects: productionFiles,
    }
}

function assertInventorySubset(
    actual: ReadonlySet<string>,
    inventory: ReadonlySet<string>,
): void {
    const unexpected = [...actual].filter(value => !inventory.has(value))
    assert(
        unexpected.length === 0,
        "test-disposition ledger contains subjects outside the frozen source catalog" +
            `; unexpected: ${unexpected.join(", ") || "none"}`,
    )
}

function assertExactLedgerInventory(
    actual: ReadonlySet<string>,
    expected: ReadonlySet<string>,
): void {
    const missing = [...expected].filter(value => !actual.has(value))
    const unexpected = [...actual].filter(value => !expected.has(value))
    assert(
        missing.length === 0 && unexpected.length === 0,
        "test-disposition inventory differs from its frozen source catalog" +
            `; missing: ${missing.join(", ") || "none"}` +
            `; unexpected: ${unexpected.join(", ") || "none"}`,
    )
}

function subjectCoordinate(subject: TestSubject): string {
    return JSON.stringify([
        subject.origin,
        subject.kind,
        subject.path,
        subject.testName ?? null,
    ])
}

function assertFrozenLegacySurface(
    frozenLegacySurface: FrozenLegacySurface,
): void {
    const packageNames = uniqueCoordinates(
        frozenLegacySurface.packages.map(
            frozenPackage => frozenPackage.package,
        ),
        "frozen legacy package",
    )
    assertExactSet(
        packageNames,
        new Set(frozenLegacySubpaths.keys()),
        "frozen legacy package",
    )

    for (const frozenPackage of frozenLegacySurface.packages) {
        const expectedSubpaths = frozenLegacySubpaths.get(
            frozenPackage.package as "valdres" | "valdres-react",
        )!
        const subpaths = uniqueCoordinates(
            frozenPackage.entrypoints.map(entrypoint => entrypoint.subpath),
            `${frozenPackage.package} frozen legacy subpath`,
        )
        assertExactSet(
            subpaths,
            expectedSubpaths,
            `${frozenPackage.package} frozen legacy subpath`,
        )
        assertFrozenLegacyGitProvenance(frozenPackage)
    }

    const coordinates = expectedFrozenLegacyCoordinates(frozenLegacySurface)
    const inventorySha256 = createHash("sha256")
        .update([...coordinates].sort().join("\n") + "\n")
        .digest("hex")
    assert(
        inventorySha256 === frozenLegacyCoordinateInventorySha256,
        "frozen legacy coordinate inventory differs from the independently pinned digest" +
            `; expected ${frozenLegacyCoordinateInventorySha256}; received ${inventorySha256}`,
    )

    const provenanceSha256 = createHash("sha256")
        .update(
            frozenLegacySurface.packages
                .map(frozenPackage => {
                    const { provenance } = frozenPackage
                    const publishedArtifact =
                        provenance.publishedArtifact.status === "verified"
                            ? JSON.stringify([
                                  provenance.publishedArtifact.status,
                                  provenance.publishedArtifact.npmSpec,
                                  provenance.publishedArtifact.integrity,
                                  provenance.publishedArtifact.sha256,
                              ])
                            : JSON.stringify([
                                  provenance.publishedArtifact.status,
                                  provenance.publishedArtifact.notes,
                              ])
                    return JSON.stringify([
                        frozenPackage.package,
                        frozenPackage.baseline,
                        provenance.sourceRevision,
                        provenance.releaseRevision,
                        provenance.sourcePackageTreeSha1,
                        provenance.releasePackageTreeSha1,
                        provenance.sourceTreeSha1,
                        provenance.sourcePackageJsonBlobSha1,
                        provenance.releasePackageJsonBlobSha1,
                        provenance.entrypointBlobs
                            .map(blob =>
                                JSON.stringify([
                                    blob.subpath,
                                    blob.path,
                                    blob.gitBlobSha1,
                                ]),
                            )
                            .sort(),
                        provenance.surfaceBlobs
                            .map(blob =>
                                JSON.stringify([blob.path, blob.gitBlobSha1]),
                            )
                            .sort(),
                        publishedArtifact,
                    ])
                })
                .sort()
                .join("\n") + "\n",
        )
        .digest("hex")
    assert(
        provenanceSha256 === frozenLegacyProvenanceInventorySha256,
        "frozen legacy provenance inventory differs from the independently pinned digest" +
            `; expected ${frozenLegacyProvenanceInventorySha256}; received ${provenanceSha256}`,
    )
}

function assertFrozenLegacyPublicArtifact(
    publicManifest: PublicManifest,
    frozenLegacySurface: FrozenLegacySurface,
): Readonly<{ npmSpec: string; sha256: string }> {
    const frozenCore = frozenLegacySurface.packages.find(
        frozenPackage => frozenPackage.package === "valdres",
    )
    assert(frozenCore !== undefined, "frozen legacy core package is missing")
    const artifact = frozenCore.provenance.publishedArtifact
    assert(
        artifact.status === "verified",
        "frozen legacy core package requires a verified published artifact",
    )
    const declared = publicManifest.generatedAgainst.frozenLegacy
    const expectedRegistryTarball = `https://registry.npmjs.org/valdres/-/valdres-${frozenCore.baseline}.tgz`
    assert(
        declared.packageVersion === frozenCore.baseline &&
            declared.npmSpec === artifact.npmSpec &&
            declared.registryTarball === expectedRegistryTarball &&
            declared.integrity === artifact.integrity &&
            declared.sha256 === artifact.sha256,
        "public manifest frozen legacy artifact differs from the independently pinned legacy provenance",
    )
    return Object.freeze({
        npmSpec: artifact.npmSpec,
        sha256: artifact.sha256,
    })
}

function assertComplete(
    publicManifest: PublicManifest,
    callbackManifest: CallbackManifest,
    contractCatalog: ContractCatalog,
    frozenLegacySurface: FrozenLegacySurface,
    frozenLegacyCoordinates: ReadonlySet<string>,
    legacyDispositionCatalog: LegacyDispositionCatalog,
    targetSurfaceCatalog: TargetSurfaceCatalog,
    independentBetaPublicIds: ReadonlySet<string>,
): void {
    const stablePublicEntries = publicManifest.entries.filter(
        entry => !independentBetaPublicIds.has(entry.id),
    )
    const stableCallbackEntries = callbackManifest.entries.filter(
        entry => !independentBetaPublicIds.has(entry.apiEntryId),
    )
    assert(
        publicManifest.entries.length > 0,
        "complete public manifest is empty",
    )
    assert(
        callbackManifest.entries.length > 0,
        "complete callback manifest is empty",
    )
    assert(
        contractCatalog.contractIds.length > 0,
        "complete contract catalog is empty",
    )
    assert(
        stablePublicEntries.every(entry => entry.decisionStatus === "approved"),
        "a complete public manifest cannot contain unresolved decisions",
    )
    assert(
        stablePublicEntries.every(entry => entry.target.status !== "pending"),
        "a complete public manifest cannot contain pending targets",
    )
    assert(
        stablePublicEntries.every(entry =>
            ["not-required", "complete"].includes(
                entry.migration.evidenceStatus,
            ),
        ),
        "a complete public manifest requires completed or explicitly unnecessary migration evidence",
    )
    assert(
        publicManifest.generatedAgainst.currentShiftX.status === "complete",
        "a complete public manifest requires current ShiftX evidence",
    )
    assert(
        targetSurfaceCatalog.pendingSurfaceDecisions.length === 0,
        "a complete target surface catalog cannot contain pending spelling decisions",
    )
    assert(
        stableCallbackEntries.every(
            entry => entry.decisionStatus === "approved",
        ),
        "a complete callback manifest cannot contain unresolved decisions",
    )

    assertContainsAll(
        new Set(publicManifest.entries.map(entry => entry.id)),
        requiredPublicIds,
        "public API",
    )
    assertContainsAll(
        new Set(callbackManifest.entries.map(entry => entry.id)),
        requiredCallbackIds,
        "callback capability",
    )
    assertContainsAll(
        new Set(publicManifest.entries.map(entry => entry.kind)),
        requiredKinds,
        "public API kind",
    )

    const expectedLegacyCoordinates =
        expectedFrozenLegacyCoordinates(frozenLegacySurface)
    assertExactSet(
        frozenLegacyCoordinates,
        expectedLegacyCoordinates,
        "frozen legacy coordinate",
    )
    assertExactSet(
        new Set(
            legacyDispositionCatalog.entries.map(entry =>
                legacyCoordinate(entry.coordinate),
            ),
        ),
        expectedLegacyCoordinates,
        "reviewed legacy disposition",
    )
    assert(
        legacyDispositionCatalog.entries.every(
            entry => entry.reviewStatus === "approved",
        ),
        "a complete public manifest requires approved legacy disposition ownership",
    )

    const referencedContracts = new Set([
        ...publicManifest.entries.flatMap(entry => entry.contractIds),
        ...callbackManifest.entries.flatMap(entry => entry.requiredContractIds),
    ])
    assertContainsAll(
        referencedContracts,
        new Set(contractCatalog.contractIds),
        "referenced contract",
    )
}

function collectFrozenLegacyCoordinates(
    publicManifest: PublicManifest,
    frozenLegacySurface: FrozenLegacySurface,
): ReadonlySet<string> {
    const coordinates: string[] = []
    const expected = expectedFrozenLegacyCoordinates(frozenLegacySurface)

    for (const entry of publicManifest.entries) {
        for (const surface of entry.legacy) {
            assertLegacyCoordinateShape(surface)
            const coordinate = legacyCoordinate(surface)
            assert(
                expected.has(coordinate),
                `${entry.id} claims a legacy coordinate absent from the frozen inventory: ${coordinate}`,
            )
            coordinates.push(coordinate)
        }
    }

    return uniqueCoordinates(coordinates, "frozen legacy coordinate")
}

function expectedFrozenLegacyCoordinates(
    frozenLegacySurface: FrozenLegacySurface,
): ReadonlySet<string> {
    return uniqueCoordinates(
        frozenLegacySurface.packages.flatMap(frozenPackage => [
            ...frozenPackage.entrypoints.flatMap(entrypoint => [
                ...entrypoint.runtimeExports.map(name =>
                    legacyCoordinate({
                        kind: "runtime-export",
                        package: frozenPackage.package,
                        subpath: entrypoint.subpath,
                        name,
                        baseline: frozenPackage.baseline,
                    }),
                ),
                ...entrypoint.typeExports.map(name =>
                    legacyCoordinate({
                        kind: "type-export",
                        package: frozenPackage.package,
                        subpath: entrypoint.subpath,
                        name,
                        baseline: frozenPackage.baseline,
                    }),
                ),
            ]),
            ...frozenPackage.members.map(member =>
                legacyCoordinate({
                    ...member,
                    package: frozenPackage.package,
                    baseline: frozenPackage.baseline,
                }),
            ),
            ...frozenPackage.options.map(option =>
                legacyCoordinate({
                    ...option,
                    package: frozenPackage.package,
                    baseline: frozenPackage.baseline,
                }),
            ),
        ]),
        "frozen legacy coordinate",
    )
}

function legacyCoordinate(surface: LegacySurface): string {
    return JSON.stringify([
        surface.kind,
        surface.package,
        surface.subpath,
        surface.owner ?? null,
        surface.name,
        surface.baseline,
    ])
}

function assertLegacyCoordinateShape(surface: LegacySurface): void {
    const isExport =
        surface.kind === "runtime-export" || surface.kind === "type-export"
    assert(
        isExport
            ? surface.owner === undefined
            : isNonblank(surface.owner ?? null),
        `${surface.kind} legacy coordinate has invalid owner provenance`,
    )
}

function assertLegacyDispositionCatalog(
    publicEntries: readonly PublicEntry[],
    publicIds: ReadonlySet<string>,
    frozenCoordinates: ReadonlySet<string>,
    catalog: LegacyDispositionCatalog,
): void {
    const mappings = new Map<string, LegacyDispositionEntry>()
    const publicEntriesById = new Map(
        publicEntries.map(entry => [entry.id, entry] as const),
    )
    for (const mapping of catalog.entries) {
        assertLegacyCoordinateShape(mapping.coordinate)
        const coordinate = legacyCoordinate(mapping.coordinate)
        assert(
            frozenCoordinates.has(coordinate),
            `legacy disposition catalog contains a coordinate absent from the frozen inventory: ${coordinate}`,
        )
        assert(
            !mappings.has(coordinate),
            `duplicate legacy disposition coordinate: ${coordinate}`,
        )
        assert(
            publicIds.has(mapping.dispositionId),
            `legacy disposition ${mapping.dispositionId} has no public manifest entry`,
        )
        const disposition = publicEntriesById.get(mapping.dispositionId)!
        assert(
            disposition.legacy.some(
                surface => legacyCoordinate(surface) === coordinate,
            ),
            `legacy disposition mapping ${coordinate} is missing from ${mapping.dispositionId}`,
        )
        mappings.set(coordinate, mapping)
    }

    for (const entry of publicEntries) {
        for (const surface of entry.legacy) {
            const coordinate = legacyCoordinate(surface)
            const mapping = mappings.get(coordinate)
            assert(
                mapping !== undefined,
                `${entry.id} legacy coordinate has no reviewed disposition mapping: ${coordinate}`,
            )
            assert(
                mapping.dispositionId === entry.id,
                `${entry.id} claims ${coordinate}, but reviewed disposition ownership belongs to ${mapping.dispositionId}`,
            )
        }
    }

    const reviewedDispositionSha256 = createHash("sha256")
        .update(
            catalog.entries
                .map(mapping =>
                    JSON.stringify([
                        mapping.coordinate.kind,
                        mapping.coordinate.package,
                        mapping.coordinate.subpath,
                        mapping.coordinate.owner ?? null,
                        mapping.coordinate.name,
                        mapping.coordinate.baseline,
                        mapping.dispositionId,
                        mapping.reviewStatus,
                    ]),
                )
                .sort()
                .join("\n") + "\n",
        )
        .digest("hex")
    assert(
        reviewedDispositionSha256 === frozenReviewedLegacyDispositionSha256,
        "reviewed legacy disposition ownership differs from the independently pinned digest" +
            `; expected ${frozenReviewedLegacyDispositionSha256}; received ${reviewedDispositionSha256}`,
    )
}

export function assertReviewedCurrentShiftXEvidence(
    evidence: Extract<
        PublicManifest["generatedAgainst"]["currentShiftX"],
        { readonly status: "complete" }
    >["evidence"],
): void {
    assert(
        frozenReviewedCurrentShiftXEvidenceSha256 !== null,
        "current ShiftX evidence has not been independently reviewed and pinned",
    )
    const evidenceSha256 = createHash("sha256")
        .update(
            JSON.stringify([
                evidence.verdict,
                evidence.remote,
                evidence.branch,
                evidence.commit,
                evidence.dirty,
                [evidence.lockfile.path, evidence.lockfile.sha256],
                [evidence.packedArtifact.path, evidence.packedArtifact.sha256],
                [evidence.report.path, evidence.report.sha256],
                [...evidence.checkedPaths].sort(),
            ]),
        )
        .digest("hex")
    assert(
        evidenceSha256 === frozenReviewedCurrentShiftXEvidenceSha256,
        "current ShiftX evidence differs from the independently reviewed payload" +
            `; expected ${frozenReviewedCurrentShiftXEvidenceSha256}; received ${evidenceSha256}`,
    )

    assertPortableShiftXReport(evidence.report.path, evidence.report.sha256)
}

export function assertPortableShiftXReport(
    declaredPath: string,
    expectedSha256: string,
    repositoryRoot = resolve(directory, "../.."),
): void {
    assert(
        !isAbsolute(declaredPath),
        `current ShiftX audit report path must be repository-relative: ${declaredPath}`,
    )
    const repositoryPath = realpathSync(repositoryRoot)
    const absolutePath = resolve(repositoryPath, declaredPath)
    assertRepositoryFilePath(
        repositoryPath,
        absolutePath,
        declaredPath,
        "current ShiftX audit report",
    )
    let realPath: string
    try {
        realPath = realpathSync(absolutePath)
    } catch (error) {
        if (isMissingPathError(error)) {
            throw new Error(
                `current ShiftX audit report does not exist: ${declaredPath}`,
            )
        }
        throw error
    }
    assertRepositoryFilePath(
        repositoryPath,
        realPath,
        declaredPath,
        "current ShiftX audit report",
    )
    assert(
        statSync(realPath).isFile(),
        `current ShiftX audit report is not a file: ${declaredPath}`,
    )
    const actualSha256 = createHash("sha256")
        .update(new Uint8Array(readFileSync(realPath)))
        .digest("hex")
    assert(
        actualSha256 === expectedSha256,
        "current ShiftX audit report SHA-256 differs from the reviewed evidence",
    )
}

function assertFrozenLegacyGitProvenance(
    frozenPackage: FrozenLegacyPackage,
): void {
    const { provenance } = frozenPackage
    const packagePath = `packages/${frozenPackage.package}`
    assertGitCoordinate(
        provenance.sourceRevision,
        packagePath,
        provenance.sourcePackageTreeSha1,
    )
    assertGitCoordinate(
        provenance.releaseRevision,
        packagePath,
        provenance.releasePackageTreeSha1,
    )
    assertGitCoordinate(
        provenance.sourceRevision,
        `${packagePath}/src`,
        provenance.sourceTreeSha1,
    )
    assertGitCoordinate(
        provenance.releaseRevision,
        `${packagePath}/src`,
        provenance.sourceTreeSha1,
    )
    assertGitCoordinate(
        provenance.sourceRevision,
        `${packagePath}/package.json`,
        provenance.sourcePackageJsonBlobSha1,
    )
    assertGitCoordinate(
        provenance.releaseRevision,
        `${packagePath}/package.json`,
        provenance.releasePackageJsonBlobSha1,
    )
    for (const blob of [
        ...provenance.entrypointBlobs,
        ...provenance.surfaceBlobs,
    ]) {
        assertGitCoordinate(
            provenance.sourceRevision,
            blob.path,
            blob.gitBlobSha1,
        )
        assertGitCoordinate(
            provenance.releaseRevision,
            blob.path,
            blob.gitBlobSha1,
        )
    }
}

function assertWorkspaceBaseline(): void {
    const result = spawnSync(
        "git",
        [
            "show",
            `${frozenWorkspaceBaseline.commit}:packages/valdres/package.json`,
        ],
        {
            cwd: resolve(directory, "../.."),
            encoding: "utf8",
        },
    )
    assert(
        result.error === undefined && result.status === 0,
        "cannot verify the pinned workspace recovery commit",
    )
    let packageJson: unknown
    try {
        packageJson = JSON.parse(result.stdout) as unknown
    } catch {
        throw new Error("pinned workspace package.json is invalid JSON")
    }
    assert(
        isRecord(packageJson) &&
            packageJson.version === frozenWorkspaceBaseline.packageVersion,
        "pinned workspace package version differs from the recovery baseline",
    )
}

function assertGitCoordinate(
    revision: string,
    path: string,
    expectedObject: string,
): void {
    const coordinate = `${revision}:${path}`
    let actualObject = gitCoordinateCache.get(coordinate)
    if (actualObject === undefined) {
        const result = spawnSync("git", ["rev-parse", coordinate], {
            cwd: resolve(directory, "../.."),
            encoding: "utf8",
        })
        assert(
            result.status === 0,
            `cannot verify frozen legacy provenance ${coordinate}`,
        )
        actualObject = result.stdout.trim()
        gitCoordinateCache.set(coordinate, actualObject)
    }
    assert(
        actualObject === expectedObject,
        `frozen legacy provenance differs for ${coordinate}; expected ${expectedObject}; received ${actualObject}`,
    )
}

function uniqueCoordinates(
    values: readonly string[],
    label: string,
): Set<string> {
    const result = new Set<string>()
    for (const value of values) {
        assert(!result.has(value), `duplicate ${label}: ${value}`)
        result.add(value)
    }
    return result
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
        `${label} inventory differs from the frozen surface` +
            `; missing: ${missing.join(", ") || "none"}` +
            `; unexpected: ${unexpected.join(", ") || "none"}`,
    )
}

function assertTargetInvariant(entry: PublicEntry): void {
    const { target } = entry
    if (target.status === "removed") {
        assert(
            target.package === null &&
                target.subpath === null &&
                target.name === null,
            `${entry.id} is removed but still names a target`,
        )
        assert(
            entry.migration.mode === "remove",
            `${entry.id} is removed but migration mode is ${entry.migration.mode}`,
        )
        return
    }
    if (target.status !== "pending") {
        assert(
            isNonblank(target.package) &&
                isNonblank(target.subpath) &&
                isNonblank(target.name),
            `${entry.id} has a ${target.status} target with missing coordinates`,
        )
    }
    assert(
        entry.migration.mode !== "remove",
        `${entry.id} uses remove migration without a removed target`,
    )
}

function assertReleaseTrackInvariant(
    entry: PublicEntry,
    independentBetaPublicIds: ReadonlySet<string>,
): void {
    const cataloguedAsIndependentBeta = independentBetaPublicIds.has(entry.id)
    assert(
        (entry.owner === independentBetaOwner) === cataloguedAsIndependentBeta,
        `${entry.id} owner disagrees with the reviewed independent-beta catalog`,
    )
    if (!cataloguedAsIndependentBeta) return
    assert(
        entry.target.status === "pending" ||
            entry.target.status === "experimental",
        `${entry.id} is owned by the independent beta but targets the stable/internal v1 surface`,
    )
}

function isNonblank(value: string | null): value is string {
    return typeof value === "string" && value.trim().length > 0
}

function compileSchema(path: string): ValidateFunction<unknown> {
    const schema = readJson(path)
    return ajv.compile(schema as AnySchema)
}

function assertSchema(
    validate: ValidateFunction<unknown>,
    value: unknown,
    label: string,
): void {
    if (validate(value)) return
    throw new Error(
        `${label} schema validation failed:\n${formatErrors(validate.errors)}`,
    )
}

function formatErrors(
    errors: readonly ErrorObject[] | null | undefined,
): string {
    return (errors ?? [])
        .map(
            error =>
                `  ${error.instancePath || "/"} ${error.message ?? "invalid"}`,
        )
        .join("\n")
}

function readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, "utf8")) as unknown
}

export function parseTestDispositionLedger(
    text: string,
    label = "test-dispositions.jsonl",
): readonly unknown[] {
    const records: unknown[] = []
    for (const [index, sourceLine] of text.split(/\r?\n/u).entries()) {
        const line = sourceLine.trim()
        if (line.length === 0) continue
        try {
            records.push(JSON.parse(line) as unknown)
        } catch (error) {
            const detail =
                error instanceof Error ? error.message : String(error)
            throw new Error(`${label}:${index + 1} invalid JSON: ${detail}`)
        }
    }
    return records
}

export function loadTestOwnerEvidence(
    ledger: readonly unknown[],
    repositoryRoot = resolve(directory, "../.."),
): readonly TestOwnerEvidence[] {
    const realRepositoryRoot = realpathSync(repositoryRoot)
    const paths = new Set<string>()
    for (const record of ledger) {
        if (
            isRecord(record) &&
            record.recordType === "test-owner" &&
            record.status === "implemented" &&
            typeof record.path === "string"
        ) {
            paths.add(record.path)
        }
    }

    const sources: Array<{
        readonly path: string
        readonly realPath: string
        readonly source: string
    }> = []
    for (const path of paths) {
        const absolutePath = resolve(realRepositoryRoot, path)
        assertRepositoryFilePath(realRepositoryRoot, absolutePath, path)
        let realPath: string
        try {
            realPath = realpathSync(absolutePath)
        } catch (error) {
            if (isMissingPathError(error)) continue
            throw error
        }
        assertRepositoryFilePath(realRepositoryRoot, realPath, path)
        if (!statSync(realPath).isFile()) continue
        sources.push({ path, realPath, source: readFileSync(realPath, "utf8") })
    }

    const passedNamesByPath = executeTestOwnerFiles(realRepositoryRoot, sources)
    const evidence = sources.map(({ path, source }) =>
        Object.freeze({
            path,
            source,
            passedTestNames: Object.freeze([
                ...(passedNamesByPath.get(path) ?? []),
            ]),
        }),
    )
    return Object.freeze(evidence)
}

function executeTestOwnerFiles(
    repositoryRoot: string,
    sources: readonly {
        readonly path: string
        readonly realPath: string
        readonly source: string
    }[],
): ReadonlyMap<string, ReadonlySet<string>> {
    if (sources.length === 0) return new Map()
    const reportDirectory = mkdtempSync(
        join(tmpdir(), "valdres-v1-test-owners-"),
    )
    const reportPath = join(reportDirectory, "junit.xml")
    try {
        const result = spawnSync(
            process.execPath,
            [
                "test",
                ...sources.map(source => source.path),
                "--reporter=junit",
                `--reporter-outfile=${reportPath}`,
            ],
            {
                cwd: repositoryRoot,
                encoding: "utf8",
                env: {
                    ...process.env,
                    VALDRES_ALLOW_ROOT_BUN_TEST: "1",
                },
            },
        )
        assert(
            result.error === undefined && result.status === 0,
            "implemented test-owner execution failed" +
                `\n${result.stdout ?? ""}${result.stderr ?? ""}`,
        )
        for (const source of sources) {
            assert(
                readFileSync(source.realPath, "utf8") === source.source,
                `test owner source changed during execution: ${source.path}`,
            )
        }
        const passed = collectPassedTestNames(readFileSync(reportPath, "utf8"))
        return passed
    } finally {
        rmSync(reportDirectory, { recursive: true, force: true })
    }
}

function collectPassedTestNames(
    junit: string,
): ReadonlyMap<string, ReadonlySet<string>> {
    const namesByPath = new Map<string, Set<string>>()
    for (const match of junit.matchAll(/<testcase\b([^>]*)\/>/gu)) {
        const attributes = match[1] ?? ""
        const path = xmlAttribute(attributes, "file")
        const name = xmlAttribute(attributes, "name")
        const className = xmlAttribute(attributes, "classname")
        const assertions = Number(xmlAttribute(attributes, "assertions"))
        if (
            path === null ||
            name === null ||
            !Number.isSafeInteger(assertions) ||
            assertions < 1
        ) {
            continue
        }
        const names = namesByPath.get(path) ?? new Set<string>()
        names.add(
            className === null || className.length === 0
                ? name
                : `${className} > ${name}`,
        )
        namesByPath.set(path, names)
    }
    return namesByPath
}

function xmlAttribute(attributes: string, name: string): string | null {
    const value = attributes.match(
        new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "u"),
    )?.[1]
    return value === undefined ? null : decodeXml(value)
}

function decodeXml(value: string): string {
    return value.replace(
        /&(?:amp|lt|gt|quot|apos);/gu,
        entity =>
            ({
                "&amp;": "&",
                "&lt;": "<",
                "&gt;": ">",
                "&quot;": '"',
                "&apos;": "'",
            })[entity]!,
    )
}

function assertRepositoryFilePath(
    repositoryRoot: string,
    candidate: string,
    declaredPath: string,
    label = "test owner",
): void {
    const relativePath = relative(repositoryRoot, candidate)
    assert(
        relativePath.length > 0 &&
            relativePath !== ".." &&
            !relativePath.startsWith(`..${sep}`) &&
            !isAbsolute(relativePath),
        `${label} path escapes the repository: ${declaredPath}`,
    )
}

function isMissingPathError(error: unknown): boolean {
    if (!isRecord(error)) return false
    return error.code === "ENOENT" || error.code === "ENOTDIR"
}

function uniqueIds<WithId extends { readonly id: string }>(
    entries: readonly WithId[],
    label: string,
): Set<string> {
    return uniqueStrings(
        entries.map(entry => entry.id),
        label,
    )
}

function uniqueStrings(values: readonly string[], label: string): Set<string> {
    const result = new Set<string>()
    for (const value of values) {
        assert(/^[a-z0-9][a-z0-9.-]+$/.test(value), `invalid ${label} ${value}`)
        assert(!result.has(value), `duplicate ${label} ${value}`)
        result.add(value)
    }
    return result
}

function assertContainsAll(
    actual: ReadonlySet<string>,
    required: ReadonlySet<string>,
    label: string,
): void {
    const missing = [...required].filter(value => !actual.has(value))
    assert(missing.length === 0, `missing ${label}: ${missing.join(", ")}`)
}

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

function main(): void {
    const testDispositionLedger = parseTestDispositionLedger(
        readFileSync(join(directory, "test-dispositions.jsonl"), "utf8"),
    )
    assertSchema(
        validateTestDispositions,
        testDispositionLedger,
        "test-dispositions.jsonl",
    )
    const result = validateContractSet({
        publicManifest: readJson(join(directory, "public-api.json")),
        callbackManifest: readJson(
            join(directory, "callback-capabilities.json"),
        ),
        contractCatalog: readJson(join(directory, "contract-catalog.json")),
        frozenLegacySurface: readJson(
            join(directory, "frozen-legacy-surface.json"),
        ),
        legacyDispositionCatalog: readJson(
            join(directory, "legacy-disposition-catalog.json"),
        ),
        targetSurfaceCatalog: readJson(
            join(directory, "target-surface-catalog.json"),
        ),
        testDispositionLedger,
        testDispositionInventoryEvidence: loadTestDispositionInventoryEvidence(
            testDispositionLedger,
        ),
        testOwnerEvidence: loadTestOwnerEvidence(testDispositionLedger),
    })
    console.log(
        `v1 contracts valid: ${result.publicEntries} API entries, ` +
            `${result.callbackEntries} callback entries, ` +
            `${result.contractIds} contract IDs; completeness=${result.completeness}; ` +
            `test-dispositions=${result.testDispositionCompleteness} ` +
            `(${result.testDispositions} rows ` +
            `[A=${result.testDispositionCounts.A}, B=${result.testDispositionCounts.B}, ` +
            `C=${result.testDispositionCounts.C}, D=${result.testDispositionCounts.D}, ` +
            `E=${result.testDispositionCounts.E}], ` +
            `${result.testDispositionNeedsReview} need review, ${result.testOwners} owners; ` +
            `inventory=${result.testInventorySubjects ?? "pending"}, ` +
            `test-scope=${result.testDispositionScopeSubjects ?? "pending"}, ` +
            `test-cases-unclassified=${result.testCaseClassificationRemaining ?? "pending"}, ` +
            `test-files-unclassified=${result.testFileClassificationRemaining ?? "pending"}, ` +
            `test-subjects-unclassified=${result.testClassificationRemaining ?? "pending"}, ` +
            `production-source-subjects=${result.productionSourceSubjects ?? "pending"})`,
    )
}

export function loadTestDispositionInventoryEvidence(
    ledger: readonly unknown[],
    repositoryRoot = resolve(directory, "../.."),
): TestDispositionInventoryEvidence | null {
    const first = ledger[0]
    if (!isRecord(first) || !isRecord(first.inventory)) return null
    if (first.inventory.status !== "frozen") return null
    const catalogPath = first.inventory.catalogPath
    assert(
        typeof catalogPath === "string",
        "frozen test inventory catalogPath must be a string",
    )
    const realRepositoryRoot = realpathSync(repositoryRoot)
    const absolutePath = resolve(realRepositoryRoot, catalogPath)
    assertRepositoryFilePath(
        realRepositoryRoot,
        absolutePath,
        catalogPath,
        "frozen test inventory catalog",
    )
    const realPath = realpathSync(absolutePath)
    assertRepositoryFilePath(
        realRepositoryRoot,
        realPath,
        catalogPath,
        "frozen test inventory catalog",
    )
    assert(
        statSync(realPath).isFile(),
        `frozen test inventory is not a file: ${catalogPath}`,
    )
    return {
        catalogPath,
        bytes: Uint8Array.from(readFileSync(realPath)),
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

if (import.meta.main) main()
