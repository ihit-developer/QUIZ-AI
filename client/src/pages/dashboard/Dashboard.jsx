import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  PlusCircle,
  TrendingUp,
  BrainCircuit,
  ArrowRight,
  Trash2,
  Zap,
  Play,
  Clock,
  HelpCircle,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { quizService } from '../../services/quizService';
import { predictionService } from '../../services/predictionService';
import { PageSkeletonLoader } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ShareQuizModal } from '../../components/quiz/ShareQuizModal';
import toast from 'react-hot-toast';

export const Dashboard = () => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [sharingQuiz, setSharingQuiz] = useState(null);

  const handleDeleteQuiz = async (quizId, quizTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${quizTitle}"? All attempts and questions will be permanently removed.`)) {
      return;
    }

    try {
      setDeletingId(quizId);
      const res = await quizService.deleteQuiz(quizId);
      if (res.success) {
        toast.success('Quiz deleted successfully');
        setQuizzes((prev) => prev.filter((q) => (q.id || q._id) !== quizId));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete quiz');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [quizRes, predRes] = await Promise.all([
          quizService.getMyQuizzes().catch(() => ({ success: false })),
          predictionService.getStudentPredictions().catch(() => ({ success: false })),
        ]);

        if (quizRes?.success) {
          setQuizzes(quizRes.data.quizzes || []);
        }
        if (predRes?.success) {
          setPrediction(predRes.data);
        }
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  if (loading) {
    return <PageSkeletonLoader />;
  }

  const isHost = user?.role === 'host';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 1. Welcome Banner */}
      <Card
        style={{
          padding: '2rem 2.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          backgroundColor: 'var(--surface-2)',
          border: '1.5px solid var(--border)',
        }}
      >
        <div>
          <Badge variant="primary" style={{ marginBottom: '0.65rem' }}>
            {user?.role?.toUpperCase()} PORTAL
          </Badge>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)' }}>
            Welcome, <span style={{ color: 'var(--primary)' }}>{user?.name}</span>!
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.95rem', maxWidth: '650px' }}>
            {isHost
              ? 'Create assessments, launch synchronized live multiplayer sessions, and monitor real-time cohort analytics.'
              : 'Review your exam attempts, track predictive scores, and view cohort trajectories.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isHost && (
            <Link to="/create-quiz" className="btn-primary">
              <PlusCircle size={18} /> Create New Quiz
            </Link>
          )}
          {!isHost && (
            <Link to="/join" className="btn-secondary">
              <Zap size={16} /> Join with Code
            </Link>
          )}
        </div>
      </Card>

      {/* 2. Quick Stat Metrics */}
      {(() => {
        // Calculate real metrics from user's quizzes or attempts
        const totalItems = quizzes.length;
        const submittedAttempts = quizzes.filter((q) => ['submitted', 'timed_out'].includes(q.attemptStatus));
        const passedAttempts = quizzes.filter((q) => q.attemptPassed === true);
        const realCompletionRate = totalItems > 0 ? Math.round((submittedAttempts.length / totalItems) * 100) : 0;
        const realPredictedScore = prediction?.hasAttemptData ? `${prediction.predictedScore}%` : '—';
        const realPace = prediction?.avgPace != null ? `${prediction.avgPace}s` : '—';

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <StatCard
              title={isHost ? 'Created Quizzes' : 'Active Enrollments'}
              value={totalItems}
              description={isHost ? 'Assessments in workspace' : 'Enrolled quiz sessions'}
              icon={BrainCircuit}
            />

            <StatCard
              title="Predicted Next Score"
              value={realPredictedScore}
              description={prediction?.hasAttemptData ? `AI Confidence: ${prediction.confidenceLevel}%` : 'Complete a quiz to unlock'}
              trend={prediction?.slope ? `${prediction.slope > 0 ? '+' : ''}${prediction.slope} pts` : undefined}
              icon={TrendingUp}
            />

            <StatCard
              title="Avg Completion"
              value={`${realCompletionRate}%`}
              description={`${submittedAttempts.length} of ${totalItems || 1} completed`}
              icon={CheckCircle2}
            />

            <StatCard
              title="Average Pace"
              value={realPace}
              description="Per question duration"
              icon={Clock}
            />
          </div>
        );
      })()}

      {/* 3. Recent Quizzes Directory */}
      <Card style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)' }}>
              {isHost ? 'Your Created Assessments' : 'Recent Quiz Attempts'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Manage questions, view join codes, or launch real-time multiplayer rooms
            </p>
          </div>

          {isHost && (
            <Link to="/create-quiz" className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', minHeight: '38px' }}>
              <PlusCircle size={15} /> New Quiz
            </Link>
          )}
        </div>

        {quizzes.length === 0 ? (
          <EmptyState
            title="No Quizzes Found"
            description={
              isHost
                ? "You haven't authored any quizzes yet. Use our AI builder or stepper wizard to create your first assessment."
                : "You haven't attempted any quizzes yet. Enter a 6-character room code to join an active session."
            }
            actionLabel={isHost ? 'Create First Quiz' : 'Join a Quiz'}
            onAction={() => (window.location.href = isHost ? '/create-quiz' : '/join')}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {quizzes.map((quiz) => {
              const quizId = quiz.id || quiz._id;
              const isDeleting = deletingId === quizId;
              const qCount = quiz.totalQuestions ?? quiz.questions?.length ?? quiz.questionCount ?? 0;

              return (
                <div
                  key={quizId}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-card)',
                    padding: '1.4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span
                        className="badge badge-primary"
                        style={{ fontSize: '0.75rem', letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}
                      >
                        CODE: {quiz.joinCode}
                      </span>

                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span className={quiz.mode === 'live' ? 'badge badge-primary' : 'badge badge-secondary'}>
                          {quiz.mode === 'live' ? 'LIVE ARENA' : 'SELF-PACED'}
                        </span>
                        {quiz.status !== 'published' && <span className="badge badge-info">Draft</span>}
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.35 }}>
                      {quiz.title}
                    </h3>

                    {quiz.description && (
                      <p
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.85rem',
                          marginTop: '0.35rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {quiz.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <HelpCircle size={14} /> {qCount} Questions
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={14} /> {quiz.settings?.timeLimitMinutes || 15} Mins
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.85rem',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {/* Direct Launch Live Room Button */}
                      {quiz.mode === 'live' ? (
                        <Link
                          to={`/live/${quiz.joinCode}`}
                          className="btn-primary"
                          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', minHeight: '34px' }}
                        >
                          <Play size={14} /> Open Live Arena
                        </Link>
                      ) : (
                        <Link
                          to={`/edit-quiz/${quizId}`}
                          className="btn-secondary"
                          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', minHeight: '34px' }}
                        >
                          Edit Quiz
                        </Link>
                      )}

                      {isHost && quiz.status === 'published' && quiz.joinCode && (
                        <button
                          type="button"
                          onClick={() => setSharingQuiz(quiz)}
                          className="btn-secondary"
                          style={{ padding: '0.45rem 0.7rem', fontSize: '0.82rem', minHeight: '34px' }}
                        >
                          <Share2 size={14} /> Share
                        </button>
                      )}

                      {isHost && (
                        <Link
                          to={`/analytics/${quizId}`}
                          className="btn-secondary"
                          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', minHeight: '34px' }}
                        >
                          Analytics
                        </Link>
                      )}
                    </div>

                    {isHost && (
                      <button
                        type="button"
                        onClick={() => handleDeleteQuiz(quizId, quiz.title)}
                        disabled={isDeleting}
                        style={{
                          color: 'var(--text-muted)',
                          padding: '0.35rem',
                          borderRadius: 'var(--radius-btn)',
                        }}
                        title="Delete Quiz"
                        aria-label="Delete quiz"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <ShareQuizModal
        isOpen={Boolean(sharingQuiz)}
        quiz={sharingQuiz}
        onClose={() => setSharingQuiz(null)}
      />
    </div>
  );
};
