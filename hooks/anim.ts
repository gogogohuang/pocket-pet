// Pure animation logic for the cat pane. step() advances one frame; scene()
// draws the arena as lines of text. No clock, no randomness of its own: the
// caller passes `rand`, so tests are deterministic.

export const WIDTH = 30
export const SPRITE_W = 7
export const MAX_X = WIDTH - SPRITE_W
const JUMP = [1, 2, 3, 3, 2, 1, 0] // height per frame of a jump
const SKY = 4 // rows above the ground

export type Pose = 'type' | 'read' | 'bash' | 'think' | 'talk' | 'scared' | 'loaf' | 'perk' | 'walk' | 'sit' | 'jump' | 'sleep' | 'groom' | 'stretch' | 'scratch' | 'yawn' | 'roll' | 'crouch' | 'spin'
/** What Claude is doing right now, as the cat sees it. */
export type Activity =
  | 'idle'
  | 'working'
  | 'thinking'
  | 'speaking'
  | 'asking'
  | 'done'
  | 'failed'
  | 'startled'
  | 'compacting'
  | 'waiting'

export type StepOptions = {
  /** How the cat works, by the tool Claude is using. */
  work?: WorkPose
  /** The person is typing a prompt. */
  watching?: boolean
}
/** How the cat works, by the tool Claude is using. */
export type WorkPose = 'type' | 'read' | 'bash'

export const workPose = (tool: string): WorkPose =>
  /^(Read|Grep|Glob|LS|WebFetch|WebSearch|ToolSearch)$/.test(tool) ? 'read' : /^(Bash|PowerShell|Monitor)$/.test(tool) ? 'bash' : 'type'

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

export function step(a: Anim, mood: Mood, rand: () => number, activity: Activity = 'idle', opts: StepOptions = {}): Anim {
  const { work = 'type', watching = false } = opts
  const frame = a.frame + 1
  // Claude needs the person: even a sleeping cat wakes up and hops about
  // (done: the same hop, to celebrate)
  if (activity === 'asking' || (activity === 'done' && mood !== 'sleeping')) {
    if (a.pose === 'jump') return jumping({ ...a, frame })
    return { ...a, pose: 'jump', t: 0, ball: null, toy: 0, frame }
  }
  if (mood === 'sleeping') return { ...a, pose: 'sleep', frame, ball: null, toy: 0, t: 0 }
  // a long wait: the cat dozes off
  if (activity === 'waiting') return { ...a, pose: 'sleep', ball: null, toy: 0, t: 0, frame }
  if (a.pose === 'sleep') return { ...a, pose: 'sit', frame, t: 4 } // just woke up

  if (activity === 'failed') return { ...a, pose: 'sit', t: 3, ball: null, toy: 0, frame }
  const busy: Partial<Record<Activity, Pose>> = {
    working: work,
    thinking: 'think',
    speaking: 'talk',
    startled: 'scared',
    compacting: 'loaf',
  }
  const doing = busy[activity]
  if (doing) {
    if (a.pose === 'jump') return jumping({ ...a, frame })
    return { ...a, pose: doing, t: 3, ball: null, toy: 0, frame }
  }

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

  // the person is typing: ears up, eyes on them
  if (watching) return { ...a, pose: 'perk', t: 2, frame }

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
    if (a.pose === 'spin' && frame % 2 === 0) return { ...a, dir: (a.dir * -1) as 1 | -1, t: a.t - 1, frame }
    return { ...a, t: a.t - 1, frame }
  }

  // a crouch ends in a pounce
  if (a.pose === 'crouch') return { ...a, pose: 'jump', t: 0, frame }

  // pick the next thing to do
  const r = rand()
  const happy = mood === 'happy'
  const rest = (pose: Pose, t: number): Anim => ({ ...a, pose, t, frame })
  if (mood === 'sad' || mood === 'starving') return rest('sit', 8)
  if (r < 0.3) return { ...a, pose: 'walk', dir: rand() < 0.5 ? 1 : -1, t: 6 + Math.floor(rand() * 10), frame }
  if (r < 0.4) return happy ? { ...a, pose: 'jump', t: 0, frame } : rest('sit', 5)
  if (r < 0.5) return rest('groom', 6)
  if (r < 0.58) return rest('stretch', 8)
  if (r < 0.66) return rest('scratch', 8)
  if (r < 0.74) return rest('yawn', 6)
  if (r < 0.8) return happy ? rest('roll', 10) : rest('sit', 5)
  if (r < 0.86) return happy ? rest('crouch', 6) : rest('sit', 5)
  if (r < 0.92) return happy ? rest('spin', 12) : rest('sit', 5)
  return rest('sit', 5 + Math.floor(rand() * 5))
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
  const odd = a.frame % 2 === 1
  if (a.pose === 'think') {
    const tilt = odd ? ' ' : ''
    return [pad(tilt + ears.trim()), pad(tilt + `(${e})`), pad(' U U ')]
  }
  if (a.pose === 'talk') return [pad(ears), pad(` (${odd ? '^o^' : '^.^'}) `), pad(' U U ')]
  if (a.pose === 'scared') return [pad(' /|_|\\ '), pad(' (>O<) '), pad(odd ? '/U U\\' : ' U U  ')]
  if (a.pose === 'loaf') return [pad(''), pad(' ,---, '), pad('(=-.-=)')]
  if (a.pose === 'perk') return [pad(' /|_|\\ '), pad(' (O.O) '), pad(' U U ')]
  if (a.pose === 'read') return [pad(ears), pad(` (${e}) `), pad(odd ? ' [= =] ' : ' [=/=] ')]
  if (a.pose === 'bash') return [pad(ears), pad(` (${e}) `), pad(odd ? ' [$_#] ' : ' [#_$] ')]
  if (a.pose === 'type') return [pad(ears), pad(` (${e}) `), pad(odd ? ' [#_#] ' : ' [_#_] ')]
  if (a.pose === 'stretch') return [pad('  ___  '), pad(' /   \\ '), pad(`U(${e})U`)]
  if (a.pose === 'scratch') return [pad(ears), pad(` (${e})${odd ? "'" : ' '}`), pad(odd ? ' U/_\\ ' : ' U\\_/ ')]
  if (a.pose === 'yawn') return [pad(ears), pad(' (-O-) '), pad(' U U   ')]
  if (a.pose === 'roll') return [pad(''), pad(odd ? ' u   u ' : '  U U  '), pad('(=^.^=)')]
  if (a.pose === 'crouch') return [pad(''), pad(ears), pad(odd ? '(o.o)~ ' : '(o.o) ~')]
  if (a.pose === 'spin') return [pad(ears), pad(face), pad(' U U@ ')]
  const paw = a.pose === 'walk' ? (a.frame % 2 ? '/ \\ /' : '\\ / \\') : a.pose === 'jump' ? '\\_/' : a.pose === 'groom' ? (a.frame % 2 ? 'u u' : 'U u') : 'U U'
  return [pad(ears), pad(face), pad(' ' + paw.padEnd(5) + ' ')]
}

/** The arena: SKY + 3 rows of cat room, then a ground line. */
/** `mark` floats above the cat's head: '!' when Claude asks, '♥' when done. */
export function scene(a: Anim, mood: Mood, mark = '', kittens = 0): string[] {
  const rows = Array.from({ length: SKY + 3 }, () => ' '.repeat(WIDTH).split(''))
  const put = (r: number, c: number, s: string) => {
    for (let i = 0; i < s.length; i++) if (c + i >= 0 && c + i < WIDTH && r >= 0 && r < rows.length) rows[r]![c + i] = s[i]!
  }
  // one little helper per running subagent, waving from the right-hand side
  for (let i = 0; i < Math.min(kittens, 3); i++) put(SKY + 2, WIDTH - 6 - i * 7, (a.frame + i) % 2 ? '=^.^=' : '=^o^=')
  const h = height(a)
  const top = SKY - h
  sprite(a, mood).forEach((line, i) => put(top + i, a.x, line))
  if (mark) put(top - 1, a.x + 3, mark)
  if (a.ball !== null) put(SKY + 2, Math.min(WIDTH - 1, a.ball), '●')
  return [...rows.map(r => r.join('')), '─'.repeat(WIDTH)]
}
