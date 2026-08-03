import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"
import { StoreDisposedError } from "../errors/StoreDisposedError"
import { assertStoreInvariants } from "../../test/invariants/checkStoreInvariants"
import { getStoreData } from "./getStoreData"

/**
 * Liveness-pass ownership contract (see graph/mountAtom.ts beginLivenessPass).
 *
 * `data.livenessPassActive` is the single ownership token: the outermost
 * propagation or store read owns the pass, every nested one defers its seeds to
 * that owner, and exactly one reconcile runs at the outermost boundary. Today
 * that is guaranteed by the control flow of the two owner sites
 * (propagateSelectorUpdates and the store read path), which is precisely what
 * decomposing propagateUpdatedAtoms.ts could disturb.
 *
 * These are characterization tests. They pin who owns the pass at each point
 * where user code re-enters the store — selector bodies, onMount, unmount
 * cleanup, unsubscribe, and disposal — rather than asserting a desired design.
 */

describe("liveness pass ownership", () => {
    test("a nested facade read defers to the in-flight pass", () => {
        const storeInstance = store()
        const data = getStoreData(storeInstance)
        const observed: {
            cachedBeforeRead: boolean
            ownedBefore: boolean
            ownedAfter: boolean
        }[] = []

        const source = atom(0)
        // Each evaluation reads a DIFFERENT, never-before-read selector, so the
        // nested read is always absent from `data.values` and cannot take the
        // cached-value early return in getDefault — it must traverse
        // beginLivenessPass. Reusing one target would let the subscribe-time
        // evaluation cache it, and the propagation-time read would then return
        // early and exercise none of the ownership path.
        const coldViews = [0, 1, 2, 3].map(index => {
            const coldSource = atom(index * 100)
            return selector(get => get(coldSource) + 5)
        })

        let readIndex = 0
        const derived = selector(get => {
            const value = get(source)
            const target = coldViews[readIndex++]!
            const cachedBeforeRead = data.values.has(target)
            const ownedBefore = !!data.livenessPassActive
            // Re-entering through the facade must not open a second pass: a
            // nested owner would end the pass here and reconcile early, against
            // a half-settled graph.
            const nested = storeInstance.get(target)
            observed.push({
                cachedBeforeRead,
                ownedBefore,
                ownedAfter: !!data.livenessPassActive,
            })
            return value + nested
        })

        storeInstance.sub(derived, () => {})
        storeInstance.set(source, 1)

        // Exactly one evaluation ran inside the owned pass, and at that point
        // the nested target was genuinely uncached — so the read went through
        // the store-read ownership path rather than returning early.
        const inPass = observed.filter(entry => entry.ownedBefore)
        expect(inPass.length).toBe(1)
        expect(inPass[0]!.cachedBeforeRead).toBe(false)
        // The outer token survived the nested read: it neither claimed
        // ownership nor released the pass the outer settlement holds.
        expect(inPass[0]!.ownedAfter).toBe(true)

        // The pass is released exactly once, when the outer settlement unwinds.
        expect(storeInstance.get(derived)).toBe(106)
        expect(data.livenessPassActive).toBe(false)
        assertStoreInvariants(storeInstance)
    })

    test("the pass is released once settlement unwinds, not by nested work", () => {
        const storeInstance = store()
        const data = getStoreData(storeInstance)
        const source = atom(0)
        const derived = selector(get => get(source) * 2)

        storeInstance.sub(derived, () => {})
        expect(data.livenessPassActive).toBe(false)
        storeInstance.set(source, 2)
        expect(data.livenessPassActive).toBe(false)
        expect(storeInstance.get(derived)).toBe(4)
        expect(data.livenessPassActive).toBe(false)
    })

    test("unsubscribing from inside an owned pass leaves ownership intact", () => {
        const storeInstance = store()
        const data = getStoreData(storeInstance)
        const observed: boolean[] = []

        const source = atom(0)
        const other = selector(get => get(source) * 10)
        let releaseOther: (() => void) | undefined = storeInstance.sub(
            other,
            () => {},
        )

        const derived = selector(get => {
            const value = get(source)
            if (value === 1 && releaseOther) {
                observed.push(!!data.livenessPassActive)
                // unsubscribe() reconciles cyclic liveness synchronously
                // without consulting the ownership token — pin that it does not
                // release the pass the outer settlement still owns.
                releaseOther()
                releaseOther = undefined
                observed.push(!!data.livenessPassActive)
            }
            return value
        })
        storeInstance.sub(derived, () => {})

        storeInstance.set(source, 1)

        expect(observed).toEqual([true, true])
        expect(data.livenessPassActive).toBe(false)
        expect(storeInstance.get(derived)).toBe(1)
        assertStoreInvariants(storeInstance)
    })
})

describe("re-entrant writes during lifecycle transitions", () => {
    test("mount and unmount hooks may write back into the settling store", () => {
        const storeInstance = store()
        const data = getStoreData(storeInstance)
        const observed: { phase: string; owned: boolean }[] = []

        const counter = atom(0)
        const gate = atom(0)
        const tracked = atom(0, {
            onMount: () => {
                observed.push({
                    phase: "mount",
                    owned: !!data.livenessPassActive,
                })
                storeInstance.set(counter, value => value + 1)
                return () => {
                    observed.push({
                        phase: "unmount",
                        owned: !!data.livenessPassActive,
                    })
                    storeInstance.set(counter, value => value + 100)
                }
            },
        })
        const derived = selector(get =>
            get(gate) === 0 ? get(tracked) : -1,
        )

        storeInstance.sub(derived, () => {})
        expect(storeInstance.get(derived)).toBe(0)

        // Flipping the gate drops the dependency on `tracked`, unmounting it
        // mid-settlement while the liveness pass is owned.
        storeInstance.set(gate, 1)

        expect(observed.map(entry => entry.phase)).toEqual(["mount", "unmount"])
        // Unmount runs inside the owned pass; the initial mount is driven by
        // the subscribe path, outside it.
        expect(observed[1]!.owned).toBe(true)
        // Both re-entrant writes committed.
        expect(storeInstance.get(counter)).toBe(101)
        expect(storeInstance.get(derived)).toBe(-1)
        expect(data.livenessPassActive).toBe(false)
        assertStoreInvariants(storeInstance)
    })
})

describe("store disposal during settlement", () => {
    test("disposing from an unmount cleanup clears the token mid-pass", () => {
        const storeInstance = store()
        const data = getStoreData(storeInstance)
        const observed: string[] = []

        const gate = atom(0)
        const tracked = atom(0, {
            onMount: () => () => {
                observed.push(`cleanup:${!!data.livenessPassActive}`)
                storeInstance.dispose()
                // resetLivenessScratch clears the ownership token even though
                // the outer settlement still holds the pass. Nothing can claim
                // the vacated token because every facade entry point now
                // rejects — that rejection, not the token, is the guard.
                observed.push(`disposed:${!!data.livenessPassActive}`)
                expect(() => storeInstance.get(gate)).toThrow(
                    StoreDisposedError,
                )
            },
        })
        const derived = selector(get =>
            get(gate) === 0 ? get(tracked) : -1,
        )

        storeInstance.sub(derived, () => {})
        expect(storeInstance.get(derived)).toBe(0)

        // The dropped dependency unmounts `tracked`, whose cleanup disposes the
        // store from inside the settlement that is still running.
        storeInstance.set(gate, 1)

        expect(observed).toEqual(["cleanup:true", "disposed:false"])
        expect(data.livenessPassActive).toBe(false)
        // Disposal is idempotent and the store stays terminal afterwards.
        expect(() => storeInstance.dispose()).not.toThrow()
        expect(() => storeInstance.get(gate)).toThrow(StoreDisposedError)
    })

    test("a store disposed mid-settlement leaves peers untouched", () => {
        const shared = atom(0)
        const derived = selector(get => get(shared) + 1)

        const doomed = store()
        const survivor = store()
        survivor.sub(derived, () => {})

        const tracked = atom(0, {
            onMount: () => () => doomed.dispose(),
        })
        const gate = atom(0)
        const gated = selector(get => (get(gate) === 0 ? get(tracked) : -1))
        doomed.sub(gated, () => {})
        expect(doomed.get(gated)).toBe(0)

        doomed.set(gate, 1)

        survivor.set(shared, 5)
        expect(survivor.get(derived)).toBe(6)
        expect(getStoreData(survivor).livenessPassActive).toBe(false)
        assertStoreInvariants(survivor)
        survivor.dispose()
    })
})
