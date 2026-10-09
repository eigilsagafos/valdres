import { atom, externalAtom, selector, type GetValue } from "valdres"
import { defaultRead, isOwnAtom } from "./atomConfig"
import { JotaiCompatibilityError, unwrapAtomError } from "./errors"
import { nodes, type AnyAtomConfig, type AtomNode } from "./nodeRegistry"
import { currentSink } from "./operationStack"
import { decodeValue, encodeValue, isPromiseLike } from "./promiseBox"

const noSnapshot = (): undefined => undefined
const ignore = () => {}

// Jotai mounts an atom in a store while something subscribes to it, directly or
// through a mounted dependent. A Valdres ExternalAtom has exactly that
// retention lifetime per StoreTree, so a writable atom's definition reads a
// constant sentinel source whose attach/detach reports onMount/onUnmount to the
// store currently operating.
const createLifecycle = (config: AnyAtomConfig, name: string) =>
    externalAtom<undefined>(
        {
            getSnapshot: noSnapshot,
            getServerSnapshot: noSnapshot,
            subscribe: () => {
                const sink = currentSink()
                sink.mounted(config)
                return () => sink.unmounted(config)
            },
        },
        { name: `${name}/mount` },
    )

const lateGetError = (config: AnyAtomConfig, target: unknown) =>
    new JotaiCompatibilityError(
        "VALDRES_JOTAI_LATE_GET",
        `${String(config)} called get(${String(target)}) after its read function returned. @valdres-react/jotai tracks dependencies synchronously: call get() for every dependency before the first await.`,
    )

const signalError = (config: AnyAtomConfig) =>
    new JotaiCompatibilityError(
        "VALDRES_JOTAI_SIGNAL_UNSUPPORTED",
        `${String(config)} read options.signal, which @valdres-react/jotai does not support: it cannot tell when a store replaces an atom's promise.`,
    )

export const readNodeState = (get: GetValue, node: AtomNode): unknown => {
    try {
        return decodeValue(get(node.state))
    } catch (error) {
        throw unwrapAtomError(error)
    }
}

const evaluate = (
    config: AnyAtomConfig,
    valdresGet: GetValue,
    node: () => AtomNode,
): unknown => {
    let active = true
    const get = (target: AnyAtomConfig) => {
        if (!active) throw lateGetError(config, target)
        if (target === config) {
            const own = node()
            if (own.value === undefined) throw new Error("no atom init")
            return decodeValue(valdresGet(own.value))
        }
        return readNodeState(valdresGet, getNode(target))
    }
    const options = Object.freeze({
        get signal(): never {
            throw signalError(config)
        },
    })
    try {
        const value = config.read(get, options)
        // Jotai observes every promise a read function returns, so a rejected
        // async atom is never reported as an unhandled rejection.
        if (isPromiseLike(value)) value.then(ignore, ignore)
        return encodeValue(value)
    } finally {
        active = false
    }
}

const createNode = (config: AnyAtomConfig): AtomNode => {
    if (config.INTERNAL_onInit) {
        throw new JotaiCompatibilityError(
            "VALDRES_JOTAI_INTERNAL_ON_INIT_UNSUPPORTED",
            `${String(config)} uses Jotai's internal INTERNAL_onInit hook, which @valdres-react/jotai does not support.`,
        )
    }
    const name = String(config)
    const value =
        "init" in config
            ? atom.lazy(() => encodeValue(config.init), { name })
            : undefined
    // Configs from other libraries (for example `jotai` itself) cannot guard a
    // late onMount assignment, so every writable one gets a sentinel.
    const lifecycle =
        typeof config.write === "function" &&
        (config.onMount !== undefined || !isOwnAtom(config))
            ? createLifecycle(config, name)
            : undefined
    const isPrimitive = value !== undefined && config.read === defaultRead
    let created: AtomNode | undefined
    const state =
        isPrimitive && lifecycle === undefined
            ? value!
            : selector(
                  get => {
                      if (lifecycle !== undefined) get(lifecycle)
                      return evaluate(config, get, () => created!)
                  },
                  { name },
              )
    created = { config, state, value, isPrimitive, lifecycle }
    return created
}

export const getNode = (config: AnyAtomConfig): AtomNode => {
    let node = nodes.get(config)
    if (node === undefined) {
        node = createNode(config)
        nodes.set(config, node)
    }
    return node
}
