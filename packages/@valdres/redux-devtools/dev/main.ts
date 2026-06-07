import { atom, selector, store } from "valdres"
import { connectReduxDevtools } from "../src"

// `enumerable: true` lets the adapter seed the DevTools timeline with state
// that already exists at connect time (via store.snapshot()), instead of
// starting empty.
const s = store("playground-root", { enumerable: true })

// --- named atoms (tracked) -------------------------------------------------
const countAtom = atom(0, { name: "count" })
const messageAtom = atom("", { name: "message" })
const todosAtom = atom<string[]>([], { name: "todos" })
// scoped atom — written inside the "sessionA" scope below
const themeAtom = atom<"light" | "dark">("light", { name: "user/theme" })
// anonymous atom — intentionally NOT tracked, to demo the warning
const anonAtom = atom(0)
// derived state (selectors) — pure values computed from atoms. They recompute
// automatically when a dependency changes, and appear under @computed when
// connected with { selectors: true }. `summary` derives from other selectors,
// showing a cascade (changing count recomputes doubleCount AND summary).
const doubleCount = selector(get => get(countAtom) * 2, { name: "doubleCount" })
const countParity = selector(
    get => (get(countAtom) % 2 === 0 ? "even" : "odd"),
    { name: "countParity" },
)
const todoCount = selector(get => get(todosAtom).length, { name: "todoCount" })
const messageLength = selector(get => get(messageAtom).length, {
    name: "messageLength",
})
const summary = selector(
    get =>
        `count=${get(countAtom)} (×2=${get(doubleCount)}), ${get(todoCount)} todo(s)`,
    { name: "summary" },
)
// A selector over the *scoped* theme atom. Subscribed inside sessionA (below),
// so it recomputes IN the scope and lands under @computed keyed by its scope
// path: `sessionA/user/isDark` — flat, NOT nested under @scopes.
const isDarkTheme = selector(get => get(themeAtom) === "dark", {
    name: "user/isDark",
})
const derivedSelectors = [
    doubleCount,
    countParity,
    todoCount,
    messageLength,
    summary,
] as const

const sessionA = s.scope("sessionA")

// Seed a little state BEFORE connecting. On an enumerable store these are
// captured by the initial snapshot, so the timeline opens already populated
// (rather than empty) — the difference store.snapshot() makes.
s.set(countAtom, 3)
s.set(messageAtom, "hello from initial state")
s.set(todosAtom, ["welcome"])

// --- connect ----------------------------------------------------------------
const hasExtension =
    typeof window !== "undefined" && !!window.__REDUX_DEVTOOLS_EXTENSION__

connectReduxDevtools(s, { name: "valdres-playground", selectors: true })

const statusEl = document.getElementById("status")!
if (hasExtension) {
    statusEl.textContent =
        "✓ Redux DevTools connected — open the Redux panel and pick “valdres-playground”."
    statusEl.className = "banner ok"
} else {
    statusEl.textContent =
        "⚠ Redux DevTools extension not detected. Install it (and reload) to see the timeline; the page still works."
}

// --- DOM wiring -------------------------------------------------------------
const $ = (id: string) => document.getElementById(id)!

const countEl = $("count")
const msgEl = $("msg") as HTMLInputElement
const todosEl = $("todos")
const themeRootEl = $("theme-root")
const themeScopeEl = $("theme-scope")
const themeBadgeEl = $("theme-scope-badge")
const snapshotEl = $("snapshot")
const computedEl = $("computed")

// The scope owns its own value (copy-on-write) only after it's been written;
// until then it inherits the root. `data.values` is where the shadow lives.
const scopeHasOwnTheme = () => sessionA.data.values.has(themeAtom)

const renderCount = () => (countEl.textContent = String(s.get(countAtom)))
const renderMessage = () => {
    const v = s.get(messageAtom)
    if (msgEl.value !== v) msgEl.value = v
}
const renderTodos = () =>
    (todosEl.textContent = JSON.stringify(s.get(todosAtom), null, 2))
const renderTheme = () => {
    themeRootEl.textContent = s.get(themeAtom)
    themeScopeEl.textContent = sessionA.get(themeAtom)
    const own = scopeHasOwnTheme()
    themeBadgeEl.textContent = own ? "own (copy-on-write)" : "inherited from root"
    themeBadgeEl.className = `pill ${own ? "own" : "inherited"}`
}
const renderComputed = () => {
    computedEl.textContent = JSON.stringify(
        {
            // Root selectors (top-level @computed). The scoped `user/isDark`
            // selector lives under @scopes.sessionA.@computed — see the
            // snapshot below.
            doubleCount: s.get(doubleCount),
            countParity: s.get(countParity),
            todoCount: s.get(todoCount),
            messageLength: s.get(messageLength),
            summary: s.get(summary),
        },
        null,
        2,
    )
}
const renderSnapshot = () => {
    const snapshot: Record<string, unknown> = {
        count: s.get(countAtom),
        message: s.get(messageAtom),
        todos: s.get(todosAtom),
        // anonymous atom — shown under the label DevTools assigns it
        unnamed_atom_1: s.get(anonAtom),
        "user/theme": s.get(themeAtom),
        // Root derived state, mirrored under the top-level @computed.
        "@computed": {
            doubleCount: s.get(doubleCount),
            countParity: s.get(countParity),
            todoCount: s.get(todoCount),
            messageLength: s.get(messageLength),
            summary: s.get(summary),
        },
    }
    // sessionA's bucket: its scoped selector lives under
    // @scopes.sessionA.@computed; the `user/theme` override key only appears
    // once it's copied-on-write.
    const sessionBucket: Record<string, unknown> = {
        "@computed": { "user/isDark": sessionA.get(isDarkTheme) },
    }
    if (scopeHasOwnTheme()) {
        sessionBucket["user/theme"] = sessionA.get(themeAtom)
    }
    snapshot["@scopes"] = { sessionA: sessionBucket }
    snapshotEl.textContent = JSON.stringify(snapshot, null, 2)
}

const renderAll = () => {
    renderCount()
    renderMessage()
    renderTodos()
    renderTheme()
    renderComputed()
    renderSnapshot()
}

// Re-render on every change (incl. time-travel restores).
s.sub(countAtom, renderAll)
// Keep the selectors live (a subscriber) so valdres reports their recomputes.
for (const sel of derivedSelectors) s.sub(sel, renderAll)
s.sub(messageAtom, renderAll)
s.sub(todosAtom, renderAll)
s.sub(anonAtom, renderAll)
s.sub(themeAtom, renderAll)
sessionA.sub(themeAtom, renderAll)
// Subscribe the scoped selector IN the scope so it recomputes there → its
// changes report with scope ["sessionA"] and land under @computed as
// "sessionA/user/isDark".
sessionA.sub(isDarkTheme, renderAll)

$("inc").addEventListener("click", () =>
    s.set(countAtom, c => c + 1),
)
$("dec").addEventListener("click", () =>
    s.set(countAtom, c => c - 1),
)
$("reset-count").addEventListener("click", () => s.set(countAtom, 0))

msgEl.addEventListener("input", () => s.set(messageAtom, msgEl.value))

let todoN = 1
$("add-todo").addEventListener("click", () =>
    s.set(todosAtom, list => [...list, `task ${todoN++}`]),
)
$("clear-todos").addEventListener("click", () => s.set(todosAtom, []))

// Root write — the scope reflects this while still inheriting.
$("toggle-theme-root").addEventListener("click", () => {
    s.set(themeAtom, t => (t === "light" ? "dark" : "light"))
    renderAll()
})

// Scope write — copies-on-write into @scopes.sessionA; from now on the scope
// diverges and root changes no longer affect it.
$("toggle-theme-scope").addEventListener("click", () => {
    sessionA.set(themeAtom, t => (t === "light" ? "dark" : "light"))
    renderAll()
})

// Drop the scope's own value so it re-inherits the root's current value
// (`unset`, the inverse of `set` — not `reset`, which would pin it to the
// atom's default). The badge flips back to "inherited from root".
$("unset-theme-scope").addEventListener("click", () => {
    sessionA.unset(themeAtom)
    renderAll()
})

$("bump-anon").addEventListener("click", () => {
    s.set(anonAtom, n => n + 1)
    renderAll()
})

// Multiple atoms changed in one named commit. The adapter fires once for the
// whole batch and uses the transaction name as the action label, so DevTools
// shows a single "seed demo data" action, not three.
$("run-txn").addEventListener("click", () => {
    s.txn(t => {
        t.set(countAtom, t.get(countAtom) + 5)
        t.set(messageAtom, "hello from a transaction")
        t.set(todosAtom, [...t.get(todosAtom), "from a transaction"])
    }, "seed demo data")
    renderAll()
})

// A transaction spanning the root and the sessionA scope. `store.onChange`
// delivers the whole commit as one batch, so DevTools shows a single action —
// `txn (3 atoms · root, sessionA)` — and time-travel jumps all of it at once.
$("run-xscope-txn").addEventListener("click", () => {
    s.txn(t => {
        t.set(countAtom, t.get(countAtom) + 1)
        t.set(messageAtom, "from a cross-scope transaction")
        t.scope("sessionA", st => {
            st.set(themeAtom, st.get(themeAtom) === "light" ? "dark" : "light")
        })
    })
    renderAll()
})

renderAll()
