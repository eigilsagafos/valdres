import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { validateContractSet, type ContractSet } from "./check"

const directory = dirname(fileURLToPath(import.meta.url))

describe("v1 contract manifest validation", () => {
    test("accepts the checked-in partial manifests", () => {
        expect(validateContractSet(readSet()).completeness).toBe(
            "partial/partial/partial/partial",
        )
    })

    test("executes required-field, enum, and additional-property schemas", () => {
        const missing = mutableSet()
        delete missing.publicManifest.entries[0].notes
        expect(() => validateContractSet(missing)).toThrow(
            /required property 'notes'/,
        )

        const invalidEnum = mutableSet()
        invalidEnum.publicManifest.entries[0].kind = "not-a-kind"
        expect(() => validateContractSet(invalidEnum)).toThrow(
            /must be equal to one/,
        )

        const additional = mutableSet()
        additional.callbackManifest.entries[0].unexpected = true
        expect(() => validateContractSet(additional)).toThrow(
            /must NOT have additional properties/,
        )

        const duplicateFrozenExport = mutableSet()
        duplicateFrozenExport.frozenLegacySurface.runtimeExports[1] =
            duplicateFrozenExport.frozenLegacySurface.runtimeExports[0]
        expect(() => validateContractSet(duplicateFrozenExport)).toThrow(
            /must NOT have duplicate items/,
        )

        const duplicateTargetId = mutableSet()
        duplicateTargetId.targetSurfaceCatalog.publicApiIds[1] =
            duplicateTargetId.targetSurfaceCatalog.publicApiIds[0]
        expect(() => validateContractSet(duplicateTargetId)).toThrow(
            /must NOT have duplicate items/,
        )
    })

    test("rejects missing replacement and contract references", () => {
        const replacement = mutableSet()
        replacement.publicManifest.entries[0].migration.replacementIds = [
            "missing.api",
        ]
        expect(() => validateContractSet(replacement)).toThrow(
            /missing replacement missing.api/,
        )

        const publicContract = mutableSet()
        publicContract.publicManifest.entries[0].contractIds = [
            "missing.contract",
        ]
        expect(() => validateContractSet(publicContract)).toThrow(
            /uncatalogued contract missing.contract/,
        )

        const callbackContract = mutableSet()
        callbackContract.callbackManifest.entries[0].requiredContractIds = [
            "missing.contract",
        ]
        expect(() => validateContractSet(callbackContract)).toThrow(
            /uncatalogued contract missing.contract/,
        )
    })

    test("cannot declare one manifest complete in isolation", () => {
        const set = mutableSet()
        set.publicManifest.completeness = "complete"
        expect(() => validateContractSet(set)).toThrow(
            /must become complete together/,
        )

        const targetOnly = mutableSet()
        targetOnly.targetSurfaceCatalog.completeness = "complete"
        expect(() => validateContractSet(targetOnly)).toThrow(
            /must become complete together/,
        )
    })

    test("manifest and reviewed target IDs must match exactly", () => {
        const missingApiManifest = mutableSet()
        missingApiManifest.publicManifest.entries.pop()
        expect(() => validateContractSet(missingApiManifest)).toThrow(
            /public API target catalog inventory differs/,
        )

        const missingApiCatalog = mutableSet()
        missingApiCatalog.targetSurfaceCatalog.publicApiIds.pop()
        expect(() => validateContractSet(missingApiCatalog)).toThrow(
            /public API target catalog inventory differs/,
        )

        const missingCallbackManifest = mutableSet()
        missingCallbackManifest.callbackManifest.entries.pop()
        expect(() => validateContractSet(missingCallbackManifest)).toThrow(
            /callback target catalog inventory differs/,
        )

        const missingCallbackCatalog = mutableSet()
        missingCallbackCatalog.targetSurfaceCatalog.callbackIds.pop()
        expect(() => validateContractSet(missingCallbackCatalog)).toThrow(
            /callback target catalog inventory differs/,
        )
    })

    test("cannot open the completion gate with empty inventories", () => {
        const set = mutableSet()
        set.publicManifest.entries = []
        set.callbackManifest.entries = []
        set.contractCatalog.contractIds = []
        set.targetSurfaceCatalog.publicApiIds = []
        set.targetSurfaceCatalog.callbackIds = []
        set.publicManifest.completeness = "complete"
        set.callbackManifest.completeness = "complete"
        set.contractCatalog.completeness = "complete"
        set.targetSurfaceCatalog.completeness = "complete"
        expect(() => validateContractSet(set)).toThrow(
            /must NOT have fewer than 1/,
        )
    })

    test("complete stable manifests reject pending decisions and evidence", () => {
        const set = mutableSet()
        set.publicManifest.completeness = "complete"
        set.callbackManifest.completeness = "complete"
        set.contractCatalog.completeness = "complete"
        set.targetSurfaceCatalog.completeness = "complete"
        expect(() => validateContractSet(set)).toThrow(
            /unresolved decisions|pending targets|migration evidence|ShiftX evidence/,
        )
    })

    test("accepts a synthetic candidate only when every gate is complete", () => {
        expect(validateContractSet(completeCandidate()).completeness).toBe(
            "complete/complete/complete/complete",
        )
    })

    test("duplicate padding cannot open the completion gate", () => {
        const set = completeCandidate()
        const runtimeEntry = findPublicEntry(set, "core.atom")
        const typeEntry = findPublicEntry(set, "core.atom.lazy")
        const runtimeSurface = rootSurface("atom")
        const typeSurface = rootSurface("OnlyOneType")

        runtimeEntry.legacy = Array.from({ length: 29 }, () => ({
            ...runtimeSurface,
        }))
        typeEntry.legacy = Array.from({ length: 56 }, () => ({
            ...typeSurface,
        }))

        expect(() => validateContractSet(set)).toThrow(
            /duplicate frozen legacy runtime export/,
        )
    })

    test("complete inventories must exactly match frozen export coordinates", () => {
        const set = completeCandidate()
        const runtimeEntry = findPublicEntry(set, "core.atom")
        const typeEntry = findPublicEntry(set, "core.atom.lazy")

        runtimeEntry.legacy = Array.from({ length: 29 }, (_, index) =>
            rootSurface(`InventedRuntime${index}`),
        )
        typeEntry.legacy = Array.from({ length: 56 }, (_, index) =>
            rootSurface(`InventedType${index}`),
        )

        expect(() => validateContractSet(set)).toThrow(
            /frozen legacy runtime export inventory differs from the frozen surface/,
        )
    })

    test("stable target coordinates and removal intent agree", () => {
        const missingTarget = mutableSet()
        missingTarget.publicManifest.entries[0].target.name = null
        expect(() => validateContractSet(missingTarget)).toThrow(
            /stable target with missing coordinates/,
        )

        const wrongRemoval = mutableSet()
        wrongRemoval.publicManifest.entries[0].migration.mode = "remove"
        expect(() => validateContractSet(wrongRemoval)).toThrow(
            /remove migration without a removed target/,
        )
    })

    test("separates Atom undefined from collection-row undefined", () => {
        const set = mutableSet()
        const atomUpdate = set.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.atom-update",
        )
        const rowUpdate = set.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.collection-row-update",
        )
        expect(atomUpdate?.resultPolicy).toBe("value-may-be-undefined")
        expect(rowUpdate?.resultPolicy).toBe("value-must-not-be-undefined")

        atomUpdate.resultPolicy = "value-must-not-be-undefined"
        expect(() => validateContractSet(set)).toThrow(
            /must be equal to constant/,
        )
    })
})

function readSet(): ContractSet {
    return {
        publicManifest: readJson("public-api.json"),
        callbackManifest: readJson("callback-capabilities.json"),
        contractCatalog: readJson("contract-catalog.json"),
        frozenLegacySurface: readJson("frozen-legacy-surface.json"),
        targetSurfaceCatalog: readJson("target-surface-catalog.json"),
    }
}

function mutableSet(): any {
    return structuredClone(readSet())
}

function readJson(name: string): unknown {
    return JSON.parse(readFileSync(join(directory, name), "utf8")) as unknown
}

function completeCandidate(): any {
    const set = mutableSet()
    set.publicManifest.completeness = "complete"
    set.callbackManifest.completeness = "complete"
    set.contractCatalog.completeness = "complete"
    set.targetSurfaceCatalog.completeness = "complete"
    set.publicManifest.generatedAgainst.currentShiftX.status = "complete"

    for (const entry of set.publicManifest.entries) {
        if (entry.id.startsWith("beta.")) continue
        entry.decisionStatus = "approved"
        entry.migration.evidenceStatus = "complete"
        if (entry.target.status === "pending") {
            entry.target = {
                package: "valdres",
                subpath: ".",
                name: "placeholder",
                status: "stable",
            }
        }
    }
    for (const entry of set.callbackManifest.entries) {
        if (!entry.apiEntryId.startsWith("beta.")) {
            entry.decisionStatus = "approved"
        }
    }

    const runtimeEntry = findPublicEntry(set, "core.atom")
    const typeEntry = findPublicEntry(set, "core.atom.lazy")
    typeEntry.kind = "type-export"
    findPublicEntry(set, "core.store.scope").kind = "option"

    for (const entry of set.publicManifest.entries) {
        if (entry.kind !== "runtime-export" && entry.kind !== "type-export") {
            continue
        }
        entry.legacy = entry.legacy.filter(
            (surface: any) =>
                surface.package !== set.frozenLegacySurface.package ||
                surface.subpath !== set.frozenLegacySurface.subpath ||
                surface.baseline !== set.frozenLegacySurface.baseline,
        )
    }
    runtimeEntry.legacy =
        set.frozenLegacySurface.runtimeExports.map(rootSurface)
    typeEntry.legacy = set.frozenLegacySurface.typeExports.map(rootSurface)
    return set
}

function findPublicEntry(set: any, id: string): any {
    return set.publicManifest.entries.find((entry: any) => entry.id === id)
}

function rootSurface(name: string): any {
    return {
        package: "valdres",
        subpath: ".",
        name,
        baseline: "1.0.0-beta.23",
    }
}
