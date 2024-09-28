"use client"
import * as jotai from "jotai"
import * as recoil from "recoil"
import * as valdres from "valdres-react"
import { memo, useCallback, useEffect, useRef, useState } from "react"

const createRecoilAtoms = (count = 1_000_000) =>
    Array.from({ length: count }).map((_, i) =>
        recoil.atom({ key: String(i), default: i }),
    )

const createJotaiAtoms = (count = 1_000_000) =>
    Array.from({ length: count }).map((_, i) => jotai.atom(i))

const createValdresAtoms = (count = 1_000_000) =>
    Array.from({ length: count }).map((_, i) => valdres.atom(i))

let recoilAtoms
let jotaiAtoms
let valdresAtoms

const createAtoms = (count: 1_000_000) => {
    if (!recoilAtoms) recoilAtoms = createRecoilAtoms(count)
    if (!jotaiAtoms) jotaiAtoms = createJotaiAtoms(count)
    if (!valdresAtoms) valdresAtoms = createValdresAtoms(count)
}

const Recoil = memo(({ children, count }) => {
    console.log(`Recoil`, count)
    return (
        <recoil.RecoilRoot
            initializeState={({ set }) => {
                recoilAtoms.slice(0, count).forEach((atom, index) => {
                    set(atom, index + 1)
                })
            }}
        >
            {children}
        </recoil.RecoilRoot>
    )
})

const Valdres = memo(({ children, count }) => {
    console.log(`valdres`, count)
    return (
        <valdres.Provider
            initialize={(...args) => {
                console.log(args)
                return valdresAtoms
                    .slice(0, count)
                    .map((atom, i) => [atom, i + 1])
            }}
        >
            {children}
        </valdres.Provider>
    )
})

const initJotaiStore = count => {
    const store = jotai.createStore()
    jotaiAtoms.slice(0, count).map((atom, i) => store.set(atom, i))
    return store
}

const Jotai = memo(({ children, count }) => {
    const store = useRef(initJotaiStore(count))
    console.log(`Jotai`, count)
    return <jotai.Provider store={store.current}>{children}</jotai.Provider>
})

const IsClient = ({ children }) => {
    const [isClient, setIsClient] = useState(false)
    useEffect(() => {
        createAtoms()
        setIsClient(true)
    }, [])

    if (isClient) return <>{children}</>
    return <></>
}

const MeasureRenderTime = memo(({ children, onComplete }) => {
    const start = performance.now()
    useEffect(() => {
        onComplete(performance.now() - start)
    }, [])

    return <>{children}</>
})

const MeasureComponentRenderTimes = ({ items, onDone }) => {
    const [results, setResults] = useState([])
    const [components, setComponents] = useState([])

    const onComplete = useCallback(time => {
        setResults(curr => [...curr, time])
    }, [])

    useEffect(() => {
        const next = items[results.length]?.Component
        if (next) {
            requestAnimationFrame(() => {
                setComponents(curr => [...curr, next])
            })
        } else {
            onDone?.()
        }
    }, [results.length])

    return (
        <div style={{ display: "flex", flexDirection: "row" }}>
            <div
                style={{ display: "grid", gridTemplateColumns: "120px auto 0" }}
            >
                {items.map(({ name, Component, componentArgs }, index) => {
                    return (
                        <>
                            <div key={name}>{name}</div>
                            <div key={name + "res"}>
                                {results[index] &&
                                    `${Math.trunc(results[index])}ms`}
                            </div>
                            <div key={name + "comp"}>
                                {components[index] && (
                                    <MeasureRenderTime
                                        key={index}
                                        onComplete={onComplete}
                                    >
                                        <Component {...componentArgs} />
                                    </MeasureRenderTime>
                                )}
                            </div>
                        </>
                    )
                })}
            </div>
        </div>
    )
}

const atomCounts = [1_000, 10_000, 100_000, 1_000_000, 10_000_000]
const formatter = new Intl.NumberFormat()

export const ProviderInit = () => {
    const [run, setRun] = useState(false)
    const [count, setCount] = useState(1000)

    return (
        <IsClient>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <button
                    onClick={() => {
                        setRun(true)
                    }}
                >
                    Start
                </button>
                <div>
                    <label htmlFor="atomCount">Atom Count</label>
                    <select
                        name="atomCount"
                        id="atomCount"
                        onChange={e => {
                            setCount(Number(e.target.value))
                            setRun(false)
                        }}
                        defaultValue={count}
                    >
                        {atomCounts.map(atomCount => (
                            <option key={atomCount} value={atomCount}>
                                {formatter.format(atomCount)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {run && (
                <MeasureComponentRenderTimes
                    // onDone={() => setRun(false)}
                    items={[
                        {
                            name: "valdres",
                            Component: Valdres,
                            componentArgs: { count },
                        },
                        {
                            name: "jotai",
                            Component: Jotai,
                            componentArgs: { count },
                        },
                        ...(count > 10000
                            ? []
                            : [
                                  {
                                      name: "recoil",
                                      Component: Recoil,
                                      componentArgs: { count },
                                  },
                              ]),
                    ]}
                />
            )}
        </IsClient>
    )
}
