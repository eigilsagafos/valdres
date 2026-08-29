import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

type Disposition = "A" | "B" | "C" | "D" | "E"

interface Subject {
    readonly origin: "published-beta.23"
    readonly kind: "production-file" | "test-file" | "test-case"
    readonly path: string
    readonly testName?: string
}

interface InventoryEntry {
    readonly id: string
    readonly subject: Subject
}

interface FrozenInventory {
    readonly entries: readonly InventoryEntry[]
}

interface LedgerHeader {
    readonly recordType: "header"
    readonly notes: readonly string[]
    readonly [key: string]: unknown
}

interface ExistingDisposition {
    readonly recordType: "disposition"
    readonly id: string
    readonly subject: Subject
    readonly disposition: Disposition
    readonly reviewStatus: "proposed" | "approved"
    readonly contractIds: readonly string[]
    readonly ownerIds: readonly string[]
    readonly destination: string | null
    readonly rationale: string
}

interface TestOwner {
    readonly recordType: "test-owner"
    readonly [key: string]: unknown
}

interface ReviewedDispositionEvidence {
    readonly disposition: Disposition
    readonly contractIds: readonly string[]
    readonly ownerIds: readonly string[]
    readonly destination: string | null
    readonly rationale: string
}

type LedgerRecord = LedgerHeader | ExistingDisposition | TestOwner

interface Classification {
    readonly disposition: Disposition
    readonly reason: string
    readonly destination: string | null
}

function main(): void {
    const write = process.argv.includes("--write")
    const check = process.argv.includes("--check")
    if (write && check) {
        throw new Error("choose at most one of --write or --check")
    }
    const repositoryRoot = resolve(import.meta.dir, "../..")
    const inventoryPath = resolve(
        repositoryRoot,
        "contracts/v1/frozen-test-inventory.json",
    )
    const ledgerPath = resolve(
        repositoryRoot,
        "contracts/v1/test-dispositions.jsonl",
    )

    const inventory = JSON.parse(
        readFileSync(inventoryPath, "utf8"),
    ) as FrozenInventory
    const existingRecords = readFileSync(ledgerPath, "utf8")
        .split(/\r?\n/u)
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line) as LedgerRecord)

    const header = existingRecords.find(
        (record): record is LedgerHeader => record.recordType === "header",
    )
    if (header === undefined)
        throw new Error("test disposition header is missing")

    const owners = existingRecords.filter(
        (record): record is TestOwner => record.recordType === "test-owner",
    )

    const proposedHeader: LedgerHeader = {
        $schema: "./schemas/test-dispositions.schema.json",
        recordType: "header",
        schemaVersion: 1,
        completeness: "partial",
        baseline: {
            package: "valdres",
            version: "1.0.0-beta.23",
            frozenSurface: "./frozen-legacy-surface.json",
        },
        inventory: header.inventory,
        classificationScope: {
            testCases: "complete",
            testFiles: "complete",
            productionFiles: "separate-artifact-pending",
        },
        notes: [
            "The beta.23 production-file, zero-registration test-file, and registered test-case inventory is frozen from immutable source trees, its lockfile, and the published tarball.",
            "Every beta.23 test subject has a proposed A/B/C/D/E disposition; none of these proposed rows is approval or replacement-owner coverage.",
            "Production-file subjects belong to the separate production-source ledger, so this test ledger remains partial until its proposed rows are reviewed and approved.",
        ],
    }

    const testEntries = inventory.entries.filter(
        entry => entry.subject.kind !== "production-file",
    )
    const generatedDispositions = testEntries.map(entry => {
        const classification = classify(entry.subject)
        const reviewed = REVIEWED_DISPOSITION_EVIDENCE.get(entry.id)
        if (
            reviewed !== undefined &&
            reviewed.disposition !== classification.disposition
        ) {
            throw new Error(
                `${entry.id} reviewed disposition ${reviewed.disposition} differs from generated ${classification.disposition}`,
            )
        }

        return {
            recordType: "disposition" as const,
            id: entry.id,
            subject: entry.subject,
            disposition: reviewed?.disposition ?? classification.disposition,
            reviewStatus: "proposed" as const,
            contractIds: reviewed?.contractIds ?? [],
            ownerIds: reviewed?.ownerIds ?? [],
            destination: reviewed?.destination ?? classification.destination,
            rationale:
                reviewed?.rationale ??
                `Proposed ${classification.disposition} classification: ${classification.reason}.`,
        }
    })

    const counts = countByDisposition(generatedDispositions)
    const expectedCounts: Readonly<Record<Disposition, number>> = {
        A: 24,
        B: 283,
        C: 370,
        D: 726,
        E: 237,
    }
    for (const disposition of ["A", "B", "C", "D", "E"] as const) {
        if (counts[disposition] !== expectedCounts[disposition]) {
            throw new Error(
                `${disposition} count changed: expected ${expectedCounts[disposition]}, received ${counts[disposition]}`,
            )
        }
    }
    if (generatedDispositions.length !== 1_640) {
        throw new Error(
            `expected 1,640 test dispositions, received ${generatedDispositions.length}`,
        )
    }
    const needsReviewCount = generatedDispositions.filter(
        row => "needsReview" in row,
    ).length
    if (needsReviewCount !== 0) {
        throw new Error(
            `expected zero needs-review rows, received ${needsReviewCount}`,
        )
    }
    const output = `${[proposedHeader, ...generatedDispositions, ...owners]
        .map(record => JSON.stringify(record))
        .join("\n")}\n`

    if (write) {
        writeFileSync(ledgerPath, output)
        console.log(
            `wrote ${generatedDispositions.length} proposed test dispositions ` +
                `(A=${counts.A}, B=${counts.B}, C=${counts.C}, D=${counts.D}, E=${counts.E}; ` +
                `needs-review=${needsReviewCount})`,
        )
    } else if (check) {
        if (readFileSync(ledgerPath, "utf8") !== output) {
            throw new Error(
                "test disposition ledger differs from deterministic generator output",
            )
        }
        console.log(
            `test disposition ledger verified: ${generatedDispositions.length} proposed rows ` +
                `(A=${counts.A}, B=${counts.B}, C=${counts.C}, D=${counts.D}, E=${counts.E}; ` +
                `needs-review=${needsReviewCount})`,
        )
    } else {
        process.stdout.write(output)
    }
}

function classify(subject: Subject): Classification {
    const path = subject.path
    const name = subject.testName?.toLowerCase() ?? ""
    if (subject.kind === "test-file") {
        const migration = ZERO_REGISTRATION_TYPE_MIGRATIONS.get(path)
        if (migration === undefined) {
            throw new Error(
                `zero-registration type-test destination is missing: ${path}`,
            )
        }
        return {
            disposition: "E",
            reason: migration.reason,
            destination: migration.destination,
        }
    }
    let classification =
        wholeFileClassification(path) ??
        b(
            "the retained public outcome is coupled to beta.23 internals or legacy spelling",
        )

    if (
        (path === CROSS_SCOPE_STALE ||
            path === SERIALIZABLE_OBSERVATION ||
            path === INDEX_MULTI_STORE) &&
        name.includes("fuzz:")
    ) {
        classification = e("the retained property/fuzz harness moves to v1")
    }

    if (path === ATOM) {
        if (
            /maxage|staleiferror|stalewhilerevalidate|\bswr\b|lazy eviction/u.test(
                name,
            )
        ) {
            classification = c(
                CACHE_DESTINATION,
                "cache freshness and stale policy move to the official beta companion",
            )
        } else if (
            /async|promise|onmount|onunmount|mutable atom|unsupported exotic|selector as default/u.test(
                name,
            )
        ) {
            classification = d(
                "Promise State, Atom lifecycle, and mutable-definition behavior are unsupported",
            )
        } else if (
            name.endsWith("atom > is good") ||
            name.includes("all subscribers are notified") ||
            name.includes("store.set rethrows the first subscriber error")
        ) {
            classification = a("the public Atom/subscription outcome remains")
        } else {
            classification = b(
                "the Atom outcome remains but its initializer/updater spelling changes",
            )
        }
    }

    if (path === ATOM_FAMILY) {
        if (name.includes("all family atom subscribers are notified")) {
            classification = b(
                "all-fire/first-error notification remains after removing family-as-State membership",
            )
        } else if (
            /family membership|get an entire atom family|getting an empty|subscribe to atomfamily|subscribe to atom family keys|order is based|all family atom subscribers|atom families in scope/u.test(
                name,
            )
        ) {
            classification = c(
                COLLECTION_DESTINATION,
                "valuable membership and ordering behavior moves to explicit collections",
            )
        } else if (
            /deleted|deleting|\bdelete\b|\brelease\b|global atomfamily|async|suspend|no defaultvalue|object key|structured key|mutable option|\bname\b|unnamed family|legitimately named|get on familyatom/u.test(
                name,
            )
        ) {
            classification = d(
                "hidden membership, deletion repair, global, async, or implicit structural-key behavior is unsupported",
            )
        } else {
            classification = b(
                "identity-factory behavior is rewritten against stable family",
            )
        }
    }

    if (path === SELECTOR_FAMILY) {
        if (
            /get returns a promise|atom as arg|selector as arg|structured key|\brelease\b|mutable option|\bname\b|unnamed family|legitimately named|every argument shape/u.test(
                name,
            )
        ) {
            classification = d(
                "async, implicit structural-key, release, and legacy option behavior is unsupported",
            )
        } else {
            classification = b(
                "selector-family identity is rewritten through stable family",
            )
        }
    }

    if (path === SELECTOR) {
        if (
            /returns promise|returns a promise|multiple async|^async selector > (?!deep selector chains)|unsupported exotic/u.test(
                name,
            )
        ) {
            classification = d(
                "Promise/async or mutable selector behavior is unsupported",
            )
        } else if (name.includes("selector listening to atomfamily")) {
            classification = c(
                COLLECTION_DESTINATION,
                "family membership observation moves to collections",
            )
        } else {
            classification = b(
                "synchronous DAG selector behavior remains but the beta fixture uses legacy internals",
            )
        }
    }

    if (path === STORE) {
        if (name.includes("exposes stable identity")) {
            classification = b(
                "retained Store object identity is split from the removed public Store.id assertion",
            )
        } else if (name.endsWith("scope > family")) {
            classification = c(
                COLLECTION_DESTINATION,
                "hidden family membership moves to collections",
            )
        } else if (name.endsWith("store > txn")) {
            classification = a(
                "the public synchronous transaction outcome remains",
            )
        } else {
            classification = b(
                "scope behavior remains but the fixture constructs a removed positional Store ID",
            )
        }
    }

    if (path === CROSS_SCOPE_STALE && !name.includes("fuzz:")) {
        classification = a("the public same-StoreTree atomic outcome remains")
    }
    if (path === SERIALIZABLE_OBSERVATION && !name.includes("fuzz:")) {
        classification = a("the public final-state observation remains")
    }
    if (path === SUBSCRIBER_SNAPSHOT) {
        classification = name.includes("unsubscribed mid-dispatch")
            ? a("an already-owned unsubscribe preserves snapshot delivery")
            : d("subscriber-created subscriptions are rejected before work")
    }
    if (path === UNSUBSCRIBED_SELECTOR_STABILITY) {
        classification = name.includes("async")
            ? d("Promise-valued selectors are unsupported")
            : name.includes("batchupdates")
              ? b(
                    "reference stability remains but the batchUpdates harness option is removed",
                )
              : a("the public synchronous reference-stability outcome remains")
    }
    if (path === PUBLIC_ERRORS) {
        classification =
            name.includes("throwing selector") ||
            name.includes("dependency cycle")
                ? a("the public selector error remains")
                : b(
                      "the combined error matrix must be split across stable, moved, and removed errors",
                  )
    }

    if (path === ADAPTER_TRANSACTION) {
        classification =
            /commit is terminal|abort discards staged writes and is terminal|abort discards a cross-scope working tree without any observable event|every callback operation rejects use after close/u.test(
                name,
            )
                ? b(
                      "the terminal commit, rollback, or closed-cursor outcome is rewritten through public Store.txn",
                  )
                : d(
                      "manual adapter transactions, adapter-supplied sources, and cancellable open transaction trees are removed",
                  )
    }

    if (path === TRANSACTION) {
        classification = b("the synchronous transaction outcome remains")
        if (
            /async|promise|suspense|continuation|global|onset|onchange|subscriber during|cleanup transaction|fresh atom|fresh unobserved|mutable atom/u.test(
                name,
            )
        ) {
            classification = d(
                "async, global, callback-hook, re-entry, or fresh-path behavior is unsupported",
            )
        }
        if (
            /family|\bdelete\b|\bdel\b|index|deep freeze|schema|unset-report/u.test(
                name,
            )
        ) {
            classification = c(
                collectionOrSchemaDestination(name),
                "the transaction case belongs to collection or schema ownership",
            )
        }
    }

    if (path === TRANSACTION_ATOMIC_SCOPE) {
        classification = b("same-StoreTree transaction atomicity remains")
        if (
            name.includes("root subscriber never sees root=new while scope=old")
        ) {
            classification = a(
                "the public same-StoreTree atomic observation remains",
            )
        }
        if (
            /onset|per-reaching-group trigger|groups are consulted|every group reports|never reached a selector|lazily initialized during evaluation joins/u.test(
                name,
            )
        ) {
            classification = d(
                "Atom hooks and per-trigger comparator provenance are unsupported",
            )
        }
        if (/family|\bdelete\b|\bunset\b|onchange/u.test(name)) {
            classification = c(
                name.includes("onchange")
                    ? INSPECT_DESTINATION
                    : COLLECTION_DESTINATION,
                "the case moves to collection/reset or inspect ownership",
            )
        }
    }

    if (path === TRANSACTION_PARENT_UNDEFINED) {
        classification = name.includes("nested txn")
            ? d("nested captured-Store transactions are unsupported")
            : b("undefined draft reads remain through the one transaction")
    }

    if (path === SCOPE) {
        classification = b("scope inheritance remains through the v1 StoreTree")
        if (/family deletion|family member|maxage/u.test(name)) {
            classification = c(
                name.includes("maxage")
                    ? CACHE_DESTINATION
                    : COLLECTION_DESTINATION,
                "the case belongs to collection or cache ownership",
            )
        }
        if (/batchupdates|global atom|trackscopevalue/u.test(name)) {
            classification = d(
                "implicit batching, writable global state, and private guard behavior are unsupported",
            )
        }
    }

    if (path === SUBSCRIBE) {
        classification = b(
            "subscription and DAG-retain outcomes remain behind a new implementation",
        )
        if (
            /family-member|atomfamily|family callback|family arguments/u.test(
                name,
            )
        ) {
            classification = c(
                COLLECTION_DESTINATION,
                "family membership subscription moves to collections",
            )
        }
        if (
            /mount|lifecycle cleanup|throwing cleanup|queued orphan|public read flushes/u.test(
                name,
            )
        ) {
            classification = d(
                "ordinary Atom lifecycle and queued orphan-cleanup behavior are unsupported",
            )
        }
    }

    if (path === UNSET_VALUE) {
        classification = b("the observable outcome is rewritten through reset")
        if (
            /onchange|emits an .unset. change|listener observes|change uses kind|reports kind/u.test(
                name,
            )
        ) {
            classification = c(
                INSPECT_DESTINATION,
                "change provenance moves to inspect instrumentation",
            )
        }
        if (
            /async default|fires subscribers and onchange even when/u.test(name)
        ) {
            classification = d(
                "async fallback and equal-value reset notification behavior are unsupported",
            )
        }
    }

    if (path === RESET_ATOM) {
        classification = b("reset semantics remain with a new fallback model")
        if (/promise|global|onset|disposal/u.test(name)) {
            classification = d(
                "Promise, global, Atom-hook, or callback disposal behavior is unsupported",
            )
        }
        if (name.includes("validates")) {
            classification = c(
                SCHEMA_DESTINATION,
                "schema validation moves outside the core mutation kernel",
            )
        }
    }

    if (path === SET_ATOM) {
        classification = b(
            "the value/update outcome is rewritten through public mutation",
        )
        if (
            /returns the new value|promise|async updater|suspense|onset/u.test(
                name,
            )
        ) {
            classification = d(
                "mutation return values, Promise writes, async updaters, and Atom hooks are unsupported",
            )
        }
        if (name.includes("deep freeze")) {
            classification = c(
                SCHEMA_DESTINATION,
                "deep-freeze policy leaves the ordinary core write path",
            )
        }
    }

    if (path === SET_ATOMS || path === WRITE_ATOMS) {
        classification = b(
            "bulk atomicity is rewritten as an explicit transaction",
        )
        if (/onset|fresh|comparator swapped|known divergences/u.test(name)) {
            classification = d(
                "Atom hooks, fresh-path distinctions, and private divergence cases are unsupported",
            )
        }
    }

    if (path === GRAPH_RUNTIME) {
        classification = /transaction overlay|invariant phase boundaries/u.test(
            name,
        )
            ? b("isolation and phase invariants remain under the one evaluator")
            : d(
                  "outcome pools, evaluator twins, and late dependency install are removed",
              )
    }

    if (path === GRAPH_ORPHAN_DEMOTION) {
        classification = b(
            "the public retention outcome is rewritten for the DAG",
        )
        if (name.includes("pending async")) {
            classification = d("async selector lifetime is unsupported")
        }
        if (name.includes("enumerable store")) {
            classification = c(
                INSPECT_DESTINATION,
                "enumerable Store behavior moves to inspect",
            )
        }
        if (name.includes("churn")) {
            classification = e(
                "the retained churn performance gate moves to v1",
            )
        }
    }

    if (path === LIVENESS_RECONCILE_MOUNT_CLEANUP) {
        classification = name.includes("acyclic")
            ? e("the acyclic DAG work bound is migrated")
            : d("cyclic and Atom onMount cleanup behavior is removed")
    }
    if (path === LIVENESS_RECONCILIATION) {
        classification = name.includes("fuzz:")
            ? e("the retained liveness fuzz harness is rewritten")
            : name.includes("repairs a corrupted")
              ? d(
                    "the replacement has no repair pass for corrupted private state",
                )
              : b("the shared-leaf retain/release outcome remains")
    }
    if (path === LIVE_DEPENDENT_COUNT_FOLLOWUPS) {
        classification = name.includes("lazy reinitialization")
            ? b("error cleanup remains under the DAG evaluator")
            : d("cyclic liveness repair machinery is removed")
    }

    if (path === DISPOSE_STORE_DATA) {
        classification = b("terminal cleanup and disposal outcomes remain")
        if (/maxage|cache revalidation/u.test(name)) {
            classification = c(
                CACHE_DESTINATION,
                "cache cancellation moves to the beta companion",
            )
        }
        if (
            /global|onchange|oncommitend|async selector|pending atom|queued batch|mount/u.test(
                name,
            )
        ) {
            classification = d(
                "global, public hook, async, batching, or Atom lifecycle behavior is unsupported",
            )
        }
    }
    if (path === STORE_LIFECYCLE) {
        classification = b("terminal internal cleanup remains")
        if (/facade|transaction/u.test(name)) {
            classification = d(
                "lease facades and cancellable open transactions are unsupported",
            )
        }
    }
    if (path === STORE_TREE_RUNTIME) {
        classification = b("one runtime per StoreTree remains")
        if (/commit-end|global/u.test(name)) {
            classification = d(
                "public commit-end and global fan-out are removed",
            )
        }
    }
    if (path === COMMIT_ENGINE) {
        classification = b(
            "phase and error outcomes move to the new mutation kernel",
        )
        if (/commit-forest|commitintents/u.test(name)) {
            classification = d(
                "CommitForest and exact intent-shape behavior are removed",
            )
        }
    }
    if (path === DEFERRED_SUBSCRIBER_ERRORS) {
        classification = b("all-fire/first-error delivery remains")
        if (name.includes("delete")) {
            classification = c(
                COLLECTION_DESTINATION,
                "family deletion delivery moves to collection rows",
            )
        }
    }

    if (path === ARCHITECTURE_PERFORMANCE) {
        if (
            /global|fixpoint|mount|commit plan|forest plan|cross-scope update \+ delete \+ unset|direct scoped unset/u.test(
                name,
            )
        ) {
            classification = d("the measured legacy mechanism is removed")
        } else if (/max-age|cache policy|cache sidecar/u.test(name)) {
            classification = c(
                CACHE_DESTINATION,
                "the performance case moves with cache policy",
            )
        } else {
            classification = e("the retained performance gate is migrated")
        }
    }
    if (
        path === SELECTOR_MEMOIZATION_GATE &&
        name.includes("default structural equal")
    ) {
        classification = c(
            EQUALITY_DESTINATION,
            "default deep equality moves to an opt-in helper",
        )
    }

    if (path === MEMORY_LEAKS) {
        classification = e("the retained memory regression gate is migrated")
        if (
            /global atom|async|onmount|detach|enumerable|released selector family|store\.del|family whose membership|settled newer write/u.test(
                name,
            )
        ) {
            classification = d("the measured legacy lifetime is removed")
        } else if (/indexes|family atom|family identity/u.test(name)) {
            classification = c(
                COLLECTION_DESTINATION,
                "the memory case moves to collection or stable family ownership",
            )
        }
    }

    if (path === ORACLE_DISPOSAL) {
        classification = name.includes("every operation throws")
            ? b("terminal Store disposal remains")
            : d(
                  "lease detach, async cancellation, Atom onMount, and global behavior are removed",
              )
    }
    if (path === ORACLE_RESET_UNSET_DELETE) {
        classification = name.includes("delete a family")
            ? c(
                  COLLECTION_DESTINATION,
                  "family-member deletion moves to collection ownership",
              )
            : name.includes("never-materialized selector default")
              ? d(
                    "selector-as-default and exact legacy trace provenance are unsupported",
                )
              : b(
                    "the reset or ownership-removal outcome is rewritten through v1 reset without legacy hook/provenance assertions",
                )
    }
    if (path === ORACLE_ERROR_ARBITRATION) {
        classification = name.includes("two subscribers on the same atom")
            ? e("the retained subscriber arbitration trace is migrated")
            : d("public commit-end and Atom onSet arbitration are removed")
    }
    if (path === ORACLE_MIXED_SETTLEMENT) {
        classification =
            /parent cascade settles|forest phase|earlier onset/u.test(name)
                ? d("exact forest, pass, or Atom-hook ordering is removed")
                : c(
                      name.includes("family delete")
                          ? COLLECTION_DESTINATION
                          : INSPECT_DESTINATION,
                      "the trace moves to collection or inspect ownership",
                  )
    }
    if (path === ORACLE_REVALIDATION) {
        classification = c(
            CACHE_DESTINATION,
            "the cache revalidation trace moves to the beta companion",
        )
    }
    if (path === ORACLE_DIRECT_BULK_SET) {
        classification = name.includes("no-op set")
            ? e("the retained no-op mutation trace is migrated")
            : d("the trace asserts removed Atom hooks or commit-end ordering")
    }

    if (path === HAS_COMMITTED_VALUE && name.includes("maxage")) {
        classification = c(
            CACHE_DESTINATION,
            "cache comparison policy moves to the beta companion",
        )
    }
    if (
        path === UNDEFINED_SELECTOR_MEMOIZATION &&
        name.includes("async selector")
    ) {
        classification = d("async selector settlement is unsupported")
    }
    if (path === UNSET_COLD_SELECTOR_REVISION && name.includes("unsetall")) {
        classification = d("unsetAll is unsupported")
    }
    if (path === INIT_ATOM) {
        classification = /async|promise|no default/u.test(name)
            ? d("Promise and absent Atom defaults are unsupported")
            : b("the fallback outcome is rewritten through atom.lazy")
    }
    if (path === INIT_SELECTOR_CROSS_STORE) {
        classification = d(
            "captured same-runtime Store reads and deferred selector capabilities are rejected",
        )
    }
    if (path === PARENT_SCOPE_DEFERRED && name.includes("onset")) {
        classification = d("ordinary Atom onSet behavior is removed")
    }
    if (path === PROPAGATE_CHILD_GROUPS) {
        classification = d(
            "legacy trigger-group and forest propagation is removed",
        )
    }
    if (path === PROPAGATE_UPDATED_ATOMS) {
        classification = b(
            "the propagation outcome is rewritten for the v1 DAG",
        )
        if (/family deletion|deleting atom family/u.test(name)) {
            classification = c(
                COLLECTION_DESTINATION,
                "family deletion propagation moves to collection rows",
            )
        }
        if (name.includes("scope detach")) {
            classification = d("lease-style scope detach is unsupported")
        }
    }
    if (path === STATE_REVISIONS) {
        classification = /family deletion|transaction deletion/u.test(name)
            ? c(
                  COLLECTION_DESTINATION,
                  "family deletion token behavior moves to collection rows",
              )
            : name.includes("global reset")
              ? d("writable global state is unsupported")
              : b(
                    "selector error cleanup remains without the legacy revision plane",
                )
    }
    if (path === INDEX_ROOT) {
        classification = d(
            "the legacy mutable version slot is replaced by isolated runtime domains",
        )
    }

    return classification
}

function wholeFileClassification(path: string): Classification | null {
    if (E_FILES.has(path)) {
        return e(
            "the retained type/build/fuzz/performance infrastructure is migrated",
        )
    }
    if (C_FILES.has(path)) {
        return c(
            destinationForMovedFile(path),
            "the behavior belongs to a named companion, subpath, or instrumentation suite",
        )
    }
    if (D_FILES.has(path)) {
        return d("the asserted legacy behavior is intentionally unsupported")
    }
    if (A_FILES.has(path)) {
        return a("the public black-box outcome remains")
    }
    return null
}

function destinationForMovedFile(path: string): string {
    if (
        path === CACHE_META ||
        path === HAS_ATOM_COMMIT_OBSERVERS ||
        path === ON_STORE_CHANGE ||
        path === STORE_SNAPSHOT
    ) {
        return path === CACHE_META ? CACHE_DESTINATION : INSPECT_DESTINATION
    }
    if (path === SCHEMA_VALIDATION) {
        return SCHEMA_DESTINATION
    }
    if (
        path === INDEX_CONSTRUCTOR ||
        path === INDEX_MULTI_STORE ||
        path === COMPLEX
    ) {
        return COLLECTION_DESTINATION
    }
    if (path === EQUAL) return EQUALITY_DESTINATION
    if (path === DEHYDRATE || path === HYDRATE) {
        return TRANSFER_DESTINATION
    }
    return "v1 named destination pending review"
}

function collectionOrSchemaDestination(name: string): string {
    return /deep freeze|schema/u.test(name)
        ? SCHEMA_DESTINATION
        : COLLECTION_DESTINATION
}

function a(reason: string): Classification {
    return { disposition: "A", reason, destination: null }
}
function b(reason: string): Classification {
    return { disposition: "B", reason, destination: null }
}
function c(destination: string, reason: string): Classification {
    return { disposition: "C", reason, destination }
}
function d(reason: string): Classification {
    return { disposition: "D", reason, destination: null }
}
function e(reason: string): Classification {
    return {
        disposition: "E",
        reason,
        destination: "v1 artifact and test infrastructure",
    }
}

function countByDisposition(
    rows: readonly { readonly disposition: Disposition }[],
): Record<Disposition, number> {
    const counts: Record<Disposition, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    for (const row of rows) counts[row.disposition] += 1
    return counts
}

const REVIEWED_DISPOSITION_EVIDENCE = new Map<
    string,
    ReviewedDispositionEvidence
>([
    [
        "beta23.scope.equal-value-pin",
        {
            disposition: "B",
            contractIds: ["scope.live-inheritance"],
            ownerIds: ["V1M-SCOPE-001"],
            destination: null,
            rationale:
                "The public pinning outcome remains, but the beta assertion reaches into private Store data.",
        },
    ],
    [
        "beta23.atom.same-value-no-notification",
        {
            disposition: "B",
            contractIds: [
                "atom.object-is-default",
                "notification.after-stability",
            ],
            ownerIds: ["V1M-SUB-002"],
            destination: null,
            rationale:
                "The observable no-notification outcome remains, but the beta test invokes private setAtom machinery.",
        },
    ],
    [
        "beta23.transaction.cross-scope-atomic-observation",
        {
            disposition: "A",
            contractIds: ["transaction.one-tree-draft"],
            ownerIds: ["V1M-TXN-001"],
            destination: null,
            rationale:
                "The replacement model records root, child, and sibling values from one subscriber delivery after the final same-tree transaction state.",
        },
    ],
    [
        "beta23.selector.promise-resolution",
        {
            disposition: "D",
            contractIds: ["selector.pure-sync-dag"],
            ownerIds: ["V1M-SEL-005"],
            destination:
                "packages/valdres/test/v1-selector-evaluator/evaluator.test.ts",
            rationale:
                "Stable selectors convert thenable results to a synchronous error and never publish later resolution.",
        },
    ],
])

const ZERO_REGISTRATION_TYPE_MIGRATIONS = new Map<
    string,
    Readonly<{ reason: string; destination: string }>
>([
    [
        "packages/valdres/src/lib/atomFamily.types.test.ts",
        {
            reason: "the removed global-family naming constraint needs an explicit compile-time removal assertion",
            destination:
                "contracts/v1/removed-public-surfaces.type-test.ts (planned)",
        },
    ],
    [
        "packages/valdres/src/lib/commitPlan.types.test.ts",
        {
            reason: "the removed CommitPlan legality encoding is replaced by compile-time gates for the new mutation kernel",
            destination:
                "packages/valdres/src/v1-internal/kernel/kernel.types.test.ts (planned)",
        },
    ],
    [
        "packages/valdres/src/lib/setAtom.types.test.ts",
        {
            reason: "the legacy sync/Promise mutation return matrix needs a replacement Store mutation type gate",
            destination: "contracts/v1/store-mutation.type-test.ts (planned)",
        },
    ],
    [
        "packages/valdres/src/lib/transaction.types.test.ts",
        {
            reason: "the public/internal transaction capability split needs a replacement v1 surface type gate",
            destination:
                "contracts/v1/store-transaction.type-test.ts (planned)",
        },
    ],
])

const CACHE_DESTINATION = "official beta loader/cache companion (name pending)"
const COLLECTION_DESTINATION = "valdres collection contract suite"
const SCHEMA_DESTINATION = "@valdres/schema"
const TRANSFER_DESTINATION = "@valdres/transfer"
const INSPECT_DESTINATION = "@valdres/inspect"
const EQUALITY_DESTINATION =
    "opt-in equality helper/subpath (coordinate pending)"

const ATOM = "packages/valdres/src/atom.test.ts"
const ATOM_FAMILY = "packages/valdres/src/atomFamily.test.ts"
const CACHE_META = "packages/valdres/src/cacheMeta.test.ts"
const PUBLIC_ERRORS = "packages/valdres/src/errors/errors.test.ts"
const INDEX_ROOT = "packages/valdres/src/index.test.ts"
const INDEX_MULTI_STORE =
    "packages/valdres/src/indexConstructor.multiStore.test.ts"
const INDEX_CONSTRUCTOR = "packages/valdres/src/indexConstructor.test.ts"
const ADAPTER_TRANSACTION =
    "packages/valdres/src/lib/adapterTransaction.test.ts"
const ARCHITECTURE_PERFORMANCE =
    "packages/valdres/src/lib/architecturePerformance.test.ts"
const COMMIT_ENGINE = "packages/valdres/src/lib/commitEngine.test.ts"
const CROSS_SCOPE_STALE =
    "packages/valdres/src/lib/crossScopeStaleSelector.test.ts"
const DEEP_FREEZE_FUZZ = "packages/valdres/src/lib/deepFreezePolicyFuzz.test.ts"
const DEFERRED_SUBSCRIBER_ERRORS =
    "packages/valdres/src/lib/deferredCommitSubscriberErrors.test.ts"
const DISPOSE_STORE_DATA = "packages/valdres/src/lib/disposeStoreData.test.ts"
const EQUAL = "packages/valdres/src/lib/equal.test.ts"
const GRAPH_ORPHAN_DEMOTION =
    "packages/valdres/src/lib/graph/orphanDemotion.test.ts"
const GRAPH_RUNTIME = "packages/valdres/src/lib/graph/runtime.test.ts"
const HAS_ATOM_COMMIT_OBSERVERS =
    "packages/valdres/src/lib/hasAtomCommitObservers.test.ts"
const HAS_COMMITTED_VALUE = "packages/valdres/src/lib/hasCommittedValue.test.ts"
const INIT_ATOM = "packages/valdres/src/lib/initAtom.test.ts"
const INIT_SELECTOR_CROSS_STORE =
    "packages/valdres/src/lib/initSelector.crossStore.test.ts"
const LIVE_DEPENDENT_COUNT_FOLLOWUPS =
    "packages/valdres/src/lib/liveDependentCountFollowups.test.ts"
const LIVENESS_RECONCILE_MOUNT_CLEANUP =
    "packages/valdres/src/lib/livenessReconcileMountCleanup.test.ts"
const LIVENESS_RECONCILIATION =
    "packages/valdres/src/lib/livenessReconciliation.test.ts"
const ON_STORE_CHANGE = "packages/valdres/src/lib/onStoreChange.test.ts"
const PARENT_SCOPE_DEFERRED =
    "packages/valdres/src/lib/parentScopeDeferredObservation.test.ts"
const PROPAGATE_CHILD_GROUPS =
    "packages/valdres/src/lib/propagateChildGroups.test.ts"
const PROPAGATE_UPDATED_ATOMS =
    "packages/valdres/src/lib/propagateUpdatedAtoms.test.ts"
const RESET_ATOM = "packages/valdres/src/lib/resetAtom.test.ts"
const SCHEMA_VALIDATION = "packages/valdres/src/lib/schemaValidation.test.ts"
const SCOPE = "packages/valdres/src/lib/scope.test.ts"
const SELECTOR_MEMOIZATION_GATE =
    "packages/valdres/src/lib/selectorMemoizationGate.test.ts"
const SERIALIZABLE_OBSERVATION =
    "packages/valdres/src/lib/serializableObservation.test.ts"
const SET_ATOM = "packages/valdres/src/lib/setAtom.test.ts"
const SET_ATOMS = "packages/valdres/src/lib/setAtoms.test.ts"
const STATE_REVISIONS = "packages/valdres/src/lib/stateRevisions.test.ts"
const STORE_LIFECYCLE = "packages/valdres/src/lib/storeLifecycle.test.ts"
const STORE_TREE_RUNTIME = "packages/valdres/src/lib/storeTreeRuntime.test.ts"
const SUBSCRIBE = "packages/valdres/src/lib/subscribe.test.ts"
const TRANSACTION_ATOMIC_SCOPE =
    "packages/valdres/src/lib/transaction.atomicScope.test.ts"
const TRANSACTION_PARENT_UNDEFINED =
    "packages/valdres/src/lib/transaction.parentUndefined.test.ts"
const TRANSACTION = "packages/valdres/src/lib/transaction.test.ts"
const UNDEFINED_SELECTOR_MEMOIZATION =
    "packages/valdres/src/lib/undefinedSelectorMemoization.test.ts"
const UNSET_COLD_SELECTOR_REVISION =
    "packages/valdres/src/lib/unsetColdSelectorRevision.test.ts"
const UNSET_VALUE = "packages/valdres/src/lib/unsetValue.test.ts"
const WRITE_ATOMS = "packages/valdres/src/lib/writeAtoms.test.ts"
const SELECTOR = "packages/valdres/src/selector.test.ts"
const SELECTOR_FAMILY = "packages/valdres/src/selectorFamily.test.ts"
const STORE_SNAPSHOT = "packages/valdres/src/store.snapshot.test.ts"
const STORE = "packages/valdres/src/store.test.ts"
const APPLY_INITIALIZE = "packages/valdres/src/utils/applyInitialize.test.ts"
const DEEP_FREEZE = "packages/valdres/src/utils/deepFreeze.test.ts"
const DEHYDRATE = "packages/valdres/src/utils/dehydrate.test.ts"
const HYDRATE = "packages/valdres/src/utils/hydrate.test.ts"
const IS_SELECTOR = "packages/valdres/src/utils/isSelector.test.ts"
const SET_ATOM_PAIRS = "packages/valdres/src/utils/setAtomPairs.test.ts"
const COMPLEX = "packages/valdres/test/complex.test.ts"
const MEMORY_LEAKS = "packages/valdres/test/memoryleaks.test.ts"
const ORACLE_DIRECT_BULK_SET =
    "packages/valdres/test/oracle/directAndBulkSet.trace.test.ts"
const ORACLE_DISPOSAL =
    "packages/valdres/test/oracle/disposalAndCancellation.trace.test.ts"
const ORACLE_ERROR_ARBITRATION =
    "packages/valdres/test/oracle/errorArbitration.trace.test.ts"
const ORACLE_MIXED_SETTLEMENT =
    "packages/valdres/test/oracle/mixedSingleStoreSettlement.trace.test.ts"
const ORACLE_RESET_UNSET_DELETE =
    "packages/valdres/test/oracle/resetUnsetDelete.trace.test.ts"
const ORACLE_REVALIDATION =
    "packages/valdres/test/oracle/revalidation.trace.test.ts"
const SUBSCRIBER_SNAPSHOT = "packages/valdres/test/subscriberSnapshot.test.ts"
const UNSUBSCRIBED_SELECTOR_STABILITY =
    "packages/valdres/test/unsubscribedSelectorRefStability.test.ts"

const E_FILES = new Set([
    ARCHITECTURE_PERFORMANCE,
    "packages/valdres/src/lib/coldValidationSemanticFuzz.test.ts",
    "packages/valdres/src/lib/orphanDemotionFuzz.test.ts",
    "packages/valdres/src/lib/selectorMemoizationFuzz.test.ts",
    SELECTOR_MEMOIZATION_GATE,
    "packages/valdres/src/lib/unsubscribeScaling.test.ts",
    "packages/valdres/src/lib/liveDependentCountChurn.test.ts",
    "packages/valdres/src/lib/atomFamilyIndexScaling.test.ts",
    "packages/valdres/src/lib/atomFamilySnapshot.types.test.ts",
    "packages/valdres/src/lib/familyKey.types.test.ts",
    "packages/valdres/src/lib/internalFields.types.test.ts",
    "packages/valdres/src/lib/schemaValidation.types.test.ts",
    "packages/valdres/src/lib/selectorFamilyContract.types.test.ts",
    "packages/valdres/src/lib/store.types.test.ts",
    "packages/valdres/src/publicTypeSurface.types.test.ts",
    "packages/valdres/test/build.test.ts",
    "packages/valdres/test/import-cycles/graphBoundary.test.ts",
    "packages/valdres/test/import-cycles/importCycles.test.ts",
    "packages/valdres/test/invariants/checkStoreInvariants.test.ts",
    "packages/valdres/test/invariants/equalPresenceGate.test.ts",
    ORACLE_DIRECT_BULK_SET,
    ORACLE_ERROR_ARBITRATION,
    ORACLE_MIXED_SETTLEMENT,
    ORACLE_REVALIDATION,
    "packages/valdres/test/oracle/scopesShadowing.trace.test.ts",
    "packages/valdres/test/oracle/stateMachine.trace.test.ts",
    "packages/valdres/test/oracle/traceRecorder.test.ts",
    "packages/valdres/test/oracle/transactionsCrossScope.trace.test.ts",
    "packages/valdres/test/oracle/transactionsSingleStore.trace.test.ts",
    "packages/valdres/test/performance/bench-utils.test.ts",
])

const C_FILES = new Set([
    CACHE_META,
    INDEX_MULTI_STORE,
    INDEX_CONSTRUCTOR,
    EQUAL,
    HAS_ATOM_COMMIT_OBSERVERS,
    ON_STORE_CHANGE,
    SCHEMA_VALIDATION,
    STORE_SNAPSHOT,
    DEHYDRATE,
    HYDRATE,
    COMPLEX,
])

const D_FILES = new Set([
    "packages/valdres/src/globalStore.test.ts",
    "packages/valdres/src/lib/abortSignal.test.ts",
    "packages/valdres/src/lib/asyncAdmissionReentrancy.test.ts",
    "packages/valdres/src/lib/asyncCrossScopeNotification.test.ts",
    "packages/valdres/src/lib/asyncUnmountCleanup.test.ts",
    "packages/valdres/src/lib/asyncWrite.test.ts",
    "packages/valdres/src/lib/batchedCrossScopeReads.test.ts",
    "packages/valdres/src/lib/batchedFlushError.test.ts",
    "packages/valdres/src/lib/coldSelectorCacheValidationPass.test.ts",
    "packages/valdres/src/lib/commitPlans.test.ts",
    "packages/valdres/src/lib/deleteFamilyAtom.test.ts",
    "packages/valdres/src/lib/globalAtom.test.ts",
    "packages/valdres/src/lib/globalCommitForestFuzz.test.ts",
    "packages/valdres/src/lib/graph/workspaceReentrancy.test.ts",
    "packages/valdres/src/lib/hasScope.test.ts",
    "packages/valdres/src/lib/livenessCyclicFuzz.test.ts",
    "packages/valdres/src/lib/livenessPassOwnership.test.ts",
    "packages/valdres/src/lib/livenessSeedsReleaseOnThrow.test.ts",
    "packages/valdres/src/lib/mountInClosure.test.ts",
    "packages/valdres/src/lib/onCommitEnd.test.ts",
    "packages/valdres/src/lib/onDispose.test.ts",
    "packages/valdres/src/lib/onSetErrors.test.ts",
    "packages/valdres/src/lib/registerName.test.ts",
    "packages/valdres/src/lib/scopeFamilyTxnFuzz.test.ts",
    "packages/valdres/src/lib/scopeFamilyTxnPropagation.test.ts",
    "packages/valdres/src/lib/selectorEvaluatorTwinFuzz.test.ts",
    "packages/valdres/src/lib/selectorOptions.test.ts",
    "packages/valdres/src/lib/sharedStoreRuntime.test.ts",
    "packages/valdres/src/lib/treeTriggerGroups.test.ts",
    "packages/valdres/src/lib/txnLazyFamilyInit.test.ts",
    "packages/valdres/src/lib/txnLazyFamilyScope.test.ts",
    "packages/valdres/src/lib/unsetAll.test.ts",
    "packages/valdres/src/lib/unsetAllDifferentialFuzz.test.ts",
    "packages/valdres/src/lib/unsetAllDocExamples.test.ts",
    "packages/valdres/src/lib/unsetAllNotification.test.ts",
    IS_SELECTOR,
    APPLY_INITIALIZE,
    DEEP_FREEZE,
    DEEP_FREEZE_FUZZ,
    SET_ATOM_PAIRS,
    "packages/valdres/test/asyncSelector.test.ts",
    "packages/valdres/test/lateBinding.test.ts",
    "packages/valdres/test/oracle/asyncAtom.trace.test.ts",
    "packages/valdres/test/oracle/asyncSelector.trace.test.ts",
    "packages/valdres/test/oracle/globalFanOut.trace.test.ts",
    "packages/valdres/test/runtimeAdoption.test.ts",
])

const A_FILES = new Set([
    "packages/valdres/src/lib/stateNameForError.test.ts",
    "packages/valdres/src/lib/txnReturnValue.test.ts",
])

main()
