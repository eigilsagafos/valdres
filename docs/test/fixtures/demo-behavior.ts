// The todo and family demos with an instrumented Store: exactly one
// subscription per mount, no Store calls from notification callbacks, and a
// cleanup that releases everything across repeated mount/unmount.
//
// Usage: bun docs/test/fixtures/demo-behavior.ts <bundle built from demo-behavior-entry.ts>
import { check, loadBundle, report, startBrowser, thrown } from "./browser"

startBrowser("http://localhost/", "")
const demos = await loadBundle(process.argv[2])
const { spy } = demos

const host = document.createElement("div")
document.body.append(host)

function todo() {
    const [, inputRow, list, status] = [...host.firstElementChild!.children] as HTMLElement[]
    const input = inputRow.querySelector("input") as HTMLInputElement
    const rows = [...list.children] as HTMLElement[]
    return {
        add(text: string) {
            input.value = text
            input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
        },
        toggle(i: number) {
            const box = rows[i].querySelector("input") as HTMLInputElement
            box.checked = !box.checked
            box.dispatchEvent(new Event("change"))
        },
        remove: (i: number) => rows[i].querySelector("button")!.click(),
        checkbox: (i: number) => rows[i].querySelector("input") as HTMLInputElement,
        status: status.textContent,
    }
}

// ── todo ───────────────────────────────────────────────────────────────────
const cleanup = demos.mountTodoListDemo(host)
check(typeof cleanup === "function", "todo: mount returns a cleanup")
check(spy.subscriptions === 1 && spy.liveSubscriptions === 1, "todo: one subscription after mount")
todo().add("Alpha")
todo().add("Beta")
todo().toggle(0)
todo().toggle(0)
todo().toggle(1)
todo().remove(0)
todo().remove(0)
todo().add("Gamma")
check(todo().status === "1 of 1 remaining", `todo: ends at 1 of 1 (${todo().status})`)
check(spy.notifications === 8, `todo: one notification per action (${spy.notifications} for 8)`)
check(spy.subscriptions === 1, `todo: no subscriptions after mount (${spy.subscriptions})`)
check(
    spy.notificationCalls.length === 0,
    `todo: no Store calls from notifications (${spy.notificationCalls.join() || "none"})`,
)

const staleCheckbox = todo().checkbox(0)
cleanup()
check(host.childElementCount === 0, "todo: cleanup removes the demo")
check(spy.liveSubscriptions === 0 && spy.disposed === 1, "todo: cleanup unsubscribes and disposes")
check(
    thrown(() => staleCheckbox.onchange!(new Event("change")))?.name === "StoreDisposedError",
    "todo: a leftover handler reaches a disposed Store",
)

const before = { stores: spy.stores, disposed: spy.disposed, subscriptions: spy.subscriptions }
let carried = 0
for (let i = 0; i < 50; i++) {
    const unmount = demos.mountTodoListDemo(host)
    todo().add(`item ${i}`)
    if (todo().status !== "1 of 1 remaining") carried++
    unmount()
}
check(carried === 0, "todo: 50 mount/unmount cycles each start empty")
check(
    spy.stores - before.stores === 50 && spy.disposed - before.disposed === 50,
    "todo: 50 cycles create and dispose 50 Stores",
)
check(
    spy.subscriptions - before.subscriptions === 50 && spy.liveSubscriptions === 0,
    `todo: 50 cycles leave no subscriptions (${spy.liveSubscriptions} live)`,
)
check(host.childElementCount === 0, "todo: host is empty after the cycles")

// ── family ─────────────────────────────────────────────────────────────────
const subscriptionsBefore = spy.subscriptions
const notificationsBefore = spy.notifications
const unmountFamily = demos.mountFamilyDemo(host)
const familyButtons = () => [...host.querySelectorAll("button")]
familyButtons().find(b => b.textContent === "+ Add User")!.click()
familyButtons().find(b => b.textContent === "+ Add User")!.click()
familyButtons().find(b => b.textContent === "+10")!.click()
familyButtons().find(b => b.textContent === "×")!.click()
check(spy.subscriptions - subscriptionsBefore === 1, "family: one subscription")
check(spy.notifications - notificationsBefore === 4, "family: one notification per action")
check(spy.notificationCalls.length === 0, "family: no Store calls from notifications")
unmountFamily()
check(host.childElementCount === 0 && spy.liveSubscriptions === 0, "family: cleanup releases everything")

// ── the runtime enforces what the old demos did wrong ──────────────────────
const control = demos.store()
const a = demos.atom(0)
const b = demos.atom(0)
control.sub(a, () => control.sub(b, () => {}))
const rejected = thrown(() => control.set(a, 1)) as (Error & { cause?: Error }) | undefined
check(
    rejected?.name === "SubscriberNotificationError" && rejected.cause?.name === "CallbackCapabilityError",
    `subscribing from a notification is rejected (${rejected?.name}/${rejected?.cause?.name})`,
)
const counter = demos.atom(0)
control.set(counter, ((n: number) => n + 1) as unknown as number)
check(typeof control.get(counter) === "function", "set(atom, fn) stores the function rather than calling it")

report()
