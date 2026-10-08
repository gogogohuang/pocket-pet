# pocket-pet 🐱🐶🐦

A tamagotchi pet (cat, dog or bird) that lives in a Claude Code pane. Feed it, play with it, clean up after it.
Time passes on the real clock, even while Claude Code is closed: it gets hungry, bored and
sleepy (23:00–07:00 local time) whether you are there or not.

## Install

```
/plugin install pocket-pet --marketplace gogogohuang/pocket-pet
```

Answer `y` to add the marketplace, then pick a scope.

## Use

- `/pet` opens the pane. Buttons: feed (`f`), play (`p`), clean (`c`).
- `/pet name <name>` renames your pet.
- `/pet species` lists the kinds; `/pet species <id or label>` switches between `cat` 貓, `dog` 狗 and `bird` 鳥.
  Only the looks change (sprite, helpers, icons); name, age, hunger and personality stay.
- `/pet adopt [species] [name]` replaces the pet with a brand-new egg (default: same species, default name).
  The old pet is gone for good, personality included.
- `/pet personality` lists the personalities; `/pet personality <id or label>` sets one:

  | id | label | the cat |
  | --- | --- | --- |
  | `normal` | 普通 | the default |
  | `playful` | 活潑 | runs and jumps a lot, gets bored fast |
  | `lazy` | 慵懶 | sits and naps, slow to get hungry, dozes off sooner |
  | `curious` | 好奇 | wanders, watches you type for longer |
  | `aloof` | 傲嬌 | grooms, ignores your typing, reacts a moment late |
  | `clingy` | 黏人 | stays near the middle, watches you closely, cheers longer |

  A personality changes how the cat moves, how it reacts to Claude, how fast it gets hungry or
  bored, and what it says. Switching is free and keeps its current hunger and mood.
- The cat lives in a small room and moves on its own: it walks, jumps, grooms, stretches,
  scratches, yawns, rolls over, crouches and pounces, chases its tail, and sleeps. Press play
  and it chases a ball. A happy cat does more; a sad or starving one mostly sits.
- The pane shows the clock and a countdown to bedtime (23:00) or wake-up (07:00).
- The cat reacts to what Claude is doing:

  | Claude is | The cat |
  | --- | --- |
  | thinking | tilts its head, `…` above it |
  | writing the answer | talks |
  | running a tool | sits at a keyboard (reads a book for Read/Grep/Glob/Web tools, types `$` for Bash) |
  | running subagents | a small helper cat appears per subagent (up to three) |
  | waiting for your permission | hops with a `!` above its head, even if asleep |
  | a tool failed | fur on end for a moment |
  | compacting the conversation | curls up into a loaf |
  | done with a turn | jumps with a `♥` for four seconds; the pane shows the output token count |
  | interrupted or failed | sits with a `?` for four seconds |
  | busy for over two minutes | dozes off |
  | you are typing a prompt | ears up, eyes on you |

  A toast waves goodbye when the session ends.

- The status line shows hunger, mood and mess, with Claude's activity in front of it
  (`💻 Bash`, `🤔`, `💬`, `❗`, `✅`, `⚠️`). Toasts tell you when the cat is hungry or awake.

## Develop

```
claude plugin test .
claude plugin validate .
```

## Release

```
scripts/release.sh patch      # or minor, major, or an exact x.y.z
scripts/release.sh patch --dry-run
```

Runs validate and tests, bumps the version in `.claude-plugin/plugin.json`, commits, tags `vX.Y.Z`,
pushes, and creates a GitHub release. Nothing is published to npm; users update with
`/plugin update pocket-pet`.
