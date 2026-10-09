// The shipped landing.js bundle on the home page's island placeholders.
//
// Usage: bun docs/test/fixtures/landing.ts <outdir containing landing.js>
import { join } from "node:path"
import { check, loadBundle, report, startBrowser, waitFor } from "./browser"

const outdir = process.argv[2]

// Scripted geolocation: the card must start nothing until its button is used.
const watches: unknown[] = []
const installGeolocation = () =>
    Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
            watchPosition: (...args: unknown[]) => watches.push(args) && watches.length,
            clearWatch: () => {},
            getCurrentPosition: () => {},
        },
    })

startBrowser(
    "http://localhost/",
    `<button id="demo-reset">Reset</button>
    <div id="react-island"><div class="island-card">Loading...</div></div>
    <div id="vue-island"></div>
    <div id="svelte-island"></div>
    <div id="solid-island"></div>
    <div id="angular-island"></div>
    <div id="landing-keyboard-island">Loading...</div>
    <div id="landing-online-island">Loading...</div>
    <div id="landing-location-island">Loading...</div>`,
)

installGeolocation()
await loadBundle(join(outdir, "landing.js"))

const island = (id: string) => document.getElementById(id)!
const reactCount = () => island("react-island").querySelector(".island-count")?.textContent

check(await waitFor(() => reactCount() === "0"), "React counter renders 0")
;(island("react-island").querySelector(".island-card") as HTMLElement).click()
;(island("react-island").querySelector(".island-card") as HTMLElement).click()
check(await waitFor(() => reactCount() === "2"), `React counter increments (${reactCount()})`)
island("demo-reset").click()
check(await waitFor(() => reactCount() === "0"), `Reset sets the shared counter to 0 (${reactCount()})`)

for (const [id, key] of [
    ["vue-island", "valdres-vue"],
    ["svelte-island", "valdres-svelte"],
    ["solid-island", "valdres-solid"],
    ["angular-island", "valdres-angular"],
]) {
    const notice = island(id).querySelector("[data-v1-unavailable]")
    check(
        notice?.getAttribute("data-v1-unavailable") === key &&
            notice.textContent!.includes("Not yet migrated to Valdres v1"),
        `${id}: shows the ${key} notice`,
    )
}

check(
    await waitFor(() => !island("landing-keyboard-island").textContent!.includes("Loading")),
    "keyboard island renders",
)
check(
    await waitFor(() => !island("landing-online-island").textContent!.includes("Loading")),
    "online island renders",
)
const locationButton = await waitFor(() =>
    [...island("landing-location-island").querySelectorAll("button")].some(b => b.textContent!.includes("Show location")),
)
check(locationButton, "location card renders its explicit trigger")
check(watches.length === 0, "location card starts no watch on load")
;([...island("landing-location-island").querySelectorAll("button")].find(b =>
    b.textContent!.includes("Show location"),
) as HTMLElement).click()
check(await waitFor(() => watches.length === 1), `the button starts one watch (${watches.length})`)

for (const id of ["react-island", "landing-keyboard-island", "landing-online-island", "landing-location-island"]) {
    check(!island(id).querySelector("[data-v1-unavailable]"), `${id}: runs live, no notice`)
}

report()
