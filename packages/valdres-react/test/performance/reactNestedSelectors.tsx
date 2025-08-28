import { run, bench, group } from "mitata"
import { Provider } from "../../src/Provider"
import { renderHook } from "@testing-library/react"
// import { selector } from "../../src/selector"
import { useValue } from "../../src/useValue"
import { useSetAtom } from "../../src/useSetAtom"
import * as valdres from "../../../valdres"
import * as jotai from "jotai"
import * as recoil from "recoil"
// const testSize

const setupValdres = size => {
    const atom = valdres.atom(1)
    const selectors = []
    Array.from({ length: size }).forEach((_, i) => {
        if (selectors[i - 1]) {
            selectors.push(valdres.selector(get => get(selectors[i - 1]) + 1))
        } else {
            selectors.push(valdres.selector(get => get(atom) + 1))
        }
    })
    const useTestValdres = () => {
        const values = selectors.map(s => useValue(s))
        const increment = useSetAtom(atom)
        return [values, () => increment(curr => curr + 1)]
    }
    return renderHook(() => useTestValdres(), {
        wrapper: ({ children }) => <Provider>{children}</Provider>,
    })
}

const setupJotai = size => {
    const atom = jotai.atom(1)
    const selectors = []
    Array.from({ length: size }).forEach((_, i) => {
        if (selectors[i - 1]) {
            selectors.push(jotai.atom(get => get(selectors[i - 1]) + 1))
        } else {
            selectors.push(jotai.atom(get => get(atom) + 1))
        }
    })

    const useTestJotai = () => {
        const values = selectors.map(s => jotai.useAtomValue(s))
        const increment = jotai.useSetAtom(atom)
        return [values, () => increment(curr => curr + 1)]
    }

    return renderHook(() => useTestJotai(), {
        wrapper: ({ children }) => <jotai.Provider>{children}</jotai.Provider>,
    })
}
const randomString = () => (Math.random() + 1).toString(36).substring(7)

const setupRecoil = size => {
    const random = randomString()

    const atom = recoil.atom({ key: random + "number", default: 1 })
    const selectors = []
    Array.from({ length: size }).forEach((_, i) => {
        if (selectors[i - 1]) {
            selectors.push(
                recoil.selector({
                    key: random + String(i),
                    get: ({ get }) => get(selectors[i - 1]) + 1,
                }),
            )
            // selector(get => get(selectors[i - 1]) + 1))
        } else {
            selectors.push(
                recoil.selector({
                    key: random + String(i),
                    get: ({ get }) => get(atom) + 1,
                }),
            )
        }
    })
    // const selectors = Array.from({ length: size }, (_, i) =>
    //     recoil.selector({
    //         key: random + String(i),
    //         get: ({ get }) => get(atom),
    //     }),
    // )

    const useTestRecoil = () => {
        const values = selectors.map(s => recoil.useRecoilValue(s))
        const increment = recoil.useSetRecoilState(atom)
        return [values, () => increment(curr => curr + 1)]
    }

    return renderHook(() => useTestRecoil(), {
        wrapper: ({ children }) => (
            <recoil.RecoilRoot>{children}</recoil.RecoilRoot>
        ),
    })
}

const testHook = hook => {
    const [values, increment]: [number[], any] = hook.result.current
    const initialValue = values[0]
    increment()
    const [updatedValues] = hook.result.current
    const updatedValue = updatedValues[0]
    if (updatedValue !== initialValue + 1) throw Error(`Fi;led`)
}

const setup = (size: number) => [
    setupRecoil(size),
    setupJotai(size),
    setupValdres(size),
]

group("update 1 atom with 1 react hook subscriber", () => {
    const [recoil, jotai, valdres] = setup(1)
    bench("recoil", () => testHook(recoil))
    bench("jotai", () => testHook(jotai))
    bench("valdres", () => testHook(valdres))
})

group("update 1 atom with 10 react hook subscribers", () => {
    const [recoil, jotai, valdres] = setup(10)
    bench("recoil", () => testHook(recoil))
    bench("jotai", () => testHook(jotai))
    bench("valdres", () => testHook(valdres))
})

group("update 1 atom with 100 react hook subscribers", () => {
    const [recoil, jotai, valdres] = setup(100)
    bench("recoil", () => testHook(recoil))
    bench("jotai", () => testHook(jotai))
    bench("valdres", () => testHook(valdres))
})

group("update 1 atom with 1000 react hook subscribers", () => {
    const [recoil, jotai, valdres] = setup(1_000)
    bench("recoil", () => testHook(recoil))
    bench("jotai", () => testHook(jotai))
    bench("valdres", () => testHook(valdres))
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
