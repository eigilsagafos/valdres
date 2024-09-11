import { callbacks } from "./callbacks"

export const registerCallback = (command: string, callback: () => void) => {
    if (!callbacks.has(command)) {
        callbacks.set(command, [])
    }
    ;(callbacks.get(command) as (() => void)[]).push(callback)
    return () => {
        const arr = callbacks.get(command)
        if (arr) {
            const filtered = arr.filter(cb => cb !== callback)
            callbacks.set(command, filtered)
        }
    }
}
