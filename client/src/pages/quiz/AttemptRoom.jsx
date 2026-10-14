import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { soundManager } from '../../utils/soundManager';
import {
  Clock,
  ShieldAlert,
  Flag,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Send,
  Sparkles,
  Maximize,
  Volume2,
  VolumeX,
  Check,
} from 'lucide-react';
import { attemptService } from '../../services/attemptService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TimerRing } from '../../components/ui/TimerRing';
import { ProgressBar } from '../../components/ui/ProgressBar';
import toast from 'react-hot-toast';

export const AttemptRoom = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const attemptData = location.state?.attemptData;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(
    (attemptData?.quiz?.settings?.timeLimitMinutes || 15) * 60
  );
  const [isMuted, setIsMuted] = useState(false);

  // Per-Question countdown timer in seconds
  const currentQuestionLimit = (attemptData?.questions && attemptData.questions[currentIdx]?.timeLimitSeconds) || 30;
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(currentQuestionLimit);

  const [violations, setViolations] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const startTimeRef = useRef(Date.now());
  const maxViolations = attemptData?.quiz?.settings?.antiCheat?.maxViolationsAllowed || 3;

  // 1. Overall Quiz Countdown Timer & Background Ambient Game Groove
  useEffect(() => {
    if (!attemptData) return;

    soundManager.startQuizBGM();

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit('timed_out');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      soundManager.stopBGM();
    };
  }, [attemptData]);

  // 2. Per-Question Timer
  useEffect(() => {
    if (!attemptData?.quiz?.settings?.perQuestionTimer || !attemptData?.questions || attemptData.questions.length === 0) return;

    const qSec = attemptData.questions[currentIdx]?.timeLimitSeconds || 30;
    setQuestionSecondsLeft(qSec);

    const qTimer = setInterval(() => {
      setQuestionSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(qTimer);
          if (currentIdx < attemptData.questions.length - 1) {
            toast('Question time expired. Moving to next question', { icon: '⏳' });
            setCurrentIdx((curr) => curr + 1);
          } else {
            toast.success('Final question time expired. Auto-submitting exam!');
            handleFinalSubmit('timed_out');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(qTimer);
  }, [currentIdx, attemptData]);

  // 3. Periodic Autosave every 8 seconds
  useEffect(() => {
    if (!attemptData?.attemptId) return;

    const autoSaveInterval = setInterval(() => {
      const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
        questionId: qId,
        selectedOptions: Array.isArray(val) ? val : [val],
        flaggedForReview: !!flagged[qId],
      }));

      attemptService.autosaveAttempt(attemptData.attemptId, {
        answers: formattedAnswers,
      }).catch(() => {});
    }, 8000);

    return () => clearInterval(autoSaveInterval);
  }, [answers, flagged, attemptData]);

  // 4. Anti-Cheat Handlers
  useEffect(() => {
    if (!attemptData) return;

    const antiCheat = attemptData.quiz?.settings?.antiCheat;

    const handleVisibilityChange = () => {
      if (document.hidden && antiCheat?.detectTabSwitch) {
        handleViolation('Tab Switch / Window Blur detected');
      }
    };

    const handleContextMenu = (e) => {
      if (antiCheat?.disableCopyPaste) {
        e.preventDefault();
        toast.error('Context menu / Copy-paste is disabled during exams.', { id: 'no-copy' });
      }
    };

    const handleCopy = (e) => {
      if (antiCheat?.disableCopyPaste) {
        e.preventDefault();
        toast.error('Copying exam questions is strictly prohibited.', { id: 'no-copy' });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
    };
  }, [attemptData, violations]);

  const handleViolation = (details) => {
    const nextCount = violations + 1;
    setViolations(nextCount);

    toast.error(`Security Warning (${nextCount}/${maxViolations}): ${details}`, {
      duration: 4000,
      icon: '🛡️',
    });

    if (attemptData?.attemptId) {
      attemptService.autosaveAttempt(attemptData.attemptId, {
        violation: { type: 'TAB_BLUR', details },
      });
    }

    if (nextCount >= maxViolations) {
      toast.error('Maximum violations reached. Auto-submitting quiz.');
      handleFinalSubmit('disqualified');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Option selection with Red-only confetti celebration
  const handleSelectOption = (questionId, optionText) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionText,
    }));

    soundManager.playCorrect();

    try {
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.2 },
        colors: ['#087F5B', '#065F46', '#10B981', '#A7F3D0', '#FFFFFF', '#D1FAE5'],
        ticks: 150,
        gravity: 0.9,
      });
    } catch {}

    if (currentIdx < (attemptData?.questions?.length || 0) - 1) {
      setTimeout(() => {
        setCurrentIdx((prevIdx) => Math.min((attemptData?.questions?.length || 1) - 1, prevIdx + 1));
      }, 350);
    }
  };

  const toggleFlag = (questionId) => {
    setFlagged((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleFinalSubmit = async (reason = 'normal') => {
    if (submitting) return;
    setSubmitting(true);
    soundManager.stopBGM();
    soundManager.playVictoryPopper();

    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const formattedAnswers = attemptData.questions.map((q) => {
      const val = answers[q.id || q._id];
      return {
        questionId: q.id || q._id,
        selectedOptions: val ? (Array.isArray(val) ? val : [val]) : [],
        flaggedForReview: !!flagged[q.id || q._id],
      };
    });

    try {
      const res = await attemptService.submitAttempt(attemptData.attemptId, {
        answers: formattedAnswers,
        durationSeconds,
      });

      if (res.success) {
        toast.success('Exam submitted successfully!');
        navigate(`/results/${attemptData.attemptId}`, {
          state: { resultData: res.data },
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error submitting attempt');
      setSubmitting(false);
    }
  };

  if (!attemptData || !attemptData.questions || attemptData.questions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>Exam Session Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Please enter through the join page with a valid room code.</p>
        <Button onClick={() => navigate('/join')} style={{ marginTop: '1.5rem' }}>
          Back to Join Page
        </Button>
      </div>
    );
  }

  const currentQ = attemptData.questions[currentIdx];
  const qId = currentQ.id || currentQ._id;
  const selectedAns = answers[qId];
  const isFlagged = flagged[qId];
  const progressPercent = ((currentIdx + 1) / attemptData.questions.length) * 100;

  const formatMinutes = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* 1. Exam Control Bar */}
      <Card
        style={{
          padding: '1.25rem 1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {attemptData.quiz?.settings?.perQuestionTimer && (
            <TimerRing
              secondsLeft={questionSecondsLeft}
              totalSeconds={currentQuestionLimit}
              size={52}
            />
          )}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              QUESTION #{currentIdx + 1} OF {attemptData.questions.length}
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text)' }}>
              {attemptData.quiz?.title || 'Live Assessment'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Overall Quiz Countdown Timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.88rem',
              fontWeight: 800,
              color: timeRemaining < 120 ? 'var(--primary-text)' : 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Clock size={16} color="var(--primary)" />
            <span>Time Left: {formatMinutes(timeRemaining)}</span>
          </div>

          {/* Sound Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              const muted = soundManager.toggleMute();
              setIsMuted(muted);
            }}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 'var(--radius-btn)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{isMuted ? 'Muted' : 'Sound'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 'var(--radius-btn)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
            aria-label="Toggle Fullscreen"
          >
            <Maximize size={16} />
            <span>{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
          </button>
        </div>
      </Card>

      {/* Slim Progress Bar */}
      <ProgressBar progress={progressPercent} height={5} />

      {/* 2. Main Question Surface & Answer Choices */}
      <Card style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <span className="badge badge-primary">{currentQ.points || 10} Points</span>
              <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                {currentQ.difficulty || 'medium'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.45 }}>
              {currentQ.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => toggleFlag(qId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              border: isFlagged ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              backgroundColor: isFlagged ? 'var(--primary-soft)' : 'var(--surface-2)',
              color: isFlagged ? 'var(--primary-text)' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Flag size={14} /> {isFlagged ? 'Flagged' : 'Flag Question'}
          </button>
        </div>

        {/* Large Tappable Option Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
          {currentQ.options?.map((opt, optIdx) => {
            const isSelected = selectedAns === opt.text;
            const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

            return (
              <div
                key={optIdx}
                onClick={() => handleSelectOption(qId, opt.text)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1.15rem 1.4rem',
                  borderRadius: 'var(--radius-card)',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--primary)' : 'var(--surface-2)',
                  color: isSelected ? 'var(--on-primary)' : 'var(--text)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                  boxShadow: isSelected ? 'var(--card-shadow)' : 'none',
                  transition: 'all 0.15s ease',
                  minHeight: '62px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--surface)',
                    border: isSelected ? 'none' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    color: isSelected ? 'var(--on-primary)' : 'var(--primary-text)',
                  }}
                >
                  {isSelected ? <Check size={18} /> : letter}
                </div>
                <span style={{ fontSize: '1rem', fontWeight: isSelected ? 700 : 500, flex: 1 }}>
                  {opt.text}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. Question Palette Drawer */}
      <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            QUESTION NAVIGATION PALETTE
          </span>
          <div style={{ display: 'flex', gap: '0.85rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} /> Answered
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--primary)', backgroundColor: 'var(--primary-soft)' }} /> Flagged
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--surface-2)' }} /> Unanswered
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {attemptData.questions.map((q, idx) => {
            const thisQId = q.id || q._id;
            const isAns = Boolean(answers[thisQId]);
            const isFlg = Boolean(flagged[thisQId]);
            const isCurr = idx === currentIdx;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-btn)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  fontVariantNumeric: 'tabular-nums',
                  cursor: 'pointer',
                  backgroundColor: isCurr
                    ? 'var(--primary)'
                    : isAns
                    ? 'var(--hero)'
                    : isFlg
                    ? 'var(--primary-soft)'
                    : 'var(--surface-2)',
                  color: isCurr || isAns ? 'var(--on-primary)' : isFlg ? 'var(--primary-text)' : 'var(--text)',
                  border: isCurr
                    ? '2px solid var(--ring)'
                    : isFlg
                    ? '2px solid var(--primary)'
                    : '1px solid var(--border)',
                  transition: 'all 0.12s ease',
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 4. Action Bar (Sticky on Mobile) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem 0',
        }}
      >
        <Button
          variant="secondary"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((c) => Math.max(0, c - 1))}
        >
          <ArrowLeft size={16} /> Previous
        </Button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {currentIdx < attemptData.questions.length - 1 ? (
            <Button onClick={() => setCurrentIdx((c) => c + 1)}>
              Next Question <ArrowRight size={16} />
            </Button>
          ) : (
            <Button
              onClick={() => handleFinalSubmit('manual')}
              disabled={submitting}
              style={{ backgroundColor: 'var(--hero)' }}
            >
              <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Exam'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
