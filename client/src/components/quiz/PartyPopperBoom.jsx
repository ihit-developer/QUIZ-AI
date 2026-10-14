import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { soundManager } from '../../utils/soundManager';
import { Trophy, Sparkles, Flame, Volume2, PartyPopper } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

/**
 * PartyPopperBoom: High-energy celebration when quiz ends & final leaderboard arrives.
 * Fires explosive confetti cannons in pure RED palette and displays congratulations for top 3!
 */
export const PartyPopperBoom = ({ leaderboard = [] }) => {
  const [boomCount, setBoomCount] = useState(0);

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  const triggerCannonBlast = () => {
    soundManager.playPopperBoom();
    setBoomCount((prev) => prev + 1);

    try {
      // 1. Left party popper cannon blast (Emerald spectrum)
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 75,
        origin: { x: 0.05, y: 0.8 },
        colors: ['#087F5B', '#065F46', '#10B981', '#D1FAE5', '#FFFFFF', '#044E39'],
        ticks: 240,
        gravity: 0.9,
      });

      // 2. Right party popper cannon blast (Emerald spectrum)
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 75,
        origin: { x: 0.95, y: 0.8 },
        colors: ['#087F5B', '#065F46', '#10B981', '#D1FAE5', '#FFFFFF', '#064E3B'],
        ticks: 240,
        gravity: 0.9,
      });

      // 3. Center emerald starburst boom
      setTimeout(() => {
        confetti({
          particleCount: 90,
          spread: 100,
          origin: { x: 0.5, y: 0.45 },
          colors: ['#087F5B', '#10B981', '#A7F3D0', '#FFFFFF', '#044E39'],
          shapes: ['circle'],
          ticks: 220,
        });
      }, 250);

      // 4. Grand victory shower
      setTimeout(() => {
        confetti({
          particleCount: 60,
          spread: 120,
          origin: { x: 0.5, y: 0.15 },
          colors: ['#087F5B', '#065F46', '#10B981', '#FFFFFF'],
          ticks: 260,
          gravity: 0.7,
        });
      }, 500);
    } catch {}
  };

  useEffect(() => {
    // Blast cannons immediately on mount
    triggerCannonBlast();
  }, []);

  return (
    <div style={{ width: '100%', marginBottom: '1.5rem' }}>
      <Card
        style={{
          border: '2px solid var(--primary)',
          borderRadius: '1.25rem',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--surface)',
        }}
      >
        {/* Floating party poppers emoji burst */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '2.5rem', display: 'inline-block' }}>🎉</span>
          <span style={{ fontSize: '2.8rem', display: 'inline-block' }}>💥</span>
          <span style={{ fontSize: '2.5rem', display: 'inline-block' }}>🎉</span>
        </div>

        {/* Title */}
        <div style={{ display: 'inline-block', padding: '0.35rem 1.2rem', borderRadius: '9999px', background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 900, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          💥 PARTY POPPER BOOM CELEBRATION! 💥
        </div>

        <h2
          style={{
            fontSize: '2rem',
            fontWeight: 900,
            lineHeight: 1.2,
            color: 'var(--text)',
            marginBottom: '0.5rem',
          }}
        >
          CONGRATULATIONS TO THE CHAMPIONS!
        </h2>

        {/* Top 1 Highlight Box */}
        {top1 && (
          <div
            style={{
              margin: '1.25rem auto',
              maxWidth: '520px',
              background: 'var(--hero)',
              color: 'var(--on-primary)',
              borderRadius: '1rem',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  border: '2px solid var(--border)',
                }}
              >
                👑
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--on-primary)', opacity: 0.9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  🏆 1ST PLACE WINNER & TOURNAMENT CHAMPION
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--on-primary)' }}>
                  {top1.name}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--on-primary)' }}>
                {top1.score} <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>PTS</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--on-primary)', fontWeight: 700, opacity: 0.9 }}>
                ✨ Grand Victory!
              </div>
            </div>
          </div>
        )}

        {/* 2nd and 3rd Honor Row */}
        {(top2 || top3) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            {top2 && (
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1.5px solid var(--primary)',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>🥈</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>2ND PLACE</div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)' }}>{top2.name}</div>
                </div>
                <span style={{ fontWeight: 800, color: 'var(--primary)', marginLeft: '0.5rem' }}>
                  {top2.score} pts
                </span>
              </div>
            )}

            {top3 && (
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>🥉</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>3RD PLACE</div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)' }}>{top3.name}</div>
                </div>
                <span style={{ fontWeight: 800, color: 'var(--primary)', marginLeft: '0.5rem' }}>
                  {top3.score} pts
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action button to re-fire party popper */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
          <Button
            variant="primary"
            onClick={triggerCannonBlast}
            style={{
              padding: '0.75rem 1.8rem',
              fontSize: '0.95rem',
              fontWeight: 800,
            }}
          >
            <PartyPopper size={18} /> 🎉 Shoot Party Popper Boom Again! 💥
          </Button>
        </div>
      </Card>
    </div>
  );
};
