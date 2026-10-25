export const GAME_CONFIG_KEY = 'tetris-config'

export const DEFAULT_GAME_CONFIG = Object.freeze({
  sfxEnabled: true,
  hapticEnabled: true,
  musicVolume: 1,
  sfxVolume: 2,
  das: 110,
  arr: 25,
  sdf: 20,
  showOnScreenControls: false,
  renderQuality: 'balanced',
  screenShakeMultiplier: 1,
  synesthesiaEnabled: true,
})

export function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)')?.matches === true
  )
}

export function readGameConfig() {
  const isTouch = isTouchDevice()
  if (typeof localStorage === 'undefined') return { ...DEFAULT_GAME_CONFIG, showOnScreenControls: isTouch }
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_CONFIG_KEY) || '{}')
    let showControls
    if (saved.userConfiguredControls === true && typeof saved.showOnScreenControls === 'boolean') {
      showControls = saved.showOnScreenControls
    } else {
      // Default to isTouch: on mobile/tablets, controls are ON by default!
      showControls = isTouch ? true : Boolean(saved.showOnScreenControls)
    }
    return {
      ...DEFAULT_GAME_CONFIG,
      ...saved,
      showOnScreenControls: showControls,
    }
  } catch {
    return { ...DEFAULT_GAME_CONFIG, showOnScreenControls: isTouch }
  }
}

export function writeGameConfig(config) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(GAME_CONFIG_KEY, JSON.stringify(config))
}
