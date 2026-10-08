// Shared setup for the island fixtures. Each fixture runs in its own process
// because every island bundle carries its own valdres runtime, and a realm
// accepts only one.
//
// The realm matches scripts/check-docs-islands.ts: happy-DOM supplies
// `document`/`window`, and `process` is absent while the bundle evaluates.
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { pathToFileURL } from "node:url"

export type Check = { ok: boolean; message: string }

const checks: Check[] = []
const consoleErrors: string[] = []

export function check(ok: unknown, message: string) {
    checks.push({ ok: Boolean(ok), message })
}

export function startBrowser(url: string, body: string) {
    GlobalRegistrator.register({ url })
    document.body.innerHTML = body
    const error = console.error
    console.error = (...args: unknown[]) => {
        consoleErrors.push(args.map(String).join(" "))
        error(...args)
    }
}

export async function loadBundle(path: string) {
    const saved = globalThis.process
    // @ts-expect-error -- the browser has no `process`
    delete globalThis.process
    try {
        return await import(pathToFileURL(path).href)
    } finally {
        globalThis.process = saved
    }
}

/** Wait for React (or anything asynchronous) to settle into a condition. */
export async function waitFor(condition: () => unknown, timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs
    while (!condition()) {
        if (Date.now() > deadline) return false
        await new Promise(resolve => setTimeout(resolve, 10))
    }
    return true
}

/** Run `fn` and return what it threw, or undefined. */
export function thrown(fn: () => unknown): Error | undefined {
    try {
        fn()
    } catch (error) {
        return error as Error
    }
    return undefined
}

/** Print the results for docs/test/islands.test.ts and exit. */
export function report() {
    check(consoleErrors.length === 0, `no console errors (${consoleErrors.join(" | ") || "none"})`)
    console.log(`__checks__${JSON.stringify(checks)}`)
    process.exit(0)
}
