import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  Sparkles,
  Zap,
  BrainCircuit,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Award,
  Users,
  Flame,
  PlusCircle,
  LayoutDashboard,
  CheckCircle2,
  ChevronDown,
  Camera,
} from 'lucide-react';

export const Home = () => {
  const { user } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);
  const navigate = useNavigate();

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/join/${joinCode.trim().toUpperCase()}`);
    }
  };

  const faqs = [
    {
      q: 'How do students join a live quiz?',
      a: 'Students simply enter the 6-character room code on the homepage or scan the unique QR code projected by the host. No mandatory registration is needed for instant participant entry.',
    },
    {
      q: 'How does the AI Difficulty Prediction engine work?',
      a: 'Our statistical regression engine models response times, error patterns, and Item Response Theory (IRT) parameters to forecast exam completion scores and flag struggling students early.',
    },
    {
      q: 'Can hosts generate questions automatically with AI?',
      a: 'Yes. Hosts can input any topic, target grade level, and question count into our Anthropic Claude AI wizard to generate multiple-choice questions with full explanations in seconds.',
    },
    {
      q: 'Does Quizese support self-paced homework quizzes?',
      a: 'Absolutely. Quizzes can be launched in real-time synchronous Live Mode or published for asynchronous Self-Paced completion with anti-cheat detection and strict time limits.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4.5rem', padding: '1rem 0 3.5rem' }}>
      {/* 1. Hero Section */}
      <section
        style={{
          textAlign: 'center',
          maxWidth: '960px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.75rem',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1rem',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--primary-soft)',
            border: '1px solid var(--border)',
            color: 'var(--primary-text)',
            fontSize: '0.82rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            boxShadow: '0 2px 8px rgba(225, 29, 72, 0.08)',
          }}
        >
          <Sparkles size={14} />
          <span>Next-Gen AI Multiplayer Assessment Platform</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5.5vw, 4.4rem)',
            fontWeight: 900,
            lineHeight: 1.12,
            letterSpacing: '-0.04em',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Supercharge Live Exams with <br />
          <span style={{ 
            background: 'linear-gradient(135deg, var(--primary) 20%, var(--hero) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block'
          }}>
            AI Trajectory & Real-Time Arena
          </span>
        </h1>

        <p
          style={{
            fontSize: '1.2rem',
            color: 'var(--text-muted)',
            maxWidth: '700px',
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          Generate smart questions with Claude AI, track live multi-student attempt telemetry, forecast performance curves, and celebrate champions with dynamic podium rankings.
        </p>

        {/* Hero Action: Host Studio vs Participant Join */}
        {user && (user.role === 'host' || user.role === 'admin') ? (
          <Card
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.25rem',
              padding: '1.5rem 2.25rem',
              marginTop: '0.75rem',
              flexWrap: 'wrap',
              backgroundColor: 'var(--surface-2)',
              border: '1.5px solid var(--border)',
              borderRadius: '24px',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div style={{ textAlign: 'left', marginRight: '0.5rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--primary-text)', letterSpacing: '0.06em' }}>
                HOST STUDIO READY
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.15rem' }}>
                Welcome back, {user.name}! Manage your cohort sessions
              </div>
            </div>
            <Link to="/create-quiz" className="btn-primary">
              <PlusCircle size={18} /> Create New Quiz
            </Link>
            <Link to="/dashboard" className="btn-secondary">
              <LayoutDashboard size={18} /> Host Dashboard
            </Link>
          </Card>
        ) : (
          /* Join Quiz Code Input with Scan QR Trigger */
          <form
            onSubmit={handleJoinSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.45rem',
              gap: '0.5rem',
              maxWidth: '540px',
              width: '100%',
              marginTop: '0.5rem',
              backgroundColor: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--card-shadow-hover)',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="ENTER 6-DIGIT CODE (e.g. JS8821)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.85rem 1.25rem',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: 'var(--text)',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate('/join')}
              className="btn-secondary"
              style={{ padding: '0.65rem 1rem', minHeight: '44px' }}
              title="Open QR Camera Scanner"
              aria-label="Scan QR Code"
            >
              <Camera size={18} />
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '0.75rem 1.75rem', fontSize: '0.98rem', whiteSpace: 'nowrap' }}
            >
              Join <ArrowRight size={17} />
            </button>
          </form>
        )}

        {/* Hero Flat SVG Illustration in Emerald & Warm Cream Tones */}
        <div style={{ width: '100%', maxWidth: '640px', marginTop: '1.5rem' }}>
          <svg viewBox="0 0 640 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
            <rect x="20" y="20" width="600" height="200" rx="16" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1.5" />
            {/* Header bar */}
            <circle cx="50" cy="45" r="5" fill="var(--primary)" />
            <circle cx="68" cy="45" r="5" fill="var(--border)" />
            <circle cx="86" cy="45" r="5" fill="var(--border)" />
            <rect x="110" y="40" width="120" height="10" rx="5" fill="var(--border)" />
            {/* Split cards */}
            <rect x="50" y="75" width="250" height="120" rx="12" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
            <rect x="70" y="95" width="100" height="10" rx="5" fill="var(--primary)" />
            <rect x="70" y="115" width="180" height="8" rx="4" fill="var(--border)" />
            <rect x="70" y="130" width="150" height="8" rx="4" fill="var(--border)" />
            <rect x="70" y="155" width="80" height="24" rx="6" fill="var(--primary-soft)" />
            {/* Leaderboard Podiums */}
            <rect x="340" y="75" width="250" height="120" rx="12" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
            <rect x="365" y="130" width="55" height="50" rx="4" fill="var(--surface-2)" stroke="var(--border)" />
            <text x="385" y="160" fill="var(--text-muted)" fontSize="12" fontWeight="800">2</text>
            <rect x="435" y="105" width="60" height="75" rx="4" fill="var(--primary)" />
            <text x="460" y="145" fill="var(--on-primary)" fontSize="14" fontWeight="900">1</text>
            <rect x="510" y="145" width="55" height="35" rx="4" fill="var(--primary-soft)" stroke="var(--border)" />
            <text x="530" y="168" fill="var(--primary-text)" fontSize="12" fontWeight="800">3</text>
          </svg>
        </div>
      </section>

      {/* 2. Three Feature Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.5rem' }}>
        <Card hoverLift style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--primary-soft) 0%, var(--surface-2) 100%)',
              border: '1px solid var(--border)',
              color: 'var(--primary-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(8, 127, 91, 0.08)',
            }}
          >
            <BrainCircuit size={26} />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            AI Question Generator
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
            Generate comprehensive question banks across subjects and difficulty levels using Claude AI in under ten seconds.
          </p>
        </Card>

        <Card hoverLift style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--primary-soft) 0%, var(--surface-2) 100%)',
              border: '1px solid var(--border)',
              color: 'var(--primary-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(225, 29, 72, 0.08)',
            }}
          >
            <Flame size={26} />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            Live Multiplayer Arena
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
            Host synchronous multiplayer rooms with synchronized countdown timers, instantaneous socket feedback, and podium celebrations.
          </p>
        </Card>

        <Card hoverLift style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--primary-soft) 0%, var(--surface-2) 100%)',
              border: '1px solid var(--border)',
              color: 'var(--primary-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(225, 29, 72, 0.08)',
            }}
          >
            <ShieldCheck size={26} />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            IRT Difficulty Prediction
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
            Identify at-risk learners early in the attempt. Statistical models project end-of-exam grades before test conclusion.
          </p>
        </Card>
      </section>

      {/* 3. Three-Step "How It Works" Strip */}
      <section
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '3rem 2.25rem',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 2.75rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--primary-text)', letterSpacing: '0.06em' }}>
            SIMPLE 3-STEP WORKFLOW
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', marginTop: '0.4rem', letterSpacing: '-0.03em' }}>
            Built for Educators & Students
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--hero))',
                color: 'var(--on-primary)',
                fontWeight: 900,
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--btn-shadow)',
              }}
            >
              1
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>Create or Import</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Use our AI prompt generator or builder wizard to configure question types, scoring rules, and anti-cheat settings.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--hero), #6b0d24)',
                color: 'var(--on-primary)',
                fontWeight: 900,
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(136, 19, 55, 0.3)',
              }}
            >
              2
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>Project Code & Join</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Students scan the projected QR code or enter the 6-character room code on any phone, tablet, or browser with zero friction.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--hero))',
                color: 'var(--on-primary)',
                fontWeight: 900,
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--btn-shadow)',
              }}
            >
              3
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>Assess & Celebrate</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Deliver instantaneous question feedback, review real-time cohort error rates, and celebrate top podium finishes.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Live Platform Stats Row */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <Card hoverLift style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
          <div style={{ 
            fontSize: '2.75rem', 
            fontWeight: 900, 
            background: 'linear-gradient(135deg, var(--primary), var(--hero))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}>
            99.4%
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.35rem' }}>
            Platform Uptime
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Socket WebSocket SLA</div>
        </Card>

        <Card hoverLift style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
          <div style={{ 
            fontSize: '2.75rem', 
            fontWeight: 900, 
            background: 'linear-gradient(135deg, var(--primary), var(--hero))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}>
            &lt; 50ms
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.35rem' }}>
            Live Answer Latency
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Real-time telemetry</div>
        </Card>

        <Card hoverLift style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
          <div style={{ 
            fontSize: '2.75rem', 
            fontWeight: 900, 
            background: 'linear-gradient(135deg, var(--primary), var(--hero))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}>
            100%
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.35rem' }}>
            Emerald SaaS Palette
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Warm Cream & Accessible</div>
        </Card>

        <Card hoverLift style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
          <div style={{ 
            fontSize: '2.75rem', 
            fontWeight: 900, 
            background: 'linear-gradient(135deg, var(--primary), var(--hero))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}>
            60 FPS
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.35rem' }}>
            Jank-Free Scrolling
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Hardware accelerated</div>
        </Card>
      </section>

      {/* 5. FAQ Accordion */}
      <section style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text)' }}>
            Frequently Asked Questions
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.35rem' }}>
            Everything you need to know about Quizese multiplayer examinations
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  style={{
                    width: '100%',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'var(--text)',
                  }}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={18}
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      color: 'var(--text-muted)',
                    }}
                  />
                </button>
                {isOpen && (
                  <div
                    style={{
                      padding: '0 1.5rem 1.25rem 1.5rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.92rem',
                      lineHeight: 1.6,
                      borderTop: '1px solid var(--border)',
                      paddingTop: '0.85rem',
                    }}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
