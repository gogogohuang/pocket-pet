import { test, expect } from 'claude-code/testing'

import { clean, computePet, createPet, feed, isAsleepAt, play, untilSleepChange, weightedMs } from './pet'

const H = 3_600_000
const at = (h: number, day = 1, min = 0) => new Date(2026, 0, day, h, min).getTime()

test('sleep window is 23:00-07:00 local', async () => {
  expect(isAsleepAt(at(23))).toBe(true)
  expect(isAsleepAt(at(3))).toBe(true)
  expect(isAsleepAt(at(7))).toBe(false)
  expect(isAsleepAt(at(22, 1, 59))).toBe(false)
})

test('sleeping hours count a quarter', async () => {
  expect(weightedMs(at(10), at(12))).toBe(2 * H)
  expect(weightedMs(at(0), at(2))).toBe(0.5 * H)
  expect(weightedMs(at(22), at(24))).toBe(1 * H + 0.25 * H)
})

test('a new pet is an egg, then a baby after 10 minutes', async () => {
  const p = createPet(at(10))
  expect(computePet(p, at(10, 1, 5)).stage).toBe('egg')
  expect(computePet(p, at(10, 1, 11)).stage).toBe('baby')
  expect(computePet(p, at(10, 5)).stage).toBe('adult')
})

test('hunger rises on the real clock, closed time included', async () => {
  const p = createPet(at(8))
  expect(computePet(p, at(8, 1, 30)).hunger).toBe(0)
  expect(computePet(p, at(12, 1, 1)).hunger).toBe(1)
  expect(computePet(p, at(8, 3)).hunger).toBe(5)
})

test('feeding lowers hunger, is refused when full, asleep or an egg', async () => {
  const p = createPet(at(8))
  expect(feed(p, at(8, 1, 5)).ok).toBe(false) // egg
  expect(feed(p, at(9)).ok).toBe(false) // not hungry
  const hungry = computePet(p, at(20)).hunger
  expect(hungry).toBeGreaterThanOrEqual(2)
  const r = feed(p, at(20))
  expect(r.ok).toBe(true)
  expect(computePet(r.record, at(20)).hunger).toBe(hungry - 3 < 0 ? 0 : hungry - 3)
  expect(feed(p, at(23, 1, 30)).ok).toBe(false) // asleep
})

test('meals leave mess that cleaning removes', async () => {
  const p = createPet(at(8))
  let r = feed(p, at(20)).record
  expect(computePet(r, at(20, 1, 30)).mess).toBe(0)
  expect(computePet(r, at(21, 1, 31)).mess).toBe(1)
  const c = clean(r, at(22))
  expect(c.ok).toBe(true)
  expect(computePet(c.record, at(22)).mess).toBe(0)
  expect(clean(c.record, at(22)).ok).toBe(false)
})

test('playing raises happiness; waking the pet costs it', async () => {
  const p = createPet(at(8))
  const sad = computePet(p, at(20))
  expect(sad.happiness).toBeLessThan(5)
  const r = play(p, at(20))
  expect(r.ok).toBe(true)
  expect(computePet(r.record, at(20)).happiness).toBeGreaterThan(sad.happiness - 0.1)
  const w = play(createPet(at(8)), at(23, 1, 30))
  expect(w.ok).toBe(false)
  expect(computePet(w.record, at(23, 1, 30)).happiness).toBeLessThan(5)
})

test('mood follows the worst need, sleep overriding', async () => {
  const p = createPet(at(8))
  expect(computePet(p, at(9)).mood).toBe('happy')
  expect(computePet(p, at(2, 3)).mood).toBe('sleeping')
  expect(computePet(p, at(20, 2)).mood).toBe('starving')
})

test('countdown runs to 23:00 while awake and to 07:00 while asleep', async () => {
  expect(untilSleepChange(at(21, 1, 30))).toBe(1.5 * H)
  expect(untilSleepChange(at(6, 1, 30))).toBe(0.5 * H)
  expect(untilSleepChange(at(23, 1, 0))).toBe(8 * H)
  expect(untilSleepChange(at(7))).toBe(16 * H)
})
