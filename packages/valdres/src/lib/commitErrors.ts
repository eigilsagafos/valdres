export type CommitErrors = {
    hasError: boolean
    firstError: unknown
}

export const createCommitErrors = (): CommitErrors => ({
    hasError: false,
    firstError: undefined,
})

export const recordCommitError = (errors: CommitErrors, error: unknown) => {
    if (!errors.hasError) {
        errors.hasError = true
        errors.firstError = error
    }
}

export const throwCommitError = (errors: CommitErrors) => {
    if (errors.hasError) throw errors.firstError
}
