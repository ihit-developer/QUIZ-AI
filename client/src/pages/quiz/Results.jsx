import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Home,
  Download,
  AlertCircle,
  Filter,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { attemptService } from '../../services/attemptService';
import { analyticsService } from '../../services/analyticsService';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { soundManager } from '../../utils/soundManager';

export const Results = () => {
  const { attemptId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [result, setResult] = useState(location.state?.result || null);
  const [quiz, setQuiz] = useState(location.state?.quiz || null);
  const [loading, setLoading] = useState(!location.state?.result);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'correct' | 'incorrect'

  useEffect(() => {
    if (!result && attemptId) {
      attemptService
        .getAttemptById(attemptId)
        .then((res) => {
          if (res.success && res.data) {
            setResult(res.data.result);
            setQuiz(res.data.quiz);
          }
        })
        .catch(() => {
          toast.error('Could not load attempt details.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [attemptId, result]);

  useEffect(() => {
    if (result && result.passed) {
      soundManager.playPopperBoom();
      try {
        confetti({
          particleCount: 80,
          spread: 85,
          origin: { y: 0.35 },
          colors: ['#E11D48', '#BE123C', '#F43F5E', '#FDA4AF', '#FFFFFF', '#0C0A0A'],
        });
      } catch {}
    }
  }, [result]);

  const evaluatedAnswers = result?.evaluatedAnswers || [];
  const correctCount = useMemo(() => {
    return evaluatedAnswers.filter((a) => a.isCorrect).length;
  }, [evaluatedAnswers]);

  const filteredAnswers = useMemo(() => {
    if (filterMode === 'correct') return evaluatedAnswers.filter((a) => a.isCorrect);
    if (filterMode === 'incorrect') return evaluatedAnswers.filter((a) => !a.isCorrect);
    return evaluatedAnswers;
  }, [evaluatedAnswers, filterMode]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.1rem' }}>
          Calculating your score and exam metrics...
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
        <Card style={{ padding: '3rem 2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.5rem' }}>
            Result Records Unavailable
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Please complete an assessment or return to your dashboard.
          </p>
          <Button variant="primary" onClick={() => navigate('/dashboard')} fullWidth>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const isPassed = result.passed;
  const studentName = user?.name || 'Student';
  const percentage = Math.round(result.percentage || 0);

  // SVG circular ring calculation
  const ringRadius = 58;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Score Summary Card */}
      <Card style={{ padding: '2.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        {/* SVG Score Ring with Percentage in Center */}
        <div style={{ position: 'relative', width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="75"
              cy="75"
              r={ringRadius}
              stroke="var(--border)"
              strokeWidth="10"
              fill="transparent"
            />
            <circle
              cx="75"
              cy="75"
              r={ringRadius}
              stroke="var(--primary)"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
              {percentage}%
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px', textTransform: 'uppercase' }}>
              {isPassed ? 'Passed' : 'Score'}
            </span>
          </div>
        </div>

        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 1rem', borderRadius: '9999px', background: isPassed ? 'var(--hero)' : 'var(--surface-2)', border: isPassed ? 'none' : '1.5px solid var(--primary)', color: isPassed ? 'var(--on-primary)' : 'var(--primary)', fontWeight: 800, fontSize: '0.85rem' }}>
            {isPassed ? <Award size={16} /> : <XCircle size={16} />}
            {isPassed ? 'PASSED & CERTIFIED' : 'BELOW PASSING THRESHOLD'}
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', marginTop: '0.75rem' }}>
            {quiz?.title || 'Assessment Completed'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Candidate: <strong style={{ color: 'var(--text)' }}>{studentName}</strong> • {result.score} of {result.totalPointsPossible} Points Earned
          </p>
        </div>

        {/* 4-Stat Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '1rem',
            width: '100%',
            maxWidth: '640px',
          }}
        >
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>TIME TAKEN</div>
            <div style={{ fontWeight: 900, fontSize: '1.25rem', marginTop: '0.25rem', color: 'var(--text)' }}>
              {Math.floor((result.durationSeconds || 0) / 60)}m {(result.durationSeconds || 0) % 60}s
            </div>
          </div>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>ACCURACY</div>
            <div style={{ fontWeight: 900, fontSize: '1.25rem', marginTop: '0.25rem', color: 'var(--primary)' }}>
              {correctCount} / {evaluatedAnswers.length}
            </div>
          </div>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>PASS CRITERIA</div>
            <div style={{ fontWeight: 900, fontSize: '1.25rem', marginTop: '0.25rem', color: 'var(--text)' }}>
              {quiz?.settings?.passingScorePercent || 60}%
            </div>
          </div>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>STATUS</div>
            <div style={{ fontWeight: 900, fontSize: '1.25rem', marginTop: '0.25rem', color: isPassed ? 'var(--primary)' : 'var(--text-muted)' }}>
              {isPassed ? 'Certified' : 'Review Required'}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
          {isPassed && (
            <a
              href={analyticsService.downloadCertificateUrl({
                studentName,
                quizTitle: quiz?.title || 'Quizese Certificate',
                percentage: result.percentage,
              })}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Button variant="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Download size={16} /> Download Certificate (PDF)
              </Button>
            </a>
          )}
          <Button variant="secondary" onClick={() => navigate('/join')}>
            <RotateCcw size={16} /> Attempt Another Quiz
          </Button>
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <Home size={16} /> Dashboard
          </Button>
        </div>
      </Card>

      {/* Answer Breakdown Header & Filter */}
      <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)' }}>
              Question Breakdown & Detailed Review
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Compare your submitted answers with verified solutions
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--surface-2)', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setFilterMode('all')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '0.35rem',
                border: 'none',
                background: filterMode === 'all' ? 'var(--primary)' : 'transparent',
                color: filterMode === 'all' ? 'var(--on-primary)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              All ({evaluatedAnswers.length})
            </button>
            <button
              onClick={() => setFilterMode('correct')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '0.35rem',
                border: 'none',
                background: filterMode === 'correct' ? 'var(--primary)' : 'transparent',
                color: filterMode === 'correct' ? 'var(--on-primary)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Correct ({correctCount})
            </button>
            <button
              onClick={() => setFilterMode('incorrect')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '0.35rem',
                border: 'none',
                background: filterMode === 'incorrect' ? 'var(--primary)' : 'transparent',
                color: filterMode === 'incorrect' ? 'var(--on-primary)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Incorrect ({evaluatedAnswers.length - correctCount})
            </button>
          </div>
        </div>

        {/* Questions List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredAnswers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No questions found for the selected filter.
            </div>
          ) : (
            filteredAnswers.map((item, idx) => {
              const isCorrect = item.isCorrect;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    background: 'var(--surface-2)',
                    border: `1.5px solid ${isCorrect ? 'var(--border)' : 'var(--primary)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: isCorrect ? 'var(--hero)' : 'var(--surface)',
                          border: `1.5px solid ${isCorrect ? 'var(--hero)' : 'var(--primary)'}`,
                          color: isCorrect ? 'var(--on-primary)' : 'var(--primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        {isCorrect ? <Check size={14} /> : <X size={14} />}
                      </span>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                          QUESTION {idx + 1}
                        </span>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.15rem' }}>
                          {item.questionTitle || `Question ${idx + 1}`}
                        </h3>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '0.2rem 0.65rem',
                        borderRadius: '0.4rem',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        background: isCorrect ? 'var(--primary-soft)' : 'var(--surface)',
                        border: `1px solid ${isCorrect ? 'var(--border)' : 'var(--primary)'}`,
                        color: 'var(--primary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isCorrect ? `+${item.pointsAwarded || 10} pts (Correct)` : '0 pts (Incorrect)'}
                    </span>
                  </div>

                  {/* Submission vs Correct Answer Box */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '0.75rem',
                      background: 'var(--surface)',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', letterSpacing: '0.04em' }}>
                        YOUR SUBMISSION
                      </span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: isCorrect ? 'var(--text)' : 'var(--primary)', marginTop: '0.15rem', display: 'block' }}>
                        {item.selectedOptions?.length ? item.selectedOptions.join(', ') : (item.textAnswer || 'No answer submitted')}
                      </span>
                    </div>

                    {item.correctAnswer && (
                      <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', letterSpacing: '0.04em' }}>
                          CORRECT ANSWER
                        </span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)', marginTop: '0.15rem', display: 'block' }}>
                          {item.correctAnswer}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Explanation Note */}
                  {item.explanation && (
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                        background: 'var(--primary-soft)',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        borderLeft: '3px solid var(--primary)',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: 'var(--primary-text)' }}>Explanation:</strong> {item.explanation}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};
