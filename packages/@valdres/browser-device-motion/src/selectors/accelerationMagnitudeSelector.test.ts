import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { motionAtom } from "../atoms/motionAtom"
import { accelerationMagnitudeSelector } from "./accelerationMagnitudeSelector"

describe("accelerationMagnitudeSelector", () => {
    afterEach(() => {
        motionAtom.resetSelf()
    })

    test("returns null when motion is null", () => {
        const s = store()
        expect(s.get(accelerationMagnitudeSelector)).toBeNull()
    })

    test("returns null when acceleration is null", () => {
        motionAtom.setSelf({
            acceleration: null,
            accelerationIncludingGravity: null,
            rotationRate: null,
            interval: 16,
            timeStamp: 0,
        })
        const s = store()
        expect(s.get(accelerationMagnitudeSelector)).toBeNull()
    })

    test("computes magnitude for a populated vector", () => {
        motionAtom.setSelf({
            acceleration: { x: 3, y: 4, z: 0 },
            accelerationIncludingGravity: null,
            rotationRate: null,
            interval: 16,
            timeStamp: 0,
        })
        const s = store()
        expect(s.get(accelerationMagnitudeSelector)).toBe(5)
    })

    test("treats null components as zero", () => {
        motionAtom.setSelf({
            acceleration: { x: null, y: null, z: 9 },
            accelerationIncludingGravity: null,
            rotationRate: null,
            interval: 16,
            timeStamp: 0,
        })
        const s = store()
        expect(s.get(accelerationMagnitudeSelector)).toBe(9)
    })

    test("returns 0 when all components are null", () => {
        motionAtom.setSelf({
            acceleration: { x: null, y: null, z: null },
            accelerationIncludingGravity: null,
            rotationRate: null,
            interval: 16,
            timeStamp: 0,
        })
        const s = store()
        expect(s.get(accelerationMagnitudeSelector)).toBe(0)
    })
})
