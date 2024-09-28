import * as recoil from "recoil"
import * as jotai from "jotai"
import * as valdres from "valdres-react"
import { useEffect, useState } from "react"

const measure = callback => {
    const start = performance.now()
    callback()
    const end = performance.now()
    console.log(start, end, end - start)
    return end - start
}

const Group = () => {}

const runTests = async () => {
    const iterations = 10000
    console.log(`asdf`, jotai)
    const jotaiStore = jotai.createStore()
    const jotaiAtoms = Array.from({ length: 1000 }).map(() =>
        jotai.atom("Jotai"),
    )
    const valdresStore = valdres.createStore()
    console.log(valdresStore)
    const atom = valdres.atom("asdf")
    console.log(atom)
    console.log(valdresStore.get(atom))
    const valdresAtoms = Array.from({ length: 1000 }).map(() =>
        valdres.atom("Valdres"),
    )
    console.log(valdresAtoms.map(a => valdresStore.get(a)))
    console.log(
        `sdf`,
        jotaiAtoms.map(a => jotaiStore.get(a)),
    )
    // const res = Array.from({ length: iterations }).forEach(() => {
    //     return measure(() => {
    //         for (const atom of valdresAtoms) {
    //             valdresStore.get(atom)
    //         }
    //     })
    // })
    // console.log(res)
}

export const Perf = () => {
    const [isTesting, setIsTesting] = useState(true)

    useEffect(() => {
        if (isTesting) {
            runTests()
        }
    }, [isTesting])

    return (
        <div>
            {/* <Group
                name="Jotai"
                callback={() => {
                    for (const atom in jotaiAtoms) {
                        jotaiStore.set(atom, "Bar")
                    }
                }}
            /> */}
            asdf<button>Test</button>
        </div>
    )
}
