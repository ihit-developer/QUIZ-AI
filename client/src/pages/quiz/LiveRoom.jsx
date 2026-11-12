import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../../utils/soundManager';
import {
  Users,
  Play,
  Pause,
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
  Flame,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  Download,
  FileText,
  BarChart2,
  UserX,
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

const AVATARS = ['🦊', '🦁', '🐼', '🚀', '⚡', '🤖', '🧙', '🦄', '🐯', '🦉', '🐱', '🐶'];
const REACTION_EMOJIS = ['❤️', '👏', '😂', '🔥', '🚀', '🤯', '💡', '🎯'];

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

  // New Interactive Player Features State
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    try {
      return localStorage.getItem('user_quiz_avatar') || '🦊';
    } catch {
      return '🦊';
    }
  });
  const [participantDetails, setParticipantDetails] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [powerUps, setPowerUps] = useState({
    fiftyFifty: true,
    extraTime: true,
    doubleDown: true,
  });
  const [eliminatedOptions, setEliminatedOptions] = useState([]);
  const [doubleDownActive, setDoubleDownActive] = useState(false);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [enablePowerUpsLobby, setEnablePowerUpsLobby] = useState(true);
  const [powerUpsEnabled, setPowerUpsEnabled] = useState(true);
  const [lastPointsDelta, setLastPointsDelta] = useState(0);

  // Host Control & Presentation Features State
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [lockOnStartLobby, setLockOnStartLobby] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [optionDistribution, setOptionDistribution] = useState({});
  const [hostInspectQIdx, setHostInspectQIdx] = useState('all'); // 'all' | 'live' | 'timer' | number
  const [lastActiveQIdx, setLastActiveQIdx] = useState(0);
  const [lastAnswererName, setLastAnswererName] = useState('');
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [kickedMessage, setKickedMessage] = useState('');

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
              avatar: selectedAvatar,
            });
          }
        } else {
          socket.emit('participant:join-room', {
            roomCode,
            participantName: user?.name || `Player_${Math.floor(Math.random() * 900 + 100)}`,
            userId: user?.id || user?._id || null,
            avatar: selectedAvatar,
          });
        }
      }).catch(() => {
        socket.emit('participant:join-room', {
          roomCode,
          participantName: user?.name || `Player_${Math.floor(Math.random() * 900 + 100)}`,
          userId: user?.id || user?._id || null,
          avatar: selectedAvatar,
        });
      });
    });

    const onRoomEndedLock = (data) => {
      setRoomState('ended');
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      toast.error(data.message || 'This quiz has concluded.', { duration: 5000 });
    };

    const onLobbyUpdated = (data) => {
      setParticipants(data.participants || []);
      if (data.participantDetails) {
        setParticipantDetails(data.participantDetails);
      }
      if (data.isLocked !== undefined) {
        setIsRoomLocked(Boolean(data.isLocked));
      }
      if (data.status === 'active') setRoomState('in_progress');
    };

    const onRoomLockUpdated = (data) => {
      if (data && data.isLocked !== undefined) {
        setIsRoomLocked(Boolean(data.isLocked));
        toast(data.isLocked ? '🔒 Room locked by host (new joins disabled)' : '🔓 Room unlocked by host', {
          id: 'lock-status-toast',
        });
      }
    };

    const onRoomPauseUpdated = (data) => {
      if (!data) return;
      const paused = Boolean(data.isPaused);
      setIsPaused(paused);
      if (data.secondsLeft !== undefined) {
        setQuestionTimer((prev) => ({ ...prev, secondsLeft: data.secondsLeft }));
      }
      toast(paused ? '⏸️ Host paused the quiz timer' : '▶️ Host resumed the quiz timer', {
        id: 'pause-status-toast',
      });
    };

    const onParticipantKicked = (data) => {
      setIsKicked(true);
      setKickedMessage(data?.message || '🚫 You were removed from this live session by the host.');
      soundManager.stopBGM();
      toast.error(data?.message || '🚫 You were removed from this live quiz by the host.', { duration: 5000 });
    };

    const onRoomLockedReject = (data) => {
      setIsKicked(true);
      setKickedMessage(data?.message || '🔒 This room is locked by the host and is not accepting new players.');
      toast.error(data?.message || '🔒 Room is locked by host.', { duration: 5000 });
    };

    const onRoomReaction = (data) => {
      if (!data) return;
      const reactionItem = {
        id: data.id || `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        emoji: data.emoji || '🔥',
        senderName: data.senderName || 'Player',
        senderAvatar: data.senderAvatar || '🦊',
        left: 12 + Math.random() * 76,
      };
      setFloatingReactions((prev) => [...prev.slice(-14), reactionItem]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== reactionItem.id));
      }, 2600);
    };

    const onQuizStarted = (data) => {
      setRoomState('in_progress');
      setPowerUpsEnabled(data.enablePowerUps !== false);
      if (data.isLocked !== undefined) setIsRoomLocked(Boolean(data.isLocked));
      if (data.isPaused !== undefined) setIsPaused(Boolean(data.isPaused));
      if (data.optionDistribution) setOptionDistribution(data.optionDistribution);
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
      if (data?.isPaused !== undefined) {
        setIsPaused(Boolean(data.isPaused));
      }
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
      setIsPaused(false);
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
      if (data.optionDistribution) {
        setOptionDistribution(data.optionDistribution);
      }
      if (data.lastAnsweredQuestionIdx !== undefined && data.lastAnsweredQuestionIdx !== null) {
        setLastActiveQIdx(Number(data.lastAnsweredQuestionIdx) || 0);
      }
      if (data.lastAnswererName) {
        setLastAnswererName(data.lastAnswererName);
      }
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
    socket.on('room:lock-updated', onRoomLockUpdated);
    socket.on('room:pause-updated', onRoomPauseUpdated);
    socket.on('participant:kicked', onParticipantKicked);
    socket.on('room:locked-reject', onRoomLockedReject);
    socket.on('quiz:started', onQuizStarted);
    socket.on('question:timer-tick', onTimerTick);
    socket.on('question:time-up', onTimeUp);
    socket.on('question:all-answered', onAllAnswered);
    socket.on('question:advanced', onQuestionAdvanced);
    socket.on('leaderboard:updated', onLeaderboardUpdated);
    socket.on('participant:cancelled', onParticipantCancelled);
    socket.on('participant:answer-confirmed', onAnswerConfirmed);
    socket.on('room:reaction', onRoomReaction);
    socket.on('quiz:ended', onQuizEnded);
    socket.on('connect_error', onConnectError);
    socket.on('error', onRoomError);

    return () => {
      socket.off('room:ended-lock', onRoomEndedLock);
      socket.off('lobby:updated', onLobbyUpdated);
      socket.off('room:lock-updated', onRoomLockUpdated);
      socket.off('room:pause-updated', onRoomPauseUpdated);
      socket.off('participant:kicked', onParticipantKicked);
      socket.off('room:locked-reject', onRoomLockedReject);
      socket.off('quiz:started', onQuizStarted);
      socket.off('question:timer-tick', onTimerTick);
      socket.off('question:time-up', onTimeUp);
      socket.off('question:all-answered', onAllAnswered);
      socket.off('question:advanced', onQuestionAdvanced);
      socket.off('leaderboard:updated', onLeaderboardUpdated);
      socket.off('participant:cancelled', onParticipantCancelled);
      socket.off('participant:answer-confirmed', onAnswerConfirmed);
      socket.off('room:reaction', onRoomReaction);
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
      enablePowerUps: enablePowerUpsLobby,
      lockOnStart: lockOnStartLobby || isRoomLocked,
    });
  };

  const handleToggleLock = (explicitVal) => {
    const nextLocked = explicitVal !== undefined ? Boolean(explicitVal) : !isRoomLocked;
    setIsRoomLocked(nextLocked);
    const socket = getSocket();
    socket.emit('host:toggle-lock', {
      roomCode: code.toUpperCase(),
      isLocked: nextLocked,
    });
  };

  const handleTogglePause = () => {
    const socket = getSocket();
    socket.emit('host:toggle-pause', {
      roomCode: code.toUpperCase(),
    });
  };

  const handleKickParticipant = (targetName, targetSocketId = null) => {
    const socket = getSocket();
    socket.emit('host:kick-participant', {
      roomCode: code.toUpperCase(),
      targetName,
      targetSocketId,
    });
    toast.success(`Removed ${targetName} from the session.`);
  };

  const handleToggleProjectorMode = () => {
    const nextMode = !isProjectorMode;
    setIsProjectorMode(nextMode);
    try {
      if (nextMode && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (!nextMode && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
  };

  const handleExportCSV = () => {
    if (!leaderboard || leaderboard.length === 0) {
      toast.error('No participant results available to export.');
      return;
    }

    const qHeaders = questions.map((_, idx) => `Q${idx + 1} Status`);
    const headers = [
      'Rank',
      'Player Name',
      'Avatar',
      'Total Score (pts)',
      'Percentage (%)',
      'Pass / Fail Status',
      'Questions Answered',
      'Max Streak',
      'Session Status',
      ...qHeaders,
    ];

    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = leaderboard.map((entry, idx) => {
      const pct = entry.percentage !== undefined
        ? entry.percentage
        : (questions.length > 0 ? Math.round(((entry.score || 0) / (questions.length * 10)) * 100) : 0);
      const passed = entry.passed !== undefined ? entry.passed : (pct >= 60 && entry.status !== 'cancelled');
      const passLabel = entry.status === 'cancelled' ? 'CANCELLED' : (passed ? 'PASS' : 'FAIL');

      const perQuestionCells = questions.map((q, qIdx) => {
        const ans = (entry.answers || []).find((a) => String(a.questionId) === String(q.id || q._id)) || (entry.answers && entry.answers[qIdx]);
        if (!ans) return 'Unanswered';
        return `${ans.isCorrect ? 'Correct' : 'Wrong'} (${ans.selectedText || 'No choice'})`;
      });

      return [
        idx + 1,
        entry.name || 'Player',
        entry.avatar || '🦊',
        entry.score || 0,
        `${pct}%`,
        passLabel,
        `${entry.answersCount ?? (entry.answers || []).length}/${questions.length}`,
        entry.streak || 0,
        entry.status || 'completed',
        ...perQuestionCells,
      ].map(escapeCsv).join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(quizInfo?.title || 'Live_Quiz').replace(/[^a-z0-9]/gi, '_')}_${code.toUpperCase()}_Results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('📊 CSV Scorecard downloaded!');
  };

  const handleExportPDF = () => {
    if (!leaderboard || leaderboard.length === 0) {
      toast.error('No participant results available to export.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=980,height=720');
    if (!printWindow) {
      toast.error('Please allow pop-ups to generate the PDF scorecard.');
      return;
    }

    const quizTitle = quizInfo?.title || 'Live Assessment Session';
    const dateStr = new Date().toLocaleString();

    const rowsHtml = leaderboard.map((entry, idx) => {
      const pct = entry.percentage !== undefined
        ? entry.percentage
        : (questions.length > 0 ? Math.round(((entry.score || 0) / (questions.length * 10)) * 100) : 0);
      const passed = entry.passed !== undefined ? entry.passed : (pct >= 60 && entry.status !== 'cancelled');
      const statusBadge = entry.status === 'cancelled'
        ? '<span style="color:#dc2626;font-weight:700;">CANCELLED</span>'
        : passed
          ? '<span style="color:#059669;font-weight:800;">PASS</span>'
          : '<span style="color:#d97706;font-weight:800;">FAIL</span>';

      const breakdownHtml = questions.map((q, qIdx) => {
        const ans = (entry.answers || []).find((a) => String(a.questionId) === String(q.id || q._id)) || (entry.answers && entry.answers[qIdx]);
        if (!ans) return `<span style="display:inline-block;margin:2px;padding:2px 6px;border-radius:4px;background:#f3f4f6;color:#6b7280;font-size:11px;">Q${qIdx + 1}: -</span>`;
        const bg = ans.isCorrect ? '#d1fae5' : '#fee2e2';
        const col = ans.isCorrect ? '#065f46' : '#991b1b';
        return `<span style="display:inline-block;margin:2px;padding:2px 6px;border-radius:4px;background:${bg};color:${col};font-size:11px;font-weight:700;">Q${qIdx + 1}: ${ans.isCorrect ? '✓' : '✗'}</span>`;
      }).join(' ');

      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:800;">#${idx + 1}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:700;">${entry.avatar || '🦊'} ${entry.name}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:800;">${entry.score || 0} pts</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${pct}%</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${statusBadge}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${breakdownHtml || `${entry.answersCount || 0}/${questions.length}`}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${quizTitle} - Official Scorecard (${code.toUpperCase()})</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: #111827; }
            h1 { margin: 0 0 6px 0; color: #065f46; font-size: 24px; }
            .meta { color: #4b5563; font-size: 13px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { text-align: left; padding: 10px; background: #065f46; color: #fff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <h1>🏆 ${quizTitle} — Official Class Scorecard</h1>
          <div class="meta">
            Room Code: <strong>${code.toUpperCase()}</strong> &nbsp;|&nbsp;
            Total Players: <strong>${leaderboard.length}</strong> &nbsp;|&nbsp;
            Questions: <strong>${questions.length}</strong> &nbsp;|&nbsp;
            Generated: ${dateStr}
          </div>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Participant</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Status</th>
                <th>Per-Question Breakdown</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 250); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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

  // Haptic feedback helper for mobile vibration
  const triggerHaptic = useCallback((type = 'correct') => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'correct') {
          navigator.vibrate([40, 60, 40]);
        } else if (type === 'wrong') {
          navigator.vibrate([120, 80, 120]);
        } else if (type === 'streak') {
          navigator.vibrate([60, 40, 60, 40, 100]);
        } else if (type === 'powerup') {
          navigator.vibrate([50]);
        }
      } catch {}
    }
  }, []);

  const getStreakMultiplier = useCallback((s) => {
    if (s >= 10) return 3.0;
    if (s >= 5) return 2.0;
    if (s >= 3) return 1.5;
    if (s >= 2) return 1.2;
    return 1.0;
  }, []);

  const getParticipantAvatar = useCallback((name) => {
    const found = participantDetails.find((p) => p.name === name);
    return found?.avatar || '🦊';
  }, [participantDetails]);

  const handleSendReaction = (emoji) => {
    triggerHaptic('powerup');
    const socket = getSocket();
    socket.emit('room:send-reaction', {
      roomCode: code.toUpperCase(),
      emoji,
    });
  };

  const handleSelectAvatar = (av) => {
    setSelectedAvatar(av);
    try {
      localStorage.setItem('user_quiz_avatar', av);
    } catch {}
    triggerHaptic('powerup');
    const socket = getSocket();
    socket.emit('participant:join-room', {
      roomCode: code.toUpperCase(),
      participantName: user?.name || `Player_${Math.floor(Math.random() * 900 + 100)}`,
      userId: user?.id || user?._id || null,
      avatar: av,
    });
  };

  const handleUseFiftyFifty = () => {
    if (!powerUps.fiftyFifty || hasAnsweredCurrent || questionTimer.secondsLeft <= 0) return;
    const qList = questionsRef.current.length > 0 ? questionsRef.current : questions;
    const currentQuestion = qList[currentQIdxRef.current] || qList[currentQIdx];
    if (!currentQuestion || !currentQuestion.options || currentQuestion.options.length <= 2) return;

    const correctIdx = currentQuestion.correctIndex;
    const wrongIndices = currentQuestion.options
      .map((_, idx) => idx)
      .filter((idx) => idx !== correctIdx);
    const shuffledWrong = [...wrongIndices].sort(() => Math.random() - 0.5);
    const toEliminate = shuffledWrong.slice(0, 2);

    setEliminatedOptions(toEliminate);
    setPowerUps((prev) => ({ ...prev, fiftyFifty: false }));
    triggerHaptic('powerup');
    toast.success('🌓 50/50 Activated! Two wrong options eliminated.');
  };

  const handleUseExtraTime = () => {
    if (!powerUps.extraTime || hasAnsweredCurrent || questionTimer.secondsLeft <= 0) return;
    setQuestionTimer((prev) => ({
      secondsLeft: prev.secondsLeft + 15,
      totalSeconds: prev.totalSeconds + 15,
    }));
    setPowerUps((prev) => ({ ...prev, extraTime: false }));
    triggerHaptic('powerup');
    toast.success('⏱️ +15 Seconds added to your timer!');
  };

  const handleUseDoubleDown = () => {
    if (!powerUps.doubleDown || doubleDownActive || hasAnsweredCurrent || questionTimer.secondsLeft <= 0) return;
    setDoubleDownActive(true);
    setPowerUps((prev) => ({ ...prev, doubleDown: false }));
    triggerHaptic('powerup');
    toast('⚡ Double Down Active! 2x points if right!', { icon: '⚡' });
  };

  const moveToNextQuestion = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    // Reset per-question active powerups
    setEliminatedOptions([]);
    setDoubleDownActive(false);

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
    setStreak(0);
    triggerHaptic('wrong');
    soundManager.playIncorrect();
    toast('⏰ Time is up for this question!', { id: 'time-up-toast', icon: '⌛' });

    const qList = questionsRef.current.length > 0 ? questionsRef.current : questions;
    const currentQuestion = qList[currentQIdxRef.current];

    // Record to answer review history
    if (currentQuestion) {
      setReviewHistory((prev) => [
        ...prev,
        {
          questionIdx: currentQIdxRef.current,
          questionTitle: currentQuestion.title,
          options: currentQuestion.options || [],
          selectedOptionText: '(Time expired)',
          correctOptionText: currentQuestion.options?.[currentQuestion.correctIndex] || '',
          isCorrect: false,
          pointsAwarded: 0,
          explanation: currentQuestion.explanation || '',
        },
      ]);
    }

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
  }, [questions, code, user, moveToNextQuestion, triggerHaptic]);

  // Pass both the option text and its index so we can compute correctness
  const handleAnswerSubmit = useCallback((optionText, optionIndex) => {
    if (hasAnsweredRef.current || hasCompletedRef.current || questionTimer.secondsLeft <= 0) return;

    hasAnsweredRef.current = true;
    const qList = questionsRef.current.length > 0 ? questionsRef.current : questions;
    const currentQuestion = qList[currentQIdxRef.current] || qList[currentQIdx];
    if (!currentQuestion) return;

    // Compute correctness client-side using correctIndex from server payload
    const isCorrect = optionIndex === currentQuestion.correctIndex;
    let finalPoints = 0;

    if (isCorrect) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setMaxStreak((prev) => Math.max(prev, nextStreak));
      const mult = getStreakMultiplier(nextStreak);
      const basePts = Number(currentQuestion.points) || 10;
      finalPoints = Math.round(basePts * mult * (doubleDownActive ? 2 : 1));

      if (nextStreak >= 3) {
        triggerHaptic('streak');
      } else {
        triggerHaptic('correct');
      }
      soundManager.playCorrect();
      launchSprinkles();
    } else {
      setStreak(0);
      triggerHaptic('wrong');
      soundManager.playIncorrect();
      finalPoints = doubleDownActive ? -5 : 0;
    }

    setSelectedOption(optionText);
    setSelectedOptionIdx(optionIndex);
    setHasAnsweredCurrent(true);
    setAnswerResult(isCorrect ? 'correct' : 'wrong');
    setLastPointsDelta(finalPoints);
    setMyScore((prev) => Math.max(0, prev + finalPoints));

    // Save to Post-Quiz Answer Review History
    setReviewHistory((prev) => [
      ...prev,
      {
        questionIdx: currentQIdxRef.current,
        questionTitle: currentQuestion.title,
        options: currentQuestion.options || [],
        selectedOptionText: optionText,
        correctOptionText: currentQuestion.options?.[currentQuestion.correctIndex] || '',
        isCorrect,
        pointsAwarded: finalPoints,
        explanation: currentQuestion.explanation || '',
      },
    ]);

    const socket = getSocket();
    socket.emit('participant:submit-answer', {
      roomCode: code.toUpperCase(),
      questionIdx: currentQIdxRef.current,
      questionId: currentQuestion.id || currentQuestion._id || null,
      selectedOptionText: optionText,
      isCorrect,
      pointsAwarded: finalPoints,
      userId: user?.id || user?._id || null,
    });

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      moveToNextQuestion();
    }, 450);
  }, [
    questionTimer.secondsLeft,
    questions,
    currentQIdx,
    code,
    user,
    streak,
    doubleDownActive,
    getStreakMultiplier,
    triggerHaptic,
    launchSprinkles,
    moveToNextQuestion,
  ]);

  // 1. Local per-question timer countdown for the active participant
  useEffect(() => {
    if (roomState !== 'in_progress' || isHost || isPaused || hasCompletedAllQuestions || hasAnsweredCurrent || hasCancelled || isKicked) {
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
  }, [roomState, isHost, isPaused, currentQIdx, hasCompletedAllQuestions, hasAnsweredCurrent, hasCancelled, isKicked]);

  // 1b. Smooth timer countdown for host view
  useEffect(() => {
    if (roomState !== 'in_progress' || !isHost || isPaused) {
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
  }, [roomState, isHost, isPaused, currentQIdx]);

  // 2. Safely trigger handleTimeUp when secondsLeft reaches 0 outside of state updaters
  useEffect(() => {
    if (
      roomState === 'in_progress' &&
      !isHost &&
      !isPaused &&
      !hasCompletedAllQuestions &&
      !hasAnsweredCurrent &&
      !hasCancelled &&
      !isKicked &&
      questionTimer.secondsLeft <= 0
    ) {
      handleTimeUp();
    }
  }, [questionTimer.secondsLeft, roomState, isHost, isPaused, hasCompletedAllQuestions, hasAnsweredCurrent, hasCancelled, isKicked, handleTimeUp]);

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
    // 50/50 eliminated option
    if (eliminatedOptions.includes(optionIndex)) {
      return {
        backgroundColor: 'var(--surface)',
        color: 'var(--text-muted)',
        border: '1px dashed var(--border)',
        opacity: 0.28,
        cursor: 'not-allowed',
        textDecoration: 'line-through',
        pointerEvents: 'none',
      };
    }

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

  if (isKicked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '580px', margin: '2rem auto', width: '100%', padding: '0 0.75rem', boxSizing: 'border-box' }}>
        <Card style={{ padding: 'clamp(1.75rem, 4vw, 2.75rem)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'hsl(0 84% 55% / 0.12)', color: 'hsl(0 84% 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserX size={34} />
          </div>
          <div>
            <Badge variant="danger" style={{ marginBottom: '0.4rem', backgroundColor: 'hsl(0 84% 55% / 0.15)', color: 'hsl(0 84% 65%)', border: '1px solid hsl(0 84% 55%)' }}>
              ACCESS RESTRICTED
            </Badge>
            <h2 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)', fontWeight: 900, color: 'var(--text)' }}>
              Unable to Participate
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.94rem', marginTop: '0.35rem', lineHeight: 1.5 }}>
              {kickedMessage || 'You have been removed from this live session or the room is currently locked by the host.'}
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
      </div>
    );
  }

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

          {/* Avatar Selection Picker for Players */}
          {!isHost && (
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.9rem',
                backgroundColor: 'var(--surface-2)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{selectedAvatar}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)' }}>
                  Choose Your Character Avatar
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', justifyContent: 'center' }}>
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => handleSelectAvatar(av)}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      border: selectedAvatar === av ? '2.5px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: selectedAvatar === av ? 'var(--primary-soft)' : 'var(--surface)',
                      fontSize: '1.35rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: selectedAvatar === av ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: selectedAvatar === av ? '0 0 12px var(--primary)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                    title={`Choose ${av}`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              participants.map((name, idx) => {
                const detail = participantDetails.find((p) => p.name === name);
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      padding: '0.35rem 0.75rem',
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
                    <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{detail?.avatar || getParticipantAvatar(name)}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    {isHost && (
                      <button
                        type="button"
                        onClick={() => handleKickParticipant(name, detail?.socketId)}
                        title={`Kick / Ban ${name}`}
                        style={{
                          background: 'hsl(0 84% 55% / 0.12)',
                          border: 'none',
                          color: 'hsl(0 84% 55%)',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          marginLeft: '0.15rem',
                          padding: 0,
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Host Action to Start */}
          {isHost ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '380px' }}>
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
                  justifyContent: 'flex-start',
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
                  justifyContent: 'flex-start',
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="checkbox"
                  checked={enablePowerUpsLobby}
                  onChange={(e) => setEnablePowerUpsLobby(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span>⚡ Enable player Power-Ups (50/50, +15s, 2x)</span>
              </label>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isRoomLocked ? 'hsl(38 92% 50% / 0.12)' : 'var(--surface)',
                  border: isRoomLocked ? '1.5px solid hsl(38 92% 50%)' : '1px solid var(--border)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text)',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={lockOnStartLobby}
                    onChange={(e) => setLockOnStartLobby(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span>🔒 Auto-lock room when quiz starts</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleToggleLock(!isRoomLocked)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--border)',
                    backgroundColor: isRoomLocked ? 'hsl(38 92% 50%)' : 'var(--surface-2)',
                    color: isRoomLocked ? '#fff' : 'var(--text)',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                  title={isRoomLocked ? 'Unlock Lobby Now' : 'Lock Lobby Now'}
                >
                  {isRoomLocked ? <><Lock size={12} /> Locked</> : <><Unlock size={12} /> Lock Now</>}
                </button>
              </div>

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
              {!isHost && streak >= 2 && (
                <motion.div
                  key={`streak-${streak}`}
                  initial={{ scale: 0.85 }}
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ duration: 0.45 }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    backgroundColor: 'hsl(24 95% 53% / 0.16)', border: '1.5px solid hsl(24 95% 53%)',
                    padding: '0.28rem 0.7rem', borderRadius: 'var(--radius-pill)',
                    fontWeight: 900, fontSize: '0.82rem', color: 'hsl(24 95% 48%)',
                    boxShadow: streak >= 3 ? '0 0 12px hsl(24 95% 53% / 0.35)' : 'none',
                  }}
                >
                  <Flame size={13} /> 🔥 {streak}x Streak ({getStreakMultiplier(streak)}x)
                </motion.div>
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
              HOST VIEW: Question Display, Controls, Live Distribution & Leaderboard
              ============================================================ */}
          {isHost && (
            <Card
              style={{
                padding: isProjectorMode ? '2.5rem' : '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                ...(isProjectorMode
                  ? {
                      position: 'fixed',
                      inset: 0,
                      zIndex: 9500,
                      borderRadius: 0,
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg)',
                    }
                  : {}),
              }}
            >
              {/* Header row with timer, counts, and controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <TimerRing
                    secondsLeft={questionTimer.secondsLeft}
                    totalSeconds={questionTimer.totalSeconds}
                    size={isProjectorMode ? 68 : 52}
                  />
                  <div>
                    <div style={{ fontSize: isProjectorMode ? '0.85rem' : '0.7rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>TIME LEFT — Q {currentQIdx + 1} / {questions.length}</span>
                      {isPaused && (
                        <Badge variant="danger" style={{ backgroundColor: 'hsl(38 92% 50%)', color: '#fff', fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                          PAUSED
                        </Badge>
                      )}
                    </div>
                    <div style={{
                      fontSize: isProjectorMode ? '2.4rem' : '1.8rem', fontWeight: 900, lineHeight: 1,
                      color: isPaused ? 'hsl(38 92% 50%)' : questionTimer.secondsLeft <= 5 ? 'hsl(0 84% 55%)' : 'var(--text)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {questionTimer.secondsLeft}s
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                      padding: '0.42rem 0.9rem', borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'var(--primary-soft)', border: '1.5px solid var(--primary)',
                      color: 'var(--primary-text)', fontWeight: 800, fontSize: '0.85rem',
                    }}
                  >
                    <CheckCircle2 size={14} />
                    {submissionStats.submittedCount} / {submissionStats.totalParticipants} answered
                  </div>

                  {/* Pause / Resume Clock Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTogglePause}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 800,
                      borderColor: isPaused ? 'hsl(142 71% 45%)' : 'hsl(38 92% 50%)',
                      color: isPaused ? 'hsl(142 71% 40%)' : 'hsl(38 92% 45%)',
                      backgroundColor: isPaused ? 'hsl(142 71% 45% / 0.1)' : 'hsl(38 92% 50% / 0.1)',
                    }}
                    title={isPaused ? 'Resume Question Timer' : 'Pause Question Timer'}
                  >
                    {isPaused ? <><Play size={14} /> Resume Timer</> : <><Pause size={14} /> Pause Timer</>}
                  </Button>

                  {/* Lock / Unlock Room Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleLock(!isRoomLocked)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 800,
                      borderColor: isRoomLocked ? 'hsl(38 92% 50%)' : 'var(--border)',
                      color: isRoomLocked ? 'hsl(38 92% 45%)' : 'var(--text)',
                    }}
                    title={isRoomLocked ? 'Room is locked (Click to unlock)' : 'Lock room to prevent late joins'}
                  >
                    {isRoomLocked ? <><Lock size={14} /> Locked</> : <><Unlock size={14} /> Lock Room</>}
                  </Button>

                  {/* Projector / Presentation Mode Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleProjectorMode}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 800,
                    }}
                    title={isProjectorMode ? 'Exit Projector Mode' : 'Enter Fullscreen Projector Mode'}
                  >
                    {isProjectorMode ? <><Minimize2 size={14} /> Exit Projector</> : <><Maximize2 size={14} /> Projector Mode</>}
                  </Button>

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
                </div>
              </div>

              {/* Host Active Question Card + Kahoot-Style Live Option Distribution Bars */}
              {(() => {
                const barColors = [
                  '#E11D48', // Kahoot Red / Rose
                  '#2563EB', // Kahoot Blue
                  '#D97706', // Kahoot Gold / Amber
                  '#059669', // Kahoot Green / Emerald
                ];

                const isAllOverview = hostInspectQIdx === 'all' && !isProjectorMode && questions.length > 1;
                const activeHostQIdx =
                  typeof hostInspectQIdx === 'number' && questions[hostInspectQIdx]
                    ? hostInspectQIdx
                    : hostInspectQIdx === 'live' && questions[lastActiveQIdx]
                    ? lastActiveQIdx
                    : currentQIdx;
                const inspectedQ = questions[activeHostQIdx] || currentQ;
                const qDist = optionDistribution[inspectedQ?.id] || optionDistribution[activeHostQIdx] || { counts: [], totalResponses: 0, correctResponses: 0 };
                const totalResp = qDist.totalResponses || 0;
                const maxCount = Math.max(1, ...(qDist.counts || [1]));

                return (
                  <div
                    style={{
                      padding: isProjectorMode ? '2rem' : '1.35rem',
                      borderRadius: 'var(--radius-card)',
                      backgroundColor: 'var(--surface)',
                      border: '1.5px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: isProjectorMode ? '1.35rem' : '1rem',
                    }}
                  >
                    {/* Host Mode Switcher Bar: All Questions Matrix (Best for Shuffled Multi-Player), Auto-Follow Latest Answer, or Single Question */}
                    {questions.length > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.55rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            📊 Host Distribution View:
                          </span>
                          {lastAnswererName && (
                            <Badge variant="secondary" style={{ fontSize: '0.7rem' }}>
                              ⚡ Latest: {lastAnswererName} answered Q{lastActiveQIdx + 1}
                            </Badge>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => setHostInspectQIdx('all')}
                            style={{
                              padding: '0.3rem 0.7rem',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              border: hostInspectQIdx === 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                              backgroundColor: hostInspectQIdx === 'all' ? 'var(--primary)' : 'var(--surface-2)',
                              color: hostInspectQIdx === 'all' ? '#fff' : 'var(--text)',
                              cursor: 'pointer',
                            }}
                            title="Show live Kahoot distribution bars for ALL questions simultaneously (Ideal when questions are shuffled per player)"
                          >
                            🌐 All Questions Live ({questions.length})
                          </button>

                          <button
                            type="button"
                            onClick={() => setHostInspectQIdx('live')}
                            style={{
                              padding: '0.3rem 0.7rem',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              border: hostInspectQIdx === 'live' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                              backgroundColor: hostInspectQIdx === 'live' ? 'var(--primary)' : 'var(--surface-2)',
                              color: hostInspectQIdx === 'live' ? '#fff' : 'var(--text)',
                              cursor: 'pointer',
                            }}
                            title="Automatically jump to whichever question was most recently answered by any player"
                          >
                            ⚡ Auto-Follow Submissions (Q{lastActiveQIdx + 1})
                          </button>

                          <button
                            type="button"
                            onClick={() => setHostInspectQIdx('timer')}
                            style={{
                              padding: '0.3rem 0.7rem',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              border: hostInspectQIdx === 'timer' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                              backgroundColor: hostInspectQIdx === 'timer' ? 'var(--primary)' : 'var(--surface-2)',
                              color: hostInspectQIdx === 'timer' ? '#fff' : 'var(--text)',
                              cursor: 'pointer',
                            }}
                          >
                            ⏱️ Room Clock (Q{currentQIdx + 1})
                          </button>

                          {questions.map((qItem, idx) => {
                            const itemDist = optionDistribution[qItem.id] || optionDistribution[idx];
                            const itemResp = itemDist?.totalResponses || 0;
                            const isSelected = hostInspectQIdx === idx;
                            return (
                              <button
                                key={qItem.id || idx}
                                type="button"
                                onClick={() => setHostInspectQIdx(idx)}
                                style={{
                                  padding: '0.28rem 0.6rem',
                                  borderRadius: 'var(--radius-pill)',
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                                  backgroundColor: isSelected ? 'var(--primary)' : itemResp > 0 ? 'var(--primary-soft)' : 'var(--surface-2)',
                                  color: isSelected ? '#fff' : itemResp > 0 ? 'var(--primary-text)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                                title={`Focus on Question ${idx + 1} (${itemResp} responses)`}
                              >
                                <span>Q{idx + 1}</span>
                                {itemResp > 0 && (
                                  <span style={{ fontSize: '0.68rem', opacity: 0.9 }}>({itemResp})</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ============================================================
                        MODE A: ALL-QUESTIONS LIVE MATRIX (Best for Shuffled Multi-Player)
                        Shows every question and its live A/B/C/D Kahoot bars at once!
                       ============================================================ */}
                    {isAllOverview ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text)' }}>
                            🔀 Players are answering shuffled questions in parallel — watching all {questions.length} questions in real time:
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                            Click any card to expand full-screen view
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.9rem' }}>
                          {questions.map((qItem, qIdx) => {
                            const itemDist = optionDistribution[qItem.id] || optionDistribution[qIdx] || { counts: [], totalResponses: 0, correctResponses: 0 };
                            const itemTotal = itemDist.totalResponses || 0;
                            const itemMax = Math.max(1, ...(itemDist.counts || [1]));
                            const isRecentlyAnswered = qIdx === lastActiveQIdx && itemTotal > 0;

                            return (
                              <div
                                key={qItem.id || qIdx}
                                onClick={() => setHostInspectQIdx(qIdx)}
                                style={{
                                  padding: '1rem',
                                  borderRadius: 'var(--radius-card)',
                                  backgroundColor: 'var(--surface-2)',
                                  border: isRecentlyAnswered ? '2px solid var(--primary)' : '1px solid var(--border)',
                                  boxShadow: isRecentlyAnswered ? 'var(--card-shadow-hover)' : 'none',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.75rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                                  <Badge variant="primary" style={{ fontSize: '0.72rem', fontWeight: 900 }}>
                                    Q{qIdx + 1}
                                  </Badge>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: itemTotal > 0 ? 'var(--primary-text)' : 'var(--text-muted)' }}>
                                    {itemTotal} / {participants.length || submissionStats.totalParticipants || 0} Answered
                                  </span>
                                </div>

                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.5em' }}>
                                  {qItem.title}
                                </div>

                                {/* Mini Vertical Kahoot Column Chart */}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${(qItem.options || []).length || 4}, minmax(0, 1fr))`,
                                    gap: '0.45rem',
                                    alignItems: 'end',
                                    height: '86px',
                                    padding: '0.6rem 0.5rem 0.35rem',
                                    backgroundColor: 'var(--surface)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border)',
                                  }}
                                >
                                  {(qItem.options || []).map((optText, optIdx) => {
                                    const isCorrect = optIdx === qItem.correctIndex;
                                    const letter = String.fromCharCode(65 + optIdx);
                                    const c = itemDist.counts?.[optIdx] || 0;
                                    const pct = itemTotal > 0 ? Math.round((c / itemTotal) * 100) : 0;
                                    const hRatio = itemTotal > 0 ? Math.max(12, Math.round((c / itemMax) * 100)) : 12;
                                    const colColor = barColors[optIdx % barColors.length];

                                    return (
                                      <div key={optIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '0.2rem' }}>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                                          {c} ({pct}%)
                                        </span>
                                        <div
                                          style={{
                                            width: '100%',
                                            maxWidth: '42px',
                                            height: `${hRatio}%`,
                                            minHeight: '8px',
                                            backgroundColor: colColor,
                                            borderRadius: '6px 6px 2px 2px',
                                            boxShadow: isCorrect ? '0 0 0 2px #10B981' : 'none',
                                            transition: 'height 0.35s ease',
                                          }}
                                        />
                                        <span style={{ fontSize: '0.68rem', fontWeight: 900, color: isCorrect ? '#059669' : 'var(--text-muted)' }}>
                                          {letter}{isCorrect ? '✓' : ''}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Option Breakdown Rows */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  {(qItem.options || []).map((optText, optIdx) => {
                                    const isCorrect = optIdx === qItem.correctIndex;
                                    const letter = String.fromCharCode(65 + optIdx);
                                    const c = itemDist.counts?.[optIdx] || 0;
                                    const pct = itemTotal > 0 ? Math.round((c / itemTotal) * 100) : 0;
                                    const colColor = barColors[optIdx % barColors.length];
                                    return (
                                      <div
                                        key={optIdx}
                                        style={{
                                          position: 'relative',
                                          overflow: 'hidden',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '0.4rem',
                                          padding: '0.32rem 0.55rem',
                                          borderRadius: '7px',
                                          backgroundColor: 'var(--surface)',
                                          border: isCorrect ? '1.5px solid #10B981' : '1px solid var(--border)',
                                          fontSize: '0.76rem',
                                        }}
                                      >
                                        <div
                                          style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            bottom: 0,
                                            width: `${pct}%`,
                                            backgroundColor: `${colColor}20`,
                                            transition: 'width 0.35s ease',
                                            pointerEvents: 'none',
                                          }}
                                        />
                                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                          <span style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: colColor, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.66rem', fontWeight: 900, flexShrink: 0 }}>
                                            {letter}
                                          </span>
                                          <span style={{ fontWeight: isCorrect ? 800 : 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {optText}
                                          </span>
                                        </div>
                                        <span style={{ position: 'relative', zIndex: 1, fontWeight: 900, color: 'var(--text)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                                          {c} ({pct}%)
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* ============================================================
                          MODE B: SINGLE FOCUSED QUESTION VIEW (With Big Kahoot Chart)
                         ============================================================ */
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <Badge variant="primary" style={{ fontSize: isProjectorMode ? '0.92rem' : '0.75rem', fontWeight: 900 }}>
                              QUESTION {activeHostQIdx + 1} OF {questions.length}
                            </Badge>
                            <Badge variant="secondary" style={{ fontSize: isProjectorMode ? '0.9rem' : '0.75rem' }}>
                              {inspectedQ?.points || 10} pts
                            </Badge>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Badge variant="primary" style={{ fontSize: isProjectorMode ? '0.9rem' : '0.75rem' }}>
                              <BarChart2 size={12} style={{ marginRight: '4px' }} /> {totalResp} Response{totalResp !== 1 ? 's' : ''} on Q{activeHostQIdx + 1}
                            </Badge>
                          </div>
                        </div>

                        <h2 style={{ fontSize: isProjectorMode ? 'clamp(1.75rem, 3.8vw, 2.5rem)' : 'clamp(1.15rem, 2.5vw, 1.45rem)', fontWeight: 900, color: 'var(--text)', margin: '0.15rem 0', lineHeight: 1.35 }}>
                          {inspectedQ?.title || 'Preparing question...'}
                        </h2>

                        {/* Kahoot-Style Vertical Column Chart */}
                        {inspectedQ?.options && (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${inspectedQ.options.length}, minmax(0, 1fr))`,
                              gap: isProjectorMode ? '1.25rem' : '0.85rem',
                              alignItems: 'end',
                              height: isProjectorMode ? '220px' : '165px',
                              padding: '1.25rem 1rem 0.75rem',
                              backgroundColor: 'var(--surface-2)',
                              borderRadius: 'var(--radius-card)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {inspectedQ.options.map((optText, optIdx) => {
                              const isCorrect = optIdx === inspectedQ.correctIndex;
                              const letter = String.fromCharCode(65 + optIdx);
                              const count = qDist.counts?.[optIdx] || 0;
                              const pct = totalResp > 0 ? Math.round((count / totalResp) * 100) : 0;
                              const heightRatio = totalResp > 0 ? Math.max(10, Math.round((count / maxCount) * 100)) : 10;
                              const colColor = barColors[optIdx % barColors.length];

                              return (
                                <div
                                  key={`col-${optIdx}`}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    height: '100%',
                                    gap: '0.4rem',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      fontWeight: 900,
                                      fontSize: isProjectorMode ? '1.1rem' : '0.85rem',
                                      color: 'var(--text)',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    <span>{count}</span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                      ({pct}%)
                                    </span>
                                    {isCorrect && (
                                      <span style={{ color: '#059669', fontWeight: 900 }} title="Correct Answer">✓</span>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      width: '100%',
                                      maxWidth: isProjectorMode ? '110px' : '78px',
                                      height: `${heightRatio}%`,
                                      minHeight: '12px',
                                      backgroundColor: colColor,
                                      borderRadius: '10px 10px 4px 4px',
                                      boxShadow: isCorrect ? `0 0 0 2.5px #10B981, 0 6px 16px ${colColor}55` : `0 4px 12px ${colColor}40`,
                                      transition: 'height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                      position: 'relative',
                                    }}
                                  />

                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                      fontSize: isProjectorMode ? '0.95rem' : '0.78rem',
                                      fontWeight: 900,
                                      color: 'var(--text)',
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '6px',
                                        backgroundColor: colColor,
                                        color: '#fff',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.74rem',
                                      }}
                                    >
                                      {letter}
                                    </span>
                                    {isCorrect && (
                                      <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 900 }}>Correct</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Detailed Option Cards with Horizontal Fill Bars */}
                        {inspectedQ?.options && (
                          <div style={{ display: 'grid', gridTemplateColumns: isProjectorMode ? 'repeat(auto-fit, minmax(340px, 1fr))' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: isProjectorMode ? '1rem' : '0.75rem' }}>
                            {inspectedQ.options.map((optText, optIdx) => {
                              const isCorrect = optIdx === inspectedQ.correctIndex;
                              const letter = String.fromCharCode(65 + optIdx);
                              const count = qDist.counts?.[optIdx] || 0;
                              const pct = totalResp > 0 ? Math.round((count / totalResp) * 100) : 0;
                              const barColor = barColors[optIdx % barColors.length];

                              return (
                                <div
                                  key={optIdx}
                                  style={{
                                    position: 'relative',
                                    overflow: 'hidden',
                                    padding: isProjectorMode ? '1.15rem 1.35rem' : '0.8rem 1rem',
                                    borderRadius: 'var(--radius-btn)',
                                    backgroundColor: isCorrect ? 'hsl(142 71% 45% / 0.08)' : 'var(--surface-2)',
                                    border: isCorrect ? '2px solid hsl(142 71% 45%)' : '1.5px solid var(--border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.45rem',
                                  }}
                                >
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      bottom: 0,
                                      width: `${pct}%`,
                                      backgroundColor: `${barColor}22`,
                                      transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                      pointerEvents: 'none',
                                    }}
                                  />

                                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                                      <span
                                        style={{
                                          width: isProjectorMode ? '34px' : '26px',
                                          height: isProjectorMode ? '34px' : '26px',
                                          borderRadius: '7px',
                                          backgroundColor: barColor,
                                          color: '#fff',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 900,
                                          fontSize: isProjectorMode ? '0.95rem' : '0.78rem',
                                          flexShrink: 0,
                                        }}
                                      >
                                        {letter}
                                      </span>
                                      <span style={{ fontWeight: isCorrect ? 800 : 700, color: 'var(--text)', fontSize: isProjectorMode ? '1.15rem' : '0.9rem', wordBreak: 'break-word' }}>
                                        {optText}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                      <span style={{ fontWeight: 900, fontSize: isProjectorMode ? '1.05rem' : '0.82rem', color: 'var(--text)' }}>
                                        {count} ({pct}%)
                                      </span>
                                      {isCorrect && (
                                        <Badge variant="primary" style={{ backgroundColor: 'hsl(142 71% 45%)', color: '#fff', fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}>
                                          ✓ Correct
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ position: 'relative', zIndex: 1, width: '100%', height: isProjectorMode ? '8px' : '6px', backgroundColor: 'var(--surface)', borderRadius: '999px', overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${pct}%`,
                                        height: '100%',
                                        backgroundColor: barColor,
                                        borderRadius: '999px',
                                        transition: 'width 0.35s ease',
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{ width: '28px', fontSize: '1.1rem', textAlign: 'center' }}>
                            {isCancelled ? '❌' : (medals[idx] || `#${idx + 1}`)}
                          </span>
                          <span style={{ fontSize: '1.15rem' }}>{entry.avatar || '🦊'}</span>
                          <span style={{
                            fontWeight: isTop3 ? 800 : 600,
                            color: isCancelled ? 'hsl(0 84% 65%)' : 'var(--text)',
                            textDecoration: isCancelled ? 'line-through' : 'none',
                          }}>
                            {entry.name}
                          </span>
                          {entry.streak >= 2 && !isCancelled && (
                            <span
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
                                fontSize: '0.72rem', fontWeight: 800,
                                color: 'hsl(24 95% 50%)', backgroundColor: 'hsl(24 95% 53% / 0.12)',
                                padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-pill)',
                              }}
                            >
                              🔥 {entry.streak}
                            </span>
                          )}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{
                            fontWeight: 900, color: isCancelled ? 'hsl(0 84% 65%)' : 'var(--primary-text)',
                            fontVariantNumeric: 'tabular-nums', fontSize: '1rem',
                          }}>
                            {entry.score} pts
                          </span>
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleKickParticipant(entry.name, entry.socketId)}
                              title={`Kick / Ban ${entry.name}`}
                              style={{
                                background: 'hsl(0 84% 55% / 0.12)',
                                border: '1px solid hsl(0 84% 55% / 0.35)',
                                color: 'hsl(0 84% 55%)',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 900,
                                padding: 0,
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
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
                {maxStreak >= 2 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 800, color: 'hsl(24 95% 48%)' }}>
                    <Flame size={16} /> Highest Streak: {maxStreak} in a row!
                  </div>
                )}
                {reviewHistory.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setShowReviewModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800 }}
                  >
                    <Sparkles size={16} /> 📖 Review Questions & Answers ({reviewHistory.length})
                  </Button>
                )}
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
                        <span style={{ fontSize: '1.1rem' }}>{entry.avatar || '🦊'}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{entry.name}</span>
                        {entry.streak >= 2 && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(24 95% 50%)', backgroundColor: 'hsl(24 95% 53% / 0.12)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-pill)' }}>
                            🔥 {entry.streak}
                          </span>
                        )}
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

              {/* Power-Ups Bar (enabled/disabled by host) */}
              {powerUpsEnabled && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.6rem',
                  padding: '0.65rem 0.95rem',
                  backgroundColor: 'var(--surface)',
                  borderRadius: 'var(--radius-card)',
                  border: '1.5px solid var(--border)',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Sparkles size={12} color="var(--primary)" /> Power-Ups:
                  </span>
                  {/* 50/50 */}
                  <button
                    type="button"
                    onClick={handleUseFiftyFifty}
                    disabled={!powerUps.fiftyFifty || hasAnsweredCurrent || isTimeUp}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.3rem 0.75rem',
                      borderRadius: 'var(--radius-pill)',
                      border: powerUps.fiftyFifty ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: powerUps.fiftyFifty ? 'var(--primary-soft)' : 'var(--surface-2)',
                      color: powerUps.fiftyFifty ? 'var(--primary-text)' : 'var(--text-muted)',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: powerUps.fiftyFifty && !hasAnsweredCurrent && !isTimeUp ? 'pointer' : 'not-allowed',
                      opacity: powerUps.fiftyFifty ? 1 : 0.45,
                      transition: 'all 0.2s',
                    }}
                    title={powerUps.fiftyFifty ? 'Eliminate 2 wrong options' : '50/50 already used'}
                  >
                    <span>🌓</span> 50/50 {powerUps.fiftyFifty ? '' : '✓'}
                  </button>

                  {/* Extra Time */}
                  <button
                    type="button"
                    onClick={handleUseExtraTime}
                    disabled={!powerUps.extraTime || hasAnsweredCurrent || isTimeUp}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.3rem 0.75rem',
                      borderRadius: 'var(--radius-pill)',
                      border: powerUps.extraTime ? '1.5px solid hsl(217 91% 60%)' : '1px solid var(--border)',
                      backgroundColor: powerUps.extraTime ? 'hsl(217 91% 60% / 0.12)' : 'var(--surface-2)',
                      color: powerUps.extraTime ? 'hsl(217 91% 55%)' : 'var(--text-muted)',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: powerUps.extraTime && !hasAnsweredCurrent && !isTimeUp ? 'pointer' : 'not-allowed',
                      opacity: powerUps.extraTime ? 1 : 0.45,
                      transition: 'all 0.2s',
                    }}
                    title={powerUps.extraTime ? 'Add +15 seconds to question' : 'Extra Time already used'}
                  >
                    <span>⏱️</span> +15s Time {powerUps.extraTime ? '' : '✓'}
                  </button>

                  {/* Double Down */}
                  <button
                    type="button"
                    onClick={handleUseDoubleDown}
                    disabled={!powerUps.doubleDown || doubleDownActive || hasAnsweredCurrent || isTimeUp}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.3rem 0.75rem',
                      borderRadius: 'var(--radius-pill)',
                      border: doubleDownActive
                        ? '2px solid hsl(38 92% 50%)'
                        : powerUps.doubleDown
                        ? '1.5px solid hsl(38 92% 50% / 0.6)'
                        : '1px solid var(--border)',
                      backgroundColor: doubleDownActive
                        ? 'hsl(38 92% 50% / 0.22)'
                        : powerUps.doubleDown
                        ? 'hsl(38 92% 50% / 0.12)'
                        : 'var(--surface-2)',
                      color: doubleDownActive ? 'hsl(38 92% 45%)' : powerUps.doubleDown ? 'hsl(38 92% 45%)' : 'var(--text-muted)',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: powerUps.doubleDown && !doubleDownActive && !hasAnsweredCurrent && !isTimeUp ? 'pointer' : 'not-allowed',
                      opacity: powerUps.doubleDown || doubleDownActive ? 1 : 0.45,
                      boxShadow: doubleDownActive ? '0 0 10px hsl(38 92% 50% / 0.4)' : 'none',
                      transition: 'all 0.2s',
                    }}
                    title={powerUps.doubleDown ? 'Double Down: 2x points if right!' : 'Double Down used'}
                  >
                    <span>⚡</span> {doubleDownActive ? '2X ACTIVE!' : '2x Points'} {!powerUps.doubleDown && !doubleDownActive ? '✓' : ''}
                  </button>
                </div>

                {streak >= 2 && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.82rem',
                      fontWeight: 900,
                      color: 'hsl(24 95% 48%)',
                      backgroundColor: 'hsl(24 95% 53% / 0.12)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid hsl(24 95% 53% / 0.4)',
                    }}
                  >
                    <Flame size={14} /> 🔥 {streak}x Streak Active ({getStreakMultiplier(streak)}x)
                  </div>
                )}
              </div>
              )}

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
                    <div style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>TIME REMAINING</span>
                      {isPaused && (
                        <Badge variant="danger" style={{ backgroundColor: 'hsl(38 92% 50%)', color: '#fff', fontSize: '0.65rem', padding: '0.08rem 0.38rem' }}>
                          PAUSED BY HOST
                        </Badge>
                      )}
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
                        ? <><CheckCircle2 size={18} flexShrink={0} /> Correct! +{lastPointsDelta || currentQ?.points || 10} pts{streak >= 2 ? ` (🔥 ${streak}x Streak)` : ''} — moving to next</>
                        : <><XCircle size={18} flexShrink={0} /> {lastPointsDelta < 0 ? `Wrong (${lastPointsDelta} pts Double Down)` : 'Wrong answer'} — moving to next</>}
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
                    const isOptionDisabled = hasAnsweredCurrent || isTimeUp || eliminatedOptions.includes(idx);
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

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
            {isHost && leaderboard.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800 }}
                >
                  <Download size={16} /> 📊 Export CSV Scorecard
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportPDF}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800 }}
                >
                  <FileText size={16} /> 📄 Export PDF Report
                </Button>
              </>
            )}
            {reviewHistory.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowReviewModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800 }}
              >
                <Sparkles size={16} /> 📖 Review Questions & Answers ({reviewHistory.length})
              </Button>
            )}
            <Button onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      )}

      {/* Floating Reaction Emojis Particles Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9998,
          overflow: 'hidden',
        }}
      >
        <AnimatePresence>
          {floatingReactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 1, y: '90vh', scale: 0.8 }}
              animate={{
                opacity: [1, 1, 0],
                y: '10vh',
                scale: [0.8, 1.35, 1.05],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.3, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: `${r.left}%`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))',
              }}
            >
              <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{r.emoji}</span>
              {r.senderName && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    backgroundColor: 'rgba(0,0,0,0.72)',
                    color: '#fff',
                    padding: '0.12rem 0.45rem',
                    borderRadius: '8px',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.senderAvatar || '🦊'} {r.senderName}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Interactive 1-Tap Reaction Emoji Dock */}
      <div
        style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          backgroundColor: 'var(--surface)',
          padding: '0.35rem 0.65rem',
          borderRadius: 'var(--radius-pill)',
          border: '1.5px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', marginRight: '0.15rem' }}>
          React:
        </span>
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleSendReaction(emoji)}
            title={`Send ${emoji} reaction`}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '0.2rem',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Post-Quiz Answer & Explanation Review Modal */}
      {showReviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 'clamp(0.75rem, 3vw, 1.5rem)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 40px -10px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
                  📖 Performance & Answer Review
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Review your answers, correct solutions, and AI learning tips.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Scrollable Questions List */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              {reviewHistory.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                  No questions were recorded for review.
                </p>
              ) : (
                reviewHistory.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-card)',
                      backgroundColor: item.isCorrect ? 'hsl(142 71% 45% / 0.06)' : 'hsl(0 84% 55% / 0.06)',
                      border: item.isCorrect ? '1.5px solid hsl(142 71% 45% / 0.4)' : '1.5px solid hsl(0 84% 55% / 0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--text-muted)' }}>
                        Question {idx + 1}
                      </span>
                      <Badge
                        variant={item.isCorrect ? 'primary' : 'danger'}
                        style={{
                          backgroundColor: item.isCorrect ? 'hsl(142 71% 45%)' : 'hsl(0 84% 55%)',
                          color: '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                        }}
                      >
                        {item.isCorrect ? `✓ Correct (+${item.pointsAwarded} pts)` : '✗ Incorrect (0 pts)'}
                      </Badge>
                    </div>

                    <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                      {item.questionTitle}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: item.isCorrect ? 'hsl(142 71% 35%)' : 'hsl(0 84% 55%)' }}>
                        <strong>Your Answer:</strong>
                        <span>{item.selectedOptionText}</span>
                      </div>
                      {!item.isCorrect && item.correctOptionText && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'hsl(142 71% 35%)' }}>
                          <strong>Correct Answer:</strong>
                          <span>{item.correctOptionText}</span>
                        </div>
                      )}
                    </div>

                    {item.explanation && (
                      <div
                        style={{
                          marginTop: '0.35rem',
                          padding: '0.55rem 0.75rem',
                          borderRadius: 'var(--radius-btn)',
                          backgroundColor: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.4,
                        }}
                      >
                        <strong style={{ color: 'var(--primary)' }}>💡 Learning Tip: </strong>
                        {item.explanation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowReviewModal(false)}>
                Done
              </Button>
            </div>
          </motion.div>
        </div>
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
