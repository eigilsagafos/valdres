export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export const waitCrash = (ms: number) => new Promise((_, reject) => setTimeout(reject, ms))
