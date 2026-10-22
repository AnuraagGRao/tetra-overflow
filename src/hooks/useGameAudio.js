import { useMemo } from 'react'
import { gameAudioController } from '../audio/gameAudioController'

export function useGameAudio() {
  return useMemo(() => ({
    unlock: () => gameAudioController.unlock(),
    setSfxVolume: (v) => gameAudioController.setSfxVolume(v),
    setSfxDuck: (v) => gameAudioController.setSfxDuck(v),
    setMusicVolume: (v) => gameAudioController.setMusicVolume(v),

    playMove: () => gameAudioController.playMove(),
    playRotate: () => gameAudioController.playRotate(),
    playRotate180: () => gameAudioController.playRotate180(),
    playHold: () => gameAudioController.playHold(),
    playSoftDrop: () => gameAudioController.playSoftDrop(),
    playHardDrop: () => gameAudioController.playHardDrop(),
    playLock: () => gameAudioController.playLock(),
    playLineClear: (comboCount = 0) => gameAudioController.playLineClear(comboCount),
    playTetris: () => gameAudioController.playTetris(),
    playZoneActivate: () => gameAudioController.playZoneActivate(),
    playZoneEnd: (lines) => gameAudioController.playZoneEnd(lines),

    startMusicStems: () => gameAudioController.startMusicStems(),
    stopMusicStems: (fadeMs) => gameAudioController.stopMusicStems(fadeMs),
    setStemLevels: (levels, fadeMs) => gameAudioController.setStemLevels(levels, fadeMs),
    updateStemMix: (state) => gameAudioController.updateStemMix(state),
  }), [])
}

export default useGameAudio
