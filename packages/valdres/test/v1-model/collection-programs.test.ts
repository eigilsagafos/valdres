import { describe, expect, test } from "bun:test"
import { createReferenceModel } from "./model"
import {
    deterministicCollectionPrograms,
    generateCollectionProgram,
} from "./collection-programs"

describe("v1 shared collection scenario programs", () => {
    test("freezes the fifteen deterministic model/public scenarios", () => {
        expect(
            deterministicCollectionPrograms.map(program => program.name),
        ).toEqual(
            Array.from(
                { length: 15 },
                (_, index) =>
                    `V1M-COLLECTION-${String(index + 1).padStart(3, "0")}`,
            ),
        )
        expect(Object.isFrozen(deterministicCollectionPrograms)).toBe(true)
        for (const program of deterministicCollectionPrograms) {
            expect(Object.isFrozen(program)).toBe(true)
            expect(Object.isFrozen(program.commands)).toBe(true)
            const model = createReferenceModel()
            for (const command of program.commands) model.execute(command)
        }
    })

    test("generates reproducible versioned legal programs with broad coverage", () => {
        const first = generateCollectionProgram(0x5eedc0de, 256)
        const repeated = generateCollectionProgram(0x5eedc0de, 256)
        const other = generateCollectionProgram(0x5eedc0df, 256)

        expect(first).toEqual(repeated)
        expect(first.program).not.toEqual(other.program)
        expect(first.program.name).toBe("seeded-v1-1592639710-256")
        expect(Object.values(first.coverage).every(count => count > 0)).toBe(
            true,
        )

        const model = createReferenceModel()
        for (const command of first.program.commands) model.execute(command)
        expect(model.trace.length).toBeGreaterThan(0)
        expect(model.audit.length).toBeGreaterThan(0)
    })

    test("rejects non-positive or non-integral generated lengths", () => {
        for (const steps of [0, -1, 1.5, Number.NaN]) {
            expect(() => generateCollectionProgram(1, steps)).toThrow(TypeError)
        }
    })
})
