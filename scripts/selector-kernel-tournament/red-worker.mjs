// Compile this minimal launcher; load the protected authority from its exact
// recorded root. Bundling inputs.mjs would change its import.meta-based ROOT.
import { pathToFileURL } from "node:url"
import { join } from "node:path"
const [authorityRoot, id, variant, controlRoot, mode, output] =
    process.argv.slice(2)
try {
    if (process.argv.length !== 8)
        throw Error("RED-CLI: exact invocation required")
    const { runRedCase } = await import(
        pathToFileURL(
            join(
                authorityRoot,
                "scripts/selector-kernel-tournament/red-actions.mjs",
            ),
        )
    )
    console.log(
        JSON.stringify(
            await runRedCase({ id, variant, controlRoot, mode, output }),
        ),
    )
} catch (error) {
    console.error(error.message)
    process.exitCode = 1
}
