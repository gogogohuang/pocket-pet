import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { initialAnim, scene, step, throwBall, workPose } from './anim'
import type { Activity, Anim } from './anim'
import { clean, computePet, createPet, feed, play, rename, untilSleepChange } from './pet'
import type { Mood, Outcome, PetRecord, PetView, Stage } from './pet'

const PANE = 'pocket-pet'
const KEY = 'pet'
const TICK_MS = 60_000
const FRAME_MS = 400

const msg = atom({ plugin: 'pocket-pet', key: 'msg' } as const, '')

const FACE: Record<Mood, string> = {
  happy: '(=^ω^=)',
  hungry: '(=•﹏•=)',
  starving: '(=x﹏x=)',
  dirty: '(=>_<=)',
  sad: '(=;ω;=)',
  sleeping: '(=-ω-=) zZ',
}

const body = (stage: Stage, mood: Mood): string[] => {
  if (stage === 'egg') return ['  _______  ', ' |       | ', ' | 紙 箱 | ', ' |_______| ']
  const face = FACE[mood]
  if (stage === 'baby') return ['  /\_/\  ', ` ${face} `, '  >   <  ', '  (_" "_)']

  return ['  /\___/\  ', ` ${face} `, '  /  w  \  ', ' (__|_|__)~', '        ']
}

const bar = (n: number, full: string, empty: string) => full.repeat(n) + empty.repeat(5 - n)

const age = (ms: number) => {
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m} 分鐘`
  if (m < 60 * 48) return `${Math.floor(m / 60)} 小時`

  return `${Math.floor(m / 1440)} 天`
}

const clock = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')

  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const span = (ms: number) => {
  const m = Math.ceil(ms / 60_000)

  return m >= 60 ? `${Math.floor(m / 60)} 小時 ${m % 60} 分` : `${m} 分`
}

const summary = (v: PetView) =>
  `${v.stage === 'egg' ? '📦' : v.asleep ? '😴' : v.mood === 'happy' ? '😺' : v.mood === 'sad' || v.mood === 'starving' ? '😿' : '🐱'} ${bar(5 - v.hunger, '🍙', '·')} ${bar(v.happiness, '♥', '♡')}${v.mess ? ' 💩'.repeat(v.mess) : ''}`

let lastMood: Mood | undefined
let anim: Anim = initialAnim()
// What Claude is doing. `done`, `failed` and `startled` are brief; the rest last until the next event.
let activity: Activity = 'idle'
let shown: Activity = 'idle' // `activity`, or `waiting` once it has gone on for a long time
let activityUntil = 0
let activityId = 0
let seenId = -1
let seenAt = 0
let inTurn = false
let kittens = 0 // subagents running right now
let lastTool = ''
let lastTokens = 0
let frames = 0
let typingFrame = -100 // the frame on which the person last edited the prompt
const WAIT_MS = 120_000

const MARK: Record<Activity, string> = {
  idle: '',
  working: '',
  thinking: '…',
  speaking: '',
  asking: '!',
  done: '♥',
  failed: '?',
  startled: '*',
  compacting: '…',
  waiting: '',
}
const DOING: Record<Activity, string> = {
  idle: '',
  working: '💻 Claude 工作中',
  thinking: '🤔 Claude 思考中',
  speaking: '💬 Claude 正在回答',
  asking: '❗ Claude 在等你回應',
  done: '✅ Claude 做完了',
  failed: '⚠️ Claude 出錯了',
  startled: '😱 工具失敗了',
  compacting: '📦 Claude 在整理對話',
  waiting: '💤 等好久了',
}
const ICON: Record<Activity, string> = {
  idle: '',
  working: '💻',
  thinking: '🤔',
  speaking: '💬',
  asking: '❗',
  done: '✅',
  failed: '⚠️',
  startled: '😱',
  compacting: '📦',
  waiting: '💤',
}

const tokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

let lastSummary = ''
let expiry: { cancel: () => void } | undefined

/** The status line: Claude's activity (if any) in front of the cat's own summary. */
function paintStatus($: EngineInterface) {
  if (!lastSummary) return
  const doing = activity === 'idle' ? '' : `${ICON[activity]}${activity === 'working' && lastTool ? ` ${lastTool}` : ''} `
  $.ui.status(doing + lastSummary)
}

/** Where a brief state ends up: back to work if a turn is still running. */
const settled = (): Activity => (inTurn ? 'working' : 'idle')

// These run inside the model's loop, so none of them may throw into it.
async function setActivity($: EngineInterface, next: Activity, forMs = 0) {
  try {
    activity = next
    shown = next
    activityId++
    activityUntil = forMs ? (await $.clock.now()) + forMs : 0
    expiry?.cancel()
    expiry = forMs
      ? $.clock.after(forMs, () => {
          if (activity === next) void setActivity($, settled())
        })
      : undefined
    paintStatus($)
    $.ui.invalidate('ui.render')
  } catch {
    activityUntil = 0
  }
}

let frameTimer: { cancel: () => void } | undefined

/** Advance the cat one frame and redraw; runs only while the pane is open. */
async function frame($: EngineInterface) {
  const now = await $.clock.now()
  const v = computePet(await load($), now)
  frames++
  if (activityUntil && now >= activityUntil) await setActivity($, settled())
  if (activityId !== seenId) {
    seenId = activityId
    seenAt = now
  }
  const long = (activity === 'working' || activity === 'thinking' || activity === 'speaking') && now - seenAt > WAIT_MS
  shown = long ? 'waiting' : activity
  anim = step(anim, v.mood, Math.random, shown, { work: workPose(lastTool), watching: frames - typingFrame <= 4 })
  $.ui.invalidate('ui.render')
}

async function load($: EngineInterface): Promise<PetRecord> {
  const stored = (await $.store.get(KEY)) as PetRecord | undefined
  if (stored) return stored
  const fresh = createPet(await $.clock.now())
  await $.store.set(KEY, fresh)

  return fresh
}

async function refresh($: EngineInterface, announce: boolean) {
  const now = await $.clock.now()
  const v = computePet(await load($), now)
  lastSummary = summary(v)
  paintStatus($)
  if (announce && v.mood !== lastMood) {
    if (v.mood === 'hungry' || v.mood === 'starving') $.ui.toast(`${v.name} 餓了!`)
    else if (v.mood === 'dirty') $.ui.toast(`${v.name} 的貓砂盆該清了`)
    else if (lastMood === 'sleeping' && v.mood !== 'sleeping') $.ui.toast(`${v.name} 睡醒了`)
  }
  lastMood = v.mood
  $.ui.invalidate('ui.render')
}

async function act($: EngineInterface, run: (r: PetRecord, now: number) => Outcome) {
  const now = await $.clock.now()
  const out = run(await load($), now)
  await $.store.set(KEY, out.record)
  await update($, msg, () => out.message)
  if (run === play && out.ok) anim = throwBall(anim, Math.random)
  await refresh($, false)
}


const doingLine = () => {
  if (shown === 'idle') return ''
  const extra =
    shown === 'working' && lastTool ? ` · ${lastTool}` : shown === 'done' && lastTokens ? ` · ${tokens(lastTokens)} tokens` : ''
  const helpers = kittens ? ` · 🐱×${kittens} 小幫手` : ''

  return DOING[shown] + extra + helpers
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'pet', description: '養貓:/pet 開面板,/pet name <名字> 改名' })
    await refresh($, true)
    $.clock.every(TICK_MS, () => refresh($, true))

    return next(e)
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    const name = e.args.match(/^name\s+(.+)$/)?.[1]
    if (name) {
      await $.store.set(KEY, rename(await load($), name))
      await refresh($, false)

      return { text: `改名完成:${name.trim().slice(0, 12)}` }
    }
    await $.ui.open({ id: PANE, title: 'Pet' })
    frameTimer ??= $.clock.every(FRAME_MS, () => frame($))

    return { text: '貓咪面板已開啟。' }
  })

  on('turn.start', async ($, e, next) => {
    lastTool = ''
    inTurn = true
    await setActivity($, 'working')

    return next(e)
  })

  // The response arriving in pieces: thinking, then the answer. Only the main loop's.
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    let kind = ''
    while (true) {
      const part = await stream.next()
      if (part.done) return part.value
      try {
        const c = part.value
        if (!e.agentId && c.kind !== kind && (c.kind === 'thinking' || c.kind === 'text')) {
          kind = c.kind
          if (activity !== 'asking') void setActivity($, c.kind === 'thinking' ? 'thinking' : 'speaking')
        }
      } catch {
        // the cat must never break the stream
      }
      yield part.value
    }
  })

  on('tool.check', async ($, e, next) => {
    const out = await next(e)
    if (out.decision === 'ask') await setActivity($, 'asking')

    return out
  })

  on('tool.call', async ($, e, next) => {
    lastTool = e.tool
    const helper = /^(Agent|Task)$/.test(e.tool)
    if (helper) kittens++
    await setActivity($, 'working')
    try {
      const out = await next(e)
      if ('isError' in out && out.isError) await setActivity($, 'startled', 2500)

      return out
    } finally {
      if (helper) kittens = Math.max(0, kittens - 1)
    }
  })

  on('session.compact', async ($, e, next) => {
    await setActivity($, 'compacting')
    try {
      return await next(e)
    } finally {
      if (activity === 'compacting') await setActivity($, settled())
    }
  })

  // The person typing: just a note of the frame; no await on the keystroke path.
  on('prompt.edit', ($, e, next) => {
    typingFrame = frames

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      inTurn = false
      kittens = 0
      lastTokens = e.usage?.output_tokens ?? 0
      await setActivity($, e.reason === 'answer' ? 'done' : 'failed', 4000)
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    try {
      const v = computePet(await load($), await $.clock.now())
      $.ui.toast(`${v.name} 揮手說掰掰 👋`)
    } catch {
      // closing anyway
    }

    return next(e)
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      frameTimer?.cancel()
      frameTimer = undefined
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const v = computePet(await load($), now)
    const note = await read($, msg)
    const feedHint = v.asleep ? '睡覺中' : ''

    return (
      <Box flexDirection="column">
        <Text bold>
          {v.name} · {v.stage === 'egg' ? '紙箱裡' : v.stage === 'baby' ? '幼貓' : '成貓'} · {age(v.ageMs)}
        </Text>
        <Box flexDirection="column" marginY={1}>
          {(v.stage === 'egg' ? body(v.stage, v.mood) : scene(anim, v.mood, MARK[shown], kittens)).map(line => (
            <Text>{line}</Text>
          ))}
          {v.mess > 0 && <Text>{'💩'.repeat(v.mess)}</Text>}
        </Box>
        <Text>飽足 {bar(5 - v.hunger, '■', '□')}</Text>
        <Text>心情 {bar(v.happiness, '♥', '♡')}</Text>
        <Text dimColor>
          🕐 {clock(now)} · {v.asleep ? '😴 睡覺中(23:00–07:00)' : '☀️ 清醒中'}
        </Text>
        <Text dimColor>
          {v.asleep ? '⏰ 距離睡醒' : '🌙 距離睡覺'} {span(untilSleepChange(now))}
        </Text>
        <Box marginTop={1}>
          <Button key="feed" label="餵食 [f]" hotkey="f" variant="primary" onPress={() => act($, feed)} />
          <Button key="play" label="玩耍 [p]" hotkey="p" onPress={() => act($, play)} />
          <Button key="clean" label="清理 [c]" hotkey="c" onPress={() => act($, clean)} />
        </Box>
        <Text dimColor>{doingLine()}</Text>
        <Text dimColor>{note || feedHint}</Text>
        <Text dimColor>{'指令:/pet 開面板 · /pet name <名字> 改名'}</Text>
      </Box>
    )
  })
}
