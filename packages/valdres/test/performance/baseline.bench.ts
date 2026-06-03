import { describe, test } from "./test-compat"
import { do_not_optimize } from "mitata"
import { measureOne } from "./bench-utils"

// Native floor: raw JS Map for the core key→value ops. The valdres and jotai
// series for these ops are emitted by atom.bench.ts; here we add ONLY the
// "<op> / map" reference so the Bencher plot overlays valdres / jotai / map on
// one latency axis. Each series is gated against its own history; the floor is
// read off the plot, not asserted. (Emitting "<op> / valdres" here too would
// collide with atom.bench.ts's series.)
describe("native floor (raw Map)", () => {
    test("store.get(atom) vs map.get", async () => {
        const map = new Map([["key", "hello"]])
        await measureOne("store.get(atom) / map", () =>
            do_not_optimize(map.get("key")),
        )
    })

    test("set(atom, value) vs map.set", async () => {
        const map = new Map<string, number>([["key", 0]])
        let i = 0
        await measureOne("set(atom, value) / map", () =>
            do_not_optimize(map.set("key", ++i)),
        )
    })
})
