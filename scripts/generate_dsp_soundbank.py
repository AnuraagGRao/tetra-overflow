#!/usr/bin/env python3
"""
Procedural DSP Soundbank Generator for Tetra Overflow Ultra
Generates mathematical 44.1kHz 16-bit mono WAV audio assets for:
1. Tetris Effect harmonic crystal chimes & chord swells.
2. Authentic 8-bit NES Classic soundboard.
Outputs directly into public/audio/dsp/
"""

import math
import os
import struct
import wave

SAMPLE_RATE = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "audio", "dsp")
os.makedirs(OUT_DIR, exist_ok=True)

def write_wav(filename, samples):
    filepath = os.path.join(OUT_DIR, filename)
    with wave.open(filepath, "w") as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(SAMPLE_RATE)
        
        packed_frames = bytearray()
        for s in samples:
            # Clamp to [-1.0, 1.0]
            val = max(-1.0, min(1.0, s))
            int_sample = int(val * 32767.0)
            packed_frames.extend(struct.pack("<h", int_sample))
            
        wav_file.writeframes(packed_frames)
    print(f"Generated: {filename} ({len(samples)} samples, {len(samples)/SAMPLE_RATE:.3f}s)")

def make_chime(freq, duration=0.45, decay=9.0):
    """Crystal bell chime with harmonic overtone and soft exponential envelope"""
    total_samples = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-decay * t)
        # Fundamental + 2nd overtone + 3rd harmonic shimmer
        s1 = math.sin(2.0 * math.pi * freq * t)
        s2 = 0.35 * math.sin(2.0 * math.pi * freq * 2.002 * t)
        s3 = 0.15 * math.sin(2.0 * math.pi * freq * 3.01 * t)
        samples.append(env * (s1 + s2 + s3) * 0.75)
    return samples

def make_sub_impact(duration=0.32):
    """Deep 808-style pitch drop sub-bass impact for hard drops"""
    total_samples = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-7.5 * t)
        # Frequency sweeps down from 120Hz to 38Hz
        freq = 38.0 + 82.0 * math.exp(-18.0 * t)
        phase = 2.0 * math.pi * (38.0 * t - (82.0 / 18.0) * math.exp(-18.0 * t))
        s = math.sin(phase)
        # Soft saturation distortion
        s = math.tanh(s * 1.5)
        samples.append(env * s * 0.85)
    return samples

def make_chord(frequencies, duration=0.6, decay=5.0):
    """Lush harmonic chord swell for line clears and Tetrises"""
    total_samples = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-decay * t) * (1.0 - math.exp(-50.0 * t)) # smooth attack
        val = 0.0
        for f in frequencies:
            val += math.sin(2.0 * math.pi * f * t)
            # Add slight stereo detune shimmer in mono
            val += 0.25 * math.sin(2.0 * math.pi * (f * 1.004) * t)
        val = (val / len(frequencies)) * env * 0.85
        samples.append(val)
    return samples

def make_nes_pulse(freq, duration=0.045, duty=0.5):
    """Authentic 8-bit NES square/pulse wave"""
    total_samples = int(SAMPLE_RATE * duration)
    samples = []
    period = SAMPLE_RATE / freq
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        env = 1.0 - (t / duration)
        phase = (i % period) / period
        val = 1.0 if phase < duty else -1.0
        samples.append(val * env * 0.6)
    return samples

def make_nes_noise(duration=0.08):
    """Authentic NES pseudo-random noise burst for drops"""
    total_samples = int(SAMPLE_RATE * duration)
    samples = []
    lfsr = 0x7FFF
    current_out = 1.0
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-16.0 * t)
        if i % 8 == 0:
            bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1
            lfsr = (lfsr >> 1) | (bit << 14)
            current_out = 1.0 if (lfsr & 1) else -1.0
        samples.append(current_out * env * 0.55)
    return samples

def make_nes_fanfare():
    """Classic 4-tone NES line clear arpeggio"""
    notes = [523.25, 659.25, 783.99, 1046.50] # C5, E5, G5, C6
    note_dur = 0.065
    samples = []
    for f in notes:
        samples.extend(make_nes_pulse(f, note_dur, duty=0.25))
    return samples

def main():
    print("Synthesizing Tetra Overflow procedural soundbank...")
    
    # 1. Tetris Effect pentatonic chime scale
    scale = {
        "chime_c4.wav": 261.63,
        "chime_d4.wav": 293.66,
        "chime_e4.wav": 329.63,
        "chime_g4.wav": 392.00,
        "chime_a4.wav": 440.00,
        "chime_c5.wav": 523.25,
        "chime_d5.wav": 587.33,
        "chime_e5.wav": 659.25,
    }
    for name, freq in scale.items():
        write_wav(name, make_chime(freq, duration=0.38, decay=10.0))
        
    # 2. Sub-bass hard drop impact
    write_wav("sub_impact.wav", make_sub_impact(0.35))
    
    # 3. Dynamic Chord Swells
    # Single (C-E), Double (C-E-G), Triple (C-E-G-B), Tetris (C-E-G-B-D-G)
    write_wav("chord_single.wav", make_chord([261.63, 329.63], duration=0.45, decay=7.0))
    write_wav("chord_double.wav", make_chord([261.63, 329.63, 392.00], duration=0.55, decay=6.0))
    write_wav("chord_triple.wav", make_chord([261.63, 329.63, 392.00, 493.88], duration=0.65, decay=5.0))
    write_wav("chord_tetris.wav", make_chord([261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50], duration=1.1, decay=3.5))
    write_wav("chord_tspin.wav", make_chord([329.63, 415.30, 493.88, 659.25, 830.61], duration=0.8, decay=4.2))
    
    # 4. Authentic NES Classic soundbank
    write_wav("nes_move.wav", make_nes_pulse(220.00, duration=0.022, duty=0.5))
    write_wav("nes_rotate.wav", make_nes_pulse(392.00, duration=0.035, duty=0.25))
    write_wav("nes_drop.wav", make_nes_noise(0.06))
    write_wav("nes_clear.wav", make_nes_fanfare())
    write_wav("nes_tetris.wav", make_chord([261.63, 329.63, 392.00, 523.25], duration=0.9, decay=3.8))
    
    print("DSP Soundbank synthesis complete!")

if __name__ == "__main__":
    main()
