import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react"
import { atom } from "./atom"
import { selector } from "./selector"
import { useRecoilValue } from "./useRecoilValue"
import { useSetRecoilState } from "./useSetRecoilState"
import { RecoilRoot } from "./RecoilRoot"

describe("recoil/RecoilRoot", () => {
    test("simple", () => {
        const numberAtom = atom({ key: "number", default: 10 })
        const times2 = selector<number>({
            key: "sel",
            get: ({ get }) => {
                return get(numberAtom) * 2
            },
            set: ({ set }, value) => {
                return set(numberAtom, value / 2)
            },
        })
        const { result } = renderHook(
            () => {
                const setSelector = useSetRecoilState(times2)
                const value = useRecoilValue(numberAtom)
                return { value, setSelector }
            },
            {
                wrapper: (({ children }) => (
                    <RecoilRoot
                        initializeState={args => {
                            args.set(numberAtom, 5)
                        }}
                    >
                        {children}
                    </RecoilRoot>
                )) as React.FC<any>,
            },
        )
        expect(result.current.value).toBe(5)
        result.current.setSelector(100)
        expect(result.current.value).toBe(50)
    })
})
