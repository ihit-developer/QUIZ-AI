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
              return { text: o, isCorrect: false };
            }
            return {
              text: o.text,
              isCorrect: Boolean(o.isCorrect === true || o.isCorrect === 'true' || o.isCorrect),
            };
          });

          const finalOptions = shouldShuffleOptions && rawOptions.length > 1
            ? shuffleArray(rawOptions)
            : [...rawOptions];

          let correctIndex = finalOptions.findIndex((o) => o.isCorrect);
          if (correctIndex < 0 && finalOptions.length > 0) {
            correctIndex = 0;
          }

          return {
            id: String(q._id || q.id),
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

          // In live multiplayer quizzes, shuffle questions per participant unless explicitly false
          const shouldShuffleQuestions = Boolean(
            shuffleQuestions !== false &&
            room.settings?.shuffleQuestions !== false
          );

          room.status = 'active';
          room.startedAt = new Date();
          room.currentQuestionIdx = 0;
          await liveRoomStore.set(code, room);

          // 1. Host receives standard question order for public projection/review
          socket.emit('quiz:started', {
            questionIdx: 0,
            questions: buildSanitizedQuestions(room, room.questions, false),
            title: room.quizTitle,
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
                });
              }
            }
          }

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
              answersCount: (p.answers || []).length,
              lastAnsweredQIdx: p.lastAnsweredQIdx,
            }));

          const roomSockets = io.sockets.adapter.rooms.get(code) || new Set();
          const activeParticipants = Array.from(room.participants.entries())
            .filter(([sockId]) => roomSockets.has(sockId));
          const totalActive = activeParticipants.length;

          io.to(code).emit('leaderboard:updated', {
            leaderboard: liveLeaderboard,
            totalParticipants: totalActive || room.participants.size,
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
        }
      });

      // 4b. Participant reports completing all questions
      socket.on('participant:finished-all', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room && room.status === 'active') {
          const roomSockets = io.sockets.adapter.rooms.get(code) || new Set();
          const activeParticipants = Array.from(room.participants.entries())
            .filter(([sockId]) => roomSockets.has(sockId));
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
                .filter(([sockId]) => roomSockets.has(sockId));
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
