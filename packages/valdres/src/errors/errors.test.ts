import { describe, expect, test } from "bun:test"
import {
    SchemaValidationError,
    SelectorCircularDependencyError,
    SelectorEvaluationError,
    StoreDisposedError,
    atom,
    selector,
    store,
} from "../index"
import { SuspendAndWaitForResolveError } from "../lib/asyncDependencyTracking"

describe("public error classes", () => {
    test("a throwing selector is catchable from the package root", () => {
        const crashing = selector(
            () => {
                throw new Error("boom")
            },
            { name: "public-error-throwing-selector" },
        )
        let thrown: unknown

        try {
            store().get(crashing)
        } catch (error) {
            thrown = error
        }

        expect(thrown).toBeInstanceOf(SelectorEvaluationError)
    })

    test("a selector dependency cycle is catchable from the package root", () => {
        let circular: ReturnType<typeof selector>
        circular = selector(get => get(circular), {
            name: "public-error-circular-selector",
        })
        let thrown: unknown

        try {
            store().get(circular)
        } catch (error) {
            thrown = error
        }

        expect(thrown).toBeInstanceOf(SelectorCircularDependencyError)
    })

    test("every error class has its own name", () => {
        const state = atom(0)

        expect(
            new SchemaValidationError(new Error("invalid"), state).name,
        ).toBe("SchemaValidationError")
        expect(new StoreDisposedError("test-store").name).toBe(
            "StoreDisposedError",
        )
        expect(new SelectorEvaluationError().name).toBe(
            "SelectorEvaluationError",
        )
        expect(new SelectorCircularDependencyError().name).toBe(
            "SelectorCircularDependencyError",
        )
        expect(new SuspendAndWaitForResolveError(Promise.resolve()).name).toBe(
            "SuspendAndWaitForResolveError",
        )
    })

    test("public selector errors have a safe empty trace", () => {
        expect(new SelectorEvaluationError().message).toContain(
            "Anonymous Selector",
        )
        expect(new SelectorCircularDependencyError().message).toContain(
            "Anonymous Selector",
        )
    })

    test("custom instanceof handling preserves subclass identity", () => {
        class SpecializedSchemaError extends SchemaValidationError {}
        class SpecializedSelectorError extends SelectorEvaluationError {}
        class SpecializedCircularError extends SelectorCircularDependencyError {}
        class SpecializedStoreError extends StoreDisposedError {}
        class SpecializedSuspendError extends SuspendAndWaitForResolveError {}
        const state = atom(0)
        const promise = Promise.resolve()

        expect(
            new SchemaValidationError(new Error("invalid"), state),
        ).not.toBeInstanceOf(SpecializedSchemaError)
        expect(new SelectorEvaluationError()).not.toBeInstanceOf(
            SpecializedSelectorError,
        )
        expect(new SelectorCircularDependencyError()).not.toBeInstanceOf(
            SpecializedCircularError,
        )
        expect(new StoreDisposedError("base")).not.toBeInstanceOf(
            SpecializedStoreError,
        )
        expect(new SuspendAndWaitForResolveError(promise)).not.toBeInstanceOf(
            SpecializedSuspendError,
        )

        expect(
            new SpecializedSchemaError(new Error("invalid"), state),
        ).toBeInstanceOf(SpecializedSchemaError)
        expect(new SpecializedSelectorError()).toBeInstanceOf(
            SpecializedSelectorError,
        )
        expect(new SpecializedCircularError()).toBeInstanceOf(
            SpecializedCircularError,
        )
        expect(new SpecializedStoreError("specialized")).toBeInstanceOf(
            SpecializedStoreError,
        )
        expect(new SpecializedSuspendError(promise)).toBeInstanceOf(
            SpecializedSuspendError,
        )
    })
})
