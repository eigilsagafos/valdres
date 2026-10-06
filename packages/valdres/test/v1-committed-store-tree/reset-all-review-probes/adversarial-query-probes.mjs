import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const target = path.resolve(process.argv[2])
const entry = process.argv[3] || 'dist'
const mode = process.argv[4] || 'bulk'
const valdres = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'index.ts' : 'index.js')))
const { query } = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'query.ts' : 'query.js')))
const keys = rows => rows.map(row => row.key)
const results = []
const run = (name, operation) => {
    try { results.push({ name, pass: true, details: operation() }) }
    catch (error) { results.push({ name, pass: false, error: error.stack }) }
}
const fixture = () => {
    const rows = valdres.collection({ indexes: { kind: value => value.kind } })
    const root = valdres.store()
    const values = ['a', 'b'].map(key => ({ kind: 'yes', key }))
    for (const [index, key] of ['a', 'b'].entries()) root.set(rows(key), values[index])
    const selected = query(rows, { where: { kind: { eq: 'yes' } } })
    return { root, rows, values, selected }
}
const clear = (cursor, states) => {
    if (mode === 'bulk') cursor.resetAll()
    else for (const state of states) cursor.reset(state)
}

run('cleared staged delete/set must not leave false ranks in committed query', () => {
    const { root, rows, values, selected } = fixture()
    const draft = root.scope('draft')
    const child = draft.scope('child')
    const notifications = []
    draft.sub(selected, () => notifications.push({ membership: keys(draft.get(rows)), query: keys(draft.get(selected)) }))
    child.sub(selected, () => notifications.push({ childMembership: keys(child.get(rows)), childQuery: keys(child.get(selected)) }))
    const before = draft.get(selected)
    const observed = {}
    root.txn(tx => {
        const cursor = tx.scope(draft)
        cursor.delete(rows('a'))
        cursor.set(rows('a'), { kind: 'yes', key: 'staged-a' })
        clear(cursor, [rows('a')])
        observed.draftMembership = keys(cursor.get(rows))
        observed.draftQuery = keys(cursor.get(selected))
    })
    observed.membership = keys(draft.get(rows))
    observed.query = keys(draft.get(selected))
    observed.childMembership = keys(child.get(rows))
    observed.childQuery = keys(child.get(selected))
    observed.queryArrayReused = draft.get(selected) === before
    observed.restoredValue = draft.get(rows('a')) === values[0]
    observed.notifications = notifications
    console.log('STAGED_RESET_RANKS', JSON.stringify(observed))
    assert.deepEqual(observed.query, observed.membership)
    assert.deepEqual(observed.childQuery, observed.childMembership)
    if (mode === 'bulk') {
        assert.deepEqual(observed.query, ['a', 'b'])
        assert.equal(observed.queryArrayReused, true)
        assert.equal(notifications.length, 0)
    }
    return observed
})

run('staged presence-neutral descendant write invalidates follower membership memo', () => {
    const { root, rows, selected } = fixture()
    const draft = root.scope('draft')
    draft.delete(rows('a'))
    draft.reset(rows('a'))
    const child = draft.scope('child')
    const observed = {}
    root.txn(tx => {
        clear(tx.scope(draft), [])
        const cursor = tx.scope(child)
        observed.beforeWrite = keys(cursor.get(rows))
        cursor.set(rows('a'), { kind: 'yes', key: 'child-a' })
        observed.afterWrite = keys(cursor.get(rows))
        observed.afterQuery = keys(cursor.get(selected))
    })
    observed.committed = keys(child.get(rows))
    observed.committedQuery = keys(child.get(selected))
    console.log('FOLLOWER_MEMO', JSON.stringify(observed))
    assert.deepEqual(observed.afterWrite, observed.committed)
    assert.deepEqual(observed.afterQuery, observed.committedQuery)
    return observed
})

console.log(JSON.stringify({ target, entry, mode, runtime: process.versions.bun || process.versions.node, results }, null, 2))
process.exitCode = results.every(result => result.pass) ? 0 : 1
