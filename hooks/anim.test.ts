import { test, expect } from 'claude-code/testing'

import { MAX_X, WIDTH, initialAnim, scene, step, throwBall } from './anim'
import type { Activity, Anim } from './anim'

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

const run = (a: Anim, mood: Parameters<typeof step>[1], n: number, rand = seeded(), activity: Activity = 'idle') => {
  const seen: Anim[] = []
  for (let i = 0; i < n; i++) seen.push((a = step(a, mood, rand, activity)))

  return seen
}

test('happy cat walks, jumps and stays inside the arena', async () => {
  const frames = run(initialAnim(), 'happy', 600)
  expect(new Set(frames.map(f => f.pose)).has('walk')).toBe(true)
  expect(new Set(frames.map(f => f.pose)).has('jump')).toBe(true)
  expect(frames.every(f => f.x >= 0 && f.x <= MAX_X)).toBe(true)
  expect(new Set(frames.map(f => f.x)).size).toBeGreaterThan(5)
})

test('a sleeping cat does not move', async () => {
  const frames = run(initialAnim(), 'sleeping', 20)
  expect(frames.every(f => f.pose === 'sleep' && f.x === frames[0]!.x)).toBe(true)
})

test('a sad cat sits instead of wandering', async () => {
  const frames = run(initialAnim(), 'sad', 200)
  expect(frames.some(f => f.pose === 'jump')).toBe(false)
})

test('the cat chases a thrown ball, then loses interest', async () => {
  const rand = seeded(7)
  const frames = run(throwBall(initialAnim(), rand), 'happy', 60, rand)
  expect(frames[0]!.ball).not.toBe(null)
  expect(frames[frames.length - 1]!.ball).toBe(null)
})

test('every scene line is the arena width', async () => {
  for (const f of run(initialAnim(), 'happy', 100)) {
    const lines = scene(f, 'happy')
    expect(lines.every(l => [...l].length === WIDTH)).toBe(true)
  }
})

test('a happy cat shows its full repertoire; a sad one only sits', async () => {
  const poses = new Set(run(initialAnim(), 'happy', 4000).map(f => f.pose))
  for (const p of ['walk', 'jump', 'groom', 'stretch', 'scratch', 'yawn', 'roll', 'crouch', 'spin'])
    expect(poses.has(p as never)).toBe(true)
  const sad = new Set(run(initialAnim(), 'sad', 1000).map(f => f.pose))
  expect([...sad].every(p => p === 'sit')).toBe(true)
})

test('a crouch ends in a pounce', async () => {
  const frames = run({ ...initialAnim(), pose: 'crouch', t: 2 }, 'happy', 6)
  expect(frames.some(f => f.pose === 'jump')).toBe(true)
})

test('while Claude works the cat types in place', async () => {
  const frames = run(initialAnim(), 'happy', 40, seeded(), 'working').slice(5)
  expect(frames.every(f => f.pose === 'type' && f.x === frames[0]!.x)).toBe(true)
})

test('when Claude asks, even a sleeping cat hops until answered', async () => {
  const frames = run({ ...initialAnim(), pose: 'sleep' }, 'sleeping', 40, seeded(), 'asking')
  expect(frames.filter(f => f.pose === 'jump').length).toBeGreaterThan(30)
})

test('a cat that sleeps ignores work and a finished turn', async () => {
  for (const act of ['working', 'done', 'failed'] as const)
    expect(run(initialAnim(), 'sleeping', 10, seeded(), act).every(f => f.pose === 'sleep')).toBe(true)
})

test('the mark floats above the cat', async () => {
  expect(scene(initialAnim(), 'happy', '!').join('\n')).toContain('!')
})
