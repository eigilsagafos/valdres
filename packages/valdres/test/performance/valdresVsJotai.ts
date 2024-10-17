import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atomFamily as jotaiAtomFamily } from "jotai/utils"
import { run, bench, group, baseline } from "mitata"
import { store as valdresCreateStore } from "../../src/store"
import { atomFamily as valdresAtomFamily } from "../../src/atomFamily"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"

group("createStore", () => {
    // baseline("baseline", () => {})
    bench("valdres", () => valdresCreateStore())
    bench("jotai", () => jotaiCreateStore())
})

group("init atom(1)", () => {
    bench("valdres", () => valdresAtom(1))
    bench("jotai", () => jotaiAtom(1))
})

group("init atomFamily(1)", () => {
    bench("valdres", () => valdresAtomFamily(1))
    bench("jotai", () => jotaiAtomFamily(() => 1))
})

group("create atom in atomFamily", () => {
    const valdresUser = valdresAtomFamily(null)
    const jotaiUser = jotaiAtomFamily(() => null)
    let valdresCounter = 0
    let jotaiCounter = 0
    bench("valdres", () => {
        valdresCounter++
        valdresUser(valdresCounter)
    })
    bench("jotai", () => {
        jotaiCounter++
        jotaiUser(jotaiCounter)
    })
})

group("store.setAtom() same value", () => {
    const valdresStore = valdresCreateStore()
    const jotaiStore = jotaiCreateStore()
    const valdresUserAtom = valdresAtom("Foo")
    const jotaiUserAtom = jotaiAtom("Foo")
    bench("valdres", () => valdresStore.set(valdresUserAtom, "Bar"))
    bench("jotai", () => jotaiStore.set(jotaiUserAtom, "Bar"))
})

group("store.getAtom() same value", () => {
    const valdresStore = valdresCreateStore()
    const jotaiStore = jotaiCreateStore()
    const valdresUserAtom = valdresAtom("Foo")
    const jotaiUserAtom = jotaiAtom("Foo")
    bench("valdres", () => valdresStore.get(valdresUserAtom))
    bench("jotai", () => jotaiStore.get(jotaiUserAtom))
})

group("store.setAtom(curr => curr+1) new value with function", () => {
    const valdresStore = valdresCreateStore()
    const jotaiStore = jotaiCreateStore()
    const valdresCountAtom = valdresAtom(0)
    const jotaiCountAtom = jotaiAtom(0)
    bench("valdres", () => valdresStore.set(valdresCountAtom, curr => curr + 1))
    bench("jotai", () => jotaiStore.set(jotaiCountAtom, curr => curr + 1))
})

group("store.setAtom() where atom has 100 selector subscribers", () => {
    const selectorCount = 100
    // prepare valdres
    const valdresStore = valdresCreateStore()
    const valdresCountAtom = valdresAtom(0)
    const valdresSelectors = Array.from({ length: selectorCount }, (_, i) =>
        valdresSelector(get => get(valdresCountAtom) + i),
    )

    // prepare jotai
    const jotaiStore = jotaiCreateStore()
    const jotaiCountAtom = jotaiAtom(0)
    const jotaiSelectors = Array.from({ length: selectorCount }, (_, i) =>
        jotaiAtom(get => get(jotaiCountAtom) + i),
    )

    let jotaiInt = 0
    let valdresInt = 0
    bench("valdres", () => {
        valdresInt++
        valdresStore.set(valdresCountAtom, valdresInt)
        valdresSelectors.map(selector => valdresStore.get(selector))
    })
    bench("jotai", () => {
        jotaiInt++
        jotaiStore.set(jotaiCountAtom, jotaiInt)
        jotaiSelectors.map(selector => jotaiStore.get(selector))
    })
    // bench("jotai", () => jotaiStore.set(jotaiCountAtom, curr => curr + 1))
})

await run({
    units: false, // print small units cheatsheet
    silent: false, // enable/disable stdout output
    avg: true, // enable/disable avg column (default: true)
    json: false, // enable/disable json output (default: false)
    colors: true, // enable/disable colors (default: true)
    min_max: true, // enable/disable min/max column (default: true)
    percentiles: false, // enable/disable percentiles column (default: true)
})
