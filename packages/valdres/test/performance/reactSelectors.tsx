import { run, bench, group } from "mitata"
import { Provider } from "../../src/Provider"
import { renderHook } from "@testing-library/react"
import * as jotai from "jotai"
import * as recoil from "recoil"
import * as valdres from "../.."

const setupValdres = size => {
    const valdresAtom = valdres.atom(1)
    const valdresSelectors = Array.from({ length: size }, (_, i) =>
        valdres.selector(get => get(valdresAtom)),
    )
    const useTestValdres = () => {
        const values = valdresSelectors.map(s => valdres.useValue(s))
        const increment = valdres.useSetAtom(valdresAtom)
        return [values, () => increment(curr => curr + 1)]
    }
    return renderHook(() => useTestValdres(), {
        wrapper: ({ children }) => <Provider>{children}</Provider>,
    })
}

const setupJotai = size => {
    const jotaiAtom = jotai.atom(1)
    const jotaiSelectors = Array.from({ length: size }, (_, i) =>
        jotai.atom(get => get(jotaiAtom)),
    )

    const useTestJotai = () => {
        const values = jotaiSelectors.map(s => jotai.useAtomValue(s))
        const increment = jotai.useSetAtom(jotaiAtom)
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
    const selectors = Array.from({ length: size }, (_, i) =>
        recoil.selector({
            key: random + String(i),
            get: ({ get }) => get(atom),
        }),
    )

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
