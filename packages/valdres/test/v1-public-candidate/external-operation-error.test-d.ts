import { ExternalSourceOperationError } from "../../src/index"

// Consumers can name the public constructor argument without importing a
// lifecycle or occurrence-record type from an internal module.
export type PublicExternalFailures = ConstructorParameters<
    typeof ExternalSourceOperationError
>[0]
export type PublicExternalFailure = PublicExternalFailures[number]

export const firstFailure = {
    cause: new Error("application failure"),
    committed: false,
    phase: "admitting",
    source: "external-startup",
} as const satisfies PublicExternalFailure

export const singleFailure = [firstFailure] as const
export const repeatedFailures = [firstFailure, firstFailure] as const
export const singleError = new ExternalSourceOperationError(singleFailure)
export const repeatedError = new ExternalSourceOperationError(repeatedFailures)

export function constructExternalError(
    failures: PublicExternalFailures,
): ExternalSourceOperationError {
    return new ExternalSourceOperationError(failures)
}

if (false) {
    // @ts-expect-error An empty constructor input has no first failure metadata.
    new ExternalSourceOperationError([])

    // @ts-expect-error The publicly nameable argument is a nonempty collection.
    const empty: PublicExternalFailures = []

    const possiblyEmpty: readonly PublicExternalFailure[] = []
    // @ts-expect-error A general array does not prove that a first failure exists.
    new ExternalSourceOperationError(possiblyEmpty)

    // @ts-expect-error A named readonly nonempty argument cannot lose its first entry.
    const optionalFirst: PublicExternalFailures = possiblyEmpty

    void [empty, optionalFirst]
}
