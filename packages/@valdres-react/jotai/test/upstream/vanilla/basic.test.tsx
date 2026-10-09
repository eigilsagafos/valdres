// Adapted from pmndrs/jotai v3.0.1 tests/vanilla/basic.test.tsx (MIT). See ../UPSTREAM.md.
// Local change: inline snapshots use Bun's function formatting (named functions print their name).
import { expect, it } from '../../vi'
import { atom } from '../../impl'

it('creates atoms', () => {
  // primitive atom
  const countAtom = atom(0)
  const anotherCountAtom = atom(1)
  // read-only derived atom
  const doubledCountAtom = atom((get) => get(countAtom) * 2)
  // read-write derived atom
  const sumCountAtom = atom(
    (get) => get(countAtom) + get(anotherCountAtom),
    (get, set, value: number) => {
      set(countAtom, get(countAtom) + value / 2)
      set(anotherCountAtom, get(anotherCountAtom) + value / 2)
    },
  )
  // write-only derived atom
  const decrementCountAtom = atom(null, (get, set) => {
    set(countAtom, get(countAtom) - 1)
  })
  expect({
    countAtom,
    doubledCountAtom,
    sumCountAtom,
    decrementCountAtom,
  }).toMatchInlineSnapshot(`
    {
      "countAtom": {
        "init": 0,
        "read": [Function: defaultRead],
        "toString": [Function: toString],
        "write": [Function: defaultWrite],
      },
      "decrementCountAtom": {
        "init": null,
        "read": [Function: defaultRead],
        "toString": [Function: toString],
        "write": [Function],
      },
      "doubledCountAtom": {
        "read": [Function],
        "toString": [Function: toString],
      },
      "sumCountAtom": {
        "read": [Function],
        "toString": [Function: toString],
        "write": [Function],
      },
    }
  `)
})

it('[DEV-ONLY] should include debugLabel in toString output', () => {
  const countAtom = atom(0)
  countAtom.debugLabel = 'count'
  expect(countAtom.toString()).toContain(':count')
})

it('should let users mark atoms as private', () => {
  const internalAtom = atom(0)
  internalAtom.debugPrivate = true

  expect(internalAtom).toMatchInlineSnapshot(`
    {
      "debugPrivate": true,
      "init": 0,
      "read": [Function: defaultRead],
      "toString": [Function: toString],
      "write": [Function: defaultWrite],
    }
  `)
})
