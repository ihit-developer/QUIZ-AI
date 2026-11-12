const liveRoomStore = require('../services/liveRoomStore');

/**
 * Live Room Socket Handler (Kahoot-Style)
 * Manages synchronized lobby, participant roster, host start, auto-advance,
 * real-time leaderboard, persistent attempt database saving, and ended room lockdown.
 */
class LiveSessionManager {
  constructor() {
    // roomCode -> { hostSocketId, quizId, quizTitle, status, currentQuestionIdx, questions, participants: Map(socketId -> { ... }) }
    this.rooms = new Map();
    // Dedicated in-memory timer map: roomCode -> { timerInterval: null, advanceTimeout: null }
    this.roomTimers = new Map();
  }

  clearRoomTimers(code) {
    const t = this.roomTimers.get(code);
    if (t) {
      if (t.timerInterval) {
        clearInterval(t.timerInterval);
        t.timerInterval = null;
      }
      if (t.advanceTimeout) {
        clearTimeout(t.advanceTimeout);
        t.advanceTimeout = null;
      }
    }
  }

  getOrCreateTimerState(code) {
    if (!this.roomTimers.has(code)) {
      this.roomTimers.set(code, { timerInterval: null, advanceTimeout: null, secondsLeft: 30, totalSeconds: 30 });
    }
    return this.roomTimers.get(code);
  }

  // Helper: Format final leaderboard including detailed per-question breakdown for CSV/PDF Export
  buildFinalLeaderboard(room) {
    const totalPointsPossible = (room.questions || []).reduce((acc, q) => acc + (q.points || 10), 0) || 10;
    const passingPercent = room.passingScorePercent || 60;
    return Array.from((room.participants || new Map()).values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((p) => {
        const score = p.score || 0;
        const pct = p.percentage !== undefined ? p.percentage : (totalPointsPossible > 0 ? Math.round((score / totalPointsPossible) * 100) : 0);
        const passed = p.passed !== undefined ? p.passed : (pct >= passingPercent && p.status !== 'cancelled');
        return {
          socketId: p.socketId || null,
          name: p.name,
          avatar: p.avatar || '🦊',
          score,
          totalPointsPossible,
          streak: p.streak || 0,
          percentage: pct,
          passed,
          attemptId: p.savedAttemptId || null,
          answersCount: (p.answers || []).length,
          status: p.status || 'active',
          answers: (p.answers || []).map((a) => ({
            questionId: String(a.questionId?._id || a.questionId?.id || a.questionId || ''),
            selectedText: a.selectedText || '',
            isCorrect: Boolean(a.isCorrect),
            pointsAwarded: a.pointsAwarded || 0,
          })),
        };
      });
  }

  // Helper: Compute Kahoot-style option distribution across all questions for Host View
  computeOptionDistribution(room) {
    const dist = {};
    const participants = Array.from((room.participants || new Map()).values());
    (room.questions || []).forEach((q, qIdx) => {
      const qId = String(q._id || q.id || '');
      const qTitle = String(q.title || '').trim().toLowerCase();
      const rawOpts = (q.options || []).map((o) => (typeof o === 'string' ? o : o.text));
      const counts = rawOpts.map(() => 0);
      let totalResponses = 0;
      let correctResponses = 0;

      participants.forEach((p) => {
        // Match by questionId first, then by questionTitle, and only fall back to index if question order was not shuffled
        const ans = (p.answers || []).find((a) => {
          const aId = String(a.questionId?._id || a.questionId?.id || a.questionId || '');
          if (aId && qId && aId === qId) return true;
          if (a.questionTitle && qTitle && String(a.questionTitle).trim().toLowerCase() === qTitle) return true;
          return false;
        });

        if (ans && ans.selectedText) {
          const matchIdx = rawOpts.findIndex(
            (optText) => String(optText || '').trim().toLowerCase() === String(ans.selectedText || '').trim().toLowerCase()
          );
          if (matchIdx >= 0) {
            counts[matchIdx] += 1;
            totalResponses += 1;
            if (ans.isCorrect) correctResponses += 1;
          }
        }
      });

      const entry = {
        questionIdx: qIdx,
        questionId: qId,
        counts,
        totalResponses,
        correctResponses,
      };
      dist[qIdx] = entry;
      if (qId) {
        dist[qId] = entry;
      }
    });
    return dist;
  }

  // Helper: Persist participant quiz attempt into database on finish
  async saveFinalAttempts(room) {
    if (!room || !room.quizId || !room.participants || room.attemptsSaved || room.isFinalizing) return;
    room.isFinalizing = true;

    const Attempt = require('../models/Attempt');
    const Quiz = require('../models/Quiz');
    const { memoryAttempts } = require('../controllers/attemptController');
    const quizId = room.quizId?._id || room.quizId?.id || room.quizId;
    const totalPointsPossible = (room.questions || []).reduce((acc, q) => acc + (q.points || 10), 0) || 10;

    for (const [, p] of room.participants.entries()) {
      if (p.status === 'cancelled') continue;
      try {
        const score = p.score || 0;
        const percentage = totalPointsPossible > 0 ? Math.round((score / totalPointsPossible) * 100) : 0;
        const passed = percentage >= (room.passingScorePercent || 60);

        const attemptDoc = {
          quizId,
          userId: p.userId?._id || p.userId || null,
          guestSession: p.userId ? null : { name: p.name, guestId: 'guest_' + Math.random().toString(36).substring(2, 8) },
          score,
          percentage,
          totalPointsPossible,
          passed,
          status: 'submitted',
          startedAt: room.startedAt || new Date(),
          submittedAt: new Date(),
          durationSeconds: room.startedAt ? Math.round((Date.now() - room.startedAt.getTime()) / 1000) : 60,
          answers: (p.answers || []).map((ans) => ({
            // Redis serialization uses `id` (not `_id`) for Mongoose
            // documents. Preserve either form so live attempts validate.
            questionId: ans.questionId?._id || ans.questionId?.id || ans.questionId,
            selectedOptions: [ans.selectedText || ''],
            isCorrect: Boolean(ans.isCorrect),
            pointsAwarded: ans.pointsAwarded || 0,
            timeSpentSeconds: ans.timeSpentSeconds || 5,
            answeredAt: new Date(),
          })),
        };

        const savedAttempt = await Attempt.create(attemptDoc);

        // Store attemptId reference so participant can review their submission
        p.savedAttemptId = savedAttempt._id.toString();
        p.percentage = percentage;
        p.passed = passed;
      } catch (err) {
        console.error(`[Live Session] Error saving attempt for participant ${p.name}:`, err.message);
        // Keep localhost usable when MongoDB is temporarily offline. Production
        // databases should be fixed using the logged error, rather than losing
        // the participant result silently.
        const fallbackId = `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        memoryAttempts.set(fallbackId, {
          id: fallbackId,
          _id: fallbackId,
          quizId,
          userId: p.userId?._id || p.userId || null,
          guestSession: p.userId ? null : { name: p.name, guestId: `guest_${Math.random().toString(36).slice(2, 8)}` },
          score: p.score || 0,
          percentage: Math.round(((p.score || 0) / totalPointsPossible) * 100),
          totalPointsPossible,
          passed: false,
          status: 'submitted',
          startedAt: room.startedAt || new Date(),
          submittedAt: new Date(),
          durationSeconds: room.startedAt ? Math.round((Date.now() - new Date(room.startedAt).getTime()) / 1000) : 60,
          answers: p.answers || [],
        });
        p.savedAttemptId = fallbackId;
      }
    }

    room.attemptsSaved = true;
    room.isFinalizing = false;

    // Mark quiz as closed in database so ended quiz cannot be started again
    try {
      await Quiz.findByIdAndUpdate(quizId, { status: 'closed' });
    } catch (err) {
      console.error('[Live Session] Error updating quiz status to closed:', err.message);
    }
  }

  init(io) {
    liveRoomStore.attachSocketAdapter(io);
    io.on('connection', (socket) => {
      // 1. Host creates / opens live room
      socket.on('host:create-room', async ({ roomCode, quizTitle }) => {
        const code = roomCode.toUpperCase();
        const Quiz = require('../models/Quiz');
        const Question = require('../models/Question');
        let questions = [];
        let title = quizTitle || 'Live Multiplayer Quiz';
        let quizDoc = null;

        try {
          quizDoc = await Quiz.findOne({ joinCode: code });
          if (quizDoc) {
            title = quizDoc.title;
            questions = await Question.find({ quizId: quizDoc._id }).sort({ order: 1 });
          }
        } catch (err) {
          console.error('Error fetching quiz for live room:', err.message);
        }
        if (!quizDoc) {
          const { memoryQuizzes, memoryQuestions } = require('../controllers/quizController');
          quizDoc = memoryQuizzes.get(code) || null;
          if (quizDoc) {
            title = quizDoc.title;
            questions = memoryQuestions.get(String(quizDoc._id || quizDoc.id)) || [];
          }
        }

        const existingRoom = await liveRoomStore.get(code) || this.rooms.get(code);

        // If room is already ended or closed in database, lock it down
        if ((existingRoom && existingRoom.status === 'ended') || (quizDoc && quizDoc.status === 'closed')) {
          socket.emit('room:ended-lock', {
            message: 'This live quiz has already concluded and cannot be started again.',
            leaderboard: existingRoom ? Array.from(existingRoom.participants.values()).sort((a, b) => b.score - a.score) : [],
          });
          return;
        }

        const existingParticipants = existingRoom ? existingRoom.participants : new Map();

        const roomObj = {
          hostSocketId: socket.id,
          quizId: quizDoc ? quizDoc._id : null,
          quizTitle: title,
          status: existingRoom ? existingRoom.status : 'lobby',
          currentQuestionIdx: existingRoom ? existingRoom.currentQuestionIdx : 0,
          questions,
          settings: quizDoc?.settings || null,
          passingScorePercent: quizDoc?.settings?.passingScorePercent || 60,
          participants: existingParticipants,
          bannedUsers: existingRoom?.bannedUsers || [],
           bannedNames: existingRoom?.bannedNames || [],
          isLocked: Boolean(existingRoom?.isLocked),
          isPaused: Boolean(existingRoom?.isPaused),
          startedAt: existingRoom ? existingRoom.startedAt : null,
          timerInterval: null,
          advanceTimeout: null,
        };

        this.rooms.set(code, roomObj);
        await liveRoomStore.set(code, roomObj);
        socket.join(code);
        socket.emit('room:created', { roomCode: code, questionsCount: questions.length });

        const participantList = Array.from(existingParticipants.values()).map((p) => p.name);
        const participantDetails = Array.from(existingParticipants.values()).map((p) => ({
          socketId: p.socketId,
          userId: p.userId || null,
          name: p.name,
          avatar: p.avatar || '🦊',
        }));
        io.to(code).emit('lobby:updated', {
          participants: participantList,
          participantDetails,
          count: participantList.length,
          status: roomObj.status,
          isLocked: roomObj.isLocked,
        });

        console.log(`[Live Session] Host initialized room: ${code} with ${questions.length} questions. Participants: ${participantList.length}`);
      });

      // 2. Participant joins live room lobby
      socket.on('participant:join-room', async ({ roomCode, participantName, userId, avatar }) => {
        const code = roomCode.toUpperCase();
        let room = await liveRoomStore.get(code) || this.rooms.get(code);

        if (!room) {
          const Quiz = require('../models/Quiz');
          const Question = require('../models/Question');
          let questions = [];
          let title = 'Live Challenge Session';
          let quizDoc = null;
          try {
            quizDoc = await Quiz.findOne({ joinCode: code });
            if (quizDoc) {
              title = quizDoc.title;
              questions = await Question.find({ quizId: quizDoc._id }).sort({ order: 1 });
            }
          } catch {}
          if (!quizDoc) {
            const { memoryQuizzes, memoryQuestions } = require('../controllers/quizController');
            quizDoc = memoryQuizzes.get(code) || null;
            if (quizDoc) {
              title = quizDoc.title;
              questions = memoryQuestions.get(String(quizDoc._id || quizDoc.id)) || [];
            }
          }

          if (quizDoc && quizDoc.status === 'closed') {
            socket.emit('room:ended-lock', {
              message: 'This live quiz has ended and is no longer accepting participants.',
            });
            return;
          }

          room = {
            hostSocketId: null,
            quizId: quizDoc ? quizDoc._id : null,
            quizTitle: title,
            status: 'lobby',
            currentQuestionIdx: 0,
            questions,
            settings: quizDoc?.settings || null,
            passingScorePercent: quizDoc?.settings?.passingScorePercent || 60,
            participants: new Map(),
            bannedUsers: [],
            bannedNames: [],
            isLocked: false,
            isPaused: false,
            startedAt: null,
            timerInterval: null,
            advanceTimeout: null,
          };
          this.rooms.set(code, room);
          await liveRoomStore.set(code, room);
        }

        // If quiz has already ended, notify participant immediately
        if (room.status === 'ended') {
          socket.emit('room:ended-lock', {
            message: 'This live quiz session has ended and cannot be restarted.',
            leaderboard: this.buildFinalLeaderboard(room),
          });
          return;
        }

        const effectiveName = participantName || `Player_${Math.floor(Math.random() * 900 + 100)}`;

        // Check if participant was kicked / banned by the host
        const isBannedUser = userId && (room.bannedUsers || []).includes(String(userId));
        const isBannedName = (room.bannedNames || []).includes(effectiveName.trim().toLowerCase());
        if (isBannedUser || isBannedName) {
          socket.emit('participant:kicked', {
            message: 'You have been removed from this live session by the host.',
          });
          return;
        }

        let existingScore = 0;
        let existingAnswers = [];
        let isExistingParticipant = false;

        // Replace previous socket connection for the same user or name so stale sockets don't accumulate
        for (const [existingSocketId, p] of room.participants.entries()) {
          if (existingSocketId !== socket.id) {
            const isSameUser = userId && p.userId && String(p.userId) === String(userId);
            const isSameName = !userId && p.name && p.name === effectiveName;
            if (isSameUser || isSameName) {
              isExistingParticipant = true;
              existingScore = p.score || 0;
              existingAnswers = p.answers || [];
              room.participants.delete(existingSocketId);
            }
          } else {
            isExistingParticipant = true;
          }
        }

        // Check if lobby/room is locked for new participants
        if (room.isLocked && !isExistingParticipant) {
          socket.emit('room:locked-reject', {
            message: '🔒 This room is locked by the host and is no longer accepting new participants.',
          });
          return;
        }

        room.participants.set(socket.id, {
          socketId: socket.id,
          userId: userId || null,
          name: effectiveName,
          avatar: avatar || '🦊',
          streak: 0,
          score: existingScore,
          answers: existingAnswers,
          lastAnsweredQIdx: -1,
        });
        socket.join(code);
        await liveRoomStore.set(code, room);

        const participantList = Array.from(room.participants.values()).map((p) => p.name);
        const participantDetails = Array.from(room.participants.values()).map((p) => ({
          socketId: p.socketId,
          userId: p.userId || null,
          name: p.name,
          avatar: p.avatar || '🦊',
        }));
        io.to(code).emit('lobby:updated', {
          participants: participantList,
          participantDetails,
          count: participantList.length,
          status: room.status,
          isLocked: Boolean(room.isLocked),
        });

        if (room.status === 'active' && room.questions && room.questions.length > 0) {
          const participant = room.participants.get(socket.id);
          let assignedQuestions = participant?.assignedQuestions;
          if (!assignedQuestions || assignedQuestions.length === 0) {
            const playerQuestionsSource = room.questions.length > 1
              ? shuffleArray(room.questions)
              : room.questions;
            assignedQuestions = buildSanitizedQuestions(room, playerQuestionsSource, true);
            if (participant) {
              participant.assignedQuestions = assignedQuestions;
            }
          }
          const resumeQIdx = (existingAnswers || []).length;
          socket.emit('quiz:started', {
            questionIdx: resumeQIdx,
            currentScore: existingScore,
            questions: assignedQuestions,
            title: room.quizTitle,
            enablePowerUps: room.enablePowerUps !== false,
          });
        }
      });

      // Fisher-Yates shuffle helper
      const shuffleArray = (arr) => {
        if (!arr || arr.length <= 1) return arr ? [...arr] : [];
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };

      // Helper to sanitize questions and shuffle options per participant
      const buildSanitizedQuestions = (room, questions, shouldShuffleOptions = true) => {
        return (questions || []).map((q, idx) => {
          const rawOptions = (q.options || []).map((o) => {
            if (typeof o === 'string') {
              return { text: o, isCorrect: false, explanation: '' };
            }
            return {
              text: o.text,
              isCorrect: Boolean(o.isCorrect === true || o.isCorrect === 'true' || o.isCorrect),
              explanation: o.explanation || '',
            };
          });

          const finalOptions = shouldShuffleOptions && rawOptions.length > 1
            ? shuffleArray(rawOptions)
            : [...rawOptions];

          let correctIndex = finalOptions.findIndex((o) => o.isCorrect);
          if (correctIndex < 0 && finalOptions.length > 0) {
            correctIndex = 0;
          }

          const correctOpt = finalOptions[correctIndex >= 0 ? correctIndex : 0];
          const fallbackTip = correctOpt?.text
            ? `Key takeaway: "${correctOpt.text}" is the accurate solution for this topic (${q.topicTag || 'General'}). Review the core principles behind this question to strengthen retention.`
            : '';

          return {
            id: String(q._id || q.id),
            title: q.title,
            options: finalOptions.map((o) => o.text),
            correctIndex: correctIndex >= 0 ? correctIndex : 0,
            points: q.points || 10,
            timeLimitSeconds: getQuestionTimeLimit(room, idx),
            explanation: q.explanation || correctOpt?.explanation || fallbackTip,
          };
        });
      };

      // Helper to compute question time limit safely
      const getQuestionTimeLimit = (room, qIdx) => {
        const q = room.questions && room.questions[qIdx];
        const qSec = Number(q?.timeLimitSeconds);
        if (qSec && qSec > 0) return qSec;
        if (room.settings?.timeLimitMinutes && room.questions?.length) {
          return Math.max(10, Math.min(120, Math.round((Number(room.settings.timeLimitMinutes) * 60) / room.questions.length)));
        }
        return 30;
      };

      // Helper to advance to next question or end quiz cleanly
      const advanceToNextOrEnd = async (code) => {
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (!room || room.status !== 'active') return;

        this.clearRoomTimers(code);

        if (room.currentQuestionIdx < room.questions.length - 1) {
          room.currentQuestionIdx += 1;
          room.isPaused = false;
          await liveRoomStore.set(code, room);
          const nextLimit = getQuestionTimeLimit(room, room.currentQuestionIdx);
          io.to(code).emit('question:advanced', {
            questionIdx: room.currentQuestionIdx,
            totalSeconds: nextLimit,
            autoAdvanced: true,
            isPaused: false,
          });
          startQuestionTimer(code);
        } else {
          room.status = 'ended';
          room.isPaused = false;
          this.clearRoomTimers(code);
          await this.saveFinalAttempts(room);
          await liveRoomStore.set(code, room);
          const finalLeaderboard = this.buildFinalLeaderboard(room);

          io.to(code).emit('quiz:ended', {
            leaderboard: finalLeaderboard,
            canRestart: false,
          });
        }
      };

      // Helper to start per-question server timer
      const startQuestionTimer = async (code, resumeSecondsLeft = null) => {
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (!room || room.status !== 'active') return;

        this.clearRoomTimers(code);

        const totalSeconds = getQuestionTimeLimit(room, room.currentQuestionIdx);
        let secondsLeft = resumeSecondsLeft !== null ? resumeSecondsLeft : totalSeconds;

        const timerState = this.getOrCreateTimerState(code);
        timerState.secondsLeft = secondsLeft;
        timerState.totalSeconds = totalSeconds;

        io.to(code).emit('question:timer-tick', {
          questionIdx: room.currentQuestionIdx,
          secondsLeft,
          totalSeconds,
          isPaused: Boolean(room.isPaused),
        });

        if (room.isPaused) return;

        timerState.timerInterval = setInterval(async () => {
          const currentRoom = this.rooms.get(code);
          if (currentRoom && currentRoom.isPaused) return;

          secondsLeft -= 1;
          timerState.secondsLeft = Math.max(0, secondsLeft);
          io.to(code).emit('question:timer-tick', {
            questionIdx: room.currentQuestionIdx,
            secondsLeft: Math.max(0, secondsLeft),
            totalSeconds,
            isPaused: false,
          });

          if (secondsLeft <= 0) {
            this.clearRoomTimers(code);

            io.to(code).emit('question:time-up', {
              questionIdx: room.currentQuestionIdx,
            });

            // Fast 400ms transition directly to next question for all players
            timerState.advanceTimeout = setTimeout(async () => {
              timerState.advanceTimeout = null;
              await advanceToNextOrEnd(code);
            }, 400);
          }
        }, 1000);
      };

      // 3. Host starts quiz (Blocked if quiz has ended)
      socket.on('host:start-quiz', async ({ roomCode, shuffleQuestions, enablePowerUps, lockOnStart }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room) {
          if (room.status === 'ended') {
            socket.emit('error', { message: 'This quiz has ended and cannot be started again.' });
            return;
          }

          if (!room.questions || room.questions.length === 0) {
            socket.emit('error', { message: 'This quiz has no questions. Add questions before starting the Live Arena.' });
            return;
          }

          this.clearRoomTimers(code);

          // In live multiplayer quizzes, shuffle questions per participant unless explicitly false
          const shouldShuffleQuestions = Boolean(
            shuffleQuestions !== false &&
            room.settings?.shuffleQuestions !== false
          );
          const powerUpsAllowed = enablePowerUps !== false;

          room.status = 'active';
          room.startedAt = new Date();
          room.currentQuestionIdx = 0;
          room.enablePowerUps = powerUpsAllowed;
          room.isPaused = false;
          if (lockOnStart !== undefined) {
            room.isLocked = Boolean(lockOnStart);
          }
          await liveRoomStore.set(code, room);

          // 1. Host receives standard question order for public projection/review
          const initialDistribution = this.computeOptionDistribution(room);
          socket.emit('quiz:started', {
            questionIdx: 0,
            questions: buildSanitizedQuestions(room, room.questions, false),
            title: room.quizTitle,
            enablePowerUps: powerUpsAllowed,
            isLocked: Boolean(room.isLocked),
            isPaused: false,
            optionDistribution: initialDistribution,
          });

          // 2. Each participant receives their OWN personalized question shuffle AND option shuffle!
          for (const [pSocketId, participant] of room.participants.entries()) {
            if (pSocketId !== socket.id) {
              const pSocket = io.sockets.sockets.get(pSocketId);
              if (pSocket) {
                const playerQuestionsSource = shouldShuffleQuestions && room.questions.length > 1
                  ? shuffleArray(room.questions)
                  : room.questions;

                const personalizedQuestions = buildSanitizedQuestions(room, playerQuestionsSource, true);
                participant.assignedQuestions = personalizedQuestions;

                pSocket.emit('quiz:started', {
                  questionIdx: 0,
                  questions: personalizedQuestions,
                  title: room.quizTitle,
                  enablePowerUps: powerUpsAllowed,
                });
              }
            }
          }

          // Start the server question timer (drives host view clock & auto-advance)
          startQuestionTimer(code);

          const maxRoomMinutes = Number(room.settings?.timeLimitMinutes) || 0;
          if (maxRoomMinutes > 0) {
            const timerState = this.getOrCreateTimerState(code);
            timerState.advanceTimeout = setTimeout(async () => {
              console.log(`[Live Session] Room ${code} time limit reached (${maxRoomMinutes}m). Ending quiz.`);
              const r = await liveRoomStore.get(code) || this.rooms.get(code);
              if (r && r.status === 'active') {
                this.clearRoomTimers(code);
                r.status = 'ended';
                await this.saveFinalAttempts(r);
                await liveRoomStore.set(code, r);
                const finalLeaderboard = Array.from(r.participants.values())
                  .sort((a, b) => b.score - a.score)
                  .map((p) => ({
                    name: p.name,
                    score: p.score,
                    percentage: p.percentage || 0,
                    passed: p.passed || false,
                    attemptId: p.savedAttemptId || null,
                    answersCount: (p.answers || []).length,
                  }));
                io.to(code).emit('quiz:ended', { leaderboard: finalLeaderboard, canRestart: false });
              }
            }, maxRoomMinutes * 60 * 1000);
          }
        }
      });

      // 4. Participant submits an answer in live mode (direct advance per player)
      socket.on('participant:submit-answer', async ({ roomCode, isCorrect, pointsAwarded, questionIdx, questionId, selectedOptionText }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room && room.participants.has(socket.id)) {
          const participant = room.participants.get(socket.id);
          const targetQIdx = Number.isInteger(Number(questionIdx))
            ? Number(questionIdx)
            : (participant.answers ? participant.answers.length : 0);

          // Prevent duplicate submission for the same question index
          if (participant.lastAnsweredQIdx === targetQIdx && (participant.answers || []).length > targetQIdx) {
            console.log(`[Live Session] Duplicate submission ignored for ${participant.name} on Q${targetQIdx}`);
            return;
          }

          participant.lastAnsweredQIdx = targetQIdx;

          // Ultimate Server Authority: verify option text directly against matching room question
          const currentQ = (room.questions || []).find((q) =>
            String(q._id || q.id) === String(questionId)
          ) || (room.questions && room.questions[targetQIdx]) || room.questions[0];

          const canonicalQId = String(currentQ?._id || currentQ?.id || questionId || '');
          const matchedOpt = (currentQ?.options || []).find((o) => {
            const text = typeof o === 'string' ? o : o.text;
            return text?.trim().toLowerCase() === String(selectedOptionText || '').trim().toLowerCase();
          });
          const actualCorrect = matchedOpt
            ? Boolean(matchedOpt.isCorrect === true || matchedOpt.isCorrect === 'true' || matchedOpt.isCorrect)
            : Boolean(isCorrect);

          const rawPts = Number(pointsAwarded);
          const pts = actualCorrect
            ? (rawPts > 0 ? rawPts : (currentQ?.points || 10))
            : (rawPts < 0 ? rawPts : 0);
          participant.score = Math.max(0, (participant.score || 0) + pts);

          if (actualCorrect) {
            participant.streak = (participant.streak || 0) + 1;
          } else {
            participant.streak = 0;
          }

          // Replace existing answer for the same questionId if present, otherwise push
          const existingAnsIdx = (participant.answers || []).findIndex(
            (a) => canonicalQId && String(a.questionId?._id || a.questionId?.id || a.questionId || '') === canonicalQId
          );
          const answerPayload = {
            questionId: currentQ?._id || currentQ?.id || questionId || null,
            questionTitle: currentQ?.title || '',
            selectedText: selectedOptionText || '',
            isCorrect: Boolean(actualCorrect),
            pointsAwarded: pts,
            timeSpentSeconds: 5,
          };
          if (existingAnsIdx >= 0) {
            participant.answers[existingAnsIdx] = answerPayload;
          } else {
            participant.answers.push(answerPayload);
          }
          await liveRoomStore.set(code, room);

          // Build live updated leaderboard
          const liveLeaderboard = Array.from(room.participants.values())
            .sort((a, b) => b.score - a.score)
            .map((p) => ({
              socketId: p.socketId,
              name: p.name,
              avatar: p.avatar || '🦊',
              score: p.score,
              streak: p.streak || 0,
              answersCount: (p.answers || []).length,
              lastAnsweredQIdx: p.lastAnsweredQIdx,
              status: p.status || 'active',
            }));

          const roomSockets = io.sockets.adapter.rooms.get(code) || new Set();
          const activeParticipants = Array.from(room.participants.entries())
            .filter(([sockId, p]) => roomSockets.has(sockId) && p.status !== 'cancelled');
          const totalActive = activeParticipants.length;

          const optionDistribution = this.computeOptionDistribution(room);
          const currentQDist = optionDistribution[room.currentQuestionIdx];
          const answeredCount = currentQDist
            ? currentQDist.totalResponses
            : activeParticipants.filter(([, p]) => (p.answers || []).length > room.currentQuestionIdx).length;

          const canonicalIdx = (room.questions || []).findIndex(
            (q) => String(q._id || q.id) === canonicalQId
          );

          io.to(code).emit('leaderboard:updated', {
            leaderboard: liveLeaderboard,
            totalParticipants: totalActive || room.participants.size,
            submittedCount: answeredCount,
            optionDistribution,
            lastAnsweredQuestionIdx: canonicalIdx >= 0 ? canonicalIdx : targetQIdx,
            lastAnsweredQuestionId: canonicalQId,
            lastAnswererName: participant.name,
          });

          // Send confirmation feedback back to participant
          socket.emit('participant:answer-confirmed', {
            questionIdx: targetQIdx,
            isCorrect: Boolean(actualCorrect),
            currentScore: participant.score,
          });

          // Check if all active players have finished all questions in the quiz
          const totalQuestionsCount = room.questions ? room.questions.length : 0;
          const allCompleted = totalActive > 0 && activeParticipants.every(
            ([, p]) => (p.answers || []).length >= totalQuestionsCount
          );

          if (allCompleted) {
            this.clearRoomTimers(code);
            room.status = 'ended';
            await this.saveFinalAttempts(room);
            await liveRoomStore.set(code, room);

            const finalLeaderboard = this.buildFinalLeaderboard(room);

            io.to(code).emit('quiz:ended', {
              leaderboard: finalLeaderboard,
              canRestart: false,
            });
          }
        }
      });

      // 4b. Participant reports completing all questions
      socket.on('participant:finished-all', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room && room.status === 'active') {
          const roomSockets = io.sockets.adapter.rooms.get(code) || new Set();
          const activeParticipants = Array.from(room.participants.entries())
            .filter(([sockId, p]) => roomSockets.has(sockId) && p.status !== 'cancelled');
          const totalActive = activeParticipants.length;
          const totalQuestionsCount = room.questions ? room.questions.length : 0;
          const allCompleted = totalActive > 0 && activeParticipants.every(
            ([, p]) => (p.answers || []).length >= totalQuestionsCount
          );

          if (allCompleted) {
            this.clearRoomTimers(code);
            room.status = 'ended';
            await this.saveFinalAttempts(room);
            await liveRoomStore.set(code, room);

            const finalLeaderboard = this.buildFinalLeaderboard(room);

            io.to(code).emit('quiz:ended', {
              leaderboard: finalLeaderboard,
              canRestart: false,
            });
          }
        }
      });

      // 4c. Participant voluntarily cancels / ends their own quiz session
      socket.on('participant:cancel-quiz', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room && room.participants.has(socket.id)) {
          const participant = room.participants.get(socket.id);
          participant.status = 'cancelled';
          participant.cancelledAt = new Date();
          await liveRoomStore.set(code, room);

          // Save partial cancelled attempt so participant record is preserved
          try {
            const Attempt = require('../models/Attempt');
            const quizId = room.quizId?._id || room.quizId?.id || room.quizId;
            const totalPointsPossible = (room.questions || []).reduce((acc, q) => acc + (q.points || 10), 0) || 10;
            const score = participant.score || 0;
            const percentage = totalPointsPossible > 0 ? Math.round((score / totalPointsPossible) * 100) : 0;

            const attemptDoc = {
              quizId,
              userId: participant.userId?._id || participant.userId || null,
              guestSession: participant.userId ? null : { name: participant.name, guestId: 'guest_' + Math.random().toString(36).substring(2, 8) },
              score,
              percentage,
              totalPointsPossible,
              passed: false,
              status: 'cancelled',
              startedAt: room.startedAt || new Date(),
              submittedAt: new Date(),
              durationSeconds: room.startedAt ? Math.round((Date.now() - new Date(room.startedAt).getTime()) / 1000) : 5,
              answers: (participant.answers || []).map((ans) => ({
                questionId: ans.questionId?._id || ans.questionId?.id || ans.questionId,
                selectedOptions: [ans.selectedText || ''],
                isCorrect: Boolean(ans.isCorrect),
                pointsAwarded: ans.pointsAwarded || 0,
                timeSpentSeconds: ans.timeSpentSeconds || 5,
                answeredAt: new Date(),
              })),
            };

            const savedAttempt = await Attempt.create(attemptDoc);
            participant.savedAttemptId = savedAttempt._id.toString();
          } catch (err) {
            console.error(`[Live Session] Error saving cancelled attempt for participant ${participant.name}:`, err.message);
          }

          // Broadcast cancellation notice to host and players in the room
          io.to(code).emit('participant:cancelled', {
            name: participant.name,
            socketId: socket.id,
            message: `${participant.name} cancelled and left the quiz.`,
          });

          // Re-broadcast updated leaderboard with 'cancelled' status
          const liveLeaderboard = Array.from(room.participants.values())
            .sort((a, b) => b.score - a.score)
            .map((p) => ({
              name: p.name,
              score: p.score,
              answersCount: (p.answers || []).length,
              lastAnsweredQIdx: p.lastAnsweredQIdx,
              status: p.status || 'active',
            }));

          const roomSockets = io.sockets.adapter.rooms.get(code) || new Set();
          const activeParticipants = Array.from(room.participants.entries())
            .filter(([sockId, p]) => roomSockets.has(sockId) && p.status !== 'cancelled');

          const answeredCount = activeParticipants.filter(
            ([, p]) => (p.answers || []).length > room.currentQuestionIdx
          ).length;

          io.to(code).emit('leaderboard:updated', {
            leaderboard: liveLeaderboard,
            totalParticipants: activeParticipants.length,
            submittedCount: answeredCount,
          });

          // If no active participants remain or all active have finished, end room cleanly
          const totalQuestionsCount = room.questions ? room.questions.length : 0;
          const allCompleted = activeParticipants.length === 0 || (
            activeParticipants.length > 0 &&
            activeParticipants.every(([, p]) => (p.answers || []).length >= totalQuestionsCount)
          );

          if (allCompleted && room.status === 'active') {
            this.clearRoomTimers(code);
            room.status = 'ended';
            await this.saveFinalAttempts(room);
            await liveRoomStore.set(code, room);

            const finalLeaderboard = Array.from(room.participants.values())
              .sort((a, b) => b.score - a.score)
              .map((p) => ({
                name: p.name,
                avatar: p.avatar || '🦊',
                score: p.score,
                streak: p.streak || 0,
                percentage: p.percentage || 0,
                passed: p.passed || false,
                attemptId: p.savedAttemptId || null,
                answersCount: (p.answers || []).length,
                status: p.status || 'active',
              }));

            io.to(code).emit('quiz:ended', {
              leaderboard: finalLeaderboard,
              canRestart: false,
            });
          }
        }
      });

      // 4d. Send real-time emoji reaction (bubbles across room screens)
      socket.on('room:send-reaction', async ({ roomCode, emoji }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room) {
          const participant = room.participants?.get(socket.id);
          io.to(code).emit('room:reaction', {
            emoji: emoji || '🔥',
            senderName: participant?.name || 'Player',
            senderAvatar: participant?.avatar || '🦊',
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          });
        }
      });

      // 5. Host advances to next question manually
      socket.on('host:next-question', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room && room.status === 'active') {
          room.isPaused = false;
          this.clearRoomTimers(code);
          await advanceToNextOrEnd(code);
        }
      });

      // 5b. Host toggles room lock (prevent latecomers from joining)
      socket.on('host:toggle-lock', async ({ roomCode, isLocked }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room) {
          room.isLocked = isLocked !== undefined ? Boolean(isLocked) : !room.isLocked;
          await liveRoomStore.set(code, room);
          io.to(code).emit('room:lock-updated', {
            isLocked: room.isLocked,
          });
        }
      });

      // 5c. Host pauses or resumes the countdown timer
      socket.on('host:toggle-pause', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room && room.status === 'active') {
          room.isPaused = !room.isPaused;
          const timerState = this.getOrCreateTimerState(code);
          const remaining = timerState.secondsLeft || getQuestionTimeLimit(room, room.currentQuestionIdx);

          if (room.isPaused) {
            this.clearRoomTimers(code);
            timerState.secondsLeft = remaining;
          } else {
            startQuestionTimer(code, remaining);
          }

          await liveRoomStore.set(code, room);
          io.to(code).emit('room:pause-updated', {
            isPaused: room.isPaused,
            secondsLeft: remaining,
          });
        }
      });

      // 5d. Host kicks / bans a participant from lobby or active game
      socket.on('host:kick-participant', async ({ roomCode, targetSocketId, targetName }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (!room) return;

        let foundSocketId = targetSocketId;
        let foundParticipant = targetSocketId ? room.participants.get(targetSocketId) : null;

        if (!foundParticipant && targetName) {
          for (const [sId, p] of room.participants.entries()) {
            if (p.name === targetName) {
              foundSocketId = sId;
              foundParticipant = p;
              break;
            }
          }
        }

        if (foundParticipant && foundSocketId) {
          room.bannedNames = room.bannedNames || [];
          room.bannedUsers = room.bannedUsers || [];
          if (foundParticipant.name) {
            room.bannedNames.push(foundParticipant.name.trim().toLowerCase());
          }
          if (foundParticipant.userId) {
            room.bannedUsers.push(String(foundParticipant.userId));
          }

          room.participants.delete(foundSocketId);
          await liveRoomStore.set(code, room);

          // Notify and remove kicked socket from room
          const targetSocket = io.sockets.sockets.get(foundSocketId);
          if (targetSocket) {
            targetSocket.emit('participant:kicked', {
              message: '🚫 You were removed from this live quiz by the host.',
            });
            targetSocket.leave(code);
          }

          const participantList = Array.from(room.participants.values()).map((p) => p.name);
          const participantDetails = Array.from(room.participants.values()).map((p) => ({
            socketId: p.socketId,
            userId: p.userId || null,
            name: p.name,
            avatar: p.avatar || '🦊',
          }));

          io.to(code).emit('lobby:updated', {
            participants: participantList,
            participantDetails,
            count: participantList.length,
            status: room.status,
            isLocked: Boolean(room.isLocked),
          });

          const liveLeaderboard = Array.from(room.participants.values())
            .sort((a, b) => b.score - a.score)
            .map((p) => ({
              socketId: p.socketId,
              name: p.name,
              avatar: p.avatar || '🦊',
              score: p.score,
              streak: p.streak || 0,
              answersCount: (p.answers || []).length,
              lastAnsweredQIdx: p.lastAnsweredQIdx,
              status: p.status || 'active',
            }));

          const roomSockets = io.sockets.adapter.rooms.get(code) || new Set();
          const activeParticipants = Array.from(room.participants.entries())
            .filter(([sockId, p]) => roomSockets.has(sockId) && p.status !== 'cancelled');

          const answeredCount = activeParticipants.filter(
            ([, p]) => (p.answers || []).length > room.currentQuestionIdx
          ).length;

          io.to(code).emit('leaderboard:updated', {
            leaderboard: liveLeaderboard,
            totalParticipants: activeParticipants.length,
            submittedCount: answeredCount,
            optionDistribution: this.computeOptionDistribution(room),
          });
        }
      });

      // 6. Host finishes quiz (Permanent End - Saves attempts & prevents restarting)
      socket.on('host:finish-quiz', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room) {
          this.clearRoomTimers(code);
          room.status = 'ended';
          room.isPaused = false;
          await this.saveFinalAttempts(room);
          await liveRoomStore.set(code, room);

          const finalLeaderboard = this.buildFinalLeaderboard(room);

          io.to(code).emit('quiz:ended', {
            leaderboard: finalLeaderboard,
            canRestart: false,
          });
        }
      });

      // Handle socket disconnect
      socket.on('disconnect', () => {
        for (const [code, room] of this.rooms.entries()) {
          if (room.participants.has(socket.id)) {
            if (room.status === 'lobby') {
              room.participants.delete(socket.id);
              liveRoomStore.set(code, room);
              const participantList = Array.from(room.participants.values()).map((p) => p.name);
              const participantDetails = Array.from(room.participants.values()).map((p) => ({
                name: p.name,
                avatar: p.avatar || '🦊',
              }));
              io.to(code).emit('lobby:updated', {
                participants: participantList,
                participantDetails,
                count: participantList.length,
              });
            } else if (room.status === 'active') {
              // Re-check remaining active connected participants
              const roomSockets = io.sockets.adapter.rooms.get(code) || new Set();
              const activeParticipants = Array.from(room.participants.entries())
                .filter(([sockId, p]) => roomSockets.has(sockId) && p.status !== 'cancelled');
              const totalActive = activeParticipants.length;
              const totalQuestionsCount = room.questions ? room.questions.length : 0;
              const allCompleted = totalActive > 0 && activeParticipants.every(
                ([, p]) => (p.answers || []).length >= totalQuestionsCount
              );

              if (allCompleted) {
                this.clearRoomTimers(code);
                room.status = 'ended';
                this.saveFinalAttempts(room).then(() => liveRoomStore.set(code, room));
                const finalLeaderboard = Array.from(room.participants.values())
                  .sort((a, b) => b.score - a.score)
                  .map((p) => ({
                    name: p.name,
                    score: p.score,
                    percentage: p.percentage || 0,
                    passed: p.passed || false,
                    attemptId: p.savedAttemptId || null,
                    answersCount: (p.answers || []).length,
                    status: p.status || 'active',
                  }));
                io.to(code).emit('quiz:ended', { leaderboard: finalLeaderboard, canRestart: false });
              }
            }
            break;
          }
        }
      });
    });
  }
}

module.exports = new LiveSessionManager();
