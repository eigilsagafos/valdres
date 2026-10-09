// Stand-in for `jest-leak-detector` on Bun: a WeakRef checked after forced GC.
export default class LeakDetector {
    private ref: WeakRef<object> | undefined

    constructor(value: unknown) {
        this.ref = new WeakRef(value as object)
    }

    async isLeaking(): Promise<boolean> {
        // A WeakRef target survives until the current job ends, and promise
        // reactions can hold it a few turns longer: collect until it is gone.
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 0))
            Bun.gc(true)
            if (this.ref!.deref() === undefined) return false
        }
        return true
    }
}
