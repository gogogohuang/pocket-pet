export type Note = string

declare module 'claude-code' {
  interface PluginState {
    'pocket-pet': { msg: Note }
  }
}
