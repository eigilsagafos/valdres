import { heapStats, heapSize, memoryUsage, fullGC } from "bun:jsc"
import * as ddd from "bun:jsc"
import { faker } from "@faker-js/faker"
import * as jotai from "jotai"
import * as valdres from "../.."

const generateUsers = (size: number) => {
    return Array.from({ length: size }, () => ({
        id: faker.string.uuid(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
    }))
}

// Bun.gc(true)
// console.log(heapStats())
const users = generateUsers(1000)
// Bun.gc(true)
// console.log(heapStats())

const testJotai = () => {
    const store = jotai.createStore()
    const atoms = users.map(user => {
        const atom = jotai.atom()
        store.set(atom, user)
        return atom
    })
    return atoms
}

const testValdres = () => {
    const store = valdres.createStore()
    const atoms = users.map(user => {
        const atom = valdres.atom()
        store.set(atom, user)
        return atom
    })
    return atoms
}

const calculateMemoryUsage = cb => {
    // Bun.gc(true)
    fullGC()
    const statsBefore = heapStats()
    const result = cb()
    // const statsAfterBeforeBc = heapStats()
    fullGC()
    // Bun.gc(true)
    // console.log(Bun.gc(true))
    // console.log(Bun.gc(true))
    const statsAfter = heapStats()
    console.log(
        "Objects added",
        statsAfter.objectCount - statsBefore.objectCount,
    )
    console.log("Heap size change", statsAfter.heapSize - statsBefore.heapSize)
}

calculateMemoryUsage(testJotai)
calculateMemoryUsage(testValdres)

// console.log(ddd)
// console.log(memoryUsage())
// console.log(heapSize())
// console.log(fullGC())
