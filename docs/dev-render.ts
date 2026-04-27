import { discover } from "./src/discover"
import { compileMdx } from "./src/compile-mdx"
import { renderPages } from "./src/render"

const rootDir = import.meta.dir.replace("/docs", "")
const distDir = `${import.meta.dir}/dist`

const entries = await discover(rootDir)
const compiled = await compileMdx(entries)
await renderPages(compiled, distDir)
