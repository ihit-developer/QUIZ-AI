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
      this.roomTimers.set(code, { timerInterval: null, advanceTimeout: null });
    }
    return this.roomTimers.get(code);
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
          startedAt: existingRoom ? existingRoom.startedAt : null,
          timerInterval: null,
          advanceTimeout: null,
        };

        this.rooms.set(code, roomObj);
        await liveRoomStore.set(code, roomObj);
        socket.join(code);
        socket.emit('room:created', { roomCode: code, questionsCount: questions.length });

        const participantList = Array.from(existingParticipants.values()).map((p) => p.name);
        io.to(code).emit('lobby:updated', {
          participants: participantList,
          count: participantList.length,
          status: roomObj.status,
        });

        console.log(`[Live Session] Host initialized room: ${code} with ${questions.length} questions. Participants: ${participantList.length}`);
      });

      // 2. Participant joins live room lobby
      socket.on('participant:join-room', async ({ roomCode, participantName, userId }) => {
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
            leaderboard: Array.from(room.participants.values()).sort((a, b) => b.score - a.score),
          });
          return;
        }

        const effectiveName = participantName || `Player_${Math.floor(Math.random() * 900 + 100)}`;
        let existingScore = 0;
        let existingAnswers = [];

        // Replace previous socket connection for the same user or name so stale sockets don't accumulate
        for (const [existingSocketId, p] of room.participants.entries()) {
          if (existingSocketId !== socket.id) {
            const isSameUser = userId && p.userId && String(p.userId) === String(userId);
            const isSameName = !userId && p.name && p.name === effectiveName;
            if (isSameUser || isSameName) {
              existingScore = p.score || 0;
              existingAnswers = p.answers || [];
              room.participants.delete(existingSocketId);
            }
          }
        }

        room.participants.set(socket.id, {
          socketId: socket.id,
          userId: userId || null,
          name: effectiveName,
          score: existingScore,
          answers: existingAnswers,
          lastAnsweredQIdx: -1,
        });
        socket.join(code);
        await liveRoomStore.set(code, room);

        const participantList = Array.from(room.participants.values()).map((p) => p.name);
        io.to(code).emit('lobby:updated', {
          participants: participantList,
          count: participantList.length,
          status: room.status,
        });

        if (room.status === 'active' && room.questions && room.questions.length > 0) {
          const shouldShuffle = room.settings?.shuffleOptions !== false;
          socket.emit('quiz:started', {
            questionIdx: room.currentQuestionIdx || 0,
            questions: buildSanitizedQuestions(room, room.questions, shouldShuffle),
            title: room.quizTitle,
          });
        }
      });

      // Fisher-Yates shuffle helper
      const shuffleArray = (arr) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };

      // Helper to sanitize questions and optionally shuffle options per participant
      const buildSanitizedQuestions = (room, questions, shouldShuffleOptions = false) => {
        return (questions || []).map((q, idx) => {
          const rawOptions = (q.options || []).map((o) => ({
            text: typeof o === 'string' ? o : o.text,
            isCorrect: Boolean(o.isCorrect === true || o.isCorrect === 'true' || o.isCorrect),
          }));

          const finalOptions = shouldShuffleOptions ? shuffleArray(rawOptions) : rawOptions;
          const correctIndex = finalOptions.findIndex((o) => o.isCorrect);

          return {
            id: q._id || q.id,
            title: q.title,
            options: finalOptions.map((o) => o.text),
            correctIndex: correctIndex >= 0 ? correctIndex : 0,
            points: q.points || 10,
            timeLimitSeconds: getQuestionTimeLimit(room, idx),
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
          await liveRoomStore.set(code, room);
          const nextLimit = getQuestionTimeLimit(room, room.currentQuestionIdx);
          io.to(code).emit('question:advanced', {
            questionIdx: room.currentQuestionIdx,
            totalSeconds: nextLimit,
            autoAdvanced: true,
          });
          startQuestionTimer(code);
        } else {
          room.status = 'ended';
          this.clearRoomTimers(code);
          await this.saveFinalAttempts(room);
          await liveRoomStore.set(code, room);
          const finalLeaderboard = Array.from(room.participants.values())
            .sort((a, b) => b.score - a.score)
            .map((p) => ({
              name: p.name,
              score: p.score,
              percentage: p.percentage || 0,
              passed: p.passed || false,
              attemptId: p.savedAttemptId || null,
              answersCount: (p.answers || []).length,
            }));

          io.to(code).emit('quiz:ended', {
            leaderboard: finalLeaderboard,
            canRestart: false,
          });
        }
      };

      // Helper to start per-question server timer
      const startQuestionTimer = async (code) => {
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (!room || room.status !== 'active') return;

        this.clearRoomTimers(code);

        const totalSeconds = getQuestionTimeLimit(room, room.currentQuestionIdx);
        let secondsLeft = totalSeconds;

        io.to(code).emit('question:timer-tick', {
          questionIdx: room.currentQuestionIdx,
          secondsLeft,
          totalSeconds,
        });

        const timerState = this.getOrCreateTimerState(code);
        timerState.timerInterval = setInterval(async () => {
          secondsLeft -= 1;
          io.to(code).emit('question:timer-tick', {
            questionIdx: room.currentQuestionIdx,
            secondsLeft: Math.max(0, secondsLeft),
            totalSeconds,
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
      socket.on('host:start-quiz', async ({ roomCode, shuffleQuestions }) => {
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

          // If shuffleQuestions is enabled, randomize question sequence for this game session
          const shouldShuffleQuestions = Boolean(
            shuffleQuestions === true ||
            room.settings?.shuffleQuestions === true
          );

          if (shouldShuffleQuestions && room.questions && room.questions.length > 1) {
            room.questions = shuffleArray(room.questions);
            console.log(`[Live Session] Questions shuffled for room ${code} (${room.questions.length} questions)`);
          }

          room.status = 'active';
          room.startedAt = new Date();
          room.currentQuestionIdx = 0;
          await liveRoomStore.set(code, room);

          const shouldShuffleOptions = room.settings?.shuffleOptions !== false;

          // 1. Host receives standard question order for public projection/review
          socket.emit('quiz:started', {
            questionIdx: 0,
            questions: buildSanitizedQuestions(room, room.questions, false),
            title: room.quizTitle,
          });

          // 2. Each participant receives their own personalized option shuffle to prevent screen peeking
          for (const [pSocketId] of room.participants.entries()) {
            if (pSocketId !== socket.id) {
              const pSocket = io.sockets.sockets.get(pSocketId);
              if (pSocket) {
                pSocket.emit('quiz:started', {
                  questionIdx: 0,
                  questions: buildSanitizedQuestions(room, room.questions, shouldShuffleOptions),
                  title: room.quizTitle,
                });
              }
            }
          }

          startQuestionTimer(code);
        }
      });

      // 4. Participant submits an answer in live mode
      socket.on('participant:submit-answer', async ({ roomCode, isCorrect, pointsAwarded, questionIdx, selectedOptionText }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room && room.participants.has(socket.id)) {
          const participant = room.participants.get(socket.id);

          // SERVER-SIDE GUARD: reject duplicate submissions for the same question
          if (participant.lastAnsweredQIdx === room.currentQuestionIdx) {
            console.log(`[Live Session] Duplicate submission rejected for ${participant.name} on Q${room.currentQuestionIdx}`);
            return;
          }

          participant.lastAnsweredQIdx = room.currentQuestionIdx;

          // Ultimate Server Authority: verify option text directly against room question
          const currentQ = room.questions[room.currentQuestionIdx];
          const matchedOpt = (currentQ?.options || []).find((o) => {
            const text = typeof o === 'string' ? o : o.text;
            return text?.trim().toLowerCase() === String(selectedOptionText || '').trim().toLowerCase();
          });
          const actualCorrect = matchedOpt
            ? Boolean(matchedOpt.isCorrect === true || matchedOpt.isCorrect === 'true' || matchedOpt.isCorrect)
            : Boolean(isCorrect);

          const pts = actualCorrect ? (Number(pointsAwarded) || currentQ?.points || 10) : 0;
          participant.score += pts;

          participant.answers.push({
            // A room restored from Redis has `id`; an in-memory Mongoose
            // question has `_id`. Supporting both prevents rejected attempts.
            questionId: currentQ?._id || currentQ?.id || null,
            selectedText: selectedOptionText || '',
            isCorrect: Boolean(actualCorrect),
            pointsAwarded: pts,
            timeSpentSeconds: 5,
          });
          await liveRoomStore.set(code, room);

          // Build live updated leaderboard
          const liveLeaderboard = Array.from(room.participants.values())
            .sort((a, b) => b.score - a.score)
            .map((p) => ({
              name: p.name,
              score: p.score,
              lastAnsweredQIdx: p.lastAnsweredQIdx,
            }));

          // Count submissions among active connected participants in room
          const roomSockets = io.sockets.adapter.rooms.get(code) || new Set();
          const activeParticipants = Array.from(room.participants.entries())
            .filter(([sockId]) => roomSockets.has(sockId) && sockId !== room.hostSocketId);
          const totalActive = activeParticipants.length;
          const submittedCount = activeParticipants.filter(
            ([, p]) => p.lastAnsweredQIdx === room.currentQuestionIdx
          ).length;

          io.to(code).emit('leaderboard:updated', {
            leaderboard: liveLeaderboard,
            submittedCount,
            totalParticipants: totalActive || room.participants.size,
          });

          // Send feedback directly back to participant with their updated total score
          socket.emit('participant:answer-confirmed', {
            questionIdx: room.currentQuestionIdx,
            isCorrect: Boolean(actualCorrect),
            currentScore: participant.score,
          });

          // When active participants answer, directly move to next question for all users
          if (totalActive > 0 && submittedCount >= totalActive) {
            this.clearRoomTimers(code);

            io.to(code).emit('question:all-answered', {
              questionIdx: room.currentQuestionIdx,
            });

            const timerState = this.getOrCreateTimerState(code);
            timerState.advanceTimeout = setTimeout(async () => {
              timerState.advanceTimeout = null;
              await advanceToNextOrEnd(code);
            }, 400);
          }
        }
      });

      // 5. Host advances to next question manually
      socket.on('host:next-question', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room && room.status === 'active') {
          this.clearRoomTimers(code);
          await advanceToNextOrEnd(code);
        }
      });

      // 6. Host finishes quiz (Permanent End - Saves attempts & prevents restarting)
      socket.on('host:finish-quiz', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room) {
          this.clearRoomTimers(code);
          room.status = 'ended';
          await this.saveFinalAttempts(room);
          await liveRoomStore.set(code, room);

          const finalLeaderboard = Array.from(room.participants.values())
            .sort((a, b) => b.score - a.score)
            .map((p) => ({
              name: p.name,
              score: p.score,
              percentage: p.percentage || 0,
              passed: p.passed || false,
              attemptId: p.savedAttemptId || null,
              answersCount: (p.answers || []).length,
            }));

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
              io.to(code).emit('lobby:updated', {
                participants: participantList,
                count: participantList.length,
              });
            } else if (room.status === 'active') {
              // Re-check remaining active connected participants
              const roomSockets = io.sockets.adapter.rooms.get(code) || new Set();
              const activeParticipants = Array.from(room.participants.entries())
                .filter(([sockId]) => roomSockets.has(sockId) && sockId !== room.hostSocketId);
              const totalActive = activeParticipants.length;
              const submittedCount = activeParticipants.filter(
                ([, p]) => p.lastAnsweredQIdx === room.currentQuestionIdx
              ).length;

              if (totalActive > 0 && submittedCount >= totalActive) {
                this.clearRoomTimers(code);
                const timerState = this.getOrCreateTimerState(code);
                timerState.advanceTimeout = setTimeout(async () => {
                  timerState.advanceTimeout = null;
                  await advanceToNextOrEnd(code);
                }, 400);
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
