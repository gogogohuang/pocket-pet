# pocket-pet 🐱

A tamagotchi cat that lives in a Claude Code pane. Feed it, play with it, clean its litter box.
Time passes on the real clock, even while Claude Code is closed: it gets hungry, bored and
sleepy (23:00–07:00 local time) whether you are there or not.

## Install

```
/plugin install pocket-pet --marketplace gogogohuang/pocket-pet
```

Answer `y` to add the marketplace, then pick a scope.

## Use

- `/pet` opens the pane. Buttons: feed (`f`), play (`p`), clean (`c`).
- `/pet name <name>` renames your cat.
- The status line shows hunger, mood and mess; toasts tell you when it is hungry or awake.

## Develop

```
claude plugin test .
claude plugin validate .
```
