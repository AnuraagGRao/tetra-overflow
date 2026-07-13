export const GAME_CONFIG_KEY = 'tetris-config'

export const DEFAULT_GAME_CONFIG = Object.freeze({
  sfxEnabled: true,
  hapticEnabled: true,
  musicVolume: 1,
  sfxVolume: 2,
  das: 110,
  arr: 25,
  showOnScreenControls: false,
  renderQuality: 'balanced',
  screenShakeMultiplier: 1,
})

export function readGameConfig() {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_GAME_CONFIG }
  try {
    return {
      ...DEFAULT_GAME_CONFIG,
      ...JSON.parse(localStorage.getItem(GAME_CONFIG_KEY) || '{}'),
    }
  } catch {
    return { ...DEFAULT_GAME_CONFIG }
  }
}

export function writeGameConfig(config) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(GAME_CONFIG_KEY, JSON.stringify(config))
}
