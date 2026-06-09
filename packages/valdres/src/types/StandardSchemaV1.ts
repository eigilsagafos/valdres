/**
 * The Standard Schema v1 interface (https://standard-schema.dev) — the
 * cross-library validation contract implemented by Zod 3.24+/4, Valibot 1+,
 * ArkType 2+, Effect Schema, and others. Vendored verbatim (the spec is
 * designed to be copied) so valdres accepts any standard-compliant schema
 * without taking a dependency on it.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly "~standard": StandardSchemaV1.Props<Input, Output>
}

export declare namespace StandardSchemaV1 {
    export interface Props<Input = unknown, Output = Input> {
        readonly version: 1
        readonly vendor: string
        readonly validate: (
            value: unknown,
        ) => Result<Output> | Promise<Result<Output>>
        readonly types?: Types<Input, Output> | undefined
    }

    export type Result<Output> = SuccessResult<Output> | FailureResult

    export interface SuccessResult<Output> {
        readonly value: Output
        readonly issues?: undefined
    }

    export interface FailureResult {
        readonly issues: ReadonlyArray<Issue>
    }

    export interface Issue {
        readonly message: string
        readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined
    }

    export interface PathSegment {
        readonly key: PropertyKey
    }

    export interface Types<Input = unknown, Output = Input> {
        readonly input: Input
        readonly output: Output
    }

    export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
        Schema["~standard"]["types"]
    >["input"]

    export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
        Schema["~standard"]["types"]
    >["output"]
}
