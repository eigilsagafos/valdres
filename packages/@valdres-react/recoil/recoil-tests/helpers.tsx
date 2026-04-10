/**
 * Test helpers adapted from Recoil's test utilities.
 * These provide the same patterns used in the original Recoil test suite
 * but using @testing-library/react and bun test.
 */
import React from "react"
import { render } from "@testing-library/react"
import { RecoilRoot } from "../src/RecoilRoot"
import { useRecoilValue } from "../src/useRecoilValue"

/**
 * Renders elements wrapped in a RecoilRoot.
 * Returns the container element.
 */
export function renderElements(elements: React.ReactNode) {
    const { container } = render(<RecoilRoot>{elements}</RecoilRoot>)
    return container
}

/**
 * Component that reads an atom and displays its value as JSON.
 */
export function ReadsAtom({ atom }: { atom: any }) {
    const value = useRecoilValue(atom)
    return <>{JSON.stringify(value)}</>
}
