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
    assertPortableShiftXReport,
    assertReviewedCurrentShiftXEvidence,
    loadTestDispositionInventoryEvidence,
    loadTestOwnerEvidence,
    parseTestDispositionLedger,
    validateContractSet,
    type ContractSet,
} from "./check"
import { acquirePublishedTarball } from "./generate-frozen-test-inventory"
import {
    collectFrozenCoordinates,
    coordinateKey,
    generateProposedPublicApiSkeletons,
} from "./generate-public-api-skeletons"

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
        duplicateFrozenExport.frozenLegacySurface.packages[0].entrypoints[0].runtimeExports[1] =
            duplicateFrozenExport.frozenLegacySurface.packages[0].entrypoints[0].runtimeExports[0]
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
            /public API target catalog inventory differs|has no public manifest entry/,
        )

        const missingApiCatalog = mutableSet()
        missingApiCatalog.targetSurfaceCatalog.publicApiIds.pop()
        expect(() => validateContractSet(missingApiCatalog)).toThrow(
            /public API target catalog inventory differs|absent from the target public API catalog/,
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

    test("stable completion is derived from reviewed release-track ownership", () => {
        const set = mutableSet()
        set.publicManifest.completeness = "complete"
        set.callbackManifest.completeness = "complete"
        set.contractCatalog.completeness = "complete"
        set.targetSurfaceCatalog.completeness = "complete"
        const entry = findPublicEntry(set, "core.store.delete")
        entry.decisionStatus = "evidence-required"
        entry.migration.evidenceStatus = "planned"
        expect(() => validateContractSet(set)).toThrow(
            /unresolved decisions|migration evidence/,
        )

        const disguisedStable = mutableSet()
        const betaSearch = findPublicEntry(disguisedStable, "beta.search")
        betaSearch.target.status = "stable"
        expect(() => validateContractSet(disguisedStable)).toThrow(
            /owned by the independent beta but targets the stable\/internal v1 surface|reviewed release-track ownership differs from the independently pinned digest/,
        )

        const selfRelabelled = mutableSet()
        const storeDelete = findPublicEntry(selfRelabelled, "core.store.delete")
        storeDelete.owner = "independent-beta"
        expect(() => validateContractSet(selfRelabelled)).toThrow(
            /owner disagrees with the reviewed independent-beta catalog|reviewed release-track ownership differs from the independently pinned digest/,
        )
    })

    test("cannot complete until current ShiftX evidence is independently pinned", () => {
        expect(() =>
            assertReviewedCurrentShiftXEvidence({
                verdict: "pass",
                remote: "ssh://example.invalid/shiftx.git",
                branch: "synthetic-validation",
                commit: "a".repeat(40),
                dirty: false,
                lockfile: { path: "bun.lock", sha256: "b".repeat(64) },
                packedArtifact: {
                    path: "shiftx-validation.tgz",
                    sha256: "c".repeat(64),
                },
                report: {
                    path: "contracts/v1/shiftx-validation-report.json",
                    sha256: "d".repeat(64),
                },
                checkedPaths: ["packages/shiftx"],
            }),
        ).toThrow(
            /current ShiftX evidence has not been independently reviewed and pinned/,
        )
    })

    test("portable ShiftX reports are exact repository-relative files", () => {
        const temporaryRoot = mkdtempSync(
            join(tmpdir(), "valdres-shiftx-report-"),
        )
        const outsideRoot = mkdtempSync(
            join(tmpdir(), "valdres-shiftx-outside-"),
        )
        try {
            const reportPath = join(temporaryRoot, "evidence/report.json")
            mkdirSync(dirname(reportPath), { recursive: true })
            writeFileSync(reportPath, '{"verdict":"pass"}\n')
            const reportSha256 = createHash("sha256")
                .update(new Uint8Array(readFileSync(reportPath)))
                .digest("hex")
            expect(() =>
                assertPortableShiftXReport(
                    "evidence/report.json",
                    reportSha256,
                    temporaryRoot,
                ),
            ).not.toThrow()
            expect(() =>
                assertPortableShiftXReport(
                    reportPath,
                    reportSha256,
                    temporaryRoot,
                ),
            ).toThrow(/must be repository-relative/)
            expect(() =>
                assertPortableShiftXReport(
                    "../outside.json",
                    reportSha256,
                    temporaryRoot,
                ),
            ).toThrow(/escapes the repository/)

            const outsideReport = join(outsideRoot, "report.json")
            writeFileSync(outsideReport, '{"verdict":"pass"}\n')
            symlinkSync(
                outsideReport,
                join(temporaryRoot, "linked-report.json"),
            )
            expect(() =>
                assertPortableShiftXReport(
                    "linked-report.json",
                    reportSha256,
                    temporaryRoot,
                ),
            ).toThrow(/escapes the repository/)
            expect(() =>
                assertPortableShiftXReport(
                    "evidence/report.json",
                    "0".repeat(64),
                    temporaryRoot,
                ),
            ).toThrow(/SHA-256 differs/)
        } finally {
            rmSync(temporaryRoot, { recursive: true, force: true })
            rmSync(outsideRoot, { recursive: true, force: true })
        }
    })

    test("duplicate padding cannot open the completion gate", () => {
        const set = completeCandidate()
        const runtimeEntry = findPublicEntry(set, "core.atom")
        runtimeEntry.legacy.push(structuredClone(runtimeEntry.legacy[0]))

        expect(() => validateContractSet(set)).toThrow(
            /duplicate frozen legacy coordinate/,
        )
    })

    test("complete inventories must exactly match frozen coordinates", () => {
        const set = completeCandidate()
        const runtimeEntry = findPublicEntry(set, "core.atom")
        runtimeEntry.legacy = [rootSurface("InventedRuntime")]

        expect(() => validateContractSet(set)).toThrow(
            /claims a legacy coordinate absent from the frozen inventory/,
        )
    })

    test("complete inventories include adapter-internals/v1 exports", () => {
        const set = completeCandidate()
        const mapping = set.legacyDispositionCatalog.entries.find(
            (entry: any) =>
                entry.coordinate.subpath === "./adapter-internals/v1" &&
                entry.coordinate.name === "storeAdapter",
        )
        findPublicEntry(set, mapping.dispositionId).legacy = []
        expect(() => validateContractSet(set)).toThrow(
            /legacy disposition mapping .* is missing/,
        )
    })

    test("reviewed ownership rejects bulk-attaching keep, replace, and remove exports to atom", () => {
        const set = completeCandidate()
        const atomEntry = findPublicEntry(set, "core.atom")
        const exports = set.publicManifest.entries.flatMap((entry: any) =>
            entry.legacy.filter(
                (surface: any) =>
                    surface.kind === "runtime-export" ||
                    surface.kind === "type-export",
            ),
        )
        expect(
            exports.some((surface: any) => surface.name === "atomFamily"),
        ).toBe(true)
        expect(
            exports.some((surface: any) => surface.name === "globalAtom"),
        ).toBe(true)
        for (const entry of set.publicManifest.entries) {
            entry.legacy = entry.legacy.filter(
                (surface: any) =>
                    surface.kind !== "runtime-export" &&
                    surface.kind !== "type-export",
            )
        }
        atomEntry.legacy.push(...exports)

        expect(() => validateContractSet(set)).toThrow(
            /legacy disposition mapping .* is missing|claims .* but reviewed disposition ownership belongs to/,
        )
    })

    test("reviewed ownership cannot self-authorize by changing both writable artifacts", () => {
        const set = mutableSet()
        const atomEntry = findPublicEntry(set, "core.atom")
        const familyEntry = findPublicEntry(set, "core.family")
        const atomFamily = familyEntry.legacy.find(
            (surface: any) => surface.name === "atomFamily",
        )
        familyEntry.legacy = familyEntry.legacy.filter(
            (surface: any) => surface.name !== "atomFamily",
        )
        atomEntry.legacy.push(structuredClone(atomFamily))
        set.legacyDispositionCatalog.entries.find(
            (mapping: any) => mapping.coordinate.name === "atomFamily",
        ).dispositionId = "core.atom"

        expect(() => validateContractSet(set)).toThrow(
            /reviewed legacy disposition ownership differs from the independently pinned digest/,
        )
    })

    test("release-track ownership cannot self-authorize across manifests", () => {
        const relabelledPublic = mutableSet()
        const storeDelete = findPublicEntry(
            relabelledPublic,
            "core.store.delete",
        )
        storeDelete.owner = "independent-beta"
        storeDelete.target.status = "experimental"
        storeDelete.decisionStatus = "evidence-required"
        relabelledPublic.targetSurfaceCatalog.independentBetaPublicApiIds.push(
            "core.store.delete",
        )
        expect(() => validateContractSet(relabelledPublic)).toThrow(
            /reviewed release-track ownership differs from the independently pinned digest/,
        )

        const relabelledCallback = mutableSet()
        relabelledCallback.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.store-subscriber",
        ).apiEntryId = "beta.search"
        expect(() => validateContractSet(relabelledCallback)).toThrow(
            /callback\.store-subscriber differs from the frozen zero-argument invalidator, quarantine, ordering, all-fire, or unsubscribe contract/,
        )

        const inventedPendingDecision = mutableSet()
        inventedPendingDecision.targetSurfaceCatalog.pendingSurfaceDecisions.push(
            {
                id: "pending.error-names",
                category: "error-names",
                status: "pending",
                notes: "A resolved surface cannot be reopened by editing the writable catalog.",
            },
        )
        expect(() => validateContractSet(inventedPendingDecision)).toThrow(
            /reviewed release-track ownership differs from the independently pinned digest/,
        )
    })

    test("complete inventories cannot omit a React export", () => {
        const set = completeCandidate()
        removeLegacyCoordinate(set, {
            package: "valdres-react",
            kind: "runtime-export",
            owner: null,
            name: "useAtom",
        })
        expect(() => validateContractSet(set)).toThrow(
            /legacy disposition mapping .* is missing/,
        )
    })

    test("complete inventories cannot omit Store or Transaction members", () => {
        for (const [owner, name] of [
            ["Store", "get(atom)"],
            ["Transaction", "reset"],
        ] as const) {
            const set = completeCandidate()
            removeLegacyCoordinate(set, {
                package: "valdres",
                kind: name.includes("(") ? "overload" : "method",
                owner,
                name,
            })
            expect(() => validateContractSet(set)).toThrow(
                /legacy disposition mapping .* is missing/,
            )
        }
    })

    test("React legacy rows must use the pinned beta.4 provenance", () => {
        const set = mutableSet()
        findPublicEntry(set, "react.provider").legacy[0].baseline =
            "1.0.0-beta.23"
        expect(() => validateContractSet(set)).toThrow(
            /claims a legacy coordinate absent from the frozen inventory/,
        )
    })

    test("approved stable targets must appear in the independent coordinate catalog", () => {
        const set = mutableSet()
        set.targetSurfaceCatalog.frozenPublicCoordinates =
            set.targetSurfaceCatalog.frozenPublicCoordinates.filter(
                (coordinate: any) => coordinate.id !== "core.atom",
            )
        expect(() => validateContractSet(set)).toThrow(
            /core\.atom has an approved stable target absent from the independent target coordinate catalog/,
        )
    })

    test("a ShiftX status flip without stamped external evidence cannot complete", () => {
        const set = mutableSet()
        set.publicManifest.generatedAgainst.currentShiftX.status = "complete"
        expect(() => validateContractSet(set)).toThrow(
            /public-api\.json schema validation failed|required property 'evidence'/,
        )
    })

    test("partial manifests cannot self-assert fabricated complete ShiftX evidence", () => {
        const set = mutableSet()
        set.publicManifest.generatedAgainst.currentShiftX = {
            status: "complete",
            notes: "Fabricated evidence must fail even while manifests are partial.",
            evidence: {
                verdict: "pass",
                remote: "ssh://example.invalid/shiftx.git",
                branch: "fabricated",
                commit: "a".repeat(40),
                dirty: false,
                lockfile: { path: "bun.lock", sha256: "b".repeat(64) },
                packedArtifact: {
                    path: "valdres-fake.tgz",
                    sha256: "c".repeat(64),
                },
                report: {
                    path: "contracts/v1/SHIFTX_HANDOFF.md",
                    sha256: createHash("sha256")
                        .update(
                            new Uint8Array(
                                readFileSync(
                                    join(directory, "SHIFTX_HANDOFF.md"),
                                ),
                            ),
                        )
                        .digest("hex"),
                },
                checkedPaths: ["packages/shiftx"],
            },
        }
        expect(() => validateContractSet(set)).toThrow(
            /current ShiftX evidence has not been independently reviewed and pinned/,
        )
    })

    test("generates deterministic evidence-free skeletons for every unowned frozen coordinate", () => {
        const set = mutableSet()
        const first = generateProposedPublicApiSkeletons(
            set.frozenLegacySurface,
            set.legacyDispositionCatalog,
        )
        const second = generateProposedPublicApiSkeletons(
            set.frozenLegacySurface,
            set.legacyDispositionCatalog,
        )
        expect(first).toEqual(second)
        expect(first.length).toBe(
            collectFrozenCoordinates(set.frozenLegacySurface).length -
                set.legacyDispositionCatalog.entries.length,
        )
        expect(
            first.every(
                skeleton =>
                    skeleton.decisionStatus === "pending-review" &&
                    skeleton.contractIds.length === 0 &&
                    !("evidence" in skeleton),
            ),
        ).toBe(true)
        expect(
            new Set(first.map(skeleton => skeleton.dispositionId)).size,
        ).toBe(first.length)
        const reviewedCoordinates = new Set(
            set.legacyDispositionCatalog.entries.map((entry: any) =>
                coordinateKey(entry.coordinate),
            ),
        )
        expect(
            new Set(first.map(skeleton => coordinateKey(skeleton.legacy))),
        ).toEqual(
            new Set(
                collectFrozenCoordinates(set.frozenLegacySurface)
                    .map(coordinateKey)
                    .filter(coordinate => !reviewedCoordinates.has(coordinate)),
            ),
        )
    })

    test("reviewed public dispositions own all 174 frozen coordinates", () => {
        const set = mutableSet()
        const frozenCoordinates = collectFrozenCoordinates(
            set.frozenLegacySurface,
        )
        expect(set.legacyDispositionCatalog.entries).toHaveLength(174)
        expect(
            set.legacyDispositionCatalog.entries.every(
                (entry: any) => entry.reviewStatus === "approved",
            ),
        ).toBe(true)
        expect(
            generateProposedPublicApiSkeletons(
                set.frozenLegacySurface,
                set.legacyDispositionCatalog,
            ),
        ).toEqual([])
        expect(
            new Set(
                set.legacyDispositionCatalog.entries.map((entry: any) =>
                    coordinateKey(entry.coordinate),
                ),
            ),
        ).toEqual(new Set(frozenCoordinates.map(coordinateKey)))

        const migrationModeById = new Map<string, string>(
            set.publicManifest.entries.map((entry: any) => [
                entry.id,
                entry.migration.mode,
            ]),
        )
        const modeCounts = set.legacyDispositionCatalog.entries.reduce(
            (counts: Record<string, number>, mapping: any) => {
                const mode = migrationModeById.get(mapping.dispositionId)!
                counts[mode] = (counts[mode] ?? 0) + 1
                return counts
            },
            {},
        )
        expect(modeCounts).toEqual({
            keep: 41,
            replace: 39,
            remove: 70,
            move: 24,
        })

        const beforeRecovery: any[] = [
            legacySurface(".", "atom"),
            legacySurface(".", "selector"),
            legacySurface(".", "atomFamily"),
            legacySurface(".", "selectorFamily"),
            legacySurface(".", "store"),
            {
                kind: "overload",
                package: "valdres",
                subpath: ".",
                owner: "Store",
                name: "scope(id)",
                baseline: "1.0.0-beta.23",
            },
            {
                kind: "overload",
                package: "valdres",
                subpath: ".",
                owner: "Store",
                name: "txn(callback)",
                baseline: "1.0.0-beta.23",
            },
            {
                kind: "method",
                package: "valdres",
                subpath: ".",
                owner: "Store",
                name: "del",
                baseline: "1.0.0-beta.23",
            },
            legacySurface(".", "globalAtom"),
            legacySurface(".", "globalStore"),
            {
                kind: "method",
                package: "valdres",
                subpath: ".",
                owner: "Store",
                name: "onDispose",
                baseline: "1.0.0-beta.23",
            },
            ...[
                "Provider",
                "Scope",
                "useStore",
                "useValue",
                "useTransaction",
                "useValdresCallback",
            ].map(name => ({
                kind: "runtime-export",
                package: "valdres-react",
                subpath: ".",
                name,
                baseline: "1.0.0-beta.4",
            })),
            legacySurface(".", "cacheMeta"),
        ]
        expect(beforeRecovery).toHaveLength(18)
        const beforeRecoveryKeys = new Set(beforeRecovery.map(coordinateKey))
        const recoveredModeCounts = set.legacyDispositionCatalog.entries
            .filter(
                (mapping: any) =>
                    !beforeRecoveryKeys.has(coordinateKey(mapping.coordinate)),
            )
            .reduce((counts: Record<string, number>, mapping: any) => {
                const mode = migrationModeById.get(mapping.dispositionId)!
                counts[mode] = (counts[mode] ?? 0) + 1
                return counts
            }, {})
        expect(recoveredModeCounts).toEqual({
            keep: 36,
            replace: 33,
            remove: 64,
            move: 23,
        })
    })

    test("freezes the internal peer-owned adapter-internals/v1 protocol without a wrapper", () => {
        const set = mutableSet()
        const expected = new Map<string, string>([
            ["adapter.assert-store", "assertStore"],
            ["adapter.read", "read"],
            ["adapter.read-hydration-snapshot", "readHydrationSnapshot"],
            ["adapter.subscribe", "subscribe"],
            ["adapter.v1-subpath", "valdres/adapter-internals/v1"],
        ])
        const entries = set.publicManifest.entries.filter(
            (entry: any) =>
                entry.target.status === "internal" &&
                entry.target.subpath === "./adapter-internals/v1",
        )

        expect(
            new Map(entries.map((entry: any) => [entry.id, entry.target.name])),
        ).toEqual(expected)
        expect(
            entries.every(
                (entry: any) =>
                    entry.target.package === "valdres" &&
                    entry.migration.mode === "add" &&
                    entry.migration.semver === "new" &&
                    entry.contractIds.includes("adapter.peer-owned-protocol"),
            ),
        ).toBe(true)
        expect(
            set.targetSurfaceCatalog.frozenPublicCoordinates
                .filter(
                    (coordinate: any) =>
                        coordinate.subpath === "./adapter-internals/v1",
                )
                .map((coordinate: any) => [coordinate.id, coordinate.name]),
        ).toEqual([...expected])

        const subscriber = set.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.adapter-subscriber",
        )
        expect(subscriber?.apiEntryId).toBe("adapter.subscribe")
        expect(subscriber?.resultBoundary).toContain(
            "no delivery wrapper, batching hook, Transaction, Store ID, or adapter options",
        )
        expect(subscriber?.errorRule).toContain("CallbackCapabilityError")
        expect(subscriber?.errorRule).toContain("DormantExternalReadError")

        const removedWrapper = findPublicEntry(set, "legacy.store-adapter")
        expect(removedWrapper.target.status).toBe("removed")
        expect(removedWrapper.migration.mode).toBe("remove")
        expect(removedWrapper.migration.replacementIds).toEqual([
            "adapter.assert-store",
            "adapter.read",
            "adapter.read-hydration-snapshot",
            "adapter.subscribe",
        ])

        const renamedEverywhere = mutableSet()
        findPublicEntry(renamedEverywhere, "adapter.read").target.name =
            "getSnapshot"
        renamedEverywhere.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) => coordinate.id === "adapter.read",
        ).name = "getSnapshot"
        expect(() => validateContractSet(renamedEverywhere)).toThrow(
            /adapter\.read frozen target catalog coordinate differs from the required standalone spelling/,
        )

        const publishedAsStable = mutableSet()
        findPublicEntry(
            publishedAsStable,
            "adapter.read-hydration-snapshot",
        ).target.status = "stable"
        expect(() => validateContractSet(publishedAsStable)).toThrow(
            /adapter\.read-hydration-snapshot must remain internal/,
        )
    })

    test("freezes the callback and external failure names and codes", () => {
        const set = mutableSet()
        const expected = new Map<string, readonly [string, string]>([
            [
                "core.callback-capability-error",
                ["CallbackCapabilityError", "VALDRES_CALLBACK_CAPABILITY"],
            ],
            [
                "core.dormant-external-read-error",
                ["DormantExternalReadError", "VALDRES_DORMANT_EXTERNAL_READ"],
            ],
            [
                "core.invalid-external-cleanup-error",
                [
                    "InvalidExternalCleanupError",
                    "VALDRES_INVALID_EXTERNAL_CLEANUP",
                ],
            ],
            [
                "core.external-source-non-convergence-error",
                [
                    "ExternalSourceNonConvergenceError",
                    "VALDRES_EXTERNAL_SOURCE_NON_CONVERGENCE",
                ],
            ],
            [
                "core.external-source-delivery-limit-error",
                [
                    "ExternalSourceDeliveryLimitError",
                    "VALDRES_EXTERNAL_SOURCE_DELIVERY_LIMIT",
                ],
            ],
            [
                "core.server-snapshot-unavailable-error",
                [
                    "ServerSnapshotUnavailableError",
                    "VALDRES_SERVER_SNAPSHOT_UNAVAILABLE",
                ],
            ],
            [
                "core.subscriber-notification-error",
                [
                    "SubscriberNotificationError",
                    "VALDRES_SUBSCRIBER_NOTIFICATION",
                ],
            ],
        ])

        for (const [id, [name, code]] of expected) {
            const entry = findPublicEntry(set, id)
            expect(entry.kind).toBe("error")
            expect(entry.target).toEqual({
                package: "valdres",
                subpath: ".",
                name,
                status: "stable",
            })
            expect(entry.errorCode).toBe(code)
            expect(entry.migration.mode).toBe("add")
            expect(entry.migration.semver).toBe("new")
            expect(entry.contractIds).toContain("error.stable-name-and-code")
            expect(
                set.targetSurfaceCatalog.frozenPublicCoordinates.find(
                    (coordinate: any) => coordinate.id === id,
                ),
            ).toEqual({
                id,
                kind: "error",
                package: "valdres",
                subpath: ".",
                name,
                errorCode: code,
            })
        }
        expect(
            findPublicEntry(set, "core.runtime-mismatch-error").errorCode,
        ).toBe("VALDRES_RUNTIME_MISMATCH")

        const callbackErrorRules = new Map<string, readonly string[]>([
            [
                "callback.adapter-subscriber",
                ["CallbackCapabilityError", "DormantExternalReadError"],
            ],
            ["callback.external-get-snapshot", ["CallbackCapabilityError"]],
            [
                "callback.external-get-server-snapshot",
                ["CallbackCapabilityError", "ServerSnapshotUnavailableError"],
            ],
            [
                "callback.external-subscribe",
                ["CallbackCapabilityError", "InvalidExternalCleanupError"],
            ],
            [
                "callback.external-cleanup",
                ["CallbackCapabilityError", "InvalidExternalCleanupError"],
            ],
            [
                "callback.store-subscriber",
                [
                    "CallbackCapabilityError",
                    "DormantExternalReadError",
                    "SubscriberNotificationError",
                ],
            ],
        ])
        for (const [callbackId, names] of callbackErrorRules) {
            const callback = set.callbackManifest.entries.find(
                (entry: any) => entry.id === callbackId,
            )
            for (const name of names) {
                expect(callback?.errorRule).toContain(name)
            }
        }

        const changedEverywhere = mutableSet()
        findPublicEntry(
            changedEverywhere,
            "core.dormant-external-read-error",
        ).errorCode = "VALDRES_DORMANT_READ"
        changedEverywhere.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) =>
                coordinate.id === "core.dormant-external-read-error",
        ).errorCode = "VALDRES_DORMANT_READ"
        expect(() => validateContractSet(changedEverywhere)).toThrow(
            /core\.dormant-external-read-error differs from the required stable error code/,
        )

        const codeOnNonError = mutableSet()
        findPublicEntry(codeOnNonError, "core.atom").errorCode =
            "VALDRES_NOT_AN_ERROR"
        expect(() => validateContractSet(codeOnNonError)).toThrow(
            /core\.atom has an error code but is not an error entry/,
        )
    })

    test("freezes Store.sub as a zero-argument ordered invalidator with committed error metadata", () => {
        const set = mutableSet()
        const subscriber = set.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.store-subscriber",
        )
        expect(subscriber.apiEntryId).toBe("core.store.sub")
        expect(subscriber.phase).toBe("notifying")
        expect(subscriber.suppliedCapabilities).toEqual([
            "zero-argument invalidation signal; no settled value argument",
            "idempotent unsubscribe for already-owned subscription",
            "committed reads that do not sample dormant external sources",
        ])
        expect(subscriber.resultBoundary).toContain(
            "Store.sub(state, callback: () => void): () => void",
        )
        expect(subscriber.resultBoundary).toContain(
            "successfully materialized ordinary current error outcome so it can register",
        )
        expect(subscriber.resultBoundary).toContain(
            "only admission, disposal, or internal-publication failure registers nothing",
        )
        expect(subscriber.resultBoundary).toContain(
            "A lifecycle-free registration does not notify",
        )
        expect(subscriber.resultBoundary).toContain("first-reaching order")
        expect(subscriber.resultBoundary).toContain(
            "subscription insertion order",
        )
        expect(subscriber.resultBoundary).toContain(
            "cannot edit the current snapshot",
        )
        expect(subscriber.thenableRule).toContain(
            "A returned thenable receives exactly one stateless rejection-containment handler",
        )
        expect(subscriber.thenableRule).toContain(
            "does not itself create a notification error",
        )
        expect(subscriber.thenableRule).toContain(
            "A thrown thenable receives exactly one stateless rejection-containment handler",
        )
        expect(subscriber.thenableRule).toContain(
            "remains the exact ordered subscriber cause",
        )
        expect(
            subscriber.thenableRule.match(
                /receives exactly one stateless rejection-containment handler/g,
            ),
        ).toHaveLength(2)
        expect(subscriber.thenableRule.match(/is never awaited/g)).toHaveLength(
            2,
        )
        expect(subscriber.decisionStatus).toBe("approved")

        const notificationError = findPublicEntry(
            set,
            "core.subscriber-notification-error",
        )
        expect(notificationError.target.name).toBe(
            "SubscriberNotificationError",
        )
        expect(notificationError.errorCode).toBe(
            "VALDRES_SUBSCRIBER_NOTIFICATION",
        )
        for (const metadata of [
            "exact first thrown value",
            "frozen readonly array",
            "committed is exactly true",
            "phase is exactly notifying",
            "source is exactly owned-mutation",
        ]) {
            expect(notificationError.notes).toContain(metadata)
        }

        const coordinatedValueCallback = mutableSet()
        const changedSubscriber =
            coordinatedValueCallback.callbackManifest.entries.find(
                (entry: any) => entry.id === "callback.store-subscriber",
            )
        changedSubscriber.role = "Deliver one settled callback value."
        changedSubscriber.suppliedCapabilities[0] = "settled callback value"
        changedSubscriber.resultBoundary =
            "Store.sub(state, callback: (value: unknown) => void): () => void delivers values."
        findPublicEntry(coordinatedValueCallback, "core.store.sub").notes =
            "Store.sub delivers settled values."
        findPublicEntry(
            coordinatedValueCallback,
            "core.type.subscribe-fn",
        ).notes = "SubscribeFn accepts a value callback."
        expect(() => validateContractSet(coordinatedValueCallback)).toThrow(
            /frozen zero-argument invalidator|frozen zero-argument subscription signature/,
        )

        const coordinatedMetadataChange = mutableSet()
        coordinatedMetadataChange.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.store-subscriber",
        ).errorRule = subscriber.errorRule.replace(
            "committed true",
            "committed false",
        )
        findPublicEntry(
            coordinatedMetadataChange,
            "core.subscriber-notification-error",
        ).notes = notificationError.notes.replace(
            "committed is exactly true",
            "committed is exactly false",
        )
        expect(() => validateContractSet(coordinatedMetadataChange)).toThrow(
            /frozen zero-argument invalidator|frozen class, code, cause ledger, or committed notification metadata/,
        )

        const coordinatedOrderChange = mutableSet()
        coordinatedOrderChange.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.store-subscriber",
        ).resultBoundary = subscriber.resultBoundary.replace(
            "first-reaching order",
            "last-reaching order",
        )
        findPublicEntry(coordinatedOrderChange, "core.store.sub").notes =
            findPublicEntry(
                coordinatedOrderChange,
                "core.store.sub",
            ).notes.replace("first-reaching order", "last-reaching order")
        expect(() => validateContractSet(coordinatedOrderChange)).toThrow(
            /frozen zero-argument invalidator|frozen zero-argument subscription signature/,
        )

        const coordinatedThenableChange = mutableSet()
        coordinatedThenableChange.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.store-subscriber",
        ).thenableRule = subscriber.thenableRule.replace(
            "does not itself create a notification error",
            "creates a notification error",
        )
        expect(() => validateContractSet(coordinatedThenableChange)).toThrow(
            /frozen zero-argument invalidator/,
        )

        const coordinatedAdmissionChange = mutableSet()
        coordinatedAdmissionChange.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.store-subscriber",
        ).resultBoundary = subscriber.resultBoundary.replace(
            "ordinary current error outcome so it can register",
            "ordinary current error outcome so registration fails",
        )
        findPublicEntry(coordinatedAdmissionChange, "core.store.sub").notes =
            findPublicEntry(
                coordinatedAdmissionChange,
                "core.store.sub",
            ).notes.replace(
                "ordinary current error outcome so it can register",
                "ordinary current error outcome so registration fails",
            )
        expect(() => validateContractSet(coordinatedAdmissionChange)).toThrow(
            /frozen zero-argument invalidator|frozen zero-argument subscription signature/,
        )

        const coordinatedCauseChange = mutableSet()
        coordinatedCauseChange.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.store-subscriber",
        ).errorRule = subscriber.errorRule.replace(
            "exact first thrown value",
            "exact last thrown value",
        )
        findPublicEntry(
            coordinatedCauseChange,
            "core.subscriber-notification-error",
        ).notes = notificationError.notes.replace(
            "exact first thrown value",
            "exact last thrown value",
        )
        expect(() => validateContractSet(coordinatedCauseChange)).toThrow(
            /frozen zero-argument invalidator|frozen class, code, cause ledger, or committed notification metadata/,
        )

        const coordinatedUnsubscribeChange = mutableSet()
        coordinatedUnsubscribeChange.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.store-subscriber",
        ).resultBoundary = subscriber.resultBoundary.replace(
            "removes future eligibility immediately",
            "removes future eligibility after delivery",
        )
        findPublicEntry(coordinatedUnsubscribeChange, "core.store.sub").notes =
            findPublicEntry(
                coordinatedUnsubscribeChange,
                "core.store.sub",
            ).notes.replace(
                "removes future eligibility immediately",
                "removes future eligibility after delivery",
            )
        expect(() => validateContractSet(coordinatedUnsubscribeChange)).toThrow(
            /frozen zero-argument invalidator|frozen zero-argument subscription signature/,
        )
    })

    test("keeps an authoritative post-apply RuntimeMismatchError primary across subscriber throws", () => {
        const set = mutableSet()
        const subscriber = set.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.store-subscriber",
        )
        const storeSub = findPublicEntry(set, "core.store.sub")
        const notificationError = findPublicEntry(
            set,
            "core.subscriber-notification-error",
        )
        const directMismatchClause =
            "If no subscriber throws, the exact RuntimeMismatchError surfaces directly after all callbacks are attempted"
        const coexistenceLedgerClause =
            "SubscriberNotificationError is the required outer wrapper with cause equal to the exact RuntimeMismatchError and frozen causes equal to [mismatch, ...subscriber throws in delivery order]"
        const secondaryCauseClause =
            "every subscriber throw is retained as a secondary cause in delivery order"

        for (const contractText of [
            subscriber.errorRule,
            storeSub.notes,
            notificationError.notes,
        ]) {
            expect(contractText).toContain(directMismatchClause)
            expect(contractText).toContain(coexistenceLedgerClause)
            expect(contractText).toContain(secondaryCauseClause)
            expect(contractText).toContain(
                "the mismatch remains the semantic primary and is not replaced",
            )
        }
        expect(subscriber.errorRule).toContain("Delivery remains all-fire")

        const rewriteCoordinatedCollisionRule = (
            candidate: any,
            from: string,
            to: string,
        ): void => {
            const candidateSubscriber = candidate.callbackManifest.entries.find(
                (entry: any) => entry.id === "callback.store-subscriber",
            )
            const candidateStoreSub = findPublicEntry(
                candidate,
                "core.store.sub",
            )
            const candidateNotificationError = findPublicEntry(
                candidate,
                "core.subscriber-notification-error",
            )
            candidateSubscriber.errorRule =
                candidateSubscriber.errorRule.replace(from, to)
            candidateStoreSub.notes = candidateStoreSub.notes.replace(from, to)
            candidateNotificationError.notes =
                candidateNotificationError.notes.replace(from, to)

            for (const contractText of [
                candidateSubscriber.errorRule,
                candidateStoreSub.notes,
                candidateNotificationError.notes,
            ]) {
                expect(contractText).toContain(to)
            }
        }

        const wrappedWithoutSubscriberThrow = mutableSet()
        rewriteCoordinatedCollisionRule(
            wrappedWithoutSubscriberThrow,
            directMismatchClause,
            "If no subscriber throws, SubscriberNotificationError replaces the exact RuntimeMismatchError",
        )
        expect(() =>
            validateContractSet(wrappedWithoutSubscriberThrow),
        ).toThrow(
            /frozen zero-argument invalidator|frozen class, code, cause ledger, or committed notification metadata/,
        )

        const omittedMismatchFromLedger = mutableSet()
        rewriteCoordinatedCollisionRule(
            omittedMismatchFromLedger,
            coexistenceLedgerClause,
            "SubscriberNotificationError is the outer wrapper with cause equal to the first subscriber throw and frozen causes that omit the mismatch",
        )
        expect(() => validateContractSet(omittedMismatchFromLedger)).toThrow(
            /frozen zero-argument invalidator|frozen class, code, cause ledger, or committed notification metadata/,
        )
    })

    test("freezes scope and transaction targeting failure ownership", () => {
        const set = mutableSet()
        const expected = new Map([
            [
                "core.store-disposed-error",
                {
                    name: "StoreDisposedError",
                    code: "VALDRES_STORE_DISPOSED",
                    mode: "keep",
                    semver: "breaking",
                    contractIds: [
                        "error.stable-name-and-code",
                        "runtime.before-work-owner-check",
                        "scope.explicit-disposal",
                        "store.explicit-owner-teardown",
                    ],
                },
            ],
            [
                "core.scope-not-found-error",
                {
                    name: "ScopeNotFoundError",
                    code: "VALDRES_SCOPE_NOT_FOUND",
                    mode: "add",
                    semver: "new",
                    contractIds: [
                        "error.stable-name-and-code",
                        "runtime.before-work-owner-check",
                        "scope.parent-local-name",
                        "transaction.scope-cursor-no-savepoint",
                    ],
                },
            ],
            [
                "core.store-tree-mismatch-error",
                {
                    name: "StoreTreeMismatchError",
                    code: "VALDRES_STORE_TREE_MISMATCH",
                    mode: "add",
                    semver: "new",
                    contractIds: [
                        "error.stable-name-and-code",
                        "no-writable-cross-tree-state",
                        "runtime.before-work-owner-check",
                        "transaction.one-tree-draft",
                        "transaction.scope-cursor-no-savepoint",
                    ],
                },
            ],
            [
                "core.invalid-transaction-target-error",
                {
                    name: "InvalidTransactionTargetError",
                    code: "VALDRES_INVALID_TRANSACTION_TARGET",
                    mode: "add",
                    semver: "new",
                    contractIds: [
                        "error.stable-name-and-code",
                        "runtime.before-work-owner-check",
                        "transaction.one-tree-draft",
                        "transaction.scope-cursor-no-savepoint",
                    ],
                },
            ],
        ] as const)

        for (const [id, ownership] of expected) {
            const entry = findPublicEntry(set, id)
            expect(entry.kind).toBe("error")
            expect(entry.target).toEqual({
                package: "valdres",
                subpath: ".",
                name: ownership.name,
                status: "stable",
            })
            expect(entry.errorCode).toBe(ownership.code)
            expect(entry.migration.mode).toBe(ownership.mode)
            expect(entry.migration.semver).toBe(ownership.semver)
            expect(entry.contractIds).toEqual(ownership.contractIds)
            expect(
                set.targetSurfaceCatalog.frozenPublicCoordinates.find(
                    (coordinate: any) => coordinate.id === id,
                ),
            ).toEqual({
                id,
                kind: "error",
                package: "valdres",
                subpath: ".",
                name: ownership.name,
                errorCode: ownership.code,
            })
        }

        const disposed = findPublicEntry(set, "core.store-disposed-error")
        expect(disposed.owner).toBe("core")
        expect(disposed.legacy).toEqual([
            {
                kind: "runtime-export",
                package: "valdres",
                subpath: ".",
                name: "StoreDisposedError",
                baseline: "1.0.0-beta.23",
            },
        ])
        for (const id of [
            "core.scope-not-found-error",
            "core.store-tree-mismatch-error",
            "core.invalid-transaction-target-error",
        ]) {
            expect(findPublicEntry(set, id).legacy).toEqual([])
        }

        const changedEverywhere = mutableSet()
        findPublicEntry(
            changedEverywhere,
            "core.scope-not-found-error",
        ).errorCode = "VALDRES_MISSING_SCOPE"
        changedEverywhere.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) => coordinate.id === "core.scope-not-found-error",
        ).errorCode = "VALDRES_MISSING_SCOPE"
        expect(() => validateContractSet(changedEverywhere)).toThrow(
            /core\.scope-not-found-error differs from the required stable error code VALDRES_SCOPE_NOT_FOUND/,
        )

        const droppedContract = mutableSet()
        findPublicEntry(
            droppedContract,
            "core.store-tree-mismatch-error",
        ).contractIds = [
            "error.stable-name-and-code",
            "runtime.before-work-owner-check",
            "transaction.one-tree-draft",
            "transaction.scope-cursor-no-savepoint",
        ]
        expect(() => validateContractSet(droppedContract)).toThrow(
            /core\.store-tree-mismatch-error differs from the required execution-error contract ownership/,
        )

        const droppedCodeCoordinate = mutableSet()
        delete findPublicEntry(
            droppedCodeCoordinate,
            "core.store-disposed-error",
        ).errorCode
        delete droppedCodeCoordinate.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) => coordinate.id === "core.store-disposed-error",
        ).errorCode
        expect(() => validateContractSet(droppedCodeCoordinate)).toThrow(
            /frozen error code coordinate inventory differs from the frozen surface; missing: core\.store-disposed-error/,
        )
    })

    test("preserves phase-specific callback errors and runtime activity ownership", () => {
        const set = mutableSet()
        const executionErrors = new Map<string, readonly [string, string]>([
            [
                "core.invalid-atom-comparator-result-error",
                [
                    "InvalidAtomComparatorResultError",
                    "VALDRES_INVALID_ATOM_COMPARATOR_RESULT",
                ],
            ],
            [
                "core.invalid-synchronous-atom-value-error",
                [
                    "InvalidSynchronousAtomValueError",
                    "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
                ],
            ],
            [
                "core.invalid-transaction-callback-result-error",
                [
                    "InvalidTransactionCallbackResultError",
                    "VALDRES_INVALID_TRANSACTION_CALLBACK_RESULT",
                ],
            ],
            [
                "core.selector-capability-error",
                [
                    "SelectorCapabilityError",
                    "VALDRES_SELECTOR_CAPABILITY_ERROR",
                ],
            ],
            [
                "core.transaction-closed-error",
                ["TransactionClosedError", "VALDRES_TRANSACTION_CLOSED"],
            ],
            [
                "core.transaction-phase-error",
                ["TransactionPhaseError", "VALDRES_TRANSACTION_PHASE"],
            ],
        ])
        for (const [id, [name, code]] of executionErrors) {
            const entry = findPublicEntry(set, id)
            expect(entry.target).toEqual({
                package: "valdres",
                subpath: ".",
                name,
                status: "stable",
            })
            expect(entry.errorCode).toBe(code)
            expect(entry.contractIds).toContain("error.stable-name-and-code")
            expect(
                set.targetSurfaceCatalog.frozenPublicCoordinates.find(
                    (coordinate: any) => coordinate.id === id,
                ),
            ).toMatchObject({ id, name, errorCode: code })
        }

        const phaseSpecificErrors = new Map<string, string>([
            ["callback.selector-getter", "SelectorCapabilityError"],
            ["callback.selector-comparator", "SelectorCapabilityError"],
            ["callback.transaction", "TransactionPhaseError"],
            ["callback.transaction-scope", "TransactionPhaseError"],
        ])
        for (const [callbackId, errorName] of phaseSpecificErrors) {
            const callback = set.callbackManifest.entries.find(
                (entry: any) => entry.id === callbackId,
            )
            expect(callback?.errorRule).toContain(errorName)
            expect(callback?.errorRule).not.toContain("CallbackCapabilityError")
        }

        for (const callback of set.callbackManifest.entries) {
            expect(JSON.stringify(callback)).not.toContain(
                "ExternalSourceNonConvergenceError",
            )
            expect(JSON.stringify(callback)).not.toContain(
                "ExternalSourceDeliveryLimitError",
            )
        }
        const outcomeErrors = new Map<string, string>([
            [
                "callback.atom-lazy-initializer",
                "InvalidSynchronousAtomValueError",
            ],
            ["callback.atom-comparator", "InvalidAtomComparatorResultError"],
            ["callback.atom-update", "InvalidSynchronousAtomValueError"],
            ["callback.transaction", "InvalidTransactionCallbackResultError"],
            [
                "callback.transaction-scope",
                "InvalidTransactionCallbackResultError",
            ],
        ])
        for (const [callbackId, errorName] of outcomeErrors) {
            const callback = set.callbackManifest.entries.find(
                (entry: any) => entry.id === callbackId,
            )
            expect(JSON.stringify(callback)).toContain(errorName)
        }
        expect(
            findPublicEntry(set, "core.external-source-non-convergence-error")
                .contractIds,
        ).toContain("external.bounded-settlement")
        expect(
            findPublicEntry(set, "core.external-source-delivery-limit-error")
                .contractIds,
        ).toContain("external.bounded-settlement")

        const genericSweep = mutableSet()
        genericSweep.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.transaction",
        ).errorRule =
            "Forbidden captured same-domain work throws CallbackCapabilityError."
        expect(() => validateContractSet(genericSweep)).toThrow(
            /callback\.transaction must retain TransactionPhaseError/,
        )

        const unnamedComparatorFailure = mutableSet()
        unnamedComparatorFailure.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.atom-comparator",
        ).thenableRule = "A thenable becomes a named comparator failure."
        expect(() => validateContractSet(unnamedComparatorFailure)).toThrow(
            /callback\.atom-comparator must retain outcome error InvalidAtomComparatorResultError/,
        )

        const droppedExecutionContract = mutableSet()
        findPublicEntry(
            droppedExecutionContract,
            "core.invalid-synchronous-atom-value-error",
        ).contractIds = [
            "atom.exact-value",
            "error.stable-name-and-code",
            "mutation.value-vs-updater",
        ]
        expect(() => validateContractSet(droppedExecutionContract)).toThrow(
            /core\.invalid-synchronous-atom-value-error differs from the required execution-error contract ownership/,
        )

        const callbackOwnedRuntimeError = mutableSet()
        callbackOwnedRuntimeError.callbackManifest.entries.find(
            (entry: any) => entry.id === "callback.external-subscribe",
        ).errorRule += " ExternalSourceDeliveryLimitError."
        expect(() => validateContractSet(callbackOwnedRuntimeError)).toThrow(
            /callback\.external-subscribe cannot own runtime activity error ExternalSourceDeliveryLimitError/,
        )
    })

    test("freezes the closed option bags and fully retires StoreOptions", () => {
        const set = mutableSet()
        const expectedOptions = new Map<string, string>([
            [
                "collection.materialize-options.priority",
                "MaterializeOptions.priority",
            ],
            ["core.atom-options.equal", "AtomOptions.equal"],
            ["core.atom-options.name", "AtomOptions.name"],
            [
                "core.collection-options.encode-key",
                "CollectionOptions.encodeKey",
            ],
            ["core.collection-options.indexes", "CollectionOptions.indexes"],
            ["core.external-atom-options.name", "ExternalAtomOptions.name"],
            ["core.family-options.encode-key", "FamilyOptions.encodeKey"],
            ["core.selector-options.equal", "SelectorOptions.equal"],
            ["core.selector-options.name", "SelectorOptions.name"],
            ["core.facet-options.mode", "FacetOptions.mode"],
            ["core.facet-options.order", "FacetOptions.order"],
            ["core.query-definition.facets", "QueryDefinition.facets"],
            ["core.query-definition.limit", "QueryDefinition.limit"],
            ["core.query-definition.offset", "QueryDefinition.offset"],
            ["core.query-definition.order-by", "QueryDefinition.orderBy"],
            ["core.query-definition.where", "QueryDefinition.where"],
        ])
        const closedOptions = set.publicManifest.entries.filter(
            (entry: any) =>
                entry.kind === "option" &&
                entry.target.status === "stable" &&
                entry.contractIds.includes("options.closed-surface"),
        )
        expect(
            new Map(
                closedOptions.map((entry: any) => [
                    entry.id,
                    entry.target.name,
                ]),
            ),
        ).toEqual(expectedOptions)
        expect(
            closedOptions.every(
                (entry: any) =>
                    entry.migration.mode === "add" &&
                    entry.migration.semver === "new",
            ),
        ).toBe(true)
        expect(
            findPublicEntry(set, "collection.materialize-options.priority")
                .notes,
        ).toBe(
            'MaterializeOptions.priority is exactly "user-visible" | "background"; no user-blocking tier or callback scheduler enters the stable surface.',
        )
        expect(findPublicEntry(set, "core.facet-options.mode").notes).toBe(
            'FacetOptions.mode is exactly "conjunctive" | "disjunctive".',
        )
        expect(findPublicEntry(set, "core.facet-options.order").notes).toBe(
            'FacetOptions.order is exactly "count-desc" | "value-asc" | "value-desc".',
        )
        const finiteOptionValues = new Map<string, readonly string[]>([
            [
                "collection.materialize-options.priority",
                ["user-visible", "background"],
            ],
            ["core.facet-options.mode", ["conjunctive", "disjunctive"]],
            [
                "core.facet-options.order",
                ["count-desc", "value-asc", "value-desc"],
            ],
        ])
        for (const [id, allowedValues] of finiteOptionValues) {
            expect(findPublicEntry(set, id).allowedValues).toEqual(
                allowedValues,
            )
            expect(
                set.targetSurfaceCatalog.frozenPublicCoordinates.find(
                    (coordinate: any) => coordinate.id === id,
                )?.allowedValues,
            ).toEqual(allowedValues)
        }

        const storeOptions = findPublicEntry(set, "core.type.store-options")
        expect(storeOptions.target).toEqual({
            package: null,
            subpath: null,
            name: null,
            status: "removed",
        })
        expect(storeOptions.migration.mode).toBe("remove")
        expect(storeOptions.legacy).toEqual([
            {
                package: "valdres",
                subpath: ".",
                kind: "type-export",
                name: "StoreOptions",
                baseline: "1.0.0-beta.23",
            },
        ])
        expect(
            set.legacyDispositionCatalog.entries.find(
                (entry: any) =>
                    entry.coordinate.kind === "type-export" &&
                    entry.coordinate.name === "StoreOptions",
            )?.dispositionId,
        ).toBe("core.type.store-options")
        expect(
            set.targetSurfaceCatalog.frozenPublicCoordinates.some(
                (coordinate: any) =>
                    coordinate.id === "core.type.store-options" ||
                    coordinate.name === "StoreOptions",
            ),
        ).toBe(false)
        expect(findPublicEntry(set, "core.store").notes).toContain(
            "exactly store() with zero options",
        )
        expect(findPublicEntry(set, "core.store").parameters).toEqual([])
        expect(
            set.targetSurfaceCatalog.frozenPublicCoordinates.find(
                (coordinate: any) => coordinate.id === "core.store",
            )?.parameters,
        ).toEqual([])
        expect(set.targetSurfaceCatalog.pendingSurfaceDecisions).toEqual([])

        const callbackOwners = new Map<string, string>([
            ["callback.atom-comparator", "core.atom-options.equal"],
            ["callback.selector-comparator", "core.selector-options.equal"],
            ["callback.family-encode-key", "core.family-options.encode-key"],
            [
                "callback.collection-encode-key",
                "core.collection-options.encode-key",
            ],
            [
                "callback.collection-index-extractor",
                "core.collection-options.indexes",
            ],
        ])
        for (const [callbackId, apiEntryId] of callbackOwners) {
            expect(
                set.callbackManifest.entries.find(
                    (entry: any) => entry.id === callbackId,
                )?.apiEntryId,
            ).toBe(apiEntryId)
        }

        expect(
            findPublicEntry(set, "legacy.subscription-deep-equality"),
        ).toMatchObject({
            target: { status: "removed" },
            migration: {
                mode: "remove",
                replacementIds: ["core.selector-options.equal"],
            },
        })
        expect(
            findPublicEntry(set, "legacy.adapter-selector-error"),
        ).toMatchObject({
            target: { status: "removed" },
            migration: {
                mode: "remove",
                replacementIds: ["core.selector-evaluation-error"],
            },
        })

        const renamedEverywhere = mutableSet()
        findPublicEntry(
            renamedEverywhere,
            "core.collection-options.encode-key",
        ).target.name = "CollectionOptions.keyEncoder"
        renamedEverywhere.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) =>
                coordinate.id === "core.collection-options.encode-key",
        ).name = "CollectionOptions.keyEncoder"
        expect(() => validateContractSet(renamedEverywhere)).toThrow(
            /core\.collection-options\.encode-key frozen target catalog coordinate differs from the required standalone spelling/,
        )

        const oneSidedLiteralMutation = mutableSet()
        findPublicEntry(
            oneSidedLiteralMutation,
            "collection.materialize-options.priority",
        ).allowedValues = ["user-visible"]
        expect(() => validateContractSet(oneSidedLiteralMutation)).toThrow(
            /collection\.materialize-options\.priority target coordinate differs from the frozen target catalog/,
        )

        const coordinatedLiteralMutation = mutableSet()
        findPublicEntry(
            coordinatedLiteralMutation,
            "core.facet-options.mode",
        ).allowedValues = ["and", "or"]
        coordinatedLiteralMutation.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) => coordinate.id === "core.facet-options.mode",
        ).allowedValues = ["and", "or"]
        expect(() => validateContractSet(coordinatedLiteralMutation)).toThrow(
            /core\.facet-options\.mode differs from the required finite option values/,
        )

        const oneSidedStoreArity = mutableSet()
        findPublicEntry(oneSidedStoreArity, "core.store").parameters = [
            "options?",
        ]
        expect(() => validateContractSet(oneSidedStoreArity)).toThrow(
            /core\.store target coordinate differs from the frozen target catalog/,
        )

        const coordinatedStoreArity = mutableSet()
        findPublicEntry(coordinatedStoreArity, "core.store").parameters = [
            "options?",
        ]
        coordinatedStoreArity.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) => coordinate.id === "core.store",
        ).parameters = ["options?"]
        expect(() => validateContractSet(coordinatedStoreArity)).toThrow(
            /core\.store differs from the required call parameters \[\]/,
        )
    })

    test("freezes the reviewed v1 public type-alias decisions", () => {
        const set = mutableSet()
        const expected = new Map<string, readonly [string, string]>([
            ["EqualFunc", ["core.type.equal-func", "keep"]],
            ["FamilyKey", ["core.type.family-key", "keep"]],
            ["GetValue", ["core.type.get-value", "keep"]],
            ["SubscribeFn", ["core.type.subscribe-fn", "keep"]],
            ["TransactionFn", ["core.type.transaction-fn", "keep"]],
            ["ResetAtom", ["legacy.mutation-type-aliases", "remove"]],
            ["SetAtom", ["legacy.mutation-type-aliases", "remove"]],
            ["SetAtomValue", ["legacy.mutation-type-aliases", "remove"]],
            ["SyncSetAtom", ["legacy.mutation-type-aliases", "remove"]],
        ])
        const entriesById = new Map<string, any>(
            set.publicManifest.entries.map((entry: any) => [entry.id, entry]),
        )
        for (const [name, [dispositionId, mode]] of expected) {
            const mapping = set.legacyDispositionCatalog.entries.find(
                (entry: any) =>
                    entry.coordinate.kind === "type-export" &&
                    entry.coordinate.package === "valdres" &&
                    entry.coordinate.name === name,
            )
            expect(mapping?.dispositionId).toBe(dispositionId)
            expect(entriesById.get(dispositionId)?.migration.mode).toBe(mode)
        }
        expect(
            set.targetSurfaceCatalog.pendingSurfaceDecisions.some(
                (decision: any) => decision.category === "alias-exports",
            ),
        ).toBe(false)
        expect(findPublicEntry(set, "core.type.family-key").target).toEqual({
            package: "valdres",
            subpath: ".",
            name: "FamilyKey",
            status: "stable",
        })
        expect(findPublicEntry(set, "core.type.family-key").notes).toContain(
            "string | number | bigint | boolean | symbol | null | undefined",
        )
        expect(findPublicEntry(set, "core.type.equal-func").notes).toContain(
            "exactly (previous: Value, next: Value) => boolean",
        )
        expect(
            findPublicEntry(set, "core.type.transaction-fn").notes,
        ).toContain("TransactionFn<Result = unknown>")
    })

    test("type-alias ownership cannot self-authorize across both writable artifacts", () => {
        const set = mutableSet()
        const kept = findPublicEntry(set, "core.type.family-key")
        const removed = findPublicEntry(set, "legacy.mutation-type-aliases")
        const familyKey = kept.legacy.find(
            (surface: any) => surface.name === "FamilyKey",
        )
        kept.legacy = kept.legacy.filter(
            (surface: any) => surface.name !== "FamilyKey",
        )
        removed.legacy.push(structuredClone(familyKey))
        set.legacyDispositionCatalog.entries.find(
            (mapping: any) => mapping.coordinate.name === "FamilyKey",
        ).dispositionId = "legacy.mutation-type-aliases"

        expect(() => validateContractSet(set)).toThrow(
            /reviewed legacy disposition ownership differs from the independently pinned digest/,
        )
    })

    test("reviewed public disposition semantics cannot self-authorize", () => {
        const set = mutableSet()
        const familyKey = findPublicEntry(set, "core.type.family-key")
        familyKey.migration.mode = "replace"
        familyKey.migration.replacementIds = ["core.family"]

        expect(() => validateContractSet(set)).toThrow(
            /reviewed release-track ownership differs from the independently pinned digest/,
        )
    })

    test("pending-review rows may remain evidence-free, while approved rows require contracts", () => {
        const pending = mutableSet()
        const pendingEntry = findPublicEntry(pending, "core.store.update")
        pendingEntry.decisionStatus = "pending-review"
        pendingEntry.contractIds = []
        expect(validateContractSet(pending).completeness).toBe(
            "partial/partial/partial/partial",
        )

        const approved = mutableSet()
        findPublicEntry(approved, "core.store.update").contractIds = []
        expect(() => validateContractSet(approved)).toThrow(
            /public-api\.json schema validation failed|must NOT have fewer than 1/,
        )
    })

    test("frozen legacy coordinates and source blobs cannot self-attest", () => {
        const changedWorkspace = mutableSet()
        changedWorkspace.publicManifest.generatedAgainst.workspace.commit =
            "f".repeat(40)
        changedWorkspace.publicManifest.generatedAgainst.workspace.packageVersion =
            "9.9.9"
        expect(() => validateContractSet(changedWorkspace)).toThrow(
            /workspace baseline differs from the independently pinned recovery input/,
        )

        const changedInventory = mutableSet()
        changedInventory.frozenLegacySurface.packages[0].members[0].name =
            "inventedId"
        expect(() => validateContractSet(changedInventory)).toThrow(
            /frozen legacy coordinate inventory differs from the independently pinned digest/,
        )

        const changedBlob = mutableSet()
        changedBlob.frozenLegacySurface.packages[1].provenance.surfaceBlobs[0].gitBlobSha1 =
            "f".repeat(40)
        expect(() => validateContractSet(changedBlob)).toThrow(
            /frozen legacy provenance differs|frozen legacy provenance inventory differs/,
        )

        const missingBlob = mutableSet()
        missingBlob.frozenLegacySurface.packages[0].provenance.surfaceBlobs.pop()
        expect(() => validateContractSet(missingBlob)).toThrow(
            /frozen legacy provenance inventory differs from the independently pinned digest/,
        )

        const repointedRevision = mutableSet()
        const coreProvenance =
            repointedRevision.frozenLegacySurface.packages[0].provenance
        coreProvenance.sourceRevision = coreProvenance.releaseRevision
        coreProvenance.sourcePackageTreeSha1 =
            coreProvenance.releasePackageTreeSha1
        coreProvenance.sourcePackageJsonBlobSha1 =
            coreProvenance.releasePackageJsonBlobSha1
        expect(() => validateContractSet(repointedRevision)).toThrow(
            /frozen legacy provenance inventory differs from the independently pinned digest/,
        )

        const forgedArtifact = mutableSet()
        const publishedArtifact =
            forgedArtifact.frozenLegacySurface.packages[0].provenance
                .publishedArtifact
        publishedArtifact.npmSpec = "valdres@9.9.9"
        publishedArtifact.integrity = `sha512-${"A".repeat(86)}==`
        publishedArtifact.sha256 = "f".repeat(64)
        forgedArtifact.publicManifest.generatedAgainst.frozenLegacy.packageVersion =
            "9.9.9"
        forgedArtifact.publicManifest.generatedAgainst.frozenLegacy.npmSpec =
            "valdres@9.9.9"
        forgedArtifact.publicManifest.generatedAgainst.frozenLegacy.registryTarball =
            "https://registry.npmjs.org/valdres/-/valdres-9.9.9.tgz"
        forgedArtifact.publicManifest.generatedAgainst.frozenLegacy.integrity =
            publishedArtifact.integrity
        forgedArtifact.publicManifest.generatedAgainst.frozenLegacy.sha256 =
            publishedArtifact.sha256
        expect(() => validateContractSet(forgedArtifact)).toThrow(
            /frozen legacy provenance inventory differs from the independently pinned digest/,
        )
    })

    test("stable target coordinates and removal intent agree", () => {
        const missingTarget = mutableSet()
        findPublicEntry(missingTarget, "core.atom").target.name = null
        expect(() => validateContractSet(missingTarget)).toThrow(
            /stable target with missing coordinates|target coordinate differs from the frozen target catalog/,
        )

        const blankTarget = mutableSet()
        findPublicEntry(blankTarget, "core.atom").target.name = "   "
        expect(() => validateContractSet(blankTarget)).toThrow(
            /public-api\.json schema validation failed|stable target with missing coordinates/,
        )

        const wrongRemoval = mutableSet()
        findPublicEntry(wrongRemoval, "core.atom").migration.mode = "remove"
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

        const renamedGeneralTarget = mutableSet()
        findPublicEntry(renamedGeneralTarget, "core.atom").target.name =
            "renamedAtom"
        renamedGeneralTarget.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) => coordinate.id === "core.atom",
        ).name = "renamedAtom"
        expect(() => validateContractSet(renamedGeneralTarget)).toThrow(
            /frozen target coordinate inventory differs from the independently pinned digest/,
        )
    })

    test("freezes standalone recursive-object structural queries", () => {
        const set = mutableSet()
        const query = findPublicEntry(set, "core.structural-query")

        expect(query.target).toEqual({
            package: "valdres",
            subpath: ".",
            name: "query",
            status: "stable",
        })
        expect(query.contractIds).toContain("query.recursive-object-definition")
        expect(
            set.callbackManifest.entries.some(
                (entry: any) => entry.id === "callback.query-builder",
            ),
        ).toBe(false)

        query.target.name = "buildQuery"
        set.targetSurfaceCatalog.frozenPublicCoordinates.find(
            (coordinate: any) => coordinate.id === "core.structural-query",
        ).name = "buildQuery"
        expect(() => validateContractSet(set)).toThrow(
            /frozen target coordinate inventory differs from the independently pinned digest/,
        )
    })

    test("freezes update as a new target while legacy set overloads replace into it", () => {
        const set = mutableSet()
        const update = findPublicEntry(set, "core.store.update")
        const setMethod = findPublicEntry(set, "core.store.set")

        expect(update.legacy).toEqual([])
        expect(update.migration.mode).toBe("add")
        expect(update.migration.semver).toBe("new")
        expect(setMethod.migration.mode).toBe("replace")
        expect(setMethod.migration.replacementIds).toContain(
            "core.store.update",
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

let pristineSet: ContractSet | undefined

// Building the set executes the implemented test-owner files in a nested
// `bun test`, so it is built once per process and handed out as clones.
function readSet(): ContractSet {
    pristineSet ??= buildSet()
    return structuredClone(pristineSet)
}

function buildSet(): ContractSet {
    const testDispositionLedger = parseTestDispositionLedger(
        readFileSync(join(directory, "test-dispositions.jsonl"), "utf8"),
    )
    return {
        publicManifest: readJson("public-api.json"),
        callbackManifest: readJson("callback-capabilities.json"),
        contractCatalog: readJson("contract-catalog.json"),
        frozenLegacySurface: readJson("frozen-legacy-surface.json"),
        legacyDispositionCatalog: readJson("legacy-disposition-catalog.json"),
        targetSurfaceCatalog: readJson("target-surface-catalog.json"),
        testDispositionLedger,
        testDispositionInventoryEvidence: loadTestDispositionInventoryEvidence(
            testDispositionLedger,
        ),
        testOwnerEvidence: loadTestOwnerEvidence(testDispositionLedger),
    }
}

function mutableSet(): any {
    return readSet()
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
    set.publicManifest.generatedAgainst.currentShiftX = {
        status: "complete",
        notes: "Synthetic complete candidate used only to exercise structural gates.",
        evidence: {
            verdict: "pass",
            remote: "ssh://example.invalid/shiftx.git",
            branch: "synthetic-validation",
            commit: "a".repeat(40),
            dirty: false,
            lockfile: {
                path: "bun.lock",
                sha256: "b".repeat(64),
            },
            packedArtifact: {
                path: "shiftx-validation.tgz",
                sha256: "c".repeat(64),
            },
            report: {
                path: "shiftx-validation-report.json",
                sha256: "d".repeat(64),
            },
            checkedPaths: ["packages/shiftx", "packages/valdres-adapter"],
        },
    }
    set.targetSurfaceCatalog.pendingSurfaceDecisions = []

    for (const entry of set.publicManifest.entries) {
        if (entry.owner === "independent-beta") continue
        entry.decisionStatus = "approved"
        entry.migration.evidenceStatus = "complete"
        if (entry.target.status === "pending") {
            entry.target = {
                package: null,
                subpath: null,
                name: null,
                status: "removed",
            }
            entry.migration.mode = "remove"
        }
    }
    for (const entry of set.callbackManifest.entries) {
        if (
            findPublicEntry(set, entry.apiEntryId).owner !== "independent-beta"
        ) {
            entry.decisionStatus = "approved"
        }
    }

    for (const mapping of set.legacyDispositionCatalog.entries) {
        mapping.reviewStatus = "approved"
    }

    const skeletons = generateProposedPublicApiSkeletons(
        set.frozenLegacySurface,
        set.legacyDispositionCatalog,
    )
    for (const skeleton of skeletons) {
        const kind =
            skeleton.legacy.kind === "type-export"
                ? "type-export"
                : skeleton.legacy.kind === "option"
                  ? "option"
                  : skeleton.legacy.kind === "runtime-export"
                    ? "runtime-export"
                    : "method"
        set.publicManifest.entries.push({
            id: skeleton.dispositionId,
            kind,
            owner: "synthetic-completion",
            legacy: [structuredClone(skeleton.legacy)],
            target: {
                package: null,
                subpath: null,
                name: null,
                status: "removed",
            },
            migration: {
                mode: "remove",
                replacementIds: [],
                semver: "breaking",
                codemod: "Synthetic completion fixture.",
                typeError: "Synthetic completion fixture.",
                firstPartyOwner: "synthetic-completion",
                evidenceStatus: "complete",
            },
            contractIds: [set.contractCatalog.contractIds[0]],
            decisionStatus: "approved",
            notes: "Synthetic completion fixture generated from one frozen coordinate.",
        })
        set.targetSurfaceCatalog.publicApiIds.push(skeleton.dispositionId)
        set.legacyDispositionCatalog.entries.push({
            coordinate: structuredClone(skeleton.legacy),
            dispositionId: skeleton.dispositionId,
            reviewStatus: "approved",
        })
    }
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

function removeLegacyCoordinate(
    set: any,
    expected: {
        package: string
        kind: string
        owner: string | null
        name: string
    },
): void {
    const mapping = set.legacyDispositionCatalog.entries.find(
        (entry: any) =>
            entry.coordinate.package === expected.package &&
            entry.coordinate.kind === expected.kind &&
            (entry.coordinate.owner ?? null) === expected.owner &&
            entry.coordinate.name === expected.name,
    )
    if (!mapping) throw new Error(`missing fixture mapping ${expected.name}`)
    const disposition = findPublicEntry(set, mapping.dispositionId)
    disposition.legacy = disposition.legacy.filter(
        (surface: any) =>
            !(
                surface.package === expected.package &&
                surface.kind === expected.kind &&
                (surface.owner ?? null) === expected.owner &&
                surface.name === expected.name
            ),
    )
}

function rootSurface(name: string): any {
    return legacySurface(".", name)
}

function legacySurface(subpath: string, name: string): any {
    return {
        kind: "runtime-export",
        package: "valdres",
        subpath,
        name,
        baseline: "1.0.0-beta.23",
    }
}
