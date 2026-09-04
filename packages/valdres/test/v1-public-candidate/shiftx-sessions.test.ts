import { describe, expect, test } from "bun:test"
import {
    collection,
    presence,
    selector,
    store,
    type Collection,
    type Selector,
    type Store,
    type Transaction,
} from "../../src/index"
import {
    createInspectableStore,
    type InspectionWorkTotals,
} from "../../src/inspect"

type SessionRef = "A" | "B" | "C"

interface Session {
    readonly ref: SessionRef
    readonly userId: "user-1" | "user-2"
    readonly expiresAt: number
    readonly revision: number
    readonly privateToken: string
}

interface SessionEnvelope {
    readonly version: 1
    readonly ref: SessionRef
    readonly order: number
    readonly value: Session
}

interface PersistedSnapshot {
    readonly envelopes: readonly SessionEnvelope[]
    readonly watermark: number
}

interface SessionStates {
    readonly sessions: Collection<SessionRef, Session>
    readonly validSessions: Selector<Session[]>
    readonly sessionsByUser: Selector<Session[]>
    readonly currentSession: Selector<Session | undefined>
}

const NOW = 2_000_000
const SESSION_PREFIX = "session/"
const LEGACY_PREFIX = "legacy/"
const WATERMARK_KEY = "meta/session-order-watermark"
const STAGING_KEY = "meta/session-migration-staging"
const MARKER_KEY = "meta/session-migration-v1"

const SESSION_A = Object.freeze({
    ref: "A",
    userId: "user-1",
    expiresAt: NOW + 10_000,
    revision: 1,
    privateToken: "PRIVATE_SESSION_A",
}) satisfies Session

const SESSION_A_UPDATED = Object.freeze({
    ...SESSION_A,
    revision: 2,
    privateToken: "PRIVATE_SESSION_A_UPDATED",
}) satisfies Session

const SESSION_A_REINSERTED = Object.freeze({
    ...SESSION_A,
    revision: 3,
    privateToken: "PRIVATE_SESSION_A_REINSERTED",
}) satisfies Session

const SESSION_B = Object.freeze({
    ref: "B",
    userId: "user-2",
    expiresAt: NOW - 1,
    revision: 1,
    privateToken: "PRIVATE_SESSION_B",
}) satisfies Session

const SESSION_C = Object.freeze({
    ref: "C",
    userId: "user-1",
    expiresAt: NOW + 20_000,
    revision: 1,
    privateToken: "PRIVATE_SESSION_C",
}) satisfies Session

const sessionKey = (ref: SessionRef): string => `${SESSION_PREFIX}${ref}`
const legacyKey = (ref: SessionRef): string => `${LEGACY_PREFIX}${ref}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null

const isSessionRef = (value: unknown): value is SessionRef =>
    value === "A" || value === "B" || value === "C"

const validateSession = (value: unknown): Session => {
    if (
        !isRecord(value) ||
        !isSessionRef(value.ref) ||
        (value.userId !== "user-1" && value.userId !== "user-2") ||
        !Number.isFinite(value.expiresAt) ||
        !Number.isSafeInteger(value.revision) ||
        typeof value.privateToken !== "string"
    ) {
        throw new TypeError("Invalid persisted ShiftX session")
    }
    return value as unknown as Session
}

const validateOrder = (value: unknown, label: string): number => {
    if (!Number.isSafeInteger(value) || (value as number) <= 0) {
        throw new TypeError(`${label} must be a positive safe integer`)
    }
    return value as number
}

const validateWatermark = (value: unknown): number => {
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
        throw new TypeError("Session order watermark must be a safe integer")
    }
    return value as number
}

const validateEnvelope = (key: string, value: unknown): SessionEnvelope => {
    if (!isRecord(value) || value.version !== 1 || !isSessionRef(value.ref)) {
        throw new TypeError(`Invalid session envelope at ${key}`)
    }
    if (key !== sessionKey(value.ref)) {
        throw new TypeError(`Session envelope identity mismatch at ${key}`)
    }
    const session = validateSession(value.value)
    if (session.ref !== value.ref) {
        throw new TypeError(`Session payload identity mismatch at ${key}`)
    }
    validateOrder(value.order, `Session order at ${key}`)
    return value as unknown as SessionEnvelope
}

const createSessionStates = (): SessionStates => {
    const sessions = collection<SessionRef, Session>()
    const validSessions = selector(get =>
        get(sessions)
            .map(row => get(row))
            .filter(
                (value): value is Session =>
                    value !== undefined && value.expiresAt > NOW,
            ),
    )
    const sessionsByUser = selector(get =>
        get(validSessions).filter(value => value.userId === "user-1"),
    )
    const currentSession = selector<Session | undefined>(get =>
        get(sessionsByUser).at(0),
    )
    return Object.freeze({
        sessions,
        validSessions,
        sessionsByUser,
        currentSession,
    })
}

interface StorageMutation {
    readonly kind: "put" | "delete"
    readonly key: string
}

class KeyedWriteFault extends Error {
    constructor(readonly write: number) {
        super(`Injected keyed-write fault after write ${write}`)
        this.name = "KeyedWriteFault"
    }
}

class MigrationVisibilityPendingError extends Error {
    constructor() {
        super("ShiftX session migration has not reached its visibility marker")
        this.name = "MigrationVisibilityPendingError"
    }
}

class DurableSessionStorage {
    readonly mutations: StorageMutation[] = []
    readonly #values: Map<string, unknown>
    #faultAfter: number | undefined
    #writes = 0

    constructor(entries: readonly (readonly [string, unknown])[] = []) {
        this.#values = new Map(entries)
    }

    get(key: string): unknown {
        return this.#values.get(key)
    }

    has(key: string): boolean {
        return this.#values.has(key)
    }

    put(key: string, value: unknown): void {
        this.#values.set(key, value)
        this.mutations.push(Object.freeze({ kind: "put", key }))
        this.#afterWrite()
    }

    delete(key: string): void {
        this.#values.delete(key)
        this.mutations.push(Object.freeze({ kind: "delete", key }))
        this.#afterWrite()
    }

    scan(
        prefix: string,
        keyOrder?: readonly string[],
    ): readonly (readonly [string, unknown])[] {
        const matching = [...this.#values].filter(([key]) =>
            key.startsWith(prefix),
        )
        if (keyOrder === undefined) return matching
        const rank = new Map(keyOrder.map((key, index) => [key, index]))
        return matching.sort(
            ([left], [right]) =>
                (rank.get(left) ?? Number.MAX_SAFE_INTEGER) -
                (rank.get(right) ?? Number.MAX_SAFE_INTEGER),
        )
    }

    faultAfter(write: number): void {
        this.#faultAfter = write
        this.#writes = 0
    }

    clearFault(): void {
        this.#faultAfter = undefined
        this.#writes = 0
    }

    clearMutations(): void {
        this.mutations.length = 0
    }

    #afterWrite(): void {
        this.#writes++
        if (this.#faultAfter === this.#writes) {
            this.#faultAfter = undefined
            throw new KeyedWriteFault(this.#writes)
        }
    }
}

const readPersistedSnapshot = (
    storage: DurableSessionStorage,
    keyOrder?: readonly string[],
): PersistedSnapshot => {
    const envelopes = storage
        .scan(SESSION_PREFIX, keyOrder)
        .map(([key, value]) => validateEnvelope(key, value))
    const seenOrders = new Set<number>()
    const seenRefs = new Set<SessionRef>()
    for (const envelope of envelopes) {
        if (seenOrders.has(envelope.order)) {
            throw new TypeError("Session envelope orders must be unique")
        }
        if (seenRefs.has(envelope.ref)) {
            throw new TypeError("Session envelope identities must be unique")
        }
        seenOrders.add(envelope.order)
        seenRefs.add(envelope.ref)
    }
    const watermark = storage.has(WATERMARK_KEY)
        ? validateWatermark(storage.get(WATERMARK_KEY))
        : 0
    return Object.freeze({
        envelopes: Object.freeze(
            [...envelopes].sort((left, right) => left.order - right.order),
        ),
        watermark,
    })
}

interface RegistryEntry {
    readonly generation: number
    readonly order: number
    unsubscribe: () => void
    pendingDelete: boolean
}

interface ProvisionalAttachment {
    readonly ref: SessionRef
    readonly generation: number
}

class ShiftXSessionsAdapter {
    readonly #states: SessionStates
    readonly #store: Store
    readonly #storage: DurableSessionStorage
    readonly #registry = new Map<SessionRef, RegistryEntry>()
    readonly #generations = new Map<SessionRef, number>()
    readonly #queuedCleanup: ProvisionalAttachment[] = []
    readonly #unsubscribeMembership: () => void
    #nextOrder: number
    #insideMembershipCallback = false
    #membershipCallbackSubscriptionAttempts = 0

    constructor(
        states: SessionStates,
        target: Store,
        storage: DurableSessionStorage,
        seedWatermark = 0,
    ) {
        this.#states = states
        this.#store = target
        this.#storage = storage
        this.#nextOrder = seedWatermark
        const existing = target.get(states.sessions).map(row => {
            const persisted = storage.get(sessionKey(row.key))
            return Object.freeze({
                ref: row.key,
                order:
                    persisted === undefined
                        ? undefined
                        : validateEnvelope(sessionKey(row.key), persisted)
                              .order,
            })
        })
        this.#unsubscribeMembership = target.sub(states.sessions, () =>
            this.#onMembershipChange(),
        )

        // Bootstrap already-present rows outside notification quarantine.
        for (const row of existing) {
            this.#attach(row.ref, row.order)
        }
    }

    get target(): Store {
        return this.#store
    }

    get activeSubscriptions(): number {
        return this.#registry.size
    }

    get membershipCallbackSubscriptionAttempts(): number {
        return this.#membershipCallbackSubscriptionAttempts
    }

    generation(ref: SessionRef): number | undefined {
        return this.#registry.get(ref)?.generation
    }

    ensureSubscribed(ref: SessionRef): number {
        return this.#attach(ref).generation
    }

    set(ref: SessionRef, value: Session): void {
        const attachment = this.#attach(ref)
        try {
            this.#store.set(this.#states.sessions(ref), value)
        } finally {
            this.#reconcileProvisionals([
                { ref, generation: attachment.generation },
            ])
        }
    }

    update(ref: SessionRef, update: (value: Session) => Session): void {
        const attachment = this.#attach(ref)
        try {
            this.#store.update(this.#states.sessions(ref), update)
        } finally {
            this.#reconcileProvisionals([
                { ref, generation: attachment.generation },
            ])
        }
    }

    delete(ref: SessionRef): void {
        this.#store.delete(this.#states.sessions(ref))
    }

    transaction(
        firstWrites: readonly SessionRef[],
        callback: (transaction: Transaction) => void,
    ): void {
        const provisional = [...new Set(firstWrites)].map(ref => {
            const entry = this.#attach(ref)
            return Object.freeze({ ref, generation: entry.generation })
        })
        try {
            this.#store.txn(callback)
        } finally {
            // Store.sub is forbidden inside a Transaction callback. Enrollment
            // therefore happens before the draft, and abort cleanup after it.
            this.#reconcileProvisionals(provisional)
        }
    }

    hydrate(envelopes: readonly SessionEnvelope[]): void {
        const provisional = envelopes.map(envelope => {
            const entry = this.#attach(envelope.ref, envelope.order)
            return Object.freeze({
                ref: envelope.ref,
                generation: entry.generation,
            })
        })
        try {
            this.#store.txn(transaction => {
                for (const envelope of envelopes) {
                    transaction.set(
                        this.#states.sessions(envelope.ref),
                        envelope.value,
                    )
                }
            })
        } finally {
            this.#reconcileProvisionals(provisional)
        }
    }

    flushCleanup(): void {
        while (this.#queuedCleanup.length > 0) {
            const queued = this.#queuedCleanup.shift()!
            const entry = this.#registry.get(queued.ref)
            if (entry === undefined || entry.generation !== queued.generation) {
                continue
            }
            if (
                this.#store.get(this.#states.sessions(queued.ref)) !== undefined
            ) {
                entry.pendingDelete = false
                continue
            }
            entry.unsubscribe()
            this.#registry.delete(queued.ref)
        }
    }

    dispose(): void {
        this.#unsubscribeMembership()
        for (const entry of this.#registry.values()) entry.unsubscribe()
        this.#registry.clear()
        this.#queuedCleanup.length = 0
    }

    #attach(ref: SessionRef, restoredOrder?: number): RegistryEntry {
        if (this.#insideMembershipCallback) {
            this.#membershipCallbackSubscriptionAttempts++
            throw new Error("Membership callbacks must not subscribe")
        }
        const current = this.#registry.get(ref)
        if (current !== undefined && !current.pendingDelete) return current
        if (current !== undefined) {
            current.unsubscribe()
            this.#registry.delete(ref)
        }

        const generation = (this.#generations.get(ref) ?? 0) + 1
        this.#generations.set(ref, generation)
        const order = restoredOrder ?? this.#nextOrder + 1
        validateOrder(order, `Subscription order for ${ref}`)
        this.#nextOrder = Math.max(this.#nextOrder, order)
        const entry: RegistryEntry = {
            generation,
            order,
            unsubscribe: () => undefined,
            pendingDelete: false,
        }
        this.#registry.set(ref, entry)
        entry.unsubscribe = this.#store.sub(this.#states.sessions(ref), () =>
            this.#onRowChange(ref, generation),
        )
        return entry
    }

    #onRowChange(ref: SessionRef, generation: number): void {
        const entry = this.#registry.get(ref)
        if (entry === undefined || entry.generation !== generation) return
        const value = this.#store.get(this.#states.sessions(ref))
        if (value === undefined) {
            this.#storage.delete(sessionKey(ref))
            this.#queueCleanup(ref, generation)
            return
        }

        entry.pendingDelete = false
        const envelope = Object.freeze({
            version: 1,
            ref,
            order: entry.order,
            value,
        }) satisfies SessionEnvelope
        this.#storage.put(sessionKey(ref), envelope)
        const persistedWatermark = this.#storage.has(WATERMARK_KEY)
            ? validateWatermark(this.#storage.get(WATERMARK_KEY))
            : 0
        if (persistedWatermark < entry.order) {
            this.#storage.put(WATERMARK_KEY, entry.order)
        }
    }

    #onMembershipChange(): void {
        this.#insideMembershipCallback = true
        try {
            const present = new Set(
                this.#store.get(this.#states.sessions).map(row => row.key),
            )
            for (const [ref, entry] of this.#registry) {
                if (!present.has(ref)) this.#queueCleanup(ref, entry.generation)
            }
        } finally {
            this.#insideMembershipCallback = false
        }
    }

    #queueCleanup(ref: SessionRef, generation: number): void {
        const entry = this.#registry.get(ref)
        if (
            entry === undefined ||
            entry.generation !== generation ||
            entry.pendingDelete
        ) {
            return
        }
        entry.pendingDelete = true
        this.#queuedCleanup.push(Object.freeze({ ref, generation }))
    }

    #reconcileProvisionals(
        provisional: readonly ProvisionalAttachment[],
    ): void {
        for (const candidate of provisional) {
            const entry = this.#registry.get(candidate.ref)
            if (
                entry === undefined ||
                entry.generation !== candidate.generation ||
                this.#store.get(this.#states.sessions(candidate.ref)) !==
                    undefined
            ) {
                continue
            }
            entry.unsubscribe()
            this.#registry.delete(candidate.ref)
        }
    }
}

interface OracleRecord {
    readonly value: Session
    readonly order: number
}

class SessionOracle {
    readonly #records = new Map<SessionRef, OracleRecord>()
    #watermark = 0

    set(value: Session): void {
        const existing = this.#records.get(value.ref)
        if (existing === undefined) {
            this.#watermark++
            this.#records.set(
                value.ref,
                Object.freeze({ value, order: this.#watermark }),
            )
            return
        }
        this.#records.set(
            value.ref,
            Object.freeze({ value, order: existing.order }),
        )
    }

    delete(ref: SessionRef): void {
        this.#records.delete(ref)
    }

    get rows(): readonly SessionRef[] {
        return [...this.#records]
            .sort(([, left], [, right]) => left.order - right.order)
            .map(([ref]) => ref)
    }

    get valid(): readonly Session[] {
        return [...this.#records.values()]
            .map(record => record.value)
            .filter(value => value.expiresAt > NOW)
    }

    get byUser(): readonly Session[] {
        return this.valid.filter(value => value.userId === "user-1")
    }

    get current(): Session | undefined {
        return this.byUser[0]
    }
}

const expectAdapterToMatch = (
    adapter: ShiftXSessionsAdapter,
    states: SessionStates,
    oracle: SessionOracle,
): void => {
    expect(adapter.target.get(states.sessions).map(row => row.key)).toEqual([
        ...oracle.rows,
    ])
    expect(adapter.target.get(states.validSessions)).toEqual([...oracle.valid])
    expect(adapter.target.get(states.sessionsByUser)).toEqual([
        ...oracle.byUser,
    ])
    expect(
        Object.is(adapter.target.get(states.currentSession), oracle.current),
    ).toBe(true)
}

interface MigrationEntry {
    readonly ref: SessionRef
    readonly order: number
}

interface MigrationManifest {
    readonly version: 1
    readonly entries: readonly MigrationEntry[]
    readonly watermark: number
}

const validateManifest = (value: unknown): MigrationManifest => {
    if (
        !isRecord(value) ||
        value.version !== 1 ||
        !Array.isArray(value.entries)
    ) {
        throw new TypeError("Invalid ShiftX migration manifest")
    }
    const entries = value.entries.map((candidate, index) => {
        if (!isRecord(candidate) || !isSessionRef(candidate.ref)) {
            throw new TypeError("Invalid ShiftX migration identity")
        }
        const order = validateOrder(
            candidate.order,
            `Migration order ${index + 1}`,
        )
        return Object.freeze({ ref: candidate.ref, order })
    })
    if (
        new Set(entries.map(entry => entry.ref)).size !== entries.length ||
        new Set(entries.map(entry => entry.order)).size !== entries.length
    ) {
        throw new TypeError("ShiftX migration manifest must be unique")
    }
    const watermark = validateWatermark(value.watermark)
    if (watermark < Math.max(0, ...entries.map(entry => entry.order))) {
        throw new TypeError("ShiftX migration watermark is stale")
    }
    return Object.freeze({
        version: 1,
        entries: Object.freeze(entries),
        watermark,
    })
}

const assertSnapshotMatchesManifest = (
    snapshot: PersistedSnapshot,
    manifest: MigrationManifest,
): void => {
    if (
        snapshot.envelopes.length !== manifest.entries.length ||
        snapshot.watermark < manifest.watermark
    ) {
        throw new TypeError("Incomplete migrated ShiftX view")
    }
    for (const [index, entry] of [...manifest.entries]
        .sort((left, right) => left.order - right.order)
        .entries()) {
        const envelope = snapshot.envelopes[index]
        if (
            envelope === undefined ||
            envelope.ref !== entry.ref ||
            envelope.order !== entry.order
        ) {
            throw new TypeError(
                "Migrated ShiftX view does not match its marker",
            )
        }
    }
}

const manifestsMatch = (
    left: MigrationManifest,
    right: MigrationManifest,
): boolean =>
    left.watermark === right.watermark &&
    left.entries.length === right.entries.length &&
    left.entries.every(
        (entry, index) =>
            entry.ref === right.entries[index]?.ref &&
            entry.order === right.entries[index]?.order,
    )

const readMarkerGatedSnapshot = (
    storage: DurableSessionStorage,
    keyOrder?: readonly string[],
): PersistedSnapshot => {
    if (!storage.has(MARKER_KEY)) {
        throw new MigrationVisibilityPendingError()
    }
    const marker = validateManifest(storage.get(MARKER_KEY))
    const snapshot = readPersistedSnapshot(storage, keyOrder)

    if (storage.has(STAGING_KEY)) {
        const staging = validateManifest(storage.get(STAGING_KEY))
        if (!manifestsMatch(marker, staging)) {
            throw new TypeError(
                "ShiftX migration marker does not match its staging manifest",
            )
        }
        assertSnapshotMatchesManifest(snapshot, marker)
    } else if (storage.scan(LEGACY_PREFIX).length > 0) {
        throw new TypeError(
            "ShiftX migration cleanup lost its durable staging manifest",
        )
    } else if (snapshot.watermark < marker.watermark) {
        throw new TypeError(
            "ShiftX session watermark predates its migration marker",
        )
    }
    return snapshot
}

const readStartupSnapshot = (
    storage: DurableSessionStorage,
    keyOrder: readonly string[],
): PersistedSnapshot => {
    if (storage.has(MARKER_KEY)) {
        return readMarkerGatedSnapshot(storage, keyOrder)
    }
    if (storage.has(STAGING_KEY) || storage.scan(LEGACY_PREFIX).length > 0) {
        throw new MigrationVisibilityPendingError()
    }
    return readPersistedSnapshot(storage, keyOrder)
}

const restoreAdapter = (
    states: SessionStates,
    storage: DurableSessionStorage,
    keyOrder: readonly string[],
    createTarget: () => Store = store,
): ShiftXSessionsAdapter => {
    // Marker visibility and all keyed data are validated before constructing,
    // subscribing, or writing a Store. A migration crash cannot hydrate its
    // partially written envelope prefix through the real startup path.
    const snapshot = readStartupSnapshot(storage, keyOrder)
    const maximumOrder = snapshot.envelopes.reduce(
        (maximum, envelope) => Math.max(maximum, envelope.order),
        0,
    )
    const adapter = new ShiftXSessionsAdapter(
        states,
        createTarget(),
        storage,
        Math.max(maximumOrder, snapshot.watermark),
    )
    adapter.hydrate(snapshot.envelopes)
    return adapter
}

const legacySessions = (
    storage: DurableSessionStorage,
): readonly (readonly [SessionRef, Session])[] =>
    storage.scan(LEGACY_PREFIX).map(([key, value]) => {
        const ref = key.slice(LEGACY_PREFIX.length)
        if (!isSessionRef(ref)) throw new TypeError("Invalid legacy identity")
        const session = validateSession(value)
        if (session.ref !== ref) throw new TypeError("Legacy identity mismatch")
        return Object.freeze([ref, session] as const)
    })

const verifyCompleteMigratedView = (
    storage: DurableSessionStorage,
): PersistedSnapshot => readMarkerGatedSnapshot(storage)

const migrateLegacySessions = (storage: DurableSessionStorage): void => {
    if (storage.has(MARKER_KEY)) {
        verifyCompleteMigratedView(storage)
        for (const [key] of storage.scan(LEGACY_PREFIX)) storage.delete(key)
        if (storage.has(STAGING_KEY)) storage.delete(STAGING_KEY)
        return
    }

    let manifest: MigrationManifest
    if (storage.has(STAGING_KEY)) {
        manifest = validateManifest(storage.get(STAGING_KEY))
    } else {
        const legacy = legacySessions(storage)
        manifest = Object.freeze({
            version: 1,
            entries: Object.freeze(
                legacy.map(([ref], index) =>
                    Object.freeze({ ref, order: index + 1 }),
                ),
            ),
            watermark: legacy.length,
        })
        // The complete cursor-order assignment is durable before row mutation.
        storage.put(STAGING_KEY, manifest)
    }

    for (const entry of manifest.entries) {
        const value = validateSession(storage.get(legacyKey(entry.ref)))
        const envelope = Object.freeze({
            version: 1,
            ref: entry.ref,
            order: entry.order,
            value,
        }) satisfies SessionEnvelope
        const key = sessionKey(entry.ref)
        if (!storage.has(key)) storage.put(key, envelope)
        const persisted = validateEnvelope(key, storage.get(key))
        if (
            persisted.order !== envelope.order ||
            persisted.value.ref !== envelope.value.ref ||
            persisted.value.userId !== envelope.value.userId ||
            persisted.value.expiresAt !== envelope.value.expiresAt ||
            persisted.value.revision !== envelope.value.revision ||
            persisted.value.privateToken !== envelope.value.privateToken
        ) {
            throw new TypeError(`Migrated ShiftX envelope mismatch at ${key}`)
        }
    }
    if (!storage.has(WATERMARK_KEY)) {
        storage.put(WATERMARK_KEY, manifest.watermark)
    }
    if (!storage.has(MARKER_KEY)) storage.put(MARKER_KEY, manifest)

    // The marker is the visibility switch. Cleanup is resumable after it.
    verifyCompleteMigratedView(storage)
    for (const [key] of storage.scan(LEGACY_PREFIX)) storage.delete(key)
    if (storage.has(STAGING_KEY)) storage.delete(STAGING_KEY)
}

const visibleStoredSessions = (
    storage: DurableSessionStorage,
): readonly Session[] =>
    storage.has(MARKER_KEY)
        ? verifyCompleteMigratedView(storage).envelopes.map(
              envelope => envelope.value,
          )
        : legacySessions(storage).map(([, value]) => value)

const legacyFixture = (): DurableSessionStorage =>
    new DurableSessionStorage([
        [legacyKey("B"), SESSION_B],
        [legacyKey("A"), SESSION_A],
        [legacyKey("C"), SESSION_C],
    ])

const collectionTotals = (totals: InspectionWorkTotals) => ({
    collectionMembershipRecordCreations:
        totals.collectionMembershipRecordCreations,
    collectionMembershipRowsScanned: totals.collectionMembershipRowsScanned,
    collectionMembershipArrayAllocations:
        totals.collectionMembershipArrayAllocations,
    collectionMembershipSourcesChanged:
        totals.collectionMembershipSourcesChanged,
    collectionOwnerRetentionSetsCreated:
        totals.collectionOwnerRetentionSetsCreated,
    collectionOwnerRetains: totals.collectionOwnerRetains,
})

describe("ShiftX sessions collection acceptance", () => {
    test("matches an independent Map oracle through enrollment, abort, logout, and stale cleanup", () => {
        const states = createSessionStates()
        const storage = new DurableSessionStorage()
        const adapter = new ShiftXSessionsAdapter(states, store(), storage)
        const oracle = new SessionOracle()
        const rowA = states.sessions("A")
        const rowB = states.sessions("B")

        expect(states.sessions("A")).toBe(rowA)
        expect(rowA.key).toBe("A")
        expect(adapter.target.get(rowA)).toBeUndefined()
        const emptyMembership = adapter.target.get(states.sessions)
        expect(emptyMembership).toEqual([])
        expect(adapter.target.get(states.sessions)).toBe(emptyMembership)

        adapter.ensureSubscribed("A")
        adapter.ensureSubscribed("B")
        let membershipCalls = 0
        let derivedCalls = 0
        const unsubscribeMembership = adapter.target.sub(
            states.sessions,
            () => membershipCalls++,
        )
        const unsubscribeDerived = adapter.target.sub(
            states.sessionsByUser,
            () => derivedCalls++,
        )
        adapter.target.get(states.sessionsByUser)

        adapter.transaction(["A", "B"], transaction => {
            transaction.set(rowA, SESSION_A)
            transaction.set(rowB, SESSION_B)
            expect(transaction.get(states.validSessions)).toEqual([SESSION_A])
            expect(transaction.get(states.sessionsByUser)).toEqual([SESSION_A])
            expect(transaction.get(states.currentSession)).toBe(SESSION_A)
        })
        oracle.set(SESSION_A)
        oracle.set(SESSION_B)
        expectAdapterToMatch(adapter, states, oracle)
        expect([membershipCalls, derivedCalls]).toEqual([1, 1])
        expect(
            validateEnvelope(sessionKey("A"), storage.get(sessionKey("A")))
                .value,
        ).toBe(SESSION_A)
        expect(storage.get(WATERMARK_KEY)).toBe(2)

        const membershipBeforeUpdate = adapter.target.get(states.sessions)
        storage.clearMutations()
        adapter.update("A", () => SESSION_A_UPDATED)
        oracle.set(SESSION_A_UPDATED)
        expect(adapter.target.get(states.sessions)).toBe(membershipBeforeUpdate)
        expect([membershipCalls, derivedCalls]).toEqual([1, 2])
        expect(storage.mutations).toEqual([
            { kind: "put", key: sessionKey("A") },
        ])
        expect(
            validateEnvelope(sessionKey("A"), storage.get(sessionKey("A")))
                .value,
        ).toBe(SESSION_A_UPDATED)
        expectAdapterToMatch(adapter, states, oracle)

        let presenceCalls = 0
        const unsubscribePresence = adapter.target.sub(
            presence(rowA),
            () => presenceCalls++,
        )
        storage.clearMutations()
        adapter.update("A", current =>
            Object.freeze({ ...current, revision: current.revision + 1 }),
        )
        oracle.set(adapter.target.get(rowA)!)
        expect(membershipCalls).toBe(1)
        expect(presenceCalls).toBe(0)
        expect(storage.mutations).toHaveLength(1)
        expect(adapter.target.get(states.sessions)).toBe(membershipBeforeUpdate)

        const abort = new Error("abort provisional ShiftX session")
        const activeBeforeAbort = adapter.activeSubscriptions
        const callsBeforeAbort = Object.freeze({
            membershipCalls,
            derivedCalls,
            presenceCalls,
        })
        storage.clearMutations()
        expect(() =>
            adapter.transaction(["C"], transaction => {
                transaction.set(states.sessions("C"), SESSION_C)
                throw abort
            }),
        ).toThrow(abort)
        expect(adapter.target.get(states.sessions("C"))).toBeUndefined()
        expect(adapter.target.get(states.sessions)).toBe(membershipBeforeUpdate)
        expect(adapter.activeSubscriptions).toBe(activeBeforeAbort)
        expect(storage.has(sessionKey("C"))).toBe(false)
        expect(storage.mutations).toEqual([])
        expect({ membershipCalls, derivedCalls, presenceCalls }).toEqual(
            callsBeforeAbort,
        )
        expectAdapterToMatch(adapter, states, oracle)

        const deletedGeneration = adapter.generation("A")!
        adapter.transaction([], transaction => transaction.delete(rowA))
        oracle.delete("A")
        expectAdapterToMatch(adapter, states, oracle)
        expect(storage.has(sessionKey("A"))).toBe(false)

        const reinsertGeneration = adapter.ensureSubscribed("A")
        expect(reinsertGeneration).toBeGreaterThan(deletedGeneration)
        adapter.set("A", SESSION_A_REINSERTED)
        oracle.set(SESSION_A_REINSERTED)
        expectAdapterToMatch(adapter, states, oracle)
        expect(adapter.target.get(states.sessions).map(row => row.key)).toEqual(
            ["B", "A"],
        )

        // The generation-one cleanup was queued by delete. It cannot detach
        // generation two after a synchronous reinsert.
        adapter.flushCleanup()
        expect(adapter.generation("A")).toBe(reinsertGeneration)
        storage.clearMutations()
        adapter.update("A", current =>
            Object.freeze({ ...current, revision: current.revision + 1 }),
        )
        oracle.set(adapter.target.get(rowA)!)
        expect(storage.mutations).toHaveLength(1)
        expectAdapterToMatch(adapter, states, oracle)
        expect(adapter.membershipCallbackSubscriptionAttempts).toBe(0)

        unsubscribePresence()
        unsubscribeDerived()
        unsubscribeMembership()
        adapter.dispose()
    })

    test("restores shuffled envelopes by validated order and advances a durable watermark", () => {
        const states = createSessionStates()
        const storage = new DurableSessionStorage([
            [
                sessionKey("A"),
                Object.freeze({
                    version: 1,
                    ref: "A",
                    order: 2,
                    value: SESSION_A_REINSERTED,
                }) satisfies SessionEnvelope,
            ],
            [
                sessionKey("B"),
                Object.freeze({
                    version: 1,
                    ref: "B",
                    order: 1,
                    value: SESSION_B,
                }) satisfies SessionEnvelope,
            ],
            [WATERMARK_KEY, 4],
        ])
        const first = restoreAdapter(states, storage, [
            sessionKey("A"),
            sessionKey("B"),
        ])
        expect(first.target.get(states.sessions).map(row => row.key)).toEqual([
            "B",
            "A",
        ])
        expect(first.target.get(states.validSessions)).toEqual([
            SESSION_A_REINSERTED,
        ])
        expect(first.target.get(states.currentSession)).toBe(
            SESSION_A_REINSERTED,
        )
        first.set("C", SESSION_C)
        expect(
            validateEnvelope(sessionKey("C"), storage.get(sessionKey("C")))
                .order,
        ).toBe(5)
        first.dispose()

        const second = restoreAdapter(states, storage, [
            sessionKey("C"),
            sessionKey("A"),
            sessionKey("B"),
        ])
        expect(second.target.get(states.sessions).map(row => row.key)).toEqual([
            "B",
            "A",
            "C",
        ])
        expect(second.target.get(states.sessionsByUser)).toEqual([
            SESSION_A_REINSERTED,
            SESSION_C,
        ])
        second.delete("B")
        second.flushCleanup()
        second.set("B", SESSION_B)
        expect(second.target.get(states.sessions).map(row => row.key)).toEqual([
            "A",
            "C",
            "B",
        ])
        expect(
            validateEnvelope(sessionKey("B"), storage.get(sessionKey("B")))
                .order,
        ).toBe(6)
        second.dispose()

        const finalRestart = restoreAdapter(states, storage, [
            sessionKey("B"),
            sessionKey("C"),
            sessionKey("A"),
        ])
        expect(
            finalRestart.target.get(states.sessions).map(row => row.key),
        ).toEqual(["A", "C", "B"])
        finalRestart.dispose()

        const prepopulatedTarget = store()
        prepopulatedTarget.set(states.sessions("C"), SESSION_C)
        const bootstrapStorage = new DurableSessionStorage([
            [
                sessionKey("C"),
                Object.freeze({
                    version: 1,
                    ref: "C",
                    order: 7,
                    value: SESSION_C,
                }) satisfies SessionEnvelope,
            ],
            [WATERMARK_KEY, 7],
        ])
        const bootstrapped = new ShiftXSessionsAdapter(
            states,
            prepopulatedTarget,
            bootstrapStorage,
            7,
        )
        expect(bootstrapped.activeSubscriptions).toBe(1)
        bootstrapStorage.clearMutations()
        bootstrapped.update("C", current =>
            Object.freeze({ ...current, revision: current.revision + 1 }),
        )
        expect(bootstrapStorage.mutations).toEqual([
            { kind: "put", key: sessionKey("C") },
        ])
        expect(
            validateEnvelope(
                sessionKey("C"),
                bootstrapStorage.get(sessionKey("C")),
            ).order,
        ).toBe(7)
        bootstrapped.dispose()

        const invalidCases: readonly DurableSessionStorage[] = [
            new DurableSessionStorage([
                [
                    sessionKey("A"),
                    { version: 1, ref: "A", order: 1, value: SESSION_A },
                ],
                [
                    sessionKey("B"),
                    { version: 1, ref: "B", order: 1, value: SESSION_B },
                ],
            ]),
            new DurableSessionStorage([
                [
                    sessionKey("A"),
                    {
                        version: 1,
                        ref: "A",
                        order: Number.POSITIVE_INFINITY,
                        value: SESSION_A,
                    },
                ],
            ]),
            new DurableSessionStorage([
                [
                    sessionKey("A"),
                    {
                        version: 1,
                        ref: "A",
                        order: Number.MAX_SAFE_INTEGER + 1,
                        value: SESSION_A,
                    },
                ],
            ]),
            new DurableSessionStorage([[WATERMARK_KEY, Number.NaN]]),
        ]
        for (const invalid of invalidCases) {
            let storeCreations = 0
            expect(() =>
                restoreAdapter(states, invalid, [], () => {
                    storeCreations++
                    return store()
                }),
            ).toThrow(TypeError)
            expect(storeCreations).toBe(0)
        }
    })

    test("resumes a manifest migration after every keyed write without a half-visible view", () => {
        const baseline = legacyFixture()
        migrateLegacySessions(baseline)
        expect(baseline.mutations).toEqual([
            { kind: "put", key: STAGING_KEY },
            { kind: "put", key: sessionKey("B") },
            { kind: "put", key: sessionKey("A") },
            { kind: "put", key: sessionKey("C") },
            { kind: "put", key: WATERMARK_KEY },
            { kind: "put", key: MARKER_KEY },
            { kind: "delete", key: legacyKey("B") },
            { kind: "delete", key: legacyKey("A") },
            { kind: "delete", key: legacyKey("C") },
            { kind: "delete", key: STAGING_KEY },
        ])
        const expected = [SESSION_B, SESSION_A, SESSION_C]
        expect(visibleStoredSessions(baseline)).toEqual(expected)
        expect(readPersistedSnapshot(baseline).watermark).toBe(3)

        const writeCount = baseline.mutations.length

        const evolvedStorage = legacyFixture()
        migrateLegacySessions(evolvedStorage)
        const evolvedStates = createSessionStates()
        const evolved = restoreAdapter(evolvedStates, evolvedStorage, [
            sessionKey("C"),
            sessionKey("A"),
            sessionKey("B"),
        ])
        evolved.delete("B")
        evolved.flushCleanup()
        evolved.set("B", SESSION_B)
        evolved.dispose()
        expect(
            validateManifest(evolvedStorage.get(MARKER_KEY)).entries.map(
                entry => entry.ref,
            ),
        ).toEqual(["B", "A", "C"])

        const evolvedRestart = restoreAdapter(evolvedStates, evolvedStorage, [
            sessionKey("B"),
            sessionKey("C"),
            sessionKey("A"),
        ])
        expect(
            evolvedRestart.target
                .get(evolvedStates.sessions)
                .map(row => row.key),
        ).toEqual(["A", "C", "B"])
        expect(evolvedStorage.get(WATERMARK_KEY)).toBe(4)
        evolvedRestart.dispose()

        for (let faultAfter = 1; faultAfter <= writeCount; faultAfter++) {
            const storage = legacyFixture()
            storage.faultAfter(faultAfter)
            expect(() => migrateLegacySessions(storage)).toThrow(
                KeyedWriteFault,
            )
            expect(visibleStoredSessions(storage)).toEqual(expected)

            const intermediateStates = createSessionStates()
            let intermediateStoreCreations = 0
            const restoreIntermediate = (): ShiftXSessionsAdapter =>
                restoreAdapter(
                    intermediateStates,
                    storage,
                    [sessionKey("C"), sessionKey("A"), sessionKey("B")],
                    () => {
                        intermediateStoreCreations++
                        return store()
                    },
                )
            if (storage.has(MARKER_KEY)) {
                const intermediate = restoreIntermediate()
                const rows = intermediate.target.get(
                    intermediateStates.sessions,
                )
                expect(rows.map(row => intermediate.target.get(row))).toEqual(
                    expected,
                )
                expect(intermediateStoreCreations).toBe(1)
                intermediate.dispose()
            } else {
                expect(restoreIntermediate).toThrow(
                    MigrationVisibilityPendingError,
                )
                expect(intermediateStoreCreations).toBe(0)
            }

            storage.clearFault()
            migrateLegacySessions(storage)
            expect(visibleStoredSessions(storage)).toEqual(expected)
            expect(storage.scan(LEGACY_PREFIX)).toEqual([])
            expect(storage.has(STAGING_KEY)).toBe(false)
            expect(validateManifest(storage.get(MARKER_KEY))).toEqual({
                version: 1,
                entries: [
                    { ref: "B", order: 1 },
                    { ref: "A", order: 2 },
                    { ref: "C", order: 3 },
                ],
                watermark: 3,
            })

            const stable = readPersistedSnapshot(storage)
            expect(stable.envelopes.map(envelope => envelope.ref)).toEqual([
                "B",
                "A",
                "C",
            ])
            storage.clearMutations()
            migrateLegacySessions(storage)
            expect(storage.mutations).toEqual([])
            expect(readPersistedSnapshot(storage)).toEqual(stable)

            const states = createSessionStates()
            const firstRestart = restoreAdapter(states, storage, [
                sessionKey("A"),
                sessionKey("C"),
                sessionKey("B"),
            ])
            expect(
                firstRestart.target.get(states.sessions).map(row => row.key),
            ).toEqual(["B", "A", "C"])
            firstRestart.dispose()

            const secondRestart = restoreAdapter(states, storage, [
                sessionKey("C"),
                sessionKey("B"),
                sessionKey("A"),
            ])
            expect(
                secondRestart.target.get(states.sessions).map(row => row.key),
            ).toEqual(["B", "A", "C"])
            secondRestart.dispose()
        }
    })

    test("closes inspection with bounded structural work and no ShiftX data", () => {
        const states = createSessionStates()
        const secretRef = "A"
        const secretValue = SESSION_A
        const { store: inspectedStore, inspect } = createInspectableStore({
            capacity: { summaries: 32, details: 128 },
        })

        // Canonical handle lookup is definition-only and creates no Store work.
        expect(states.sessions(secretRef)).toBe(states.sessions(secretRef))
        expect(inspect.export().summaries).toEqual([])
        expect(inspect.export().details).toEqual([])

        inspect.span("absent ShiftX reads", () => {
            expect(
                inspectedStore.get(states.sessions(secretRef)),
            ).toBeUndefined()
            expect(
                inspectedStore.get(presence(states.sessions(secretRef))),
            ).toBe(false)
        })
        const absent = inspect
            .export()
            .summaries.find(
                summary =>
                    summary.type === "span" &&
                    summary.name === "absent ShiftX reads",
            )!
        expect(collectionTotals(absent.totals)).toMatchObject({
            collectionMembershipRecordCreations: 0,
            collectionOwnerRetentionSetsCreated: 0,
            collectionOwnerRetains: 0,
        })

        const storage = new DurableSessionStorage()
        const adapter = new ShiftXSessionsAdapter(
            states,
            inspectedStore,
            storage,
        )
        adapter.set(secretRef, secretValue)
        inspect.reset()
        inspect.span("ShiftX value update", () => {
            adapter.update(secretRef, current =>
                Object.freeze({ ...current, revision: current.revision + 1 }),
            )
        })
        const report = inspect.export()
        const update = report.summaries.find(
            summary =>
                summary.type === "span" &&
                summary.name === "ShiftX value update",
        )!
        expect(collectionTotals(update.totals)).toMatchObject({
            collectionMembershipRowsScanned: 0,
            collectionMembershipArrayAllocations: 0,
            collectionMembershipSourcesChanged: 0,
            collectionOwnerRetentionSetsCreated: 0,
            collectionOwnerRetains: 0,
        })
        expect(report.complete).toBe(true)
        const serialized = JSON.stringify(report)
        expect(serialized).not.toContain(JSON.stringify(secretRef))
        expect(serialized).not.toContain(secretValue.privateToken)
        adapter.dispose()
    })
})
