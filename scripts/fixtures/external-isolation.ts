import {
    atom,
    externalAtom,
    selector,
    store,
} from "../../packages/valdres/src/v1"

const [workload, installed] = process.argv.slice(2)
let samples = 0
// Both arms load precisely the same module graph. Only this definition differs.
if (installed === "installed")
    externalAtom({
        getSnapshot: () => ++samples,
        subscribe: () => {
            throw new Error("Unrelated source attached")
        },
    })
const app = store()
const input = atom(0)
const selected = selector(get => get(input) + 1)
app.get(selected)
let checksum = 0
let next = 0
const callback = () => {
    checksum++
}
const run = (count: number) => {
    switch (workload) {
        case "reads":
            for (let i = 0; i < count; i++) checksum += app.get(selected)
            break
        case "subscriptions":
            for (let i = 0; i < count; i++) app.sub(selected, callback)()
            break
        case "writes":
            for (let i = 0; i < count; i++) app.set(input, ++next)
            break
        case "transactions":
            for (let i = 0; i < count; i++)
                app.txn(tx => tx.set(input, tx.get(input) + 1))
            break
        default:
            throw new Error(`Unknown workload ${workload}`)
    }
}
// Warm JITs before calibration; timing excludes imports, startup and definition.
const warm = performance.now()
do {
    run(1_000)
} while (performance.now() - warm < 150)
const calibration = performance.now()
run(10_000)
const count = Math.max(
    1_000,
    Math.ceil((10_000 * 40) / (performance.now() - calibration)),
)
const ns: number[] = []
for (let batch = 0; batch < 7; batch++) {
    const start = performance.now()
    run(count)
    ns.push(((performance.now() - start) * 1e6) / count)
}
if (samples !== 0) throw new Error("Unrelated source sampled")
if (!Number.isFinite(checksum) || app.get(input) < 0)
    throw new Error("Invalid result")
ns.sort((a, b) => a - b)
console.log(
    JSON.stringify({
        ns: ns[3],
        batches: ns,
        checksum,
        final: app.get(input),
        samples,
    }),
)
app.dispose()
