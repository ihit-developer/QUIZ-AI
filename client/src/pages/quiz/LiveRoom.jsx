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
import confetti from 'canvas-confetti';

export const LiveRoom = () => {
  const { code = 'JS8821' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [quizInfo, setQuizInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  // 'lobby' | 'in_progress' | 'ended'
  const [roomState, setRoomState] = useState('lobby');
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  // stores the plain string text of the selected option
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(null);
  // questions: [{ id, title, options: string[], correctIndex, points, timeLimitSeconds }]
  const [questions, setQuestions] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);
  const [hasCompletedAllQuestions, setHasCompletedAllQuestions] = useState(false);
  const [shuffleQuestionsLobby, setShuffleQuestionsLobby] = useState(true);
  const questionsRef = useRef([]);
  const currentQIdxRef = useRef(0);
  const hasAnsweredRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const advanceTimerRef = useRef(null);
  // null | 'correct' | 'wrong'
  const [answerResult, setAnswerResult] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [hasCancelled, setHasCancelled] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [questionTimer, setQuestionTimer] = useState({ secondsLeft: 30, totalSeconds: 30 });
  const [submissionStats, setSubmissionStats] = useState({ submittedCount: 0, totalParticipants: 0 });
  const launchSprinkles = useCallback((count = 18) => {
    try {
      confetti({ particleCount: count, spread: 36, startVelocity: 18, scalar: 0.62, gravity: 1.12, origin: { x: 0.5, y: 0.72 }, colors: ['#087F5B', '#065F46', '#10B981', '#D1FAE5', '#F59E0B'] });
    } catch {}
  }, []);

  // isHost is computed from quizInfo state for rendering purposes
  const isHost = Boolean(
    user &&
    quizInfo &&
    (String(quizInfo.hostId) === String(user.id || user._id) || user.role === 'admin')
  );
  const isHostRef = useRef(isHost);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // Run socket setup ONCE when room code changes — not when isHost changes
  // (isHost changes after quizInfo loads and would cause duplicate listeners)
  useEffect(() => {
    // A Google redirect restores its session asynchronously. Do not join before
    // that finishes or this signed-in participant is saved as a guest.
    if (authLoading) return undefined;

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
      const loadedQuestions = data.questions && data.questions.length > 0 ? data.questions : [];
      setQuestions(loadedQuestions);
      questionsRef.current = loadedQuestions;

      const qIdx = Number(data.questionIdx) || 0;
      currentQIdxRef.current = qIdx;
      hasAnsweredRef.current = false;
      hasCompletedRef.current = false;
      setCurrentQIdx(qIdx);
      if (data.currentScore !== undefined) {
        setMyScore(data.currentScore);
      }
      setSelectedOption(null);
      setSelectedOptionIdx(null);
      setHasAnsweredCurrent(false);
      setAnswerResult(null);

      if (qIdx >= loadedQuestions.length && loadedQuestions.length > 0) {
        setHasCompletedAllQuestions(true);
      } else {
        setHasCompletedAllQuestions(false);
        const currentQ = loadedQuestions[qIdx];
        const initialSeconds = Number(currentQ?.timeLimitSeconds) || 30;
        setQuestionTimer({ secondsLeft: initialSeconds, totalSeconds: initialSeconds });
      }

      soundManager.resumeAudio().then(() => soundManager.startLiveArenaBGM()).catch(() => {});
      toast.success('🚀 Quiz started! Good luck!');
    };

    const onTimerTick = (data) => {
      // In host view, show the room clock
      if (isHostRef.current && data) {
        setQuestionTimer({ secondsLeft: data.secondsLeft, totalSeconds: data.totalSeconds || 30 });
      }
    };

    const onTimeUp = () => {
      if (isHostRef.current) {
        setQuestionTimer((prev) => ({ ...prev, secondsLeft: 0 }));
      }
    };

    const onAllAnswered = () => {
      toast('🎯 All players have answered!', { id: 'all-answered-toast', icon: '👏' });
    };

    const onQuestionAdvanced = (data) => {
      // Host view follows room advancement
      if (isHostRef.current) {
        const qIdx = data.questionIdx || 0;
        setCurrentQIdx(qIdx);
        currentQIdxRef.current = qIdx;
        const nextLimit = Number(data.totalSeconds) || 30;
        setQuestionTimer({ secondsLeft: nextLimit, totalSeconds: nextLimit });
      }
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

    const onParticipantCancelled = (data) => {
      toast.error(`⚠️ ${data.name || 'A player'} cancelled their quiz.`, {
        id: `cancel-${data.socketId || Date.now()}`,
        duration: 4000,
        icon: '🚫',
      });
    };

    const onAnswerConfirmed = (data) => {
      const isCorrect = Boolean(data.isCorrect);
      setAnswerResult((prev) => prev || (isCorrect ? 'correct' : 'wrong'));
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
    socket.on('question:time-up', onTimeUp);
    socket.on('question:all-answered', onAllAnswered);
    socket.on('question:advanced', onQuestionAdvanced);
    socket.on('leaderboard:updated', onLeaderboardUpdated);
    socket.on('participant:cancelled', onParticipantCancelled);
    socket.on('participant:answer-confirmed', onAnswerConfirmed);
    socket.on('quiz:ended', onQuizEnded);
    socket.on('connect_error', onConnectError);
    socket.on('error', onRoomError);

    return () => {
      socket.off('room:ended-lock', onRoomEndedLock);
      socket.off('lobby:updated', onLobbyUpdated);
      socket.off('quiz:started', onQuizStarted);
      socket.off('question:timer-tick', onTimerTick);
      socket.off('question:time-up', onTimeUp);
      socket.off('question:all-answered', onAllAnswered);
      socket.off('question:advanced', onQuestionAdvanced);
      socket.off('leaderboard:updated', onLeaderboardUpdated);
      socket.off('participant:cancelled', onParticipantCancelled);
      socket.off('participant:answer-confirmed', onAnswerConfirmed);
      socket.off('quiz:ended', onQuizEnded);
      socket.off('connect_error', onConnectError);
      socket.off('error', onRoomError);
      soundManager.stopBGM();
    };
  }, [code, launchSprinkles, authLoading, user]);

  const handleStartQuiz = () => {
    soundManager.resumeAudio().then(() => soundManager.startLiveArenaBGM()).catch(() => {});
    const socket = getSocket();
    socket.emit('host:start-quiz', {
      roomCode: code.toUpperCase(),
      shuffleQuestions: shuffleQuestionsLobby,
    });
  };

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
    if (!muted) soundManager.resumeAudio().then(() => soundManager.startLiveArenaBGM()).catch(() => {});
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

  const handleCancelMyQuiz = () => {
    setShowCancelModal(false);
    setHasCancelled(true);
    soundManager.stopBGM();
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    const socket = getSocket();
    socket.emit('participant:cancel-quiz', {
      roomCode: code.toUpperCase(),
      userId: user?.id || user?._id || null,
    });
    toast.error('You have cancelled this quiz session.');
  };

  const moveToNextQuestion = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    const qList = questionsRef.current.length > 0 ? questionsRef.current : questions;
    const currentIdx = currentQIdxRef.current;
    const nextIdx = currentIdx + 1;

    if (nextIdx < qList.length) {
      currentQIdxRef.current = nextIdx;
      hasAnsweredRef.current = false;

      // Clean, unnested top-level state updates
      setCurrentQIdx(nextIdx);
      setSelectedOption(null);
      setSelectedOptionIdx(null);
      setHasAnsweredCurrent(false);
      setAnswerResult(null);

      const nextLimit = Number(qList[nextIdx]?.timeLimitSeconds) || 30;
      setQuestionTimer({ secondsLeft: nextLimit, totalSeconds: nextLimit });
    } else {
      hasCompletedRef.current = true;
      setHasCompletedAllQuestions(true);
      const socket = getSocket();
      socket.emit('participant:finished-all', {
        roomCode: code.toUpperCase(),
        userId: user?.id || user?._id || null,
      });
    }
  }, [questions, code, user]);

  const handleTimeUp = useCallback(() => {
    if (hasAnsweredRef.current || hasCompletedRef.current) return;
    hasAnsweredRef.current = true;
    setHasAnsweredCurrent(true);
    setAnswerResult('wrong');
    soundManager.playIncorrect();
    toast('⏰ Time is up for this question!', { id: 'time-up-toast', icon: '⌛' });

    const qList = questionsRef.current.length > 0 ? questionsRef.current : questions;
    const currentQuestion = qList[currentQIdxRef.current];
    const socket = getSocket();
    socket.emit('participant:submit-answer', {
      roomCode: code.toUpperCase(),
      questionIdx: currentQIdxRef.current,
      questionId: currentQuestion?.id || currentQuestion?._id || null,
      selectedOptionText: '',
      isCorrect: false,
      pointsAwarded: 0,
      userId: user?.id || user?._id || null,
    });

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      moveToNextQuestion();
    }, 600);
  }, [questions, code, user, moveToNextQuestion]);

  // Pass both the option text and its index so we can compute correctness
  const handleAnswerSubmit = useCallback((optionText, optionIndex) => {
    if (hasAnsweredRef.current || hasCompletedRef.current || questionTimer.secondsLeft <= 0) return;

    hasAnsweredRef.current = true;
    const qList = questionsRef.current.length > 0 ? questionsRef.current : questions;
    const currentQuestion = qList[currentQIdxRef.current] || qList[currentQIdx];
    if (!currentQuestion) return;

    // Compute correctness client-side using correctIndex from server payload
    const isCorrect = optionIndex === currentQuestion.correctIndex;
    const pointsAwarded = isCorrect ? (currentQuestion.points || 10) : 0;

    setSelectedOption(optionText);
    setSelectedOptionIdx(optionIndex);
    setHasAnsweredCurrent(true);
    setAnswerResult(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      soundManager.playCorrect();
      launchSprinkles();
    } else {
      soundManager.playIncorrect();
    }

    const socket = getSocket();
    socket.emit('participant:submit-answer', {
      roomCode: code.toUpperCase(),
      questionIdx: currentQIdxRef.current,
      questionId: currentQuestion.id || currentQuestion._id || null,
      selectedOptionText: optionText,
      isCorrect,
      pointsAwarded,
      userId: user?.id || user?._id || null,
    });

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      moveToNextQuestion();
    }, 450);
  }, [questionTimer.secondsLeft, questions, currentQIdx, code, user, launchSprinkles, moveToNextQuestion]);

  // 1. Local per-question timer countdown for the active participant
  useEffect(() => {
    if (roomState !== 'in_progress' || isHost || hasCompletedAllQuestions || hasAnsweredCurrent || hasCancelled) {
      return undefined;
    }

    const timer = setInterval(() => {
      setQuestionTimer((prev) => {
        if (prev.secondsLeft <= 1) {
          return { ...prev, secondsLeft: 0 };
        }
        const nextSeconds = prev.secondsLeft - 1;
        if (nextSeconds <= 3 && nextSeconds > 0) {
          soundManager.playTick();
        }
        return { ...prev, secondsLeft: nextSeconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [roomState, isHost, currentQIdx, hasCompletedAllQuestions, hasAnsweredCurrent, hasCancelled]);

  // 1b. Smooth timer countdown for host view
  useEffect(() => {
    if (roomState !== 'in_progress' || !isHost) {
      return undefined;
    }

    const timer = setInterval(() => {
      setQuestionTimer((prev) => {
        if (prev.secondsLeft <= 1) {
          return { ...prev, secondsLeft: 0 };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [roomState, isHost, currentQIdx]);

  // 2. Safely trigger handleTimeUp when secondsLeft reaches 0 outside of state updaters
  useEffect(() => {
    if (
      roomState === 'in_progress' &&
      !isHost &&
      !hasCompletedAllQuestions &&
      !hasAnsweredCurrent &&
      !hasCancelled &&
      questionTimer.secondsLeft <= 0
    ) {
      handleTimeUp();
    }
  }, [questionTimer.secondsLeft, roomState, isHost, hasCompletedAllQuestions, hasAnsweredCurrent, hasCancelled, handleTimeUp]);

  // 3. Clean up advance timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const isTimeUp = questionTimer.secondsLeft <= 0;

  // Helper: compute per-option styling based on answered state
  const getOptionStyle = (optionText, optionIndex) => {
    if (!hasAnsweredCurrent && !isTimeUp) {
      return {
        backgroundColor: 'var(--surface-2)',
        color: 'var(--text)',
        border: '1.5px solid var(--border)',
        cursor: 'pointer',
      };
    }
    const currentQuestion = questions[currentQIdx];
    const isCorrectOption = currentQuestion && optionIndex === currentQuestion.correctIndex;
    const isSelectedOption = selectedOptionIdx === optionIndex || selectedOption === optionText;

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1080px', margin: '0 auto', width: '100%', padding: '0 0.75rem', boxSizing: 'border-box' }}>
      {/* 1. LOBBY STATE */}
      {roomState === 'lobby' && (
        <Card style={{ padding: 'clamp(1.25rem, 4vw, 2.5rem)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={26} />
          </div>

          <div>
            <Badge variant="primary" style={{ marginBottom: '0.4rem' }}>
              LIVE MULTIPLAYER LOBBY
            </Badge>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', fontWeight: 900, color: 'var(--text)', lineHeight: 1.3 }}>
              {quizInfo?.title || 'Live Assessment Session'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.25rem' }}>
              Room Code: <strong style={{ color: 'var(--primary)', fontSize: 'clamp(1.1rem, 3.5vw, 1.35rem)', letterSpacing: '0.1em' }}>{code.toUpperCase()}</strong>
            </p>
          </div>

          {/* Participant count chip */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              padding: '0.5rem 1.2rem',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 800,
              fontSize: '0.9rem',
              color: 'var(--text)',
            }}
          >
            <Users size={16} color="var(--primary)" />
            <span>{participants.length} Player{participants.length !== 1 ? 's' : ''} in Lobby</span>
          </div>

          {/* Participant Chips Grid */}
          <div
            style={{
              width: '100%',
              maxWidth: '750px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              justifyContent: 'center',
              padding: '1rem',
              backgroundColor: 'var(--surface-2)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              minHeight: '80px',
              boxSizing: 'border-box',
            }}
          >
            {participants.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 'auto' }}>
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
                    gap: '0.4rem',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    padding: '0.35rem 0.8rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                </div>
              ))
            )}
          </div>

          {/* Host Action to Start */}
          {isHost ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '360px' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  cursor: 'pointer',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text)',
                  userSelect: 'none',
                  width: '100%',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="checkbox"
                  checked={shuffleQuestionsLobby}
                  onChange={(e) => setShuffleQuestionsLobby(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span>🔀 Shuffle questions per player</span>
              </label>

              <Button
                onClick={handleStartQuiz}
                size="lg"
                style={{ width: '100%', minWidth: '220px', fontSize: '1rem' }}
              >
                <Play size={18} /> Launch Live Arena{participants.length > 0 ? ` (${participants.length} ready)` : ''}
              </Button>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              ⏳ Waiting for the host to start the game... Get ready!
            </p>
          )}
        </Card>
      )}

      {/* ======================================================
          2. IN-PROGRESS STATE
      ====================================================== */}
      {roomState === 'in_progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>

          {/* ── TOP STATUS BAR (shared) ── */}
          <Card
            style={{
              padding: 'clamp(0.65rem, 2vw, 0.85rem) clamp(0.75rem, 3vw, 1.25rem)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Left: progress info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Badge variant="primary" style={{ fontSize: '0.78rem', fontWeight: 900 }}>
                Q {Math.min(currentQIdx + 1, questions.length || 1)} / {questions.length}
              </Badge>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {leaderboard.length > 0 ? `${leaderboard.length} Live` : `${participants.length} Joined`}
              </span>
              {currentQ && (
                <Badge variant="secondary" style={{ fontSize: '0.75rem' }}>
                  {currentQ.points || 10} pts
                </Badge>
              )}
            </div>

            {/* Right: participant score pill OR host controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleToggleSound}
                aria-label={isMuted ? 'Turn sound on' : 'Mute sound'}
                title={isMuted ? 'Turn sound on' : 'Mute sound'}
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', width: '34px', height: '34px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              {!isHost && (
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    backgroundColor: 'var(--primary-soft)', border: '1.5px solid var(--primary)',
                    padding: '0.28rem 0.75rem', borderRadius: 'var(--radius-pill)',
                    fontWeight: 800, fontSize: '0.82rem', color: 'var(--primary-text)',
                  }}
                >
                  <Zap size={12} /> {myScore} pts
                </div>
              )}
              {!isHost && !hasCompletedAllQuestions && !hasCancelled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelModal(true)}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.28rem 0.65rem',
                    borderColor: 'hsl(0 84% 60% / 0.4)',
                    color: 'hsl(0 84% 65%)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                  title="Leave / Cancel this quiz"
                >
                  <XCircle size={13} /> Cancel Quiz
                </Button>
              )}
              {isHost && (
                <Button variant="danger" size="sm" onClick={handleEndQuiz}>
                  End Quiz
                </Button>
              )}
            </div>
          </Card>

          {/* ============================================================
              HOST VIEW: Question Display, Controls & Live Leaderboard
              ============================================================ */}
          {isHost && (
            <Card style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Header row with timer, counts, and controls */}
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
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
                  {currentQIdx < questions.length - 1 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleNextQuestion}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}
                    >
                      Next Question <ArrowRight size={14} />
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleEndQuiz}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}
                    >
                      Finish Quiz 🏆
                    </Button>
                  )}
                  <div
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 1rem', borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)',
                      color: 'var(--text)', fontWeight: 800, fontSize: '0.88rem',
                    }}
                  >
                    <Crown size={14} color="var(--primary)" /> Host View
                  </div>
                </div>
              </div>

              {/* Host Active Question Card */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-card)',
                  backgroundColor: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <Badge variant="primary" style={{ fontSize: '0.75rem', fontWeight: 900 }}>
                    QUESTION {currentQIdx + 1} OF {questions.length}
                  </Badge>
                  <Badge variant="secondary" style={{ fontSize: '0.75rem' }}>
                    {currentQ?.points || 10} pts
                  </Badge>
                </div>

                <h2 style={{ fontSize: 'clamp(1.15rem, 2.5vw, 1.45rem)', fontWeight: 800, color: 'var(--text)', margin: '0.25rem 0', lineHeight: 1.4 }}>
                  {currentQ?.title || 'Preparing question...'}
                </h2>

                {/* Question options with correct marked for host */}
                {currentQ?.options && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem', marginTop: '0.25rem' }}>
                    {currentQ.options.map((optText, optIdx) => {
                      const isCorrect = optIdx === currentQ.correctIndex;
                      return (
                        <div
                          key={optIdx}
                          style={{
                            padding: '0.7rem 0.9rem',
                            borderRadius: 'var(--radius-btn)',
                            backgroundColor: isCorrect ? 'hsl(142 71% 45% / 0.12)' : 'var(--surface-2)',
                            border: isCorrect ? '1.5px solid hsl(142 71% 45%)' : '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                          }}
                        >
                          <span style={{ fontWeight: isCorrect ? 800 : 600, color: isCorrect ? 'hsl(142 71% 35%)' : 'var(--text)', fontSize: '0.88rem' }}>
                            {optText}
                          </span>
                          {isCorrect && (
                            <Badge variant="primary" style={{ backgroundColor: 'hsl(142 71% 45%)', color: '#fff', fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>
                              ✓ Correct
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
                    const isCancelled = entry.status === 'cancelled';
                    const isTop3 = idx < 3 && !isCancelled;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.75rem 1.1rem', borderRadius: 'var(--radius-btn)',
                          backgroundColor: isCancelled
                            ? 'hsl(0 84% 55% / 0.05)'
                            : isTop3 ? 'var(--primary-soft)' : 'var(--surface-2)',
                          border: isCancelled
                            ? '1px dashed hsl(0 84% 55% / 0.4)'
                            : isTop3 ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                          fontSize: '0.92rem',
                          transition: 'all 0.2s',
                          opacity: isCancelled ? 0.7 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ width: '28px', fontSize: '1.1rem', textAlign: 'center' }}>
                            {isCancelled ? '❌' : (medals[idx] || `#${idx + 1}`)}
                          </span>
                          <span style={{
                            fontWeight: isTop3 ? 800 : 600,
                            color: isCancelled ? 'hsl(0 84% 65%)' : 'var(--text)',
                            textDecoration: isCancelled ? 'line-through' : 'none',
                          }}>
                            {entry.name}
                          </span>
                          {isCancelled ? (
                            <Badge variant="danger" style={{ backgroundColor: 'hsl(0 84% 55% / 0.15)', color: 'hsl(0 84% 65%)', border: '1px solid hsl(0 84% 55%)', fontSize: '0.72rem', fontWeight: 800 }}>
                              Cancelled
                            </Badge>
                          ) : entry.answersCount !== undefined ? (
                            <span
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                fontSize: '0.75rem', fontWeight: 700,
                                color: entry.answersCount >= questions.length ? 'hsl(142 71% 40%)' : 'var(--text-muted)',
                                backgroundColor: entry.answersCount >= questions.length ? 'hsl(142 71% 45% / 0.12)' : 'var(--surface)',
                                padding: '0.15rem 0.55rem',
                                borderRadius: 'var(--radius-pill)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {entry.answersCount >= questions.length ? 'Finished' : `Q ${entry.answersCount}/${questions.length}`}
                            </span>
                          ) : hasAnswered ? (
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
                          ) : null}
                        </div>
                        <span style={{
                          fontWeight: 900, color: isCancelled ? 'hsl(0 84% 65%)' : 'var(--primary-text)',
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
              PARTICIPANT VIEW: Cancelled State
              ============================================================ */}
          {!isHost && hasCancelled && (
            <Card style={{ padding: 'clamp(1.5rem, 4vw, 2.75rem)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', maxWidth: '580px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'hsl(0 84% 55% / 0.12)', color: 'hsl(0 84% 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={36} />
              </div>
              <div>
                <Badge variant="danger" style={{ marginBottom: '0.4rem', backgroundColor: 'hsl(0 84% 55% / 0.15)', color: 'hsl(0 84% 65%)', border: '1px solid hsl(0 84% 55%)' }}>
                  QUIZ CANCELLED
                </Badge>
                <h2 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)', fontWeight: 900, color: 'var(--text)' }}>
                  You Left This Quiz
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.35rem', lineHeight: 1.5 }}>
                  You have voluntarily withdrawn from this live session. Your participation and score of <strong>{myScore} pts</strong> have been recorded, and the host has been notified.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: '0.5rem' }}>
                <Button variant="primary" onClick={() => navigate('/dashboard')} style={{ minWidth: '150px' }}>
                  Dashboard
                </Button>
                <Button variant="outline" onClick={() => navigate('/quiz/join')} style={{ minWidth: '150px' }}>
                  Join Another Quiz
                </Button>
              </div>
            </Card>
          )}

          {/* ============================================================
              PARTICIPANT VIEW: Prominent timer + question + options
              ============================================================ */}
          {!isHost && !hasCancelled && hasCompletedAllQuestions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <Card style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <PartyPopperBoom />
                <div style={{ fontSize: '3.5rem' }}>🎉</div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text)' }}>
                  All Questions Completed!
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '420px', lineHeight: 1.5 }}>
                  You have completed all {questions.length} questions. Fantastic performance!
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--primary-soft)', border: '1.5px solid var(--primary)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary-text)' }}>
                  <Zap size={20} /> Your Score: {myScore} pts
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Waiting for all players to finish... Live standings are updating below!
                </p>
              </Card>

              {/* Live Standings while waiting */}
              <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  🏆 LIVE STANDINGS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {leaderboard.map((entry, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.75rem 1rem', borderRadius: 'var(--radius-btn)',
                        backgroundColor: idx < 3 ? 'var(--primary-soft)' : 'var(--surface)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', minWidth: '22px' }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{entry.name}</span>
                        {entry.answersCount !== undefined && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', backgroundColor: 'var(--surface-2)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-pill)' }}>
                            {entry.answersCount >= questions.length ? 'Finished' : `Q ${entry.answersCount}/${questions.length}`}
                          </span>
                        )}
                      </div>
                      <span style={{ fontWeight: 900, color: 'var(--primary-text)', fontSize: '1rem' }}>
                        {entry.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {!isHost && !hasCancelled && !hasCompletedAllQuestions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>

              {/* Big Timer Card */}
              <Card
                style={{
                  padding: 'clamp(0.85rem, 2.5vw, 1.35rem)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  backgroundColor: questionTimer.secondsLeft <= 5
                    ? 'hsl(0 84% 55% / 0.08)'
                    : 'var(--surface-2)',
                  border: questionTimer.secondsLeft <= 5
                    ? '2px solid hsl(0 84% 55%)'
                    : '1px solid var(--border)',
                  transition: 'all 0.3s ease',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <TimerRing
                    secondsLeft={questionTimer.secondsLeft}
                    totalSeconds={questionTimer.totalSeconds}
                    size={58}
                  />
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                      TIME REMAINING
                    </div>
                    <div
                      style={{
                        fontSize: 'clamp(1.8rem, 5vw, 2.7rem)',
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
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', marginLeft: '0.25rem' }}>s</span>
                    </div>
                  </div>
                </div>

                {/* Answer status */}
                {hasAnsweredCurrent ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: 'var(--radius-card)',
                      backgroundColor: answerResult === 'correct'
                        ? 'hsl(142 71% 45%)'
                        : answerResult === 'wrong'
                          ? 'hsl(0 84% 55%)'
                          : 'var(--primary)',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {answerResult === 'correct' ? (
                      <><CheckCircle2 size={18} /><span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Correct!</span></>
                    ) : answerResult === 'wrong' ? (
                      <><XCircle size={18} /><span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Wrong</span></>
                    ) : (
                      <><Clock size={16} /><span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Recorded</span></>
                    )}
                  </div>
                ) : isTimeUp ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: 'var(--radius-card)',
                      backgroundColor: 'hsl(38 95% 45%)',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={18} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Time's up!</span>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: 'var(--radius-card)',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={18} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Choose!</span>
                  </div>
                )}
              </Card>

              {/* Question Card */}
              <Card style={{ padding: 'clamp(1rem, 3.5vw, 1.85rem)', display: 'flex', flexDirection: 'column', gap: '1.15rem', width: '100%', boxSizing: 'border-box' }}>
                <h2 style={{ fontSize: 'clamp(1.1rem, 3.2vw, 1.4rem)', fontWeight: 800, color: 'var(--text)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  {currentQ?.title || 'Loading question...'}
                </h2>

                {/* Answer result banner or Time's up banner */}
                <AnimatePresence>
                  {answerResult ? (
                    <motion.div
                      key="result-banner"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.65rem',
                        padding: '0.75rem 1rem', borderRadius: 'var(--radius-btn)',
                        backgroundColor: answerResult === 'correct' ? 'hsl(142 71% 45%)' : 'hsl(0 84% 55%)',
                        color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                      }}
                    >
                      {answerResult === 'correct'
                        ? <><CheckCircle2 size={18} flexShrink={0} /> Correct! +{currentQ?.points || 10} pts — moving to next</>
                        : <><XCircle size={18} flexShrink={0} /> Wrong answer — moving to next</>}
                    </motion.div>
                  ) : isTimeUp && !hasAnsweredCurrent ? (
                    <motion.div
                      key="timeup-banner"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.65rem',
                        padding: '0.75rem 1rem', borderRadius: 'var(--radius-btn)',
                        backgroundColor: 'hsl(38 95% 45%)',
                        color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                      }}
                    >
                      <Clock size={18} flexShrink={0} /> Time’s up! Moving to next question...
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {/* Options grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '0.75rem', width: '100%', boxSizing: 'border-box' }}>
                  {(currentQ?.options || []).map((optionText, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const optStyle = getOptionStyle(optionText, idx);
                    const isOptionDisabled = hasAnsweredCurrent || isTimeUp;
                    const showCorrectIcon = (hasAnsweredCurrent || isTimeUp) && idx === currentQ?.correctIndex;
                    const showWrongIcon = hasAnsweredCurrent && (selectedOptionIdx === idx || selectedOption === optionText) && idx !== currentQ?.correctIndex;

                    return (
                      <motion.div
                        key={idx}
                        whileHover={!isOptionDisabled ? { scale: 1.015 } : {}}
                        whileTap={!isOptionDisabled ? { scale: 0.98 } : {}}
                        onClick={() => { if (!isOptionDisabled) handleAnswerSubmit(optionText, idx); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.85rem 1.05rem', borderRadius: 'var(--radius-card)',
                          transition: 'all 0.2s ease', minHeight: '52px', userSelect: 'none',
                          wordBreak: 'break-word', width: '100%', boxSizing: 'border-box',
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
                        <span style={{ fontSize: '0.94rem', fontWeight: 600, flex: 1, lineHeight: 1.35 }}>
                          {optionText}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                {hasAnsweredCurrent && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                    ⚡ Moving to the next question...
                  </div>
                )}
                {isTimeUp && !hasAnsweredCurrent && (
                  <div style={{ textAlign: 'center', color: 'hsl(38 95% 45%)', fontSize: '0.85rem', fontWeight: 700 }}>
                    ⌛ Time expired. Preparing the next question...
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* 3. ENDED STATE - Podium */}

      {roomState === 'ended' && (
        <Card style={{ padding: 'clamp(1.25rem, 4vw, 2.5rem)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
          <PartyPopperBoom leaderboard={leaderboard} />

          <div>
            <Badge variant="primary" style={{ marginBottom: '0.4rem' }}>
              LIVE TOURNAMENT CONCLUDED
            </Badge>
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', fontWeight: 900, color: 'var(--text)' }}>
              Champions Podium
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Final tournament standings and rankings
            </p>
          </div>

          {/* 3-Tier Emerald Podium: 2nd (Left), 1st (Center), 3rd (Right) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 'clamp(0.35rem, 1.8vw, 1.25rem)',
              width: '100%',
              maxWidth: '650px',
              paddingTop: '1rem',
              boxSizing: 'border-box',
            }}
          >
            {/* 2nd Place (Left) */}
            {leaderboard[1] ? (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                <div
                  style={{
                    width: 'clamp(42px, 10vw, 60px)',
                    height: 'clamp(42px, 10vw, 60px)',
                    borderRadius: '50%',
                    backgroundColor: 'var(--hero)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
                    color: 'var(--on-primary)',
                    border: '2px solid var(--border)',
                  }}
                >
                  2
                </div>
                <div style={{ fontWeight: 800, fontSize: 'clamp(0.78rem, 2vw, 0.95rem)', color: 'var(--text)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {leaderboard[1].name}
                </div>
                <div style={{ fontSize: 'clamp(0.72rem, 1.8vw, 0.85rem)', fontWeight: 700, color: 'var(--primary-text)' }}>
                  {leaderboard[1].score} pts
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 'clamp(75px, 15vw, 110px)',
                    backgroundColor: 'var(--surface-2)',
                    border: '1.5px solid var(--border)',
                    borderBottom: 'none',
                    borderRadius: '0.75rem 0.75rem 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
                    fontWeight: 900,
                    color: 'var(--text-muted)',
                  }}
                >
                  2nd
                </div>
              </div>
            ) : <div style={{ flex: 1, minWidth: 0 }} />}

            {/* 1st Place (Center - Highest) */}
            {leaderboard[0] ? (
              <div style={{ flex: 1.15, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}>👑</div>
                <div
                  style={{
                    width: 'clamp(52px, 12vw, 74px)',
                    height: 'clamp(52px, 12vw, 74px)',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'clamp(1.3rem, 3.2vw, 1.8rem)',
                    color: 'var(--on-primary)',
                    border: '3px solid var(--surface)',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  1
                </div>
                <div style={{ fontWeight: 900, fontSize: 'clamp(0.85rem, 2.2vw, 1.1rem)', color: 'var(--primary-text)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {leaderboard[0].name}
                </div>
                <div style={{ fontSize: 'clamp(0.75rem, 2vw, 0.95rem)', fontWeight: 800, color: 'var(--text)' }}>
                  {leaderboard[0].score} pts
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 'clamp(100px, 20vw, 150px)',
                    backgroundColor: 'var(--primary)',
                    border: '2px solid var(--primary-hover)',
                    borderBottom: 'none',
                    borderRadius: '0.85rem 0.85rem 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'clamp(1.5rem, 3.8vw, 2.4rem)',
                    fontWeight: 900,
                    color: 'var(--on-primary)',
                  }}
                >
                  1st
                </div>
              </div>
            ) : <div style={{ flex: 1.15, minWidth: 0 }} />}

            {/* 3rd Place (Right) */}
            {leaderboard[2] ? (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                <div
                  style={{
                    width: 'clamp(42px, 10vw, 60px)',
                    height: 'clamp(42px, 10vw, 60px)',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
                    color: 'var(--primary-text)',
                    border: '1.5px solid var(--border)',
                  }}
                >
                  3
                </div>
                <div style={{ fontWeight: 800, fontSize: 'clamp(0.78rem, 2vw, 0.95rem)', color: 'var(--text)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {leaderboard[2].name}
                </div>
                <div style={{ fontSize: 'clamp(0.72rem, 1.8vw, 0.85rem)', fontWeight: 700, color: 'var(--primary-text)' }}>
                  {leaderboard[2].score} pts
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 'clamp(55px, 11vw, 80px)',
                    backgroundColor: 'var(--surface-2)',
                    border: '1.5px solid var(--border)',
                    borderBottom: 'none',
                    borderRadius: '0.75rem 0.75rem 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'clamp(1rem, 2.8vw, 1.5rem)',
                    fontWeight: 900,
                    color: 'var(--text-muted)',
                  }}
                >
                  3rd
                </div>
              </div>
            ) : <div style={{ flex: 1, minWidth: 0 }} />}
          </div>

          <Button onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
            Back to Dashboard
          </Button>
        </Card>
      )}

      {/* Confirmation Modal for Player Cancelling */}
      {showCancelModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: '1.75rem',
              maxWidth: '440px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'hsl(0 84% 55% / 0.12)', color: 'hsl(0 84% 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <XCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  Cancel Quiz?
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  Are you sure you want to exit this live quiz?
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              Your current answers and score ({myScore} pts) will be saved, and the host will be notified that you cancelled your quiz.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button variant="outline" size="sm" onClick={() => setShowCancelModal(false)}>
                Stay in Quiz
              </Button>
              <Button variant="danger" size="sm" onClick={handleCancelMyQuiz}>
                Yes, Cancel Quiz
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
