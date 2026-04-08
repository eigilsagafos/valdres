/**
 * Appends a benchmark entry to the history file, keeping the last 50 runs.
 * Used by CI to update the benchmark-data branch.
 *
 * Usage: bun run scripts/append-bench-history.ts <existing.json> <entry.json> <output.json>
 */
import { readFileSync, writeFileSync } from "fs"

const [existingPath, entryPath, outputPath] = process.argv.slice(2)
if (!existingPath || !entryPath || !outputPath) {
    console.error(
        "Usage: bun run scripts/append-bench-history.ts <existing.json> <entry.json> <output.json>",
    )
    process.exit(1)
}

const history = JSON.parse(readFileSync(existingPath, "utf-8"))
if (!Array.isArray(history)) {
    console.error(`Expected ${existingPath} to contain a JSON array, got ${typeof history}`)
    process.exit(1)
}

const entry = JSON.parse(readFileSync(entryPath, "utf-8"))
if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    console.error(`Expected ${entryPath} to contain a JSON object, got ${typeof entry}`)
    process.exit(1)
}

history.push(entry)
const trimmed = history.slice(-50)
writeFileSync(outputPath, JSON.stringify(trimmed, null, 2))
console.log(`Appended entry (${trimmed.length} total, kept last 50)`)
