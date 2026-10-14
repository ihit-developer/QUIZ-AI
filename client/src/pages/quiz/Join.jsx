import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { QrCode, ArrowRight, User, KeyRound, Zap, Clock } from 'lucide-react';
import { attemptService } from '../../services/attemptService';
import { quizService } from '../../services/quizService';
import { Card } from '../../components/ui/Card';
import { OTPInput } from '../../components/ui/OTPInput';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { soundManager } from '../../utils/soundManager';

export const Join = () => {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const normaliseJoinCode = (value = '') => {
    const text = String(value).trim();
    const urlMatch = text.match(/\/join\/([a-z0-9]{4,})/i);
    return (urlMatch?.[1] || text).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  };
  const [code, setCode] = useState(normaliseJoinCode(urlCode));
  const [guestName, setGuestName] = useState('');
  const [joining, setJoining] = useState(false);
  const [quizPreview, setQuizPreview] = useState(null); // { title, mode, timeLimitMinutes }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const debounceRef = useRef(null);
  const isJoiningWithCode = Boolean(code);

  // Fetch quiz preview whenever code reaches 6 chars
  useEffect(() => {
    if (code.length === 6) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setPreviewLoading(true);
        try {
          const res = await quizService.getQuizByCode(code.toUpperCase());
          if (res.success && res.data?.quiz) {
            setQuizPreview(res.data.quiz);
          } else {
            setQuizPreview(null);
          }
        } catch {
          setQuizPreview(null);
        } finally {
          setPreviewLoading(false);
        }
      }, 400);
    } else {
      setQuizPreview(null);
    }
    return () => clearTimeout(debounceRef.current);
  }, [code]);

  useEffect(() => {
    quizService.getAvailableSelfPacedQuizzes()
      .then((res) => setAvailableQuizzes(res.data?.quizzes || []))
      .catch(() => setAvailableQuizzes([]));
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length < 4) {
      toast.error('Please enter a valid 6-character room code.');
      return;
    }

    const guestAllowed = quizPreview?.settings?.allowGuests && !quizPreview?.settings?.requireLogin;
    if (!user && !guestAllowed) {
      toast.error('Please register or sign in to join and participate in this quiz!');
      navigate('/login', {
        state: { from: `/join/${code.trim().toUpperCase()}` },
      });
      return;
    }

    if (!user && !guestName.trim()) {
      toast.error('Please enter your name to join as a guest.');
      return;
    }

    // If quiz is Live mode — go directly to live room lobby, skip startAttempt
    if (quizPreview?.mode === 'live') {
      soundManager.resumeAudio().catch(() => {});
      navigate(`/live/${code.trim().toUpperCase()}`);
      return;
    }

    setJoining(true);
    try {
      const res = await attemptService.startAttempt({
        joinCode: code.trim().toUpperCase(),
        guestName: guestName.trim(),
      });

      if (res.success && res.data) {
        toast.success(`Entering exam room for ${res.data.quiz.title}!`);
        navigate(`/attempt/${res.data.attemptId}`, {
          state: { attemptData: res.data },
        });
      }
    } catch (err) {
      if (err.response?.data?.isLiveRoom && err.response?.data?.liveUrl) {
        toast.success('Entering Live Arena lobby! Waiting for host to start...');
        navigate(err.response.data.liveUrl);
      } else {
        toast.error(err.response?.data?.message || 'Failed to enter quiz room');
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: isJoiningWithCode ? 'calc(100dvh - 7rem)' : '75vh',
        padding: isJoiningWithCode ? '0.5rem 1rem' : '1rem',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: isJoiningWithCode ? '1.1rem 1.25rem' : '2.5rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: isJoiningWithCode ? '0.8rem' : '1.5rem',
          textAlign: 'center',
        }}
      >
        {!isJoiningWithCode && <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            backgroundColor: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--on-primary)',
            margin: '0 auto',
          }}
        >
          <QrCode size={26} />
        </div>}

        <div>
          {!isJoiningWithCode && <Badge variant="primary" style={{ marginBottom: '0.4rem' }}>
            PARTICIPANT GATEWAY
          </Badge>}
          <h2 style={{ fontSize: isJoiningWithCode ? '1.25rem' : '1.75rem', fontWeight: 900, color: 'var(--text)' }}>
            Enter Quiz Room
          </h2>
          {!isJoiningWithCode && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Enter your host's 6-character room code to join
          </p>}
        </div>

        {/* Quiz Preview Card */}
        {previewLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Checking room code...
          </div>
        )}
        {quizPreview && !previewLoading && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-card)',
              border: `2px solid ${quizPreview.mode === 'live' ? 'var(--primary)' : 'var(--border)'}`,
              backgroundColor: quizPreview.mode === 'live' ? 'var(--primary-soft)' : 'var(--surface-2)',
              display: 'flex', flexDirection: 'column', gap: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {quizPreview.mode === 'live' ? (
                <Badge variant="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Zap size={12} /> LIVE ARENA
                </Badge>
              ) : (
                <Badge variant="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={12} /> SELF-PACED
                </Badge>
              )}
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                {quizPreview.title}
              </span>
            </div>
            {quizPreview.mode === 'live' ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--primary-text)', fontWeight: 600, margin: 0 }}>
                ⚡ This is a live multiplayer quiz — you'll join the lobby and wait for the host to start.
              </p>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                📝 Self-paced exam · {quizPreview.settings?.timeLimitMinutes || 15} minute time limit
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: isJoiningWithCode ? '0.75rem' : '1.25rem', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem', textAlign: 'center' }}>
              6-CHARACTER JOIN CODE
            </label>
            <OTPInput
              length={6}
              value={code}
              onChange={(nextCode) => setCode(normaliseJoinCode(nextCode))}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', textAlign: 'center', marginTop: '0.3rem' }}>
              Paste a quiz code or the full join link here.
            </p>
          </div>

          {!user && quizPreview?.settings?.allowGuests && !quizPreview?.settings?.requireLogin && (
            <Input
              label="Your name"
              required
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="How should the host see you?"
            />
          )}

          {!user && !(quizPreview?.settings?.allowGuests && !quizPreview?.settings?.requireLogin) && (
            <div
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-card)',
                padding: '0.8rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.35rem' }}>
                Account Required to Join Quiz
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                Please register or sign in first so your attempts, scores, and certificates are tracked under your profile.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/register', { state: { from: `/join/${code}` } })}
                  style={{ minHeight: '38px', fontSize: '0.85rem' }}
                >
                  Register Account
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/login', { state: { from: `/join/${code}` } })}
                  style={{ minHeight: '38px', fontSize: '0.85rem' }}
                >
                  Sign In
                </Button>
              </div>
            </div>
          )}

          {user && (
            <div
              style={{
                backgroundColor: 'var(--surface-2)',
                borderRadius: 'var(--radius-btn)',
                padding: '0.55rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.85rem',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: 'var(--on-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                }}
              >
                {user.name.charAt(0)}
              </div>
              <div style={{ color: 'var(--text)' }}>
                Joining as <strong>{user.name}</strong> ({user.email})
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={joining}
            style={{ width: '100%', marginTop: '0.15rem', minHeight: '44px', fontSize: '0.95rem' }}
          >
            {joining
              ? 'Entering Room...'
              : quizPreview?.mode === 'live'
                ? <><Zap size={18} /> Enter Live Arena</>  
                : <><ArrowRight size={18} /> Enter Quiz Room</>}
          </Button>
        </form>

        {availableQuizzes.length > 0 && !code && (
          <div style={{ textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: '0.65rem' }}>Available self-paced quizzes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {availableQuizzes.slice(0, 5).map((quiz) => (
                <button key={quiz.id || quiz._id} type="button" onClick={() => setCode(quiz.joinCode)} style={{ textAlign: 'left', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', background: 'var(--surface-2)', color: 'var(--text)' }}>
                  <div style={{ fontWeight: 800 }}>{quiz.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Code: {quiz.joinCode} · {quiz.settings?.timeLimitMinutes || 15} min</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
