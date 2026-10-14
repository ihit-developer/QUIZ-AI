import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../../utils/soundManager';
import {
  Users,
  Play,
  ArrowRight,
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  Check,
  Crown,
} from 'lucide-react';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TimerRing } from '../../components/ui/TimerRing';
import { PartyPopperBoom } from '../../components/quiz/PartyPopperBoom';
import toast from 'react-hot-toast';

export const LiveRoom = () => {
  const { code = 'JS8821' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quizInfo, setQuizInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  // 'lobby' | 'in_progress' | 'ended'
  const [roomState, setRoomState] = useState('lobby');
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  // stores the plain string text of the selected option
  const [selectedOption, setSelectedOption] = useState(null);
  // questions: [{ id, title, options: string[], correctIndex, points, timeLimitSeconds }]
  const [questions, setQuestions] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);
  // null | 'correct' | 'wrong'
  const [answerResult, setAnswerResult] = useState(null);
  const [myScore, setMyScore] = useState(0);

  const [questionTimer, setQuestionTimer] = useState({ secondsLeft: 30, totalSeconds: 30 });
  const [submissionStats, setSubmissionStats] = useState({ submittedCount: 0, totalParticipants: 0 });

  // isHost is computed from quizInfo state for rendering purposes
  const isHost = Boolean(
    user &&
    quizInfo &&
    (String(quizInfo.hostId) === String(user.id || user._id) || user.role === 'admin')
  );

  // Run socket setup ONCE when room code changes — not when isHost changes
  // (isHost changes after quizInfo loads and would cause duplicate listeners)
  useEffect(() => {
    const socket = getSocket();
    const roomCode = code.toUpperCase();

    import('../../services/quizService').then(({ quizService }) => {
      quizService.getQuizByCode(roomCode).then((res) => {
        if (res.success && res.data?.quiz) {
          const q = res.data.quiz;
          setQuizInfo(q);

          const ownerCheck = Boolean(
            user && (String(q.hostId) === String(user.id || user._id) || user.role === 'admin')
          );

          if (ownerCheck) {
            socket.emit('host:create-room', { roomCode, quizTitle: q.title });
          } else {
            socket.emit('participant:join-room', {
              roomCode,
              participantName: user?.name || `Player_${Math.floor(Math.random() * 900 + 100)}`,
              userId: user?.id || user?._id || null,
            });
          }
        } else {
          socket.emit('participant:join-room', {
            roomCode,
            participantName: user?.name || `Player_${Math.floor(Math.random() * 900 + 100)}`,
            userId: user?.id || user?._id || null,
          });
        }
      }).catch(() => {
        socket.emit('participant:join-room', {
          roomCode,
          participantName: user?.name || `Player_${Math.floor(Math.random() * 900 + 100)}`,
          userId: user?.id || user?._id || null,
        });
      });
    });

    const onRoomEndedLock = (data) => {
      setRoomState('ended');
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      toast.error(data.message || 'This quiz has concluded.', { duration: 5000 });
    };

    const onLobbyUpdated = (data) => {
      // participants is an array of name strings
      setParticipants(data.participants || []);
      if (data.status === 'active') setRoomState('in_progress');
    };

    const onQuizStarted = (data) => {
      setRoomState('in_progress');
      // data.questions[i].options is string[] from server
      if (data.questions && data.questions.length > 0) setQuestions(data.questions);
      setCurrentQIdx(data.questionIdx || 0);
      setSelectedOption(null);
      setHasAnsweredCurrent(false);
      setAnswerResult(null);
      setSubmissionStats({ submittedCount: 0, totalParticipants: 0 });
      soundManager.resumeAudio().then(() => soundManager.startQuizBGM()).catch(() => {});
      toast.success('🚀 Quiz started! Good luck!');
    };

    const onTimerTick = (data) => {
      setQuestionTimer({ secondsLeft: data.secondsLeft, totalSeconds: data.totalSeconds || 30 });
      if (data.secondsLeft <= 3 && data.secondsLeft > 0) soundManager.playTick();
    };

    const onQuestionAdvanced = (data) => {
      setCurrentQIdx(data.questionIdx || 0);
      setSelectedOption(null);
      setHasAnsweredCurrent(false);
      setAnswerResult(null);
      setSubmissionStats({ submittedCount: 0, totalParticipants: 0 });
    };

    const onLeaderboardUpdated = (data) => {
      setLeaderboard(data.leaderboard || []);
      if (data.submittedCount !== undefined) {
        setSubmissionStats({
          submittedCount: data.submittedCount,
          totalParticipants: data.totalParticipants || data.leaderboard?.length || 0,
        });
      }
    };

    const onAnswerConfirmed = (data) => {
      setAnswerResult(data.isCorrect ? 'correct' : 'wrong');
      setMyScore(data.currentScore || 0);
    };

    const onQuizEnded = (data) => {
      setRoomState('ended');
      setLeaderboard(data.leaderboard || []);
      soundManager.stopBGM();
      soundManager.playPopperBoom();
    };

    const onConnectError = () => {
      toast.error('Unable to connect to the Live Arena. Please check your internet and try again.');
    };

    const onRoomError = (data) => {
      toast.error(data?.message || 'The Live Arena could not complete that action.');
    };

    socket.on('room:ended-lock', onRoomEndedLock);
    socket.on('lobby:updated', onLobbyUpdated);
    socket.on('quiz:started', onQuizStarted);
    socket.on('question:timer-tick', onTimerTick);
    socket.on('question:advanced', onQuestionAdvanced);
    socket.on('leaderboard:updated', onLeaderboardUpdated);
    socket.on('participant:answer-confirmed', onAnswerConfirmed);
    socket.on('quiz:ended', onQuizEnded);
    socket.on('connect_error', onConnectError);
    socket.on('error', onRoomError);

    return () => {
      socket.off('room:ended-lock', onRoomEndedLock);
      socket.off('lobby:updated', onLobbyUpdated);
      socket.off('quiz:started', onQuizStarted);
      socket.off('question:timer-tick', onTimerTick);
      socket.off('question:advanced', onQuestionAdvanced);
      socket.off('leaderboard:updated', onLeaderboardUpdated);
      socket.off('participant:answer-confirmed', onAnswerConfirmed);
      socket.off('quiz:ended', onQuizEnded);
      socket.off('connect_error', onConnectError);
      socket.off('error', onRoomError);
      soundManager.stopBGM();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]); // Only re-run if room code changes

  const handleStartQuiz = () => {
    const socket = getSocket();
    socket.emit('host:start-quiz', { roomCode: code.toUpperCase() });
  };

  const handleNextQuestion = () => {
    const socket = getSocket();
    socket.emit('host:next-question', { roomCode: code.toUpperCase() });
  };

  const handleEndQuiz = () => {
    const socket = getSocket();
    // Correct event name: server listens on 'host:finish-quiz' not 'host:end-quiz'
    socket.emit('host:finish-quiz', { roomCode: code.toUpperCase() });
  };

  // Pass both the option text and its index so we can compute correctness
  const handleAnswerSubmit = useCallback((optionText, optionIndex) => {
    if (hasAnsweredCurrent) return;

    const currentQuestion = questions[currentQIdx];
    if (!currentQuestion) return;

    // Compute correctness client-side using correctIndex from server payload
    const isCorrect = optionIndex === currentQuestion.correctIndex;
    const pointsAwarded = isCorrect ? (currentQuestion.points || 10) : 0;

    setSelectedOption(optionText);
    setHasAnsweredCurrent(true);

    const socket = getSocket();
    socket.emit('participant:submit-answer', {
      roomCode: code.toUpperCase(),
      questionIdx: currentQIdx,
      selectedOptionText: optionText,
      isCorrect,
      pointsAwarded,
      userId: user?.id || user?._id || null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnsweredCurrent, questions, currentQIdx, code, user]);

  // Helper: compute per-option styling based on answered state
  const getOptionStyle = (optionText, optionIndex) => {
    if (!hasAnsweredCurrent) {
      return {
        backgroundColor: 'var(--surface-2)',
        color: 'var(--text)',
        border: '1.5px solid var(--border)',
        cursor: 'pointer',
      };
    }
    const currentQuestion = questions[currentQIdx];
    const isCorrectOption = currentQuestion && optionIndex === currentQuestion.correctIndex;
    const isSelectedOption = selectedOption === optionText;

    if (isCorrectOption) {
      return {
        backgroundColor: 'hsl(142 71% 45%)',
        color: '#fff',
        border: '2px solid hsl(142 71% 35%)',
        cursor: 'default',
      };
    }
    if (isSelectedOption) {
      // Selected but wrong
      return {
        backgroundColor: 'hsl(0 84% 55%)',
        color: '#fff',
        border: '2px solid hsl(0 84% 40%)',
        cursor: 'default',
      };
    }
    return {
      backgroundColor: 'var(--surface-2)',
      color: 'var(--text-muted)',
      border: '1.5px solid var(--border)',
      cursor: 'default',
      opacity: 0.5,
    };
  };

  // currentQ options are plain strings (server sends string[], not object[])
  const currentQ = questions[currentQIdx];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
      {/* 1. LOBBY STATE */}
      {roomState === 'lobby' && (
        <Card style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={28} />
          </div>

          <div>
            <Badge variant="primary" style={{ marginBottom: '0.4rem' }}>
              LIVE MULTIPLAYER LOBBY
            </Badge>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text)' }}>
              {quizInfo?.title || 'Live Assessment Session'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
              Room Code: <strong style={{ color: 'var(--primary)', fontSize: '1.2rem', letterSpacing: '0.1em' }}>{code.toUpperCase()}</strong>
            </p>
          </div>

          {/* Participant count chip */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.65rem',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              padding: '0.6rem 1.4rem',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 800,
              fontSize: '0.95rem',
              color: 'var(--text)',
            }}
          >
            <Users size={18} color="var(--primary)" />
            <span>{participants.length} Player{participants.length !== 1 ? 's' : ''} in Lobby</span>
          </div>

          {/* Participant Chips Grid */}
          <div
            style={{
              width: '100%',
              maxWidth: '750px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.65rem',
              justifyContent: 'center',
              padding: '1.25rem',
              backgroundColor: 'var(--surface-2)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              minHeight: '100px',
            }}
          >
            {participants.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 'auto' }}>
                Waiting for participants to join with code {code.toUpperCase()}...
              </span>
            ) : (
              // participants is an array of name strings
              participants.map((name, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'inline-block' }} />
                  <span>{name}</span>
                </div>
              ))
            )}
          </div>

          {/* Host Action to Start */}
          {isHost ? (
            <Button
              onClick={handleStartQuiz}
              size="lg"
              style={{ minWidth: '240px', fontSize: '1.05rem' }}
            >
              <Play size={20} /> Launch Live Arena{participants.length > 0 ? ` (${participants.length} ready)` : ''}
            </Button>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              ⏳ Waiting for the host to start the game... Get ready!
            </p>
          )}
        </Card>
      )}

      {/* ======================================================
          2. IN-PROGRESS STATE
      ====================================================== */}
      {roomState === 'in_progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── TOP STATUS BAR (shared) ── */}
          <Card
            style={{
              padding: '0.9rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Left: progress info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Badge variant="primary" style={{ fontSize: '0.8rem', fontWeight: 900 }}>
                Q {currentQIdx + 1} / {questions.length}
              </Badge>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {submissionStats.submittedCount} / {submissionStats.totalParticipants} Answered
              </span>
              {currentQ && (
                <Badge variant="secondary" style={{ fontSize: '0.8rem' }}>
                  {currentQ.points || 10} pts
                </Badge>
              )}
            </div>

            {/* Right: participant score pill OR host controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              {!isHost && (
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    backgroundColor: 'var(--primary-soft)', border: '1.5px solid var(--primary)',
                    padding: '0.35rem 0.9rem', borderRadius: 'var(--radius-pill)',
                    fontWeight: 800, fontSize: '0.88rem', color: 'var(--primary-text)',
                  }}
                >
                  <Zap size={13} /> {myScore} pts
                </div>
              )}
              {isHost && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button variant="secondary" size="sm" onClick={handleNextQuestion}>
                    Next <ArrowRight size={14} />
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleEndQuiz}>
                    End Quiz
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* ============================================================
              HOST VIEW: Leaderboard only (full width)
              ============================================================ */}
          {isHost && (
            <Card style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <TimerRing
                    secondsLeft={questionTimer.secondsLeft}
                    totalSeconds={questionTimer.totalSeconds}
                    size={52}
                  />
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>
                      TIME LEFT — Q {currentQIdx + 1} / {questions.length}
                    </div>
                    <div style={{
                      fontSize: '1.8rem', fontWeight: 900, lineHeight: 1,
                      color: questionTimer.secondsLeft <= 5 ? 'hsl(0 84% 55%)' : 'var(--text)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {questionTimer.secondsLeft}s
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                      padding: '0.45rem 1rem', borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'var(--primary-soft)', border: '1.5px solid var(--primary)',
                      color: 'var(--primary-text)', fontWeight: 800, fontSize: '0.88rem',
                    }}
                  >
                    <CheckCircle2 size={14} />
                    {submissionStats.submittedCount} / {submissionStats.totalParticipants} answered
                  </div>
                  <div
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 1rem', borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'var(--primary-soft)', border: '1.5px solid var(--primary)',
                      color: 'var(--primary-text)', fontWeight: 800, fontSize: '0.88rem',
                    }}
                  >
                    <Crown size={14} /> Host View
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--border)' }} />

              {/* Leaderboard title */}
              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                🏆 LIVE LEADERBOARD
              </div>

              {/* Leaderboard rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {leaderboard.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0', textAlign: 'center' }}>
                    Standings will appear once participants start answering.
                  </div>
                ) : (
                  leaderboard.map((entry, idx) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const hasAnswered = entry.lastAnsweredQIdx === currentQIdx;
                    const isTop3 = idx < 3;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.75rem 1.1rem', borderRadius: 'var(--radius-btn)',
                          backgroundColor: isTop3 ? 'var(--primary-soft)' : 'var(--surface-2)',
                          border: isTop3 ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                          fontSize: '0.92rem',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ width: '28px', fontSize: '1.1rem', textAlign: 'center' }}>
                            {medals[idx] || `#${idx + 1}`}
                          </span>
                          <span style={{ fontWeight: isTop3 ? 800 : 600, color: 'var(--text)' }}>
                            {entry.name}
                          </span>
                          {hasAnswered && (
                            <span
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                fontSize: '0.75rem', fontWeight: 700,
                                color: 'hsl(142 71% 40%)',
                                backgroundColor: 'hsl(142 71% 45% / 0.12)',
                                padding: '0.15rem 0.55rem',
                                borderRadius: 'var(--radius-pill)',
                                border: '1px solid hsl(142 71% 45%)',
                              }}
                            >
                              <CheckCircle2 size={11} /> Answered
                            </span>
                          )}
                        </div>
                        <span style={{
                          fontWeight: 900, color: 'var(--primary-text)',
                          fontVariantNumeric: 'tabular-nums', fontSize: '1rem',
                        }}>
                          {entry.score} pts
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          )}


          {/* ============================================================
              PARTICIPANT VIEW: Prominent timer + question + options
              ============================================================ */}
          {!isHost && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Big Timer Card */}
              <Card
                style={{
                  padding: '1.5rem 2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  backgroundColor: questionTimer.secondsLeft <= 5
                    ? 'hsl(0 84% 55% / 0.08)'
                    : 'var(--surface-2)',
                  border: questionTimer.secondsLeft <= 5
                    ? '2px solid hsl(0 84% 55%)'
                    : '1px solid var(--border)',
                  transition: 'all 0.3s ease',
                }}
              >
                <TimerRing
                  secondsLeft={questionTimer.secondsLeft}
                  totalSeconds={questionTimer.totalSeconds}
                  size={80}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>
                    TIME REMAINING
                  </div>
                  <div
                    style={{
                      fontSize: '3rem',
                      fontWeight: 900,
                      lineHeight: 1,
                      color: questionTimer.secondsLeft <= 5
                        ? 'hsl(0 84% 55%)'
                        : questionTimer.secondsLeft <= 10
                          ? 'hsl(38 95% 50%)'
                          : 'var(--text)',
                      fontVariantNumeric: 'tabular-nums',
                      transition: 'color 0.3s',
                    }}
                  >
                    {questionTimer.secondsLeft}
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>sec</span>
                  </div>
                </div>

                {/* Answer status */}
                {hasAnsweredCurrent ? (
                  <div
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                      padding: '0.75rem 1.1rem', borderRadius: 'var(--radius-card)',
                      backgroundColor: answerResult === 'correct' ? 'hsl(142 71% 45%)' : 'hsl(0 84% 55%)',
                      color: '#fff',
                    }}
                  >
                    {answerResult === 'correct'
                      ? <><CheckCircle2 size={22} /><span style={{ fontSize: '0.8rem', fontWeight: 800 }}>Correct!</span></>
                      : <><XCircle size={22} /><span style={{ fontSize: '0.8rem', fontWeight: 800 }}>Wrong</span></>}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                      padding: '0.75rem 1.1rem', borderRadius: 'var(--radius-card)',
                      backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Clock size={20} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Answer!</span>
                  </div>
                )}
              </Card>

              {/* Question Card */}
              <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.45 }}>
                  {currentQ?.title || 'Loading question...'}
                </h2>

                {/* Answer result banner */}
                <AnimatePresence>
                  {answerResult && (
                    <motion.div
                      key="result-banner"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-btn)',
                        backgroundColor: answerResult === 'correct' ? 'hsl(142 71% 45%)' : 'hsl(0 84% 55%)',
                        color: '#fff', fontWeight: 800, fontSize: '0.95rem',
                      }}
                    >
                      {answerResult === 'correct'
                        ? <><CheckCircle2 size={18} /> Correct! +{currentQ?.points || 10} points — waiting for next question</>
                        : <><XCircle size={18} /> Wrong answer — the correct one is highlighted above</>}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Options grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                  {(currentQ?.options || []).map((optionText, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const optStyle = getOptionStyle(optionText, idx);
                    const showCorrectIcon = hasAnsweredCurrent && idx === currentQ?.correctIndex;
                    const showWrongIcon = hasAnsweredCurrent && selectedOption === optionText && idx !== currentQ?.correctIndex;

                    return (
                      <motion.div
                        key={idx}
                        whileHover={!hasAnsweredCurrent ? { scale: 1.02 } : {}}
                        whileTap={!hasAnsweredCurrent ? { scale: 0.97 } : {}}
                        onClick={() => { if (!hasAnsweredCurrent) handleAnswerSubmit(optionText, idx); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.85rem',
                          padding: '1.15rem 1.25rem', borderRadius: 'var(--radius-card)',
                          transition: 'all 0.2s ease', minHeight: '62px', userSelect: 'none',
                          ...optStyle,
                        }}
                      >
                        <div
                          style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 900, fontSize: '0.85rem', flexShrink: 0,
                          }}
                        >
                          {showCorrectIcon ? <Check size={16} /> : showWrongIcon ? <XCircle size={14} /> : letter}
                        </div>
                        <span style={{ fontSize: '0.98rem', fontWeight: 600, flex: 1 }}>
                          {optionText}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                {hasAnsweredCurrent && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 600 }}>
                    ⏳ Waiting for other players... Next question coming soon!
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* 3. ENDED STATE - Podium */}

      {roomState === 'ended' && (
        <Card style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
          <PartyPopperBoom leaderboard={leaderboard} />

          <div>
            <Badge variant="primary" style={{ marginBottom: '0.5rem' }}>
              LIVE TOURNAMENT CONCLUDED
            </Badge>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--text)' }}>
              Champions Podium
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Final tournament standings and rankings
            </p>
          </div>

          {/* 3-Tier Red Podium: 2nd (Left), 1st (Center), 3rd (Right) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: '1.25rem',
              width: '100%',
              maxWidth: '650px',
              paddingTop: '1.5rem',
            }}
          >
            {/* 2nd Place (Left) - Solid Deep Red */}
            {leaderboard[1] ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--hero)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    color: 'var(--on-primary)',
                    border: '2px solid var(--border)',
                  }}
                >
                  2
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{leaderboard[1].name}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-text)' }}>
                  {leaderboard[1].score} pts
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '110px',
                    backgroundColor: 'var(--surface-2)',
                    border: '1.5px solid var(--border)',
                    borderBottom: 'none',
                    borderRadius: '1rem 1rem 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    fontWeight: 900,
                    color: 'var(--text-muted)',
                  }}
                >
                  2nd
                </div>
              </div>
            ) : <div style={{ flex: 1 }} />}

            {/* 1st Place (Center - Highest) - Solid Brand Primary Red */}
            {leaderboard[0] ? (
              <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.75rem' }}>👑</div>
                <div
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    color: 'var(--on-primary)',
                    border: '3px solid var(--surface)',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  1
                </div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary-text)' }}>
                  {leaderboard[0].name}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' }}>
                  {leaderboard[0].score} pts
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '150px',
                    backgroundColor: 'var(--primary)',
                    border: '2px solid var(--primary-hover)',
                    borderBottom: 'none',
                    borderRadius: '1.25rem 1.25rem 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.4rem',
                    fontWeight: 900,
                    color: 'var(--on-primary)',
                  }}
                >
                  1st
                </div>
              </div>
            ) : <div style={{ flex: 1.15 }} />}

            {/* 3rd Place (Right) - Light Red Tint */}
            {leaderboard[2] ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    color: 'var(--primary-text)',
                    border: '1.5px solid var(--border)',
                  }}
                >
                  3
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{leaderboard[2].name}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-text)' }}>
                  {leaderboard[2].score} pts
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '80px',
                    backgroundColor: 'var(--surface-2)',
                    border: '1.5px solid var(--border)',
                    borderBottom: 'none',
                    borderRadius: '1rem 1rem 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    fontWeight: 900,
                    color: 'var(--text-muted)',
                  }}
                >
                  3rd
                </div>
              </div>
            ) : <div style={{ flex: 1 }} />}
          </div>

          <Button onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
            Back to Dashboard
          </Button>
        </Card>
      )}
    </div>
  );
};
