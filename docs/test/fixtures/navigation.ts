// The shipped demos.js bundle across client-side navigations, driven the way
// client.ts drives it: swap #page-content, update the URL, then dispatch
// `valdres:navigate`.
//
// Usage: bun docs/test/fixtures/navigation.ts <outdir containing demos.js>
import { join } from "node:path"
import { check, loadBundle, report, startBrowser, thrown, waitFor } from "./browser"

const outdir = process.argv[2]

const page = (content: string) => `${content}<div id="api-demo"></div>`

startBrowser(
    "http://localhost/valdres/atomFamily",
    `<div id="page-content">${page("")}</div>`,
)

function navigate(path: string, content = "") {
    history.pushState({}, "", path)
    document.getElementById("page-content")!.innerHTML = page(content)
    document.dispatchEvent(new Event("valdres:navigate"))
}

const apiDemo = () => document.getElementById("api-demo")!
const click = (el: Element) => (el as HTMLElement).click()
const buttonNamed = (root: Element, text: string) =>
    [...root.querySelectorAll("button")].find(b => b.textContent === text)!

function todo() {
    const container = apiDemo().firstElementChild!
    const [, inputRow, list, status] = [...container.children] as HTMLElement[]
    const input = inputRow.querySelector("input") as HTMLInputElement
    const rows = [...list.children] as HTMLElement[]
    return {
        add(text: string, via: "click" | "enter" = "click") {
            input.value = text
            if (via === "click") click(buttonNamed(inputRow, "Add"))
            else input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
        },
        texts: rows.map(row => row.querySelector("span")!.textContent),
        checkbox: (i: number) => rows[i].querySelector("input") as HTMLInputElement,
        toggle(i: number) {
            const box = rows[i].querySelector("input") as HTMLInputElement
            box.checked = !box.checked
            box.dispatchEvent(new Event("change"))
        },
        remove: (i: number) => click(rows[i].querySelector("button")!),
        status: status.textContent,
        input,
    }
}

function family() {
    const container = apiDemo().firstElementChild!
    const [, addButton, list, total] = [...container.children] as HTMLElement[]
    const rows = [...list.children] as HTMLElement[]
    const scores = rows.map(row => Number(/\((\d+) pts\)/.exec(row.querySelector("span")!.textContent!)![1]))
    return {
        add: () => click(addButton),
        rows,
        scores,
        sum: scores.reduce((a, b) => a + b, 0),
        plusTen: (i: number) => click(buttonNamed(rows[i], "+10")),
        remove: (i: number) => click(buttonNamed(rows[i], "×")),
        total: total.textContent,
    }
}

await loadBundle(join(outdir, "demos.js"))

// ── todo (atomFamily page) ─────────────────────────────────────────────────
check(todo().status === "No todos yet", "todo: mounts empty")
todo().add("   ")
check(todo().texts.length === 0, "todo: whitespace-only input adds nothing")
todo().add("Alpha")
todo().add("Beta", "enter")
todo().add("Gamma")
check(todo().texts.join() === "Alpha,Beta,Gamma", `todo: add by button and Enter (${todo().texts})`)
check(todo().input.value === "", "todo: input clears after adding")
check(todo().status === "3 of 3 remaining", `todo: remaining 3 of 3 (${todo().status})`)
todo().toggle(1)
check(todo().status === "2 of 3 remaining", `todo: toggle derives 2 of 3 (${todo().status})`)
check(todo().checkbox(1).checked, "todo: toggled row renders checked")
todo().toggle(1)
check(todo().status === "3 of 3 remaining", "todo: toggling back derives 3 of 3")
todo().toggle(1)
todo().remove(0)
check(todo().texts.join() === "Beta,Gamma", `todo: remove (${todo().texts})`)
check(todo().status === "1 of 2 remaining", `todo: remove an open item (${todo().status})`)
todo().remove(0)
check(todo().status === "1 of 1 remaining", `todo: remove a done item (${todo().status})`)

const staleTodoCheckbox = todo().checkbox(0)

// ── navigate: family (selectorFamily page) ─────────────────────────────────
navigate("/valdres/selectorFamily")
const todoAfterLeaving = thrown(() => staleTodoCheckbox.onchange!(new Event("change")))
check(
    todoAfterLeaving?.name === "StoreDisposedError",
    `navigation away disposes the todo Store (${todoAfterLeaving?.name})`,
)
check(family().total?.startsWith("No users yet"), "family: mounts empty")
family().add()
family().add()
family().add()
check(
    family().rows.length === 3 && family().total === `Total: ${family().sum} pts across 3 users`,
    `family: add keeps labels and total consistent (${family().total})`,
)
const before = family().scores[1]
family().plusTen(1)
check(family().scores[1] === before + 10, "family: +10 updates the member's label")
check(family().total === `Total: ${family().sum} pts across 3 users`, "family: +10 updates the total")
family().remove(0)
check(
    family().rows.length === 2 && family().total === `Total: ${family().sum} pts across 2 users`,
    `family: remove updates list and total (${family().total})`,
)
const staleFamilyButton = buttonNamed(family().rows[0], "+10")

// ── navigate back: a fresh todo ────────────────────────────────────────────
navigate("/valdres/atomFamily")
const familyAfterLeaving = thrown(() => staleFamilyButton.onclick!(new PointerEvent("click")))
check(
    familyAfterLeaving?.name === "StoreDisposedError",
    `navigation away disposes the family Store (${familyAfterLeaving?.name})`,
)
check(todo().status === "No todos yet", "todo: navigating back mounts a fresh demo")

// ── repeated navigation ────────────────────────────────────────────────────
let stale: HTMLInputElement | undefined
let leaks = 0
for (let i = 0; i < 25; i++) {
    navigate(i % 2 ? "/valdres/atomFamily" : "/valdres/store")
    if (stale && thrown(() => stale!.onchange!(new Event("change")))?.name !== "StoreDisposedError") leaks++
    stale = undefined
    if (i % 2) {
        todo().add(`item ${i}`)
        if (todo().status !== "1 of 1 remaining") leaks++
        stale = todo().checkbox(0)
    }
    if (apiDemo().childElementCount !== 1) leaks++
}
check(leaks === 0, `25 navigations: every demo mounts fresh and every left Store is disposed (${leaks} failures)`)

// ── the other core demos ───────────────────────────────────────────────────
const demoText = () => apiDemo().textContent!.replace("Live demo", "")

navigate("/valdres/store")
click(buttonNamed(apiDemo(), "+"))
click(buttonNamed(apiDemo(), "+"))
click(buttonNamed(apiDemo(), "-"))
check(demoText() === "-1+", `store: counter updates (${demoText()})`)

navigate("/react/useResetAtom")
click(buttonNamed(apiDemo(), "+"))
click(buttonNamed(apiDemo(), "+"))
check(demoText() === "-2+Reset", `useResetAtom: counter updates (${demoText()})`)
click(buttonNamed(apiDemo(), "Reset"))
check(demoText() === "-0+Reset", `useResetAtom: Reset restores the default (${demoText()})`)

navigate("/react/useSetAtom")
click(buttonNamed(apiDemo(), "Set 10"))
click(buttonNamed(apiDemo(), "+1"))
check(demoText().includes("Current value:11"), `useSetAtom: set then update (${demoText()})`)

navigate("/react/useValue")
click(buttonNamed(apiDemo(), "+"))
click(buttonNamed(apiDemo(), "+"))
check(demoText().includes("count2doubled (selector)4"), `useValue: value and selector (${demoText()})`)

navigate("/valdres/selector")
const nameInput = apiDemo().querySelector("input") as HTMLInputElement
nameInput.value = "Ada"
nameInput.dispatchEvent(new Event("input"))
check(demoText().includes("Hello, Ada!"), `selector: derived greeting (${demoText()})`)
const staleNameInput = nameInput
navigate("/guides/introduction")
check(
    thrown(() => staleNameInput.oninput!(new Event("input")))?.name === "StoreDisposedError",
    "navigating to a page without a demo still releases the last one",
)
check(apiDemo().childElementCount === 0, "a page without a demo mounts nothing")

// ── React plugin inspectors on the shared store ────────────────────────────
const migrated = [
    "browser-online",
    "browser-color-scheme",
    "browser-visibility",
    "browser-contrast",
    "browser-focus",
    "browser-presence",
    "browser-reduced-data",
    "browser-reduced-motion",
    "browser-reduced-transparency",
    "browser-keyboard",
    "hotkeys",
    "browser-window",
    "browser-screen",
]
navigate(
    "/browser-online",
    migrated.map(name => `<div data-plugin-demo="${name}">Loading demo…</div>`).join(""),
)
const placeholders = migrated.map(
    name => document.querySelector(`[data-plugin-demo="${name}"]`) as HTMLElement,
)
const rendered = await waitFor(() =>
    placeholders.every(el => el.childElementCount > 0 && !el.textContent!.includes("Loading demo")),
)
check(rendered, "v1 plugin demos render")
for (const [i, name] of migrated.entries()) {
    check(!placeholders[i].querySelector("[data-v1-unavailable]"), `${name}: runs live, no notice`)
}
check(placeholders[0].textContent!.includes("onlineAtom"), "browser-online inspector shows onlineAtom")
const windowDemo = placeholders[migrated.indexOf("browser-window")]!.textContent!
check(
    windowDemo.includes("inner") && windowDemo.includes(`${window.innerWidth} × ${window.innerHeight}`),
    "browser-window inspector shows the live inner size",
)
const screenDemo = placeholders[migrated.indexOf("browser-screen")]!.textContent!
check(
    screenDemo.includes("devicePixelRatio") && screenDemo.includes(`${window.screen.width} × ${window.screen.height}`),
    "browser-screen inspector shows the live screen size",
)

navigate("/guides/introduction")
check(
    placeholders.every(el => el.childElementCount === 0),
    "navigation away unmounts every plugin root",
)

// ── unavailable integrations ───────────────────────────────────────────────
const unmigrated = [
    "bandwidth",
    "browser-device-motion",
    "browser-device-orientation",
    "browser-geolocation",
    "browser-screen-details",
    "color-mode",
    "public-ip",
]
navigate(
    "/public-ip",
    unmigrated.map(name => `<div data-plugin-demo="${name}">Loading demo…</div>`).join(""),
)
for (const name of unmigrated) {
    const notice = document.querySelector(`[data-plugin-demo="${name}"] [data-v1-unavailable]`)
    check(
        notice?.getAttribute("data-v1-unavailable") === `@valdres/${name}` &&
            notice.textContent!.includes("Not yet migrated to Valdres v1"),
        `${name}: shows the not-yet-migrated notice`,
    )
}

for (const [path, key] of [
    ["/vue/createValdres", "valdres-vue"],
    ["/svelte/fromState", "valdres-svelte"],
    ["/solid/createAtom", "valdres-solid"],
    ["/solid/createResetAtom", "valdres-solid"],
    ["/angular/injectAtom", "valdres-angular"],
    ["/angular/injectValue", "valdres-angular"],
] as const) {
    navigate(path)
    check(
        apiDemo().querySelector("[data-v1-unavailable]")?.getAttribute("data-v1-unavailable") === key,
        `${path}: shows the ${key} notice instead of a core-only counter`,
    )
}

navigate("/valdres/atom", `<div id="cache-demo" class="not-prose"></div>`)
check(
    document.querySelector("#cache-demo [data-v1-unavailable]")?.getAttribute("data-v1-unavailable") ===
        "valdres/cache",
    "atom page: the caching demo shows its notice",
)

report()
