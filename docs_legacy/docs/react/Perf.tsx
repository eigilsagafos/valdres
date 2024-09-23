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

const runBenchmark = () => {
    bench("recoil", () => {
        int++
        const key = String(int)
        // const key = crypto.randomUUID()
        const atom = recoil.atom({ default: 1, key })
        if (atom.key !== key) throw new Error("Something went wrong")
    })
    bench("valdres", () => {
        int++
        const atom = valdres.atom(1)
        if (atom.defaultValue !== 1) throw new Error("Something went wrong")
    })
    bench("jotai", () => {
        int++
        const atom = jotai.atom(1)
        if (atom.init !== 1) throw new Error("Something went wrong")
    })

    return run({
        // format: "quiet"
    }).then(res => {
        return res.benchmarks.flatMap(b => b.runs)
    })
}

export const Perf = () => {
    const [isRunning, setIsRunning] = useState(false)
    const [result, setResult] = useState([])
    // const [] = useState()

    // useEffect(() => {
    //     runBenchmark()
    // }, [])
    return (
        <>
            <h2>Memory usage</h2>
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
