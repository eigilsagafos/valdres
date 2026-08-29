import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
    loadTestDispositionInventoryEvidence,
    loadTestOwnerEvidence,
    parseTestDispositionLedger,
    validateContractSet,
    type ContractSet,
} from "./check"
import { acquirePublishedTarball } from "./generate-frozen-test-inventory"

const directory = dirname(fileURLToPath(import.meta.url))
const ZERO_REGISTRATION_PATHS = [
    "packages/valdres/src/lib/atomFamily.types.test.ts",
    "packages/valdres/src/lib/commitPlan.types.test.ts",
    "packages/valdres/src/lib/setAtom.types.test.ts",
    "packages/valdres/src/lib/transaction.types.test.ts",
] as const

describe("v1 contract manifest validation", () => {
    test("accepts the checked-in partial manifests", () => {
        const result = validateContractSet(readSet())
        expect(result.completeness).toBe("partial/partial/partial/partial")
        expect(result.testDispositionCompleteness).toBe("partial")
        expect(result.testDispositions).toBe(1640)
        expect(result.testDispositionCounts).toEqual({
            A: 24,
            B: 283,
            C: 370,
            D: 726,
            E: 237,
        })
        expect(result.testDispositionNeedsReview).toBe(0)
        expect(result.testOwners).toBe(31)
        expect(result.testInventorySubjects).toBe(1830)
        expect(result.testDispositionScopeSubjects).toBe(1640)
        expect(result.testCaseClassificationRemaining).toBe(0)
        expect(result.testFileClassificationRemaining).toBe(0)
        expect(result.testClassificationRemaining).toBe(0)
        expect(result.productionSourceSubjects).toBe(190)
    })

    test("the test-disposition generator rejects fabricated evidence outside the reviewed four", () => {
        const temporaryRoot = mkdtempSync(
            join(tmpdir(), "valdres-test-disposition-seed-"),
        )
        const temporaryContracts = join(temporaryRoot, "contracts/v1")
        try {
            mkdirSync(temporaryContracts, { recursive: true })
            for (const name of [
                "generate-test-dispositions.ts",
                "frozen-test-inventory.json",
                "test-dispositions.jsonl",
            ]) {
                copyFileSync(
                    join(directory, name),
                    join(temporaryContracts, name),
                )
            }

            const ledgerPath = join(
                temporaryContracts,
                "test-dispositions.jsonl",
            )
            const records = parseTestDispositionLedger(
                readFileSync(ledgerPath, "utf8"),
            ) as any[]
            const fabricated = records.find(
                record =>
                    record.recordType === "disposition" &&
                    record.id === "beta23.test.src.atom.l1220.01",
            )
            expect(fabricated).toBeDefined()
            fabricated.contractIds = ["atom.object-is-default"]
            fabricated.ownerIds = ["V1M-SUB-002"]
            fabricated.rationale = "Fabricated evidence must not self-attest."
            writeFileSync(
                ledgerPath,
                `${records.map(record => JSON.stringify(record)).join("\n")}\n`,
            )

            const result = spawnSync(
                process.execPath,
                [
                    join(temporaryContracts, "generate-test-dispositions.ts"),
                    "--check",
                ],
                { cwd: temporaryRoot, encoding: "utf8" },
            )
            expect(result.status).not.toBe(0)
            expect(result.stderr).toContain(
                "test disposition ledger differs from deterministic generator output",
            )
        } finally {
            rmSync(temporaryRoot, { recursive: true, force: true })
        }
    })

    test("fetches the immutable registry tarball when the ignored local archive is absent", async () => {
        const temporaryRoot = mkdtempSync(
            join(tmpdir(), "valdres-tarball-fallback-"),
        )
        try {
            const fixture = Uint8Array.from([0x1f, 0x8b, 0x08, 0x00])
            let requestedUrl = ""
            const path = await acquirePublishedTarball(
                join(temporaryRoot, "absent-local-archive.tgz"),
                temporaryRoot,
                async url => {
                    requestedUrl = url
                    return {
                        ok: true,
                        status: 200,
                        statusText: "OK",
                        arrayBuffer: async () => fixture.buffer,
                    }
                },
            )
            expect(requestedUrl).toBe(
                "https://registry.npmjs.org/valdres/-/valdres-1.0.0-beta.23.tgz",
            )
            expect(new Uint8Array(readFileSync(path))).toEqual(fixture)
        } finally {
            rmSync(temporaryRoot, { recursive: true, force: true })
        }
    })

    test("parses one JSON value per nonblank JSONL line", () => {
        expect(
            parseTestDispositionLedger(
                '{"recordType":"header"}\n\n{"recordType":"test-owner"}\n',
            ),
        ).toEqual([{ recordType: "header" }, { recordType: "test-owner" }])
        expect(() =>
            parseTestDispositionLedger(
                '{"recordType":"header"}\n{',
                "fixture.jsonl",
            ),
        ).toThrow(/fixture\.jsonl:2 invalid JSON/)
    })

    test("rejects malformed test-disposition rows", () => {
        const set = mutableSet()
        set.testDispositionLedger.push({
            recordType: "disposition",
            id: "legacy.selector.promise-resolution",
            subject: {
                origin: "published-beta.23",
                kind: "test-case",
                path: "packages/valdres/test/asyncSelector.test.ts",
                testName:
                    "selector returning a Promise stores the Promise then resolves",
            },
            disposition: "F",
            reviewStatus: "proposed",
            contractIds: ["selector.pure-sync-dag"],
            ownerIds: [],
            destination: null,
            rationale: "The stable selector evaluator is synchronous.",
        })
        expect(() => validateContractSet(set)).toThrow(
            /test-dispositions\.jsonl schema validation failed/,
        )

        const unexpected = mutableSet()
        unexpected.testDispositionLedger[1].unexpected = true
        expect(() => validateContractSet(unexpected)).toThrow(
            /must NOT have additional properties/,
        )

        const prematurelyApproved = mutableSet()
        const proposed = prematurelyApproved.testDispositionLedger.find(
            (record: any) => record.recordType === "disposition",
        )
        proposed.reviewStatus = "approved"
        proposed.needsReview = {
            status: "needs-human-judgment",
            reasons: [
                {
                    code: "mixed-contract-subject",
                    detail: "Fixture remains intentionally review-blocked.",
                },
            ],
        }
        expect(() => validateContractSet(prematurelyApproved)).toThrow(
            /test-dispositions\.jsonl schema validation failed|cannot be approved while it needs human judgment/,
        )
    })

    test("requires exact parity for the complete test-subject classification scope", () => {
        const missing = mutableSet()
        const index = missing.testDispositionLedger.findIndex(
            (record: any) => record.recordType === "disposition",
        )
        missing.testDispositionLedger.splice(index, 1)

        expect(() => validateContractSet(missing)).toThrow(
            /test-disposition inventory differs from its frozen source catalog/,
        )

        const missingTypeFile = mutableSet()
        const typeFileIndex = missingTypeFile.testDispositionLedger.findIndex(
            (record: any) => record.subject?.kind === "test-file",
        )
        missingTypeFile.testDispositionLedger.splice(typeFileIndex, 1)
        expect(() => validateContractSet(missingTypeFile)).toThrow(
            /test-disposition inventory differs from its frozen source catalog/,
        )

        const productionLeak = mutableSet()
        const inventory = JSON.parse(
            new TextDecoder().decode(
                productionLeak.testDispositionInventoryEvidence.bytes,
            ),
        )
        testDispositionHeader(
            productionLeak,
        ).inventory.expectedDispositionIds.push(
            inventory.entries.find(
                (entry: any) => entry.subject.kind === "production-file",
            ).id,
        )
        expect(() => validateContractSet(productionLeak)).toThrow(
            /test-disposition inventory differs from its frozen source catalog/,
        )
    })

    test("cannot falsely complete the test ledger", () => {
        const flagOnly = mutableSet()
        const flagOnlyHeader = testDispositionHeader(flagOnly)
        flagOnlyHeader.completeness = "complete"
        flagOnlyHeader.inventory = {
            status: "pending",
            catalogPath: null,
            sha256: null,
            expectedDispositionIds: [],
        }
        flagOnly.testDispositionInventoryEvidence = null
        expect(() => validateContractSet(flagOnly)).toThrow(
            /requires a frozen source inventory/,
        )

        const inventedInventory = mutableSet()
        const inventedHeader = testDispositionHeader(inventedInventory)
        inventedHeader.completeness = "complete"
        inventedHeader.inventory = {
            status: "frozen",
            catalogPath: "contracts/v1/frozen-test-inventory.json",
            sha256: "0".repeat(64),
            expectedDispositionIds: ["legacy.missing"],
        }
        inventedInventory.testDispositionInventoryEvidence = null
        expect(() => validateContractSet(inventedInventory)).toThrow(
            /requires independently loaded catalog evidence/,
        )

        const proposed = completeTestDispositionCandidate()
        proposed.testDispositionLedger.find(
            (record: any) => record.recordType === "disposition",
        ).reviewStatus = "proposed"
        expect(() => validateContractSet(proposed)).toThrow(
            /cannot contain proposed rows/,
        )

        const plannedOwner = completeTestDispositionCandidate()
        const owner = plannedOwner.testDispositionLedger.find(
            (record: any) => record.recordType === "test-owner",
        )
        owner.status = "planned"
        owner.testName = null
        expect(() => validateContractSet(plannedOwner)).toThrow(
            /cannot contain planned test owners/,
        )
    })

    test("complete test ledgers require exact subjects and test-owner joins", () => {
        const complete = completeTestDispositionCandidate()
        expect(validateContractSet(complete).testDispositionCompleteness).toBe(
            "complete",
        )

        const missingEvidence = completeTestDispositionCandidate()
        missingEvidence.testDispositionInventoryEvidence = null
        expect(() => validateContractSet(missingEvidence)).toThrow(
            /requires independently loaded catalog evidence/,
        )

        const tamperedEvidence = completeTestDispositionCandidate()
        const tamperedBytes = tamperedEvidence.testDispositionInventoryEvidence
            .bytes as Uint8Array
        tamperedEvidence.testDispositionInventoryEvidence.bytes =
            new Uint8Array([...tamperedBytes, 0x20])
        expect(() => validateContractSet(tamperedEvidence)).toThrow(
            /does not match its frozen SHA-256/,
        )

        const changedSubject = completeTestDispositionCandidate()
        changedSubject.testDispositionLedger.find(
            (record: any) => record.recordType === "disposition",
        ).subject.testName = "invented replacement subject"
        expect(() => validateContractSet(changedSubject)).toThrow(
            /subject differs from frozen inventory/,
        )

        const missingOwner = completeTestDispositionCandidate()
        missingOwner.testDispositionLedger.find(
            (record: any) => record.recordType === "disposition",
        ).ownerIds = ["V1M-ATOM-999"]
        expect(() => validateContractSet(missingOwner)).toThrow(
            /missing test owner V1M-ATOM-999/,
        )

        const duplicateSubject = completeTestDispositionCandidate()
        const disposition = duplicateSubject.testDispositionLedger.find(
            (record: any) => record.recordType === "disposition",
        )
        duplicateSubject.testDispositionLedger.push({
            ...structuredClone(disposition),
            id: "legacy.atom.eager-copy",
        })
        testDispositionHeader(
            duplicateSubject,
        ).inventory.expectedDispositionIds.push("legacy.atom.eager-copy")
        expect(() => validateContractSet(duplicateSubject)).toThrow(
            /duplicates a disposition subject/,
        )
    })

    test("implemented test owners require real source evidence and exact canonical names", () => {
        const missingPath = mutableSet()
        const missingOwner = missingPath.testDispositionLedger.find(
            (record: any) =>
                record.recordType === "test-owner" &&
                record.id === "V1M-ATOM-001",
        )
        missingOwner.path = "contracts/v1/does-not-exist.test.ts"
        missingPath.testOwnerEvidence = loadTestOwnerEvidence(
            missingPath.testDispositionLedger,
        )
        expect(() => validateContractSet(missingPath)).toThrow(
            /implemented test owner requires independently loaded source evidence/,
        )

        const inventedName = mutableSet()
        const inventedOwner = inventedName.testDispositionLedger.find(
            (record: any) =>
                record.recordType === "test-owner" &&
                record.id === "V1M-ATOM-001",
        )
        inventedOwner.testName =
            "v1 reference model atoms > V1M-ATOM-001 invented passing test"
        expect(() => validateContractSet(inventedName)).toThrow(
            /implemented test name is not present/,
        )

        expect(() =>
            loadTestOwnerEvidence([
                {
                    recordType: "test-owner",
                    path: "../package.json",
                    status: "implemented",
                },
            ]),
        ).toThrow(/test owner path escapes the repository/)
    })

    test("implemented owners must be collected and pass, not merely appear in dead source", () => {
        const temporaryRoot = mkdtempSync(
            join(tmpdir(), "valdres-dead-owner-evidence-"),
        )
        try {
            const path = "packages/valdres/test/v1-model/dead.test.ts"
            mkdirSync(join(temporaryRoot, dirname(path)), { recursive: true })
            writeFileSync(
                join(temporaryRoot, path),
                [
                    'import { expect, test as bunTest } from "bun:test"',
                    'bunTest("unrelated executable test", () => { expect(true).toBeTrue() })',
                    "const describe = (_name: string, _body: () => void) => {}",
                    "const test = (_name: string, _body: () => void) => {}",
                    'if (false) describe("dead suite", () => {',
                    '    test("V1M-SCOPE-001 dead branch", () => {})',
                    "})",
                    "",
                ].join("\n"),
            )
            const evidence = loadTestOwnerEvidence(
                [
                    {
                        recordType: "test-owner",
                        id: "V1M-SCOPE-001",
                        path,
                        testName: "dead suite > V1M-SCOPE-001 dead branch",
                        contractIds: ["scope.live-inheritance"],
                        status: "implemented",
                    },
                ],
                temporaryRoot,
            )
            expect(evidence[0]?.passedTestNames).toEqual([
                "unrelated executable test",
            ])
            const set = mutableSet()
            const owner = set.testDispositionLedger.find(
                (record: any) => record.id === "V1M-SCOPE-001",
            )
            owner.path = path
            owner.testName = "dead suite > V1M-SCOPE-001 dead branch"
            set.testOwnerEvidence = [...set.testOwnerEvidence, ...evidence]
            expect(() => validateContractSet(set)).toThrow(
                /implemented test did not execute and pass/,
            )
        } finally {
            rmSync(temporaryRoot, { recursive: true, force: true })
        }
    })

    test("frozen inventory loading rejects a symlink that escapes the repository", () => {
        const temporaryRoot = mkdtempSync(
            join(tmpdir(), "valdres-inventory-symlink-"),
        )
        const repositoryRoot = join(temporaryRoot, "repository")
        try {
            mkdirSync(join(repositoryRoot, "contracts/v1"), { recursive: true })
            const outsidePath = join(temporaryRoot, "outside.json")
            writeFileSync(outsidePath, "{}\n")
            symlinkSync(
                outsidePath,
                join(repositoryRoot, "contracts/v1/frozen-test-inventory.json"),
            )
            expect(() =>
                loadTestDispositionInventoryEvidence(
                    [
                        {
                            recordType: "header",
                            inventory: {
                                status: "frozen",
                                catalogPath:
                                    "contracts/v1/frozen-test-inventory.json",
                            },
                        },
                    ],
                    repositoryRoot,
                ),
            ).toThrow(/frozen test inventory catalog path escapes/)
        } finally {
            rmSync(temporaryRoot, { recursive: true, force: true })
        }
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
        duplicateFrozenExport.frozenLegacySurface.entrypoints[0].runtimeExports[1] =
            duplicateFrozenExport.frozenLegacySurface.entrypoints[0].runtimeExports[0]
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

    test("stable completion is derived from API ownership, not an ID prefix", () => {
        const set = completeCandidate()
        const entry = findPublicEntry(set, "core.store.delete")
        entry.id = "beta.store-delete"
        entry.decisionStatus = "evidence-required"
        entry.migration.evidenceStatus = "planned"
        const targetId =
            set.targetSurfaceCatalog.publicApiIds.indexOf("core.store.delete")
        set.targetSurfaceCatalog.publicApiIds[targetId] = "beta.store-delete"
        expect(() => validateContractSet(set)).toThrow(
            /unresolved decisions|migration evidence/,
        )

        const disguisedStable = mutableSet()
        const betaSearch = findPublicEntry(disguisedStable, "beta.search")
        betaSearch.target.status = "stable"
        expect(() => validateContractSet(disguisedStable)).toThrow(
            /independent beta but targets the stable\/internal v1 surface/,
        )

        const selfRelabelled = mutableSet()
        const storeDelete = findPublicEntry(selfRelabelled, "core.store.delete")
        storeDelete.owner = "independent-beta"
        storeDelete.target = {
            package: null,
            subpath: null,
            name: null,
            status: "pending",
        }
        expect(() => validateContractSet(selfRelabelled)).toThrow(
            /owner disagrees with the reviewed independent-beta catalog/,
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

    test("complete inventories include adapter-internals/v1 exports", () => {
        const set = completeCandidate()
        const runtimeEntry = findPublicEntry(set, "core.atom")
        runtimeEntry.legacy = runtimeEntry.legacy.filter(
            (surface: any) =>
                surface.subpath !== "./adapter-internals/v1" ||
                surface.name !== "storeAdapter",
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

        const blankTarget = mutableSet()
        blankTarget.publicManifest.entries[0].target.name = "   "
        expect(() => validateContractSet(blankTarget)).toThrow(
            /public-api\.json schema validation failed|stable target with missing coordinates/,
        )

        const wrongRemoval = mutableSet()
        wrongRemoval.publicManifest.entries[0].migration.mode = "remove"
        expect(() => validateContractSet(wrongRemoval)).toThrow(
            /remove migration without a removed target/,
        )
    })

    test("independent target catalog freezes standalone collection coordinates", () => {
        const renamedMaterialize = mutableSet()
        findPublicEntry(
            renamedMaterialize,
            "collection.materialize",
        ).target.name = "materialise"

        expect(() => validateContractSet(renamedMaterialize)).toThrow(
            /collection\.materialize target coordinate differs from the frozen target catalog/,
        )

        const renamedEverywhere = mutableSet()
        findPublicEntry(
            renamedEverywhere,
            "collection.materialize",
        ).target.name = "materialise"
        renamedEverywhere.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) => coordinate.id === "collection.materialize",
        ).name = "materialise"

        expect(() => validateContractSet(renamedEverywhere)).toThrow(
            /collection\.materialize frozen target catalog coordinate differs from the required standalone spelling/,
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
    const testDispositionLedger = parseTestDispositionLedger(
        readFileSync(join(directory, "test-dispositions.jsonl"), "utf8"),
    )
    return {
        publicManifest: readJson("public-api.json"),
        callbackManifest: readJson("callback-capabilities.json"),
        contractCatalog: readJson("contract-catalog.json"),
        frozenLegacySurface: readJson("frozen-legacy-surface.json"),
        targetSurfaceCatalog: readJson("target-surface-catalog.json"),
        testDispositionLedger,
        testDispositionInventoryEvidence: loadTestDispositionInventoryEvidence(
            testDispositionLedger,
        ),
        testOwnerEvidence: loadTestOwnerEvidence(testDispositionLedger),
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
        if (entry.owner === "independent-beta") continue
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
        if (
            findPublicEntry(set, entry.apiEntryId).owner !== "independent-beta"
        ) {
            entry.decisionStatus = "approved"
        }
    }

    const runtimeEntry = findPublicEntry(set, "core.atom")
    const typeEntry = findPublicEntry(set, "core.atom.lazy")
    typeEntry.kind = "type-export"
    findPublicEntry(set, "core.store.scope").kind = "option"

    const frozenSubpaths = new Set(
        set.frozenLegacySurface.entrypoints.map(
            (entrypoint: any) => entrypoint.subpath,
        ),
    )
    for (const entry of set.publicManifest.entries) {
        if (entry.kind !== "runtime-export" && entry.kind !== "type-export") {
            continue
        }
        entry.legacy = entry.legacy.filter(
            (surface: any) =>
                surface.package !== set.frozenLegacySurface.package ||
                !frozenSubpaths.has(surface.subpath) ||
                surface.baseline !== set.frozenLegacySurface.baseline,
        )
    }
    runtimeEntry.legacy = set.frozenLegacySurface.entrypoints.flatMap(
        (entrypoint: any) =>
            entrypoint.runtimeExports.map((name: string) =>
                legacySurface(entrypoint.subpath, name),
            ),
    )
    typeEntry.legacy = set.frozenLegacySurface.entrypoints.flatMap(
        (entrypoint: any) =>
            entrypoint.typeExports.map((name: string) =>
                legacySurface(entrypoint.subpath, name),
            ),
    )
    return set
}

function completeTestDispositionCandidate(): any {
    const set = mutableSet()
    set.testDispositionLedger = set.testDispositionLedger.filter(
        (record: any) => record.recordType !== "disposition",
    )
    set.testDispositionLedger.push({
        recordType: "disposition",
        id: "legacy.atom.eager",
        subject: {
            origin: "published-beta.23",
            kind: "test-case",
            path: "packages/valdres/test/atom.test.ts",
            testName: "returns its eager fallback",
        },
        disposition: "A",
        reviewStatus: "approved",
        contractIds: ["atom.exact-value", "atom.object-is-default"],
        ownerIds: ["V1M-ATOM-001"],
        destination: null,
        rationale: "The observable eager Atom contract remains stable in 1.0.",
    })
    for (const [index, path] of ZERO_REGISTRATION_PATHS.entries()) {
        set.testDispositionLedger.push({
            recordType: "disposition",
            id: `legacy.type-file.${index + 1}`,
            subject: {
                origin: "published-beta.23",
                kind: "test-file",
                path,
            },
            disposition: "E",
            reviewStatus: "approved",
            contractIds: [],
            ownerIds: [],
            destination: "contracts/v1/replacement.type-test.ts (planned)",
            rationale:
                "The compile-time assertion moves to a replacement v1 type-test suite.",
        })
    }
    attachFrozenTestInventory(set)
    return set
}

function attachFrozenTestInventory(set: any): void {
    const catalogPath = "contracts/v1/frozen-test-inventory.json"
    const entries = set.testDispositionLedger
        .filter((record: any) => record.recordType === "disposition")
        .map((record: any) => ({
            id: record.id,
            subject: structuredClone(record.subject),
            evidence:
                record.subject.kind === "test-case"
                    ? { gitBlobSha1: "1".repeat(40), sourceLine: 1 }
                    : { gitBlobSha1: "2".repeat(40) },
        }))
    entries.push({
        id: "legacy.production.atom",
        subject: {
            origin: "published-beta.23",
            kind: "production-file",
            path: "packages/valdres/src/atom.ts",
        },
        evidence: { gitBlobSha1: "3".repeat(40) },
    })
    const source = `${JSON.stringify(
        {
            $schema: "./schemas/frozen-test-inventory.schema.json",
            schemaVersion: 1,
            baseline: { package: "valdres", version: "1.0.0-beta.23" },
            provenance: {
                sourceRevision: "c071cdaba26a2f30243d43516a199a94a9137c6e",
                releaseRevision: "6adb53a240a84fc90b8ad8dc2af77611e45dfd08",
                sourceTrees: {
                    source: "2e521d12d483d1d59030f95cacac6a1f2801232d",
                    tests: "785381e6d0bf303ad8d67dd3ba2af1f58be2a121",
                },
                publishedPackage: {
                    npmSpec: "valdres@1.0.0-beta.23",
                    tarballSha256:
                        "d98638aa0d8890d35f25b2a132fb7add0355206f925fcf2a4cfe0104a20cafa4",
                },
                sourceLockfile: {
                    path: "bun.lock",
                    gitBlobSha1: "8684a8d328c8e0bfdeb9c7f6ccb849d9cd9ecc05",
                    sha256: "c79a4fe44e6caa93c294744ba6ded67ccf2844286d5218e509cfa944f8b6a2d0",
                },
                testRegistration: {
                    runner: "bun",
                    runnerVersion: "1.4.0",
                    selection: "packages/valdres/**/*.test.ts",
                    files: 5,
                    registeredFiles: 1,
                    zeroRegistrationFiles: ZERO_REGISTRATION_PATHS,
                    tests: 1,
                    minimumAssertions: 328000,
                    failures: 0,
                    skipped: 0,
                },
                generator: "contracts/v1/generate-frozen-test-inventory.ts",
            },
            counts: {
                productionFiles: 1,
                testFiles: 4,
                testCases: 1,
                total: 6,
            },
            entries,
        },
        null,
        2,
    )}\n`
    const header = testDispositionHeader(set)
    header.completeness = "complete"
    header.inventory = {
        status: "frozen",
        catalogPath,
        sha256: createHash("sha256").update(source).digest("hex"),
        expectedDispositionIds: entries
            .filter((entry: any) => entry.subject.kind !== "production-file")
            .map((entry: any) => entry.id),
    }
    set.testDispositionInventoryEvidence = {
        catalogPath,
        bytes: new TextEncoder().encode(source),
    }
}

function testDispositionHeader(set: any): any {
    return set.testDispositionLedger[0]
}

function findPublicEntry(set: any, id: string): any {
    return set.publicManifest.entries.find((entry: any) => entry.id === id)
}

function rootSurface(name: string): any {
    return legacySurface(".", name)
}

function legacySurface(subpath: string, name: string): any {
    return {
        package: "valdres",
        subpath,
        name,
        baseline: "1.0.0-beta.23",
    }
}
