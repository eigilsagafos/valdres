/**
 * Package-local binding of the shared geometry harness, which lives in the
 * private `@valdres/test` workspace and is imported by relative path so this
 * suite still runs standalone with `bun test` and takes no dependency on an
 * unpublished workspace.
 */
export {
    installGeometryHarness,
    type GeometryHarness,
} from "../../../../test/src/browser/geometryHarness"
