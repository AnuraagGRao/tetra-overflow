import { gameAudioController } from './gameAudioController'

export const setSfxVolume = (v) => gameAudioController.setSfxVolume(v)
export const setSfxDuck = (v) => gameAudioController.setSfxDuck(v)

export const playMoveSFX = (_theme = 'classic') => gameAudioController.playMove()
export const playRotateSFX = (_theme = 'classic') => gameAudioController.playRotate()
export const playRotate180SFX = (_theme = 'classic') => gameAudioController.playRotate180()
export const playHoldSFX = (_theme = 'classic') => gameAudioController.playHold()
export const playSoftDropSFX = (_theme = 'classic') => gameAudioController.playSoftDrop()
export const playHardDropSFX = (_theme = 'classic') => gameAudioController.playHardDrop()
export const playLockSFX = (_theme = 'classic') => gameAudioController.playLock()
export const playLineClearSFX = (_theme = 'classic', comboCount = 0) => gameAudioController.playLineClear(comboCount)
export const playTetrisSFX = (_theme = 'classic') => gameAudioController.playTetris()
export const playTSpinSFX = (_theme = 'classic') => gameAudioController.playTSpin()
export const playAllClearSFX = (_theme = 'classic') => gameAudioController.playAllClear()
export const playLevelUpSFX = (_theme = 'classic') => gameAudioController.playLevelUp()
export const playZoneActivateSFX = (_theme = 'classic') => gameAudioController.playZoneActivate()
export const playZoneEndSFX = (lines = 0) => gameAudioController.playZoneEnd(lines)
export const playPauseSFX = (_theme = 'classic') => gameAudioController.playPause()
export const playResumeSFX = (_theme = 'classic') => gameAudioController.playResume()
export const playComboSFX = (c = 1, _theme = 'classic') => gameAudioController.playCombo(c)
export const playGameOverSFX = (_theme = 'classic') => gameAudioController.playGameOver()

