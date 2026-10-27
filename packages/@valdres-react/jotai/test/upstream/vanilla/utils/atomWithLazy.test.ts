// Adapted from pmndrs/jotai v3.0.1 tests/vanilla/utils/atomWithLazy.test.ts (MIT). See ../../UPSTREAM.md.
import { expect, it, vi } from '../../../vi'
import { createStore } from '../../../impl'
import { atomWithLazy } from 'jotai-reference/vanilla/utils'

it('initializes on first store get', () => {
  const storeA = createStore()
  const storeB = createStore()

  let externalState = 'first'
  const initializer = vi.fn(() => externalState)
  const anAtom = atomWithLazy(initializer)

  expect(initializer).not.toHaveBeenCalled()
  expect(storeA.get(anAtom)).toEqual('first')
  expect(initializer).toHaveBeenCalledOnce()

  externalState = 'second'

  expect(storeA.get(anAtom)).toEqual('first')
  expect(initializer).toHaveBeenCalledOnce()
  expect(storeB.get(anAtom)).toEqual('second')
  expect(initializer).toHaveBeenCalledTimes(2)
})

it('is writable', () => {
  const store = createStore()
  const anAtom = atomWithLazy(() => 0)

  store.set(anAtom, 123)

  expect(store.get(anAtom)).toEqual(123)
})

it('should work with a set state action', () => {
  const store = createStore()
  const anAtom = atomWithLazy(() => 4)

  store.set(anAtom, (prev: number) => prev * prev)

  expect(store.get(anAtom)).toEqual(16)
})
