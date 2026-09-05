import { readFileSync } from "node:fs"
import { join, dirname, relative, resolve } from "node:path"
import ts from "typescript"
import { fileHash, requireGate } from "./inputs.mjs"
import { inspectArtifact } from "./artifact.mjs"
export function packedRootReachability(tarball, metadata) {
    const artifact = inspectArtifact(tarball, metadata, "timed")
    try {
        const root = artifact.packageRoot,
            seen = new Set()
        function visit(path) {
            if (seen.has(path)) return
            seen.add(path)
            const ast = ts.createSourceFile(
                path,
                readFileSync(path, "utf8"),
                ts.ScriptTarget.Latest,
                true,
                ts.ScriptKind.JS,
            )
            function walk(node) {
                const specifier =
                    ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
                        ? node.moduleSpecifier
                        : ts.isCallExpression(node) &&
                            node.expression.kind === ts.SyntaxKind.ImportKeyword
                          ? node.arguments[0]
                          : null
                if (specifier) {
                    requireGate(
                        ts.isStringLiteral(specifier),
                        "ARTIFACT-SOURCE-IMPORT",
                        "uninspectable import",
                    )
                    const dependency = resolve(dirname(path), specifier.text)
                    requireGate(
                        dependency.startsWith(join(root, "dist") + "/"),
                        "ARTIFACT-SOURCE-IMPORT",
                        "root reaches outside dist",
                    )
                    visit(dependency)
                }
                ts.forEachChild(node, walk)
            }
            walk(ast)
        }
        visit(join(root, "dist/index.js"))
        return {
            entry: "dist/index.js",
            files: [...seen].sort().map(path => ({
                path: relative(root, path),
                sha256: fileHash(path),
            })),
            packageManifestSha256: fileHash(artifact.packageJsonPath),
            distTreeSha256: artifact.distTreeSha256,
        }
    } finally {
        artifact.cleanup()
    }
}
