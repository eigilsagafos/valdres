import { expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    SubscriberNotificationError,
    createCommittedStoreTreeDomain,
    getExternalDomainRecords,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    configureInternalExternalBounds,
    createInternalExternalAtom,
    ExternalSourceDeliveryLimitError,
    ExternalSourceNonConvergenceError,
} from "../../src/v1-internal/committed-store-tree/external-atom"
import type { ExternalProjectionPlane } from "../../src/v1-internal/committed-store-tree/external-projection"

function thrown(operation: () => unknown): unknown {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected failure")
}

test.each(["deliveryDepth", "deliveryWork"] as const)(
    "%s retry markers follow acceptance and generation lifetime",
    bound => {
        const domain = createCommittedStoreTreeDomain()
        const source = () => {
            let value = 0
            const listeners: (() => void)[] = []
            const node = createInternalExternalAtom(domain, {
                getSnapshot: () => value,
                subscribe(invalidate) {
                    listeners.push(invalidate)
                    return () => {}
                },
            })
            return {
                node,
                listeners,
                write: () => value++,
                emit: () => listeners.at(-1)!(),
            }
        }
        const outer = source(),
            inner = source(),
            loop = source()
        const records = getExternalDomainRecords(domain)
        const runtime = records.externalRuntime!
        const planes: ExternalProjectionPlane[] = []
        // Capture the optional internal plane without adding a public Store seam.
        records.externalRuntime = {
            ...runtime,
            createTree(host) {
                const plane = runtime.createTree(
                    host,
                ) as ExternalProjectionPlane
                planes.push(plane)
                return plane
            },
        }
        configureInternalExternalBounds(domain, { [bound]: 1, rounds: 1 })
        const a = domain.createStoreTree(),
            b = domain.createStoreTree()
        a.sub(outer.node, () => {
            inner.write()
            inner.emit()
        })
        let stop = b.sub(inner.node, () => {})
        const pending = () => planes[1]!.inspectRetryRequired(inner.node)
        outer.write()
        const expectDeliveryRejection = () => {
            const error = thrown(outer.emit) as SubscriberNotificationError
            expect(error).toBeInstanceOf(SubscriberNotificationError)
            expect(error.causes).toHaveLength(1)
            expect(error.cause).toBeInstanceOf(ExternalSourceDeliveryLimitError)
        }
        expectDeliveryRejection()
        expect(pending()).toBe(true)
        expect(b.get(inner.node)).toBe(0)

        const forbidden = createInternalExternalAtom(domain, {
            getSnapshot() {
                inner.emit()
                return 0
            },
            subscribe: () => () => {},
        })
        expect(thrown(() => a.get(forbidden))).toBeInstanceOf(
            CallbackCapabilityError,
        )
        expect(pending()).toBe(true)

        let terminalNotifications = 0
        b.sub(loop.node, () => {
            try {
                b.get(loop.node)
            } catch (error) {
                expect(error).toBeInstanceOf(ExternalSourceNonConvergenceError)
                terminalNotifications++
                inner.emit()
                return
            }
            loop.write()
            loop.emit()
        })
        loop.write()
        expect(thrown(loop.emit)).toBeInstanceOf(
            ExternalSourceNonConvergenceError,
        )
        expect(terminalNotifications).toBe(1)
        expect(pending()).toBe(true)

        const trigger = domain.atom(0)
        b.sub(trigger, inner.emit)
        b.set(trigger, 1)
        expect(b.get(inner.node)).toBe(1)
        expect(pending()).toBe(false)
        const stale = inner.listeners[0]!
        stop()
        expect(pending()).toBe(false)
        stop = b.sub(inner.node, () => {})
        expect(inner.listeners).toHaveLength(2)
        expect(pending()).toBe(false)

        outer.write()
        expectDeliveryRejection()
        expect(pending()).toBe(true)
        stale()
        expect(pending()).toBe(true)
        stop()
        expect(pending()).toBe(false)
        b.sub(inner.node, () => {})
        expect(inner.listeners).toHaveLength(3)
        expect(b.get(inner.node)).toBe(2)
        expect(pending()).toBe(false)
        a.dispose()
        b.dispose()
    },
)
