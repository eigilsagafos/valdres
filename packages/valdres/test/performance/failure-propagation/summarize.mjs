// Renders time.mjs JSON lines as a table of p50 [p10–p90] milliseconds.
//
//   node summarize.mjs result.json...
import { readFileSync } from "node:fs"

const STEPS = [
    "healthyWrite",
    "healthyRead",
    "failWrite",
    "failRead",
    "failInspect",
    "failInputWrite",
    "failStacks",
    "recoverWrite",
    "recoverRead",
]
for (const file of process.argv.slice(2)) {
    for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
        const result = JSON.parse(line)
        console.log(
            `${result.runtime} ${result.topology} ${result.width}x${result.layers}, ${result.rounds} rounds — p50 ms [p10–p90]`,
        )
        console.log(
            "lane".padEnd(10) +
                STEPS.map(step => step.padStart(21)).join("") +
                "  gc/failWrite",
        )
        for (const row of result.rows) {
            console.log(
                row.label.padEnd(10) +
                    STEPS.map(step => {
                        const { p10, p50, p90 } = row[step]
                        return `${p50.toFixed(2)} [${p10.toFixed(1)}–${p90.toFixed(1)}]`.padStart(
                            21,
                        )
                    }).join("") +
                    (row.failWriteGcCount === undefined
                        ? ""
                        : `  ${row.failWriteGcCount} (${row.failWriteGcMs} ms)`),
            )
        }
        console.log()
    }
}
