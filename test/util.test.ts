import { test } from 'node:test'
import strict from 'node:assert/strict'
import { assert, raise, Fail, ValidationError, number, decimal, credits, duration, clamp } from '../src/util.ts'
import { initialState, trade, toggleModule, changeHull } from '../src/model.ts'
import { themePreference } from '../src/theme.ts'

test('assert and raise preserve typed failures, codes and causes', () => {
    const cause = new TypeError('source failure')
    strict.throws(() => raise('invalid route', 'navigation', cause), error => error instanceof ValidationError && error.code === 'navigation' && error.cause === cause)
    strict.throws(() => assert(false, 'no capacity', 'capacity'), error => error instanceof Fail && error.code === 'capacity')
    const value: string | undefined = 'ready'
    assert(value, 'missing')
    strict.equal(value.toUpperCase(), 'READY')
    const original = new ValidationError('invalid', 'input')
    strict.equal(Fail.from(original), original)
    strict.equal(Fail.from(cause).cause, cause)
    strict.equal(Fail.from(null).message, 'operation failed')
})

test('domain rejections have stable codes and cannot mutate a snapshot', () => {
    const game = initialState()
    const before = structuredClone(game)
    strict.throws(() => trade(game, 'ore', 'buy', 999), { code: 'trade', name: 'ValidationError' })
    const overloaded = { ...game, fitted: [ 'drive', 'cargo' ] as const }
    strict.throws(() => toggleModule({ ...overloaded, fitted: [ ...overloaded.fitted ]}, 'ansible'), { code: 'fitting' })
    strict.throws(() => changeHull(game, 'missing' as never), { code: 'hull' })
    strict.deepEqual(game, before)
})

test('formatters retain orbital precision and duration units', () => {
    strict.equal(decimal(5.604), '5.60')
    strict.equal(number(258.91, 1), '258.9')
    strict.equal(credits(12480), '₢12,480')
    strict.equal(duration(3660), '1h 1m')
    strict.equal(clamp(2), 1)
    strict.equal(clamp(-1), 0)
})

test('unknown theme preferences fall back to the system setting', () => {
    for (const value of [ null, undefined, 'blue', '', 1 ]) strict.equal(themePreference(value), 'system')
    strict.equal(themePreference('dark'), 'dark')
    strict.equal(themePreference('light'), 'light')
})
