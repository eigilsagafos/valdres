export const deepFreeze = (obj: any, seen = new WeakSet()) => {
    if (seen.has(obj)) return obj
    if (obj && typeof obj === "object") seen.add(obj)
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
