import { describe, test, expect, mock } from "bun:test"
import { atom } from "./atom"
import { selector } from "./selector"
import { createStore } from "./createStore"
import { wait } from "@valdres/test"
import * as jotai from "jotai"

describe("atom", () => {
    test("is good", () => {
        const store = createStore()
        const ageAtom = atom(24)
        const ageDoubleSelector = selector(get => get(ageAtom) * 2)

        store.set(ageAtom, 20)
        expect(store.get(ageAtom)).toBe(20)
        expect(store.get(ageDoubleSelector)).toBe(40)

        store.set(ageAtom, 30)
        expect(store.get(ageAtom)).toBe(30)
        expect(store.get(ageDoubleSelector)).toBe(60)
    })

    test("get in default function", () => {
        const store = createStore()
        const atom1 = atom(10)
        const atom2 = atom(() => store.get(atom1) + 10)

        expect(store.get(atom1)).toBe(10)
        expect(store.get(atom2)).toBe(20)
        store.set(atom1, 11)
        expect(store.get(atom1)).toBe(11)
        expect(store.get(atom2)).toBe(20)
        store.reset(atom2)
        expect(store.get(atom2)).toBe(21)
    })

    test("set with function", () => {
        const store = createStore()
        const numberAtom = atom(10)
        expect(store.get(numberAtom)).toBe(10)
        store.set(numberAtom, curr => curr * 10)
        expect(store.get(numberAtom)).toBe(100)
    })

    test("async default", () => {
        const store = createStore()
        const asyncFunction = () =>
            new Promise(resolve => setTimeout(() => resolve("done"), 100))
        const numberAtom = atom(asyncFunction)
        const res = store.get(numberAtom)
        console.log(res)
    })

    test("onMount", () => {
        const store = createStore()
        const onMountCallback = mock(() => {})
        const onUnmountCallback = mock(() => {})
        const user1 = atom("Foo", {
            onMount: onMountCallback,
            onUnmount: onUnmountCallback,
        })
        expect(store.get(user1)).toBe("Foo")
        expect(onMountCallback).toHaveBeenCalledTimes(0)
        expect(onUnmountCallback).toHaveBeenCalledTimes(0)
        const unsubscribe = store.sub(user1, () => {})
        expect(onMountCallback).toHaveBeenCalledTimes(1)
        expect(onUnmountCallback).toHaveBeenCalledTimes(0)
        unsubscribe()
        expect(onMountCallback).toHaveBeenCalledTimes(1)
        expect(onUnmountCallback).toHaveBeenCalledTimes(1)
        console.log(store.get(user1))
    })

    test("onInit", () => {
        const store = createStore()
        const onInitCallback = mock(() => {})
        const user1 = atom("Foo", {
            onInit: onInitCallback,
        })
        expect(store.get(user1)).toBe("Foo")
        expect(onInitCallback).toHaveBeenCalledTimes(1)
        // expect(onUnmountCallback).toHaveBeenCalledTimes(0)
        // const unsubscribe = store.sub(user1, () => {})
        // expect(onMountCallback).toHaveBeenCalledTimes(1)
        // expect(onUnmountCallback).toHaveBeenCalledTimes(0)
        // unsubscribe()
        // expect(onMountCallback).toHaveBeenCalledTimes(1)
        // expect(onUnmountCallback).toHaveBeenCalledTimes(1)
        // console.log(store.get(user1))
    })

    test("jotai", async () => {
        const store = jotai.createStore()
        const defaultValue = mock(() => performance.now())

        const atom1 = jotai.atom(defaultValue)
        atom1.onMount = () => {
            console.log(`moujnasdf`)
        }
        console.log(store.get(atom1))
        await wait(1)
        console.log(store.get(atom1))
        expect(defaultValue).toHaveBeenCalledTimes(1)
        console.log(atom1.read())
        store.sub(atom1, () => {})
    })
})
