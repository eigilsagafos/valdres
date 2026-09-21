/**
 * Package-local binding of the shared media harness.
 *
 * The harness itself lives in the private `@valdres/test` workspace
 * (`packages/test/src/browser/mediaHarness.ts`) and is imported by relative
 * path, the way `packages/valdres` imports `LeakDetector` — so this package's
 * suite still runs standalone with `bun test` and takes no dependency on an
 * unpublished workspace. All this file supplies is the private cache reset the
 * harness needs to make the package re-resolve its `MediaQueryList` objects.
 */
import {
    installMediaHarness as install,
    type MediaHarness,
} from "../../../../test/src/browser/mediaHarness"
import { resetMediaQueryCache } from "../../src/lib/mediaQuery"

export type { MediaHarness }

export const installMediaHarness = (
    matching: Readonly<Record<string, boolean>> = {},
): MediaHarness => install({ resetCache: resetMediaQueryCache, matching })
