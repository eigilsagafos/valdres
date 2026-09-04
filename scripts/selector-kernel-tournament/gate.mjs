export function requireGate(condition, id, message) {
    if (!condition) throw new Error(`${id}: ${message}`)
}
