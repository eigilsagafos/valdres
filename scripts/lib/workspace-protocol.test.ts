import { expect, test } from "bun:test"
import {
    findWorkspaceProtocolViolations,
    PUBLISHED_DEPENDENCY_FIELDS,
} from "./workspace-protocol"

test("finds every workspace: range across the published dependency fields", () => {
    expect(
        findWorkspaceProtocolViolations({
            dependencies: { a: "workspace:^", b: "^1.0.0" },
            peerDependencies: { c: "workspace:*" },
            optionalDependencies: { d: "workspace:1.2.3" },
        }),
    ).toEqual([
        { field: "dependencies", dependency: "a", range: "workspace:^" },
        { field: "peerDependencies", dependency: "c", range: "workspace:*" },
        {
            field: "optionalDependencies",
            dependency: "d",
            range: "workspace:1.2.3",
        },
    ])
})

test("ignores devDependencies, which prepack strips before publishing", () => {
    expect(
        findWorkspaceProtocolViolations({
            devDependencies: { valdres: "workspace:^" },
        }),
    ).toEqual([])
    expect(PUBLISHED_DEPENDENCY_FIELDS).not.toContain("devDependencies")
})

test("accepts a manifest with plain semver ranges or no dependencies at all", () => {
    expect(
        findWorkspaceProtocolViolations({
            dependencies: { a: "^1.0.0" },
            peerDependencies: { valdres: "^1.0.0-beta.19" },
        }),
    ).toEqual([])
    expect(findWorkspaceProtocolViolations({})).toEqual([])
})

test("tolerates malformed dependency fields instead of throwing", () => {
    expect(
        findWorkspaceProtocolViolations({
            dependencies: null,
            peerDependencies: "not-an-object",
            optionalDependencies: { a: 42 },
        }),
    ).toEqual([])
})
