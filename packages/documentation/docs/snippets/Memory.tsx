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

const humanFileSize = (size: number) => {
    var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024))
    return (
        +(size / Math.pow(1024, i)).toFixed(2) * 1 +
        " " +
        ["B", "kB", "MB", "GB", "TB"][i]
    )
}

const average = (array: number[]) =>
    array.reduce((a, b) => a + b) / array.length

const getHeapSize = () => {
    return performance.memory?.usedJSHeapSize
}

const runOneBencmark = (lib, iterations = 5) => {
    let results = []
    for (let i = 0; i < iterations; i++) {
        const startMem = getHeapSize()
        const startTime = performance.now()
        const store = lib.createStore()
        const atoms = Array.from({ length: 1_000_000 }).map((_, i) =>
            lib.atom(i),
        )
        atoms.forEach(atom => {
            store.set(atom, 1)
        })
        const endTime = performance.now()
        const endMem = getHeapSize()
        results.push({
            memory: startMem ? endMem - startMem : undefined,
            time: endTime - startTime,
        })
    }

    if (getHeapSize()) {
        results = results.filter(res => res.memory > 0)
        results.memoryAvg = average(results.map(item => item.memory))
    }
    results.timeAvg = average(results.map(item => item.time))
    return results
}

const runBenchmark = async () => {
    const valdresRes = runOneBencmark({
        createStore: valdres.store,
        atom: valdres.atom,
    })
    const jotaiRes = runOneBencmark({
        createStore: jotai.createStore,
        atom: jotai.atom,
    })

    return [
        ["valdres", valdresRes],
        ["jotai", jotaiRes],
    ]
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
                        console.log(res)
                    })
                }}
            >
                Run
            </button>

            <div>
                {result.map(([name, res]) => {
                    return (
                        <div key={name}>
                            {name} {res.timeAvg}ms{" "}
                            {humanFileSize(res.memoryAvg)}
                        </div>
                    )
                })}
            </div>
        </>
    )
}
