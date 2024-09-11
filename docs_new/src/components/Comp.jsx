// import Ract from "react"
import { group, bench, run } from "mitata"
import { useEffect } from "react"
import * as jotai from "jotai"
import * as valdres from "../../../valdres-react"

export const Comp = () => {
    useEffect(() => {
        console.log(`here`)

        group("init atom(1)", () => {
            bench("valdres", () => valdres.atom(1))
            bench("jotai", () => jotai.atom(1))
        })
        run({ json: true, silent: true }).then(res => {
            console.log(res)
        })
    }, [])
    return <div>Hi from react 2</div>
}
