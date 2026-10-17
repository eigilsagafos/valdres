/**
 * Package-local binding of the shared device harness, which lives in the
 * private `@valdres/test` workspace and is imported by relative path so this
 * suite still runs standalone with `bun test` and takes no dependency on an
 * unpublished workspace.
 */
export {
    deferred,
    flush,
    installDeviceHarness,
    scriptedRequest,
    type Deferred,
    type DeviceHarness,
    type FakePermissions,
    type ScriptedRequest,
} from "../../../../test/src/browser/deviceHarness"
