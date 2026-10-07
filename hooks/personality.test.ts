import { test, expect } from 'claude-code/testing'

import { PERSONALITIES, listPersonalities, parsePersonality, personalityOf } from './personality'

const all = Object.values(PERSONALITIES)

test('every preset is complete and sane', async () => {
  for (const p of all) {
    expect(Object.values(p.weights).every(w => w > 0)).toBe(true)
    expect(p.hungerRate).toBeGreaterThanOrEqual(0.5)
    expect(p.hungerRate).toBeLessThanOrEqual(2)
    expect(p.boredRate).toBeGreaterThanOrEqual(0.5)
    expect(p.boredRate).toBeLessThanOrEqual(2)
    expect(p.lagFrames).toBeLessThanOrEqual(4)
    for (const line of Object.values(p.lines)) expect(line('Gogo').length).toBeGreaterThan(0)
  }
})

test('normal keeps the original text and rates', async () => {
  const n = PERSONALITIES.normal
  expect(n.lines.fed('Gogo')).toBe('Gogo 呼嚕呼嚕地吃光了!')
  expect(n.lines.hungry('Gogo')).toBe('Gogo 餓了!')
  expect([n.hungerRate, n.boredRate, n.lagFrames, n.dozeAfterMs]).toEqual([1, 1, 0, 120_000])
})

test('ids and Chinese labels are both accepted; anything else is not', async () => {
  expect(parsePersonality('playful')?.id).toBe('playful')
  expect(parsePersonality(' PLAYFUL ')?.id).toBe('playful')
  expect(parsePersonality('活潑')?.id).toBe('playful')
  expect(parsePersonality('nonsense')).toBe(undefined)
  expect(listPersonalities()).toContain('黏人(clingy)')
})

test('a record without a personality, or with an unknown one, is normal', async () => {
  expect(personalityOf({}).id).toBe('normal')
  expect(personalityOf({ personality: 'gone' }).id).toBe('normal')
  expect(personalityOf({ personality: 'lazy' }).id).toBe('lazy')
})
