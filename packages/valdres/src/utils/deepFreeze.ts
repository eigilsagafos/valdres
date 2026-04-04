export const deepFreeze = (obj: any, seen = new WeakSet()) => {
    if (obj === null || obj === undefined) return obj
    if (typeof obj !== "object" && typeof obj !== "function") return obj
    if (seen.has(obj) || Object.isFrozen(obj)) return obj
    seen.add(obj)
    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (item && typeof item === "object") {
                deepFreeze(item, seen)
            }
        }
    } else {
        const propNames = Object.getOwnPropertyNames(obj)
        for (const name of propNames) {
            const value = obj[name]
            if (value && typeof value === "object") {
                deepFreeze(value, seen)
            }
        }
    }
    return Object.freeze(obj)
}
