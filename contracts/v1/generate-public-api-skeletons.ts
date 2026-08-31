import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

type LegacyKind =
    | "runtime-export"
    | "type-export"
    | "property"
    | "method"
    | "overload"
    | "option"

export interface LegacyCoordinate {
    readonly kind: LegacyKind
    readonly package: string
    readonly subpath: string
    readonly owner?: string
    readonly name: string
    readonly baseline: string
}

interface FrozenPackage {
    readonly package: string
    readonly baseline: string
    readonly entrypoints: readonly {
        readonly subpath: string
        readonly runtimeExports: readonly string[]
        readonly typeExports: readonly string[]
    }[]
    readonly members: readonly {
        readonly kind: "property" | "method" | "overload"
        readonly subpath: string
        readonly owner: string
        readonly name: string
    }[]
    readonly options: readonly {
        readonly kind: "option"
        readonly subpath: string
        readonly owner: string
        readonly name: string
    }[]
}

export interface FrozenLegacyInput {
    readonly packages: readonly FrozenPackage[]
}

export interface LegacyDispositionInput {
    readonly entries: readonly {
        readonly coordinate: LegacyCoordinate
        readonly dispositionId: string
    }[]
}

export interface ProposedPublicApiSkeleton {
    readonly recordType: "proposed-public-api-disposition"
    readonly schemaVersion: 1
    readonly dispositionId: string
    readonly legacy: LegacyCoordinate
    readonly reviewStatus: "proposed"
    readonly decisionStatus: "pending-review"
    readonly contractIds: readonly []
    readonly target: {
        readonly status: "pending"
        readonly package: null
        readonly subpath: null
        readonly name: null
    }
    readonly notes: readonly [string]
}

export function generateProposedPublicApiSkeletons(
    frozen: FrozenLegacyInput,
    reviewed: LegacyDispositionInput,
): readonly ProposedPublicApiSkeleton[] {
    const reviewedCoordinates = new Set(
        reviewed.entries.map(entry => coordinateKey(entry.coordinate)),
    )
    const coordinates = collectFrozenCoordinates(frozen)
        .filter(
            coordinate => !reviewedCoordinates.has(coordinateKey(coordinate)),
        )
        .sort((left, right) => {
            const leftKey = coordinateKey(left)
            const rightKey = coordinateKey(right)
            return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
        })

    const skeletons: ProposedPublicApiSkeleton[] = coordinates.map(legacy => ({
        recordType: "proposed-public-api-disposition",
        schemaVersion: 1,
        dispositionId: proposedDispositionId(legacy),
        legacy,
        reviewStatus: "proposed",
        decisionStatus: "pending-review",
        contractIds: [],
        target: {
            status: "pending",
            package: null,
            subpath: null,
            name: null,
        },
        notes: [
            "Generated from immutable legacy coordinates only; target semantics, contracts, evidence, and migration ownership require review.",
        ],
    }))
    const dispositionIds = new Set(
        reviewed.entries.map(entry => entry.dispositionId),
    )
    for (const skeleton of skeletons) {
        if (dispositionIds.has(skeleton.dispositionId)) {
            throw new Error(
                `duplicate proposed disposition ID: ${skeleton.dispositionId}`,
            )
        }
        dispositionIds.add(skeleton.dispositionId)
    }
    return skeletons
}

export function collectFrozenCoordinates(
    frozen: FrozenLegacyInput,
): readonly LegacyCoordinate[] {
    const coordinates = frozen.packages.flatMap(frozenPackage => [
        ...frozenPackage.entrypoints.flatMap(entrypoint => [
            ...entrypoint.runtimeExports.map(name => ({
                kind: "runtime-export" as const,
                package: frozenPackage.package,
                subpath: entrypoint.subpath,
                name,
                baseline: frozenPackage.baseline,
            })),
            ...entrypoint.typeExports.map(name => ({
                kind: "type-export" as const,
                package: frozenPackage.package,
                subpath: entrypoint.subpath,
                name,
                baseline: frozenPackage.baseline,
            })),
        ]),
        ...frozenPackage.members.map(member => ({
            ...member,
            package: frozenPackage.package,
            baseline: frozenPackage.baseline,
        })),
        ...frozenPackage.options.map(option => ({
            ...option,
            package: frozenPackage.package,
            baseline: frozenPackage.baseline,
        })),
    ])
    const seen = new Set<string>()
    for (const coordinate of coordinates) {
        const key = coordinateKey(coordinate)
        if (seen.has(key))
            throw new Error(`duplicate frozen coordinate: ${key}`)
        seen.add(key)
    }
    return coordinates
}

export function coordinateKey(coordinate: LegacyCoordinate): string {
    return JSON.stringify([
        coordinate.kind,
        coordinate.package,
        coordinate.subpath,
        coordinate.owner ?? null,
        coordinate.name,
        coordinate.baseline,
    ])
}

function proposedDispositionId(coordinate: LegacyCoordinate): string {
    const readable = [
        coordinate.package,
        coordinate.subpath === "." ? "root" : coordinate.subpath,
        coordinate.kind,
        coordinate.owner,
        coordinate.name,
    ]
        .filter((part): part is string => part !== undefined)
        .map(slug)
        .filter(Boolean)
        .join(".")
        .slice(0, 96)
    const digest = createHash("sha256")
        .update(coordinateKey(coordinate))
        .digest("hex")
        .slice(0, 10)
    return `proposed.${readable}.${digest}`
}

function slug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, ".")
        .replace(/^\.+|\.+$/gu, "")
}

function readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, "utf8")) as unknown
}

if (import.meta.main) {
    const directory = dirname(fileURLToPath(import.meta.url))
    const frozen = readJson(
        join(directory, "frozen-legacy-surface.json"),
    ) as FrozenLegacyInput
    const reviewed = readJson(
        join(directory, "legacy-disposition-catalog.json"),
    ) as LegacyDispositionInput
    for (const skeleton of generateProposedPublicApiSkeletons(
        frozen,
        reviewed,
    )) {
        console.log(JSON.stringify(skeleton))
    }
}
