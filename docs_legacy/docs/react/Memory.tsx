import { run, bench, group } from "mitata"
import { useState } from "react"
import * as valdres from "valdres"
import * as jotai from "jotai"
import * as recoil from "recoil"
import { useEffect } from "react"

// group("init atom(1)", () => {
//     bench("valdres", () => valdresAtom(1))
//     bench("jotai", () => jotaiAtom(1))
// })

let int = 0

function humanFileSize(size) {
    var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024))
    return (
        +(size / Math.pow(1024, i)).toFixed(2) * 1 +
        " " +
        ["B", "kB", "MB", "GB", "TB"][i]
    )
}

const average = array => array.reduce((a, b) => a + b) / array.length

const runOneBencmark = (lib, iterations = 5) => {
    const results = []
    for (let i = 0; i < 5; i++) {
        const startMem = performance.memory.usedJSHeapSize
        const startTime = performance.now()
        const store = lib.createStore()
        const atoms = Array.from({ length: 1_000_000 }).map((_, i) =>
            lib.atom(i),
        )
        atoms.forEach(atom => {
            store.set(atom, 1)
        })
        const endTime = performance.now()
        const endMem = performance.memory.usedJSHeapSize
        results.push({
            memory: endMem - startMem,
            time: endTime - startTime,
        })
    }
    return results
}

const runBenchmark = async () => {
    const valdresRes = runOneBencmark({
        createStore: valdres.createStore,
        atom: valdres.atom,
    })
    const jotaiRes = runOneBencmark({
        createStore: jotai.createStore,
        atom: jotai.atom,
    })

    console.log(valdresRes)
    console.log(jotaiRes)
    // return [{ name: "valdres", valdresRes}]

    // const result = []
    // for (let i = 0; i < 5; i++) {
    //     const start = performance.memory.usedJSHeapSize
    //     const jotaiStore = jotai.createStore()
    //     const jotaiAtoms = Array.from({ length: 1_000_000 }).map((_, i) =>
    //         jotai.atom(i),
    //     )
    //     jotaiAtoms.forEach(atom => {
    //         jotaiStore.set(atom, 1)
    //     })
    //     const end = performance.memory.usedJSHeapSize
    //     console.log(performance.memory)
    //     result.push(end - start)
    // }
    // console.log(humanFileSize(average(result.filter(num => num > 0))))

    // const valdresResult = []
    // for (let i = 0; i < 5; i++) {
    //     const start = performance.memory.usedJSHeapSize
    //     const store = valdres.createStore()
    //     const atoms = Array.from({ length: 1_000_000 }).map((_, i) =>
    //         valdres.atom(i),
    //     )
    //     atoms.forEach(atom => {
    //         store.set(atom, 1)
    //     })
    //     const end = performance.memory.usedJSHeapSize
    //     console.log(performance.memory)
    //     valdresResult.push(end - start)
    // }
    // console.log(humanFileSize(average(valdresResult.filter(num => num > 0))))

    // return []
}

// const atom =

export const Memory = () => {
    const [isRunning, setIsRunning] = useState(false)
    const [result, setResult] = useState([])
    // const [] = useState()

    // useEffect(() => {
    //     runBenchmark()
    // }, [])
    return (
        <>
            <h2>Memory usage</h2>
            <p>This benchmark creates 1 million atoms and sets them in state</p>
            <button
                onClick={() => {
                    setIsRunning(true)
                    runBenchmark().then(res => {
                        setIsRunning(false)
                        setResult(res)
                    })
                }}
            >
                Run
            </button>

            <div>
                {result.map(item => {
                    console.log(item)
                    return (
                        <div key={item.name}>
                            {item.name} {item.stats.avg}
                        </div>
                    )
                })}
            </div>
        </>
    )
}
