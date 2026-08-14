/**
 * Make declaration output valid for Node16/NodeNext consumers.
 *
 * The source graph intentionally uses extensionless imports for Bun. tsgo and
 * svelte-package preserve those specifiers in declaration emit, but ESM
 * declarations need explicit JavaScript extensions. Every rewritten specifier
 * is resolved to exactly one emitted declaration first, so missing or ambiguous
 * targets fail the build instead of producing a broken path.
 */

import { readdir, stat } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import ts from "typescript"

async function declarationFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    const nested = await Promise.all(
        entries.map(entry => {
            const path = join(dir, entry.name)
            return entry.isDirectory()
                ? declarationFiles(path)
                : Promise.resolve(path.endsWith(".d.ts") ? [path] : [])
        }),
    )
    return nested.flat()
}

async function isFile(path: string) {
    try {
        return (await stat(path)).isFile()
    } catch {
        return false
    }
}

type Replacement = { start: number; end: number; value: string }
type Rewrite = { file: string; output: string; count: number }

function moduleSpecifiers(sourceFile: ts.SourceFile) {
    const specifiers: ts.StringLiteral[] = []

    function visit(node: ts.Node) {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            specifiers.push(node.moduleSpecifier)
        } else if (
            ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteral(node.argument.literal)
        ) {
            specifiers.push(node.argument.literal)
        } else if (
            ts.isExternalModuleReference(node) &&
            node.expression &&
            ts.isStringLiteral(node.expression)
        ) {
            specifiers.push(node.expression)
        }
        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return specifiers
}

async function rewriteFile(file: string): Promise<Rewrite | undefined> {
    const source = await Bun.file(file).text()
    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    )
    const replacements: Replacement[] = []

    for (const literal of moduleSpecifiers(sourceFile)) {
        const specifier = literal.text
        const isRelative =
            specifier === "." ||
            specifier === ".." ||
            specifier.startsWith("./") ||
            specifier.startsWith("../")
        if (!isRelative) continue
        if (/\.(?:[cm]?js|json)$/.test(specifier)) continue

        const declarationTarget = join(dirname(file), `${specifier}.d.ts`)
        const indexTarget = join(dirname(file), specifier, "index.d.ts")
        const [hasDeclarationTarget, hasIndexTarget] = await Promise.all([
            isFile(declarationTarget),
            isFile(indexTarget),
        ])
        if (hasDeclarationTarget && hasIndexTarget) {
            throw new Error(
                `Ambiguous declaration import ${JSON.stringify(specifier)} from ${file}`,
            )
        }

        let replacement: string
        if (hasDeclarationTarget) {
            replacement = `${specifier}.js`
        } else if (hasIndexTarget) {
            replacement = `${specifier}/index.js`
        } else {
            throw new Error(
                `Cannot resolve declaration import ${JSON.stringify(specifier)} from ${file}`,
            )
        }

        replacements.push({
            start: literal.getStart(sourceFile) + 1,
            end: literal.getEnd() - 1,
            value: replacement,
        })
    }

    if (replacements.length === 0) return
    let output = source
    for (const replacement of replacements.reverse()) {
        output =
            output.slice(0, replacement.start) +
            replacement.value +
            output.slice(replacement.end)
    }
    return { file, output, count: replacements.length }
}

export async function rewriteDeclarationImports(typesDir: string) {
    // Plan every rewrite before writing anything so a bad edge cannot leave a
    // partially transformed declaration tree behind.
    const rewrites = (
        await Promise.all(
            (await declarationFiles(typesDir)).map(file => rewriteFile(file)),
        )
    ).filter(rewrite => rewrite !== undefined)

    await Promise.all(
        rewrites.map(rewrite => Bun.write(rewrite.file, rewrite.output)),
    )
    return rewrites.reduce((total, rewrite) => total + rewrite.count, 0)
}

if (import.meta.main) {
    const typesDir = process.argv[2]
    if (!typesDir) {
        throw new Error(
            "Usage: rewrite-declaration-imports.ts <declarations-dir>",
        )
    }
    const rewritten = await rewriteDeclarationImports(resolve(typesDir))
    console.log(
        `Rewrote ${rewritten} declaration import(s) with explicit extensions`,
    )
}
