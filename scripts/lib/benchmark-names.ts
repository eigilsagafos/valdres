/**
 * Benchmark naming rules shared by the BMF converter and the paired decision
 * report. A `compare()` benchmark is named "<op> / <impl>"; a standalone
 * `measureOne()` benchmark is just "<op>".
 */

/** True for the competitor / native-floor side of a `compare()` benchmark. */
export function isReference(name: string): boolean {
    const match = name.match(/ \/ ([^/]+)$/)
    return match !== null && match[1] !== "valdres"
}

/** The "<op>" part of a benchmark name, dropping any " / <impl>" suffix. */
export function opName(name: string): string {
    const match = name.match(/^(.*) \/ [^/]+$/)
    return match ? match[1] : name
}
