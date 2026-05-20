import { useRef, useEffect } from 'react';
import { Howl, Howler } from 'howler';

/**
 * Sound system using Howler.js
 * Uses royalty-free CC0 sounds + Web Audio synthesis for SFX (no external files needed for SFX).
 *
 * For background music, the system will look for /assets/music/heist-theme.mp3
 * If not found, it gracefully degrades (no music, but SFX still work).
 */
export const useSound = () => {
  const bgMusic = useRef(null);
  const audioContext = useRef(null);

  useEffect(() => {
    // Initialize background music (gracefully fail if not present)
    try {
      bgMusic.current = new Howl({
        src: ['/assets/music/heist-theme.mp3', '/assets/music/heist-theme.ogg'],
        loop: true,
        volume: 0.25,
        html5: true,
        onloaderror: () => {
          console.info('Background music not found. Add a file at public/assets/music/heist-theme.mp3 to enable.');
        }
      });
    } catch (e) {
      console.warn('Howler init failed:', e);
    }

    // Initialize Web Audio for SFX
    try {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }

    return () => {
      if (bgMusic.current) {
        bgMusic.current.stop();
        bgMusic.current.unload();
      }
    };
  }, []);

  const playBackground = () => {
    if (bgMusic.current && !bgMusic.current.playing()) {
      try { bgMusic.current.play(); } catch (e) { /* ignore */ }
    }
  };

  const stopBackground = () => {
    if (bgMusic.current) {
      try { bgMusic.current.stop(); } catch (e) { /* ignore */ }
    }
  };

  const mute = () => { Howler.mute(true); };
  const unmute = () => { Howler.mute(false); };

  // Synthesized SFX using Web Audio API
  const playTone = (freq, duration, type = 'sine', volume = 0.15) => {
    const ctx = audioContext.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const playCorrect = () => {
    playTone(523.25, 0.1, 'sine', 0.15); // C5
    setTimeout(() => playTone(659.25, 0.1, 'sine', 0.15), 80); // E5
    setTimeout(() => playTone(783.99, 0.2, 'sine', 0.15), 160); // G5
  };

  const playWrong = () => {
    playTone(200, 0.2, 'sawtooth', 0.1);
    setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.1), 100);
  };

  const playSteal = () => {
    // Cha-ching coin sound
    playTone(800, 0.05, 'square', 0.1);
    setTimeout(() => playTone(1200, 0.05, 'square', 0.1), 40);
    setTimeout(() => playTone(1600, 0.1, 'sine', 0.12), 80);
  };

  const playVictory = () => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, 'sine', 0.2), i * 120);
    });
  };

  const playTick = () => {
    playTone(1000, 0.03, 'square', 0.05);
  };

  return {
    playBackground,
    stopBackground,
    mute,
    unmute,
    playCorrect,
    playWrong,
    playSteal,
    playVictory,
    playTick
  };
};
