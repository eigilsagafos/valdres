import type {
    Atom,
    PrimitiveAtom,
    WithInitialValue,
    WritableAtom,
} from "./types/jotai"
import { atomPrototype, defaultRead, defaultWrite } from "./lib/atomConfig"

type Read<Value> = Atom<Value>["read"]
type Write<Args extends unknown[], Result> = WritableAtom<
    unknown,
    Args,
    Result
>["write"]

let keyCount = 0

export function atom<Value, Args extends unknown[], Result>(
    read: Read<Value>,
    write: Write<Args, Result>,
): WritableAtom<Value, Args, Result>
export function atom<Value>(read: Read<Value>): Atom<Value>
export function atom<Value, Args extends unknown[], Result>(
    initialValue: Value,
    write: Write<Args, Result>,
): WritableAtom<Value, Args, Result> & WithInitialValue<Value>
export function atom<Value>(): PrimitiveAtom<Value | undefined> &
    WithInitialValue<Value | undefined>
export function atom<Value>(
    initialValue: Value,
): PrimitiveAtom<Value> & WithInitialValue<Value>
export function atom(read?: unknown, write?: unknown) {
    const key = `atom${++keyCount}`
    const config = Object.create(atomPrototype) as {
        toString: () => string
        debugLabel?: string
        read?: unknown
        write?: unknown
        init?: unknown
    }
    config.toString = function toString(this: { debugLabel?: string }) {
        return this.debugLabel ? `${key}:${this.debugLabel}` : key
    }
    if (typeof read === "function") {
        config.read = read
    } else {
        config.init = read
        config.read = defaultRead
        config.write = defaultWrite
    }
    if (write) {
        config.write = write
    }
    return config
}
