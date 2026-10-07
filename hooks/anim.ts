// Pure animation logic for the cat pane. step() advances one frame; scene()
// draws the arena as lines of text. No clock, no randomness of its own: the
// caller passes `rand`, so tests are deterministic.

export const WIDTH = 30
export const SPRITE_W = 7
export const MAX_X = WIDTH - SPRITE_W
const JUMP = [1, 2, 3, 3, 2, 1, 0] // height per frame of a jump
const SKY = 4 // rows above the ground

export type Pose = 'walk' | 'sit' | 'jump' | 'sleep' | 'groom'
export type Mood = 'sleeping' | 'starving' | 'dirty' | 'sad' | 'hungry' | 'happy'

export type Anim = {
  x: number
  dir: 1 | -1
  pose: Pose
  /** frames left in the current pose (walk/sit/groom) or index into JUMP */
  t: number
  frame: number
  /** toy ball column while the cat is playing; null when no toy */
  ball: number | null
  /** frames the toy stays */
  toy: number
}

export const initialAnim = (): Anim => ({ x: 4, dir: 1, pose: 'sit', t: 6, frame: 0, ball: null, toy: 0 })

/** Drop a ball in: the cat will chase it for a while. */
export const throwBall = (a: Anim, rand: () => number): Anim => ({
  ...a,
  ball: 2 + Math.floor(rand() * (MAX_X + 3)),
  toy: 40,
  pose: 'walk',
  t: 99,
})

export function step(a: Anim, mood: Mood, rand: () => number): Anim {
  const frame = a.frame + 1
  if (mood === 'sleeping') return { ...a, pose: 'sleep', frame, ball: null, toy: 0, t: 0 }
  if (a.pose === 'sleep') return { ...a, pose: 'sit', frame, t: 4 } // just woke up

  // toy: run at the ball, pounce when close
  if (a.ball !== null) {
    const toy = a.toy - 1
    if (toy <= 0) return { ...a, ball: null, toy: 0, pose: 'sit', t: 5, frame }
    if (a.pose === 'jump') return jumping({ ...a, toy, frame })
    const dist = a.ball - a.x
    if (Math.abs(dist) <= 1) {
      const ball = 2 + Math.floor(rand() * (MAX_X + 3))
      return { ...a, pose: 'jump', t: 0, ball, toy, frame }
    }
    const dir = dist > 0 ? 1 : -1
    return { ...a, dir, x: clampX(a.x + dir * 2), pose: 'walk', toy, frame }
  }

  if (a.pose === 'jump') return jumping({ ...a, frame })

  if (a.t > 0) {
    if (a.pose === 'walk') {
      let x = a.x + a.dir
      let dir = a.dir
      if (x <= 0 || x >= MAX_X) {
        dir = (dir * -1) as 1 | -1
        x = clampX(x)
      }
      return { ...a, x, dir, t: a.t - 1, frame }
    }
    return { ...a, t: a.t - 1, frame }
  }

  // pick the next thing to do
  const r = rand()
  if (mood === 'sad' || mood === 'starving') return { ...a, pose: 'sit', t: 8, frame }
  if (r < 0.45) return { ...a, pose: 'walk', dir: rand() < 0.5 ? 1 : -1, t: 6 + Math.floor(rand() * 10), frame }
  if (r < 0.65 && mood === 'happy') return { ...a, pose: 'jump', t: 0, frame }
  if (r < 0.85) return { ...a, pose: 'groom', t: 6, frame }
  return { ...a, pose: 'sit', t: 5 + Math.floor(rand() * 5), frame }
}

const clampX = (x: number) => Math.max(0, Math.min(MAX_X, x))

function jumping(a: Anim): Anim {
  const t = a.t + 1
  if (a.pose !== 'jump') return a
  // hop forward while in the air
  const x = clampX(a.x + a.dir)
  if (t >= JUMP.length) return { ...a, x, pose: 'sit', t: 3 }
  return { ...a, x, t }
}

const EYES: Record<Mood, string> = {
  happy: '^.^',
  hungry: 'o.o',
  starving: 'x.x',
  dirty: '>_<',
  sad: ';.;',
  sleeping: '-.-',
}

const height = (a: Anim) => (a.pose === 'jump' ? (JUMP[a.t] ?? 0) : 0)

/** The cat as 3 rows, 7 columns wide, facing a.dir. */
function sprite(a: Anim, mood: Mood): string[] {
  const eyes = EYES[a.pose === 'groom' ? 'happy' : mood]
  const blink = a.frame % 12 === 0 && a.pose !== 'sleep'
  const e = blink ? '-.-' : eyes
  const ears = ' /\\_/\\ '
  const face = a.dir === 1 ? `~(${e})` : `(${e})~`
  const pad = (s: string) => s.padEnd(SPRITE_W)
  if (a.pose === 'sleep') {
    return [pad(''), pad(' ,-.-. '), pad(` (${a.frame % 6 < 3 ? 'z' : 'Z'}_-_) `)]
  }
  const paw = a.pose === 'walk' ? (a.frame % 2 ? '/ \\ /' : '\\ / \\') : a.pose === 'jump' ? '\\_/' : a.pose === 'groom' ? (a.frame % 2 ? 'u u' : 'U u') : 'U U'
  return [pad(ears), pad(face), pad(' ' + paw.padEnd(5) + ' ')]
}

/** The arena: SKY + 3 rows of cat room, then a ground line. */
export function scene(a: Anim, mood: Mood): string[] {
  const rows = Array.from({ length: SKY + 3 }, () => ' '.repeat(WIDTH).split(''))
  const put = (r: number, c: number, s: string) => {
    for (let i = 0; i < s.length; i++) if (c + i >= 0 && c + i < WIDTH && r >= 0 && r < rows.length) rows[r]![c + i] = s[i]!
  }
  const h = height(a)
  const top = SKY - h
  sprite(a, mood).forEach((line, i) => put(top + i, a.x, line))
  if (a.ball !== null) put(SKY + 2, Math.min(WIDTH - 1, a.ball), '●')
  return [...rows.map(r => r.join('')), '─'.repeat(WIDTH)]
}
