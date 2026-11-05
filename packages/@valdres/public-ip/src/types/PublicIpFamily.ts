/**
 * Which address a request asks for: `"any"` accepts whichever family the
 * endpoint answers with, `"v4"` / `"v6"` only that family.
 */
export type PublicIpFamily = "any" | "v4" | "v6"
