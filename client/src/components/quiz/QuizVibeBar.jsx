import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Sparkles } from 'lucide-react';
import { soundManager } from '../../utils/soundManager';

/**
 * QuizVibeBar: Interactive control widget for enjoyment music and falling sprinkles.
 * Displays dancing red soundwave equalizer, volume/mute toggle, and sprinkles switch.
 * 60fps compliant: zero blur, zero backdrop-filter, pure semantic tokens.
 */
export const QuizVibeBar = ({
  sprinklesActive = true,
  onToggleSprinkles,
}) => {
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);
  const [isPlaying, setIsPlaying] = useState(soundManager.bgmPlaying);

  useEffect(() => {
    const unsubscribe = soundManager.subscribe((state) => {
      setIsMuted(state.isMuted);
      setIsPlaying(state.bgmPlaying);
    });
    return unsubscribe;
  }, []);

  const handleToggleSound = () => {
    soundManager.resumeAudio().then(() => {
      const nextMuted = soundManager.toggleMute();
      setIsMuted(nextMuted);
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: 'var(--surface-2)',
        border: '1.5px solid var(--border)',
        borderRadius: '0.75rem',
        padding: '0.65rem 1rem',
      }}
    >
      {/* Left: Music Status with Dancing Red Equalizer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <button
          onClick={handleToggleSound}
          style={{
            cursor: 'pointer',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: isMuted ? 'var(--surface)' : 'var(--primary)',
            border: `1.5px solid ${isMuted ? 'var(--border)' : 'var(--primary)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isMuted ? 'var(--text-muted)' : 'var(--on-primary)',
            transition: 'background 0.15s ease',
          }}
          title={isMuted ? 'Unmute Enjoyment Music' : 'Mute Enjoyment Music'}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' }}>
              {isMuted ? 'Music Muted' : 'Enjoyment Music'}
            </span>

            {/* Dancing Red Equalizer Bars */}
            {!isMuted && isPlaying && (
              <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                <span className="eq-bar eq-bar-1" />
                <span className="eq-bar eq-bar-2" />
                <span className="eq-bar eq-bar-3" />
                <span className="eq-bar eq-bar-4" />
              </div>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {isMuted ? 'Click to enjoy music' : 'Upbeat game groove active 🎶'}
          </div>
        </div>
      </div>

      {/* Right Controls: Music Toggle + Sprinkles Shower Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={handleToggleSound}
          style={{
            padding: '0.4rem 0.85rem',
            fontSize: '0.78rem',
            borderRadius: '0.5rem',
            fontWeight: 800,
            background: isMuted ? 'var(--surface)' : 'var(--primary-soft)',
            border: `1px solid ${isMuted ? 'var(--border)' : 'var(--primary)'}`,
            color: isMuted ? 'var(--text-muted)' : 'var(--primary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          {isMuted ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {isMuted ? 'Play Music' : 'Mute Music'}
        </button>

        {onToggleSprinkles && (
          <button
            onClick={onToggleSprinkles}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.78rem',
              borderRadius: '0.5rem',
              fontWeight: 800,
              background: sprinklesActive ? 'var(--primary-soft)' : 'var(--surface)',
              border: `1px solid ${sprinklesActive ? 'var(--primary)' : 'var(--border)'}`,
              color: sprinklesActive ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title="Toggle Falling Sprinkles Shower from Top"
          >
            <Sparkles size={13} />
            {sprinklesActive ? 'Sprinkles: ON ✨' : 'Sprinkles: OFF'}
          </button>
        )}
      </div>

      <style>{`
        .eq-bar {
          width: 3px;
          background: var(--primary);
          border-radius: 2px;
          animation: eqDance 0.8s ease-in-out infinite alternate;
        }
        .eq-bar-1 { height: 6px; animation-delay: 0.1s; }
        .eq-bar-2 { height: 12px; animation-delay: 0.3s; }
        .eq-bar-3 { height: 9px; animation-delay: 0.2s; }
        .eq-bar-4 { height: 14px; animation-delay: 0.4s; }

        @keyframes eqDance {
          0% { height: 4px; }
          100% { height: 14px; }
        }
      `}</style>
    </div>
  );
};
