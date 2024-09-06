export const waitCrash = (ms: number) =>
    new Promise((_, reject) => setTimeout(reject, ms))
