import Ajv2020, {
    type ErrorObject,
    type ValidateFunction,
} from "ajv/dist/2020.js"
import type { AnySchema } from "ajv"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

type Completeness = "partial" | "complete"
type DecisionStatus = "approved" | "pending-experiment" | "evidence-required"
type ResultPolicy = "value-may-be-undefined" | "value-must-not-be-undefined"

interface LegacySurface {
    readonly package: string
    readonly subpath: string
    readonly name: string
    readonly baseline: string
}

interface PublicEntry {
    readonly id: string
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
}

interface PublicManifest {
    readonly schemaVersion: 1
    readonly completeness: Completeness
    readonly generatedAgainst: {
        readonly workspace: { readonly commit: string }
        readonly frozenLegacy: {
            readonly integrity: string
            readonly sha256: string
        }
        readonly currentShiftX: { readonly status: string }
    }
    readonly entries: readonly PublicEntry[]
}

interface CallbackEntry {
    readonly id: string
    readonly apiEntryId: string
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

interface TargetSurfaceCatalog {
    readonly schemaVersion: 1
    readonly completeness: Completeness
    readonly publicApiIds: readonly string[]
    readonly callbackIds: readonly string[]
}

interface FrozenLegacySurface {
    readonly schemaVersion: 1
    readonly package: string
    readonly subpath: string
    readonly baseline: string
    readonly runtimeExports: readonly string[]
    readonly typeExports: readonly string[]
}

interface FrozenLegacyCoordinates {
    readonly runtime: ReadonlySet<string>
    readonly types: ReadonlySet<string>
}

export interface ContractSet {
    readonly publicManifest: unknown
    readonly callbackManifest: unknown
    readonly contractCatalog: unknown
    readonly frozenLegacySurface: unknown
    readonly targetSurfaceCatalog: unknown
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
const validateTargetSurfaceCatalog = compileSchema(
    join(schemasDirectory, "target-surface-catalog.schema.json"),
)

const requiredPublicIds = new Set([
    "core.atom",
    "core.atom.lazy",
    "core.selector",
    "core.external-atom",
    "core.family",
    "core.collection",
    "core.presence",
    "core.structural-query",
    "core.store",
    "core.store.txn",
    "core.store.update",
    "react.provider",
    "react.use-store",
    "react.use-value",
    "core.runtime-mismatch-error",
])
const requiredCallbackIds = new Set([
    "callback.atom-lazy-initializer",
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
    "callback.query-builder",
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

export function validateContractSet(input: ContractSet): Readonly<{
    publicEntries: number
    callbackEntries: number
    contractIds: number
    completeness: `${Completeness}/${Completeness}/${Completeness}/${Completeness}`
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
        validateTargetSurfaceCatalog,
        input.targetSurfaceCatalog,
        "target-surface-catalog.json",
    )

    const publicManifest = input.publicManifest as PublicManifest
    const callbackManifest = input.callbackManifest as CallbackManifest
    const contractCatalog = input.contractCatalog as ContractCatalog
    const frozenLegacySurface = input.frozenLegacySurface as FrozenLegacySurface
    const targetSurfaceCatalog =
        input.targetSurfaceCatalog as TargetSurfaceCatalog

    assert(
        /^[0-9a-f]{40}$/.test(publicManifest.generatedAgainst.workspace.commit),
        "workspace commit must be a full Git SHA",
    )
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
    assertExactSet(publicIds, targetPublicIds, "public API target catalog")
    assertExactSet(callbackIds, targetCallbackIds, "callback target catalog")
    const frozenLegacyCoordinates = collectFrozenLegacyCoordinates(
        publicManifest,
        frozenLegacySurface,
    )

    for (const entry of publicManifest.entries) {
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
        )
    }

    return {
        publicEntries: publicManifest.entries.length,
        callbackEntries: callbackManifest.entries.length,
        contractIds: contractCatalog.contractIds.length,
        completeness: completeness.join(
            "/",
        ) as `${Completeness}/${Completeness}/${Completeness}/${Completeness}`,
    }
}

function assertComplete(
    publicManifest: PublicManifest,
    callbackManifest: CallbackManifest,
    contractCatalog: ContractCatalog,
    frozenLegacySurface: FrozenLegacySurface,
    frozenLegacyCoordinates: FrozenLegacyCoordinates,
): void {
    const stablePublicEntries = publicManifest.entries.filter(
        entry => !entry.id.startsWith("beta."),
    )
    const stableCallbackEntries = callbackManifest.entries.filter(
        entry => !entry.apiEntryId.startsWith("beta."),
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

    assertExactSet(
        frozenLegacyCoordinates.runtime,
        expectedFrozenLegacyCoordinates(
            "runtime-export",
            frozenLegacySurface.runtimeExports,
            frozenLegacySurface,
        ),
        "frozen legacy runtime export",
    )
    assertExactSet(
        frozenLegacyCoordinates.types,
        expectedFrozenLegacyCoordinates(
            "type-export",
            frozenLegacySurface.typeExports,
            frozenLegacySurface,
        ),
        "frozen legacy type export",
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
): FrozenLegacyCoordinates {
    const runtime: string[] = []
    const types: string[] = []

    for (const entry of publicManifest.entries) {
        if (entry.kind !== "runtime-export" && entry.kind !== "type-export") {
            continue
        }
        for (const surface of entry.legacy) {
            if (
                surface.package !== frozenLegacySurface.package ||
                surface.subpath !== frozenLegacySurface.subpath ||
                surface.baseline !== frozenLegacySurface.baseline
            ) {
                continue
            }
            const coordinate = legacyCoordinate(entry.kind, surface)
            if (entry.kind === "runtime-export") runtime.push(coordinate)
            else types.push(coordinate)
        }
    }

    return {
        runtime: uniqueCoordinates(runtime, "frozen legacy runtime export"),
        types: uniqueCoordinates(types, "frozen legacy type export"),
    }
}

function expectedFrozenLegacyCoordinates(
    kind: "runtime-export" | "type-export",
    names: readonly string[],
    frozenLegacySurface: FrozenLegacySurface,
): ReadonlySet<string> {
    return new Set(
        names.map(name =>
            legacyCoordinate(kind, {
                package: frozenLegacySurface.package,
                subpath: frozenLegacySurface.subpath,
                name,
                baseline: frozenLegacySurface.baseline,
            }),
        ),
    )
}

function legacyCoordinate(
    kind: "runtime-export" | "type-export",
    surface: LegacySurface,
): string {
    return JSON.stringify([
        kind,
        surface.package,
        surface.subpath,
        surface.name,
        surface.baseline,
    ])
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
            target.package !== null &&
                target.subpath !== null &&
                target.name !== null,
            `${entry.id} has a ${target.status} target with missing coordinates`,
        )
    }
    assert(
        entry.migration.mode !== "remove",
        `${entry.id} uses remove migration without a removed target`,
    )
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
    const result = validateContractSet({
        publicManifest: readJson(join(directory, "public-api.json")),
        callbackManifest: readJson(
            join(directory, "callback-capabilities.json"),
        ),
        contractCatalog: readJson(join(directory, "contract-catalog.json")),
        frozenLegacySurface: readJson(
            join(directory, "frozen-legacy-surface.json"),
        ),
        targetSurfaceCatalog: readJson(
            join(directory, "target-surface-catalog.json"),
        ),
    })
    console.log(
        `v1 contracts valid: ${result.publicEntries} API entries, ` +
            `${result.callbackEntries} callback entries, ` +
            `${result.contractIds} contract IDs; completeness=${result.completeness}`,
    )
}

if (import.meta.main) main()
