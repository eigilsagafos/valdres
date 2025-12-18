import { $, type Shell, type ShellOutput } from "bun"
import { render, Box, Text, useApp } from "ink"
import { getAllPackageJsonPaths } from "./lib/getAllPackageJsonPaths"
import { atomFamily, store } from "valdres"
import { Provider, useValue } from "valdres-react"
import Spinner from "ink-spinner"
// import { publish, unpublish } from "libnpmpublish"

const NPM_TOKEN = process.env.NPM_TOKEN
if (!NPM_TOKEN) {
    throw new Error("NPM_TOKEN not found in .env.local")
}

const findRootDepth = async (level = 0) => {
    const levels = "../".repeat(level)
    const relativePath = `${levels}package.json`
    const file = Bun.file(relativePath)
    if (await file.exists()) {
        const json = await file.json()
        if (json.private && json.workspaces?.length) {
            return levels
        }
    }
    return findRootDepth(level + 1)
}
const packages = await getAllPackageJsonPaths()
const packageJsonsWithPath = await Promise.all(
    packages.map(p =>
        Bun.file(p)
            .json()
            .then(res => [p, res]),
    ),
)
const publicPackagesWithPath = packageJsonsWithPath.filter(
    ([, p]) => !p.private,
)
const publicPackages = publicPackagesWithPath.map(([, json]) => json)
const packageJsons = publicPackagesWithPath.map(([, json]) => json)
const packageNames = packageJsons.map(p => p.name)
const length = packageNames.sort((a, b) => b.length - a.length)[0].length

const valdresStore = store()
const jobStatus = atomFamily("pending")
const jobMeta = atomFamily({})

const JobStatus = ({ packageName, jobName }) => {
    const status = useValue(jobStatus({ packageName, jobName }))
    return (
        <Box width={jobName.length} marginLeft={1}>
            {status === "pending" && <Text></Text>}
            {status === "running" && (
                <Text color="green">
                    <Spinner type="moon" />
                </Text>
            )}
            {status === "success" && <Text>✅</Text>}
            {status === "failure" && <Text>❌</Text>}
        </Box>
    )
}

const PackageStatusRow = ({ packageName }) => {
    return (
        <Box key={packageName} flexDirection="row">
            <Box width={length} marginRight={1}>
                <Text>{packageName}</Text>
            </Box>
            {steps.map(job => (
                <JobStatus
                    key={job.name}
                    packageName={packageName}
                    jobName={job.name}
                />
            ))}
        </Box>
    )
}

const runJob = async (packageName, path, job) => {
    const key = { packageName, jobName: job.name }
    const atom = jobStatus(key)
    valdresStore.set(atom, "running")
    const dir = path.split("/").slice(0, -1).join("/")
    const res: ShellOutput = await job.callback($.cwd(dir), path, packageName)
    // .quiet()
    // .nothrow()
    valdresStore.set(atom, res.exitCode === 0 ? "success" : "failure")
    if (res.exitCode !== 0) {
        console.error(res.stderr.toString())
        process.exit(1)
    } else {
        if (job.onSuccess) {
            job.onSuccess(res.stdout.toString(), packageName)
        }
    }
}

const runner = async () => {
    for (const job of steps) {
        for (const [path, { name }] of publicPackagesWithPath) {
            await runJob(name, path, job)
        }
    }
}

const steps = [
    // {
    //     name: "postpack",
    //     callback: (shell, parentDir) => {
    //         const up = "../".repeat(parentDir.split("/").length - 1)
    //         return shell`bun run ${up}scripts/postpack.ts`.quiet().nothrow()
    //     },
    // },
    {
        name: "test",
        callback: shell => shell`bun run test`.quiet().nothrow(),
    },
    {
        name: "cleanup",
        callback: shell => {
            return shell`rm -rf dist`.quiet().nothrow()
        },
    },
    {
        name: "build",
        callback: shell => shell`bun run build`.quiet().nothrow(),
    },
    {
        name: "tsc",
        callback: shell => shell`bun run build:types`.quiet().nothrow(),
    },
    {
        name: "prepack",
        callback: (shell, parentDir) => {
            const up = "../".repeat(parentDir.split("/").length - 1)
            return shell`bun run ${up}scripts/prepack.ts`.quiet().nothrow()
        },
    },
    {
        name: "pack",
        callback: shell =>
            shell`bun pm pack --destination dist-tarball`.quiet().nothrow(),
        onSuccess: (output, key) => {
            const match = output.match(/dist-tarball\/[^\s]+\.tgz/)
            valdresStore.set(jobMeta(key), { tarball: match[0] })
        },
    },
    {
        name: "publish",
        callback: async (shell, packagePath, key) => {
            const meta = valdresStore.get(jobMeta(key))

            const file = meta.tarball.split(`/`).pop()
            const dir = packagePath.split("/")
            dir.pop()
            // return {
            //     exitCode: 0,
            // }
            return $.cwd(
                `${dir.join(`/`)}/dist-tarball`,
            )`npm publish ${file} --//registry.npmjs.org/:_authToken=${NPM_TOKEN}`.quiet()
        },
        // onSuccess: (output, key) => {
        //     console.log(output)
        // },
    },
    {
        name: "postpublish",
        callback: (shell, parentDir) => {
            const up = "../".repeat(parentDir.split("/").length - 1)
            return shell`bun run ${up}scripts/postpublish.ts`.quiet().nothrow()
        },
    },
    // {
    //     name: "cleanup",
    //     callback: shell => {
    //         return shell`rm -rf dist`
    //     },
    // },
]

const Publisher = () => {
    return (
        <Provider store={valdresStore}>
            <Box flexDirection="column" width="100%">
                <Box flexDirection="row">
                    <Box width={length}>
                        <Text>PACKAGE</Text>
                    </Box>
                    {steps.map(step => (
                        <Box
                            key={step.name}
                            width={step.name.length}
                            marginLeft={2}
                        >
                            <Text key={step.name}>{step.name}</Text>
                        </Box>
                    ))}
                </Box>
                {publicPackages.map(json => {
                    return (
                        <PackageStatusRow
                            key={json.name}
                            packageName={json.name}
                        />
                    )
                })}
            </Box>
        </Provider>
    )
}

render(<Publisher />)
runner()
