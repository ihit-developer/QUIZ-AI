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
  }

  // Helper: Persist participant quiz attempt into database on finish
  async saveFinalAttempts(room) {
    if (!room || !room.quizId || !room.participants) return;

    const Attempt = require('../models/Attempt');
    const Quiz = require('../models/Quiz');
    const totalPointsPossible = (room.questions || []).reduce((acc, q) => acc + (q.points || 10), 0) || 10;

    for (const [, p] of room.participants.entries()) {
      try {
        const score = p.score || 0;
        const percentage = totalPointsPossible > 0 ? Math.round((score / totalPointsPossible) * 100) : 0;
        const passed = percentage >= (room.passingScorePercent || 60);

        const attemptDoc = {
          quizId: room.quizId,
          userId: p.userId || null,
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
            questionId: ans.questionId,
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
      }
    }

    // Mark quiz as closed in database so ended quiz cannot be started again
    try {
      await Quiz.findByIdAndUpdate(room.quizId, { status: 'closed' });
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
          passingScorePercent: quizDoc?.settings?.passingScorePercent || 60,
          participants: existingParticipants,
          startedAt: existingRoom ? existingRoom.startedAt : null,
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
            passingScorePercent: quizDoc?.settings?.passingScorePercent || 60,
            participants: new Map(),
            startedAt: null,
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
        room.participants.set(socket.id, {
          socketId: socket.id,
          userId: userId || null,
          name: effectiveName,
          score: 0,
          answers: [],
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
      });

      // Helper to start per-question server timer
      const startQuestionTimer = async (code) => {
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (!room) return;

        if (room.timerInterval) {
          clearInterval(room.timerInterval);
          room.timerInterval = null;
        }

        const currentQ = room.questions[room.currentQuestionIdx];
        let secondsLeft = currentQ?.timeLimitSeconds || 30;

        io.to(code).emit('question:timer-tick', {
          questionIdx: room.currentQuestionIdx,
          secondsLeft,
          totalSeconds: secondsLeft,
        });

        room.timerInterval = setInterval(async () => {
          secondsLeft -= 1;
          io.to(code).emit('question:timer-tick', {
            questionIdx: room.currentQuestionIdx,
            secondsLeft,
            totalSeconds: currentQ?.timeLimitSeconds || 30,
          });

          if (secondsLeft <= 0) {
            clearInterval(room.timerInterval);
            room.timerInterval = null;

            // Automatically advance to next question or end quiz
            if (room.currentQuestionIdx < room.questions.length - 1) {
              room.currentQuestionIdx += 1;
              io.to(code).emit('question:advanced', {
                questionIdx: room.currentQuestionIdx,
                autoAdvanced: true,
              });
              startQuestionTimer(code);
            } else {
              room.status = 'ended';
              await this.saveFinalAttempts(room);
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
        }, 1000);
      };

      // 3. Host starts quiz (Blocked if quiz has ended)
      socket.on('host:start-quiz', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room) {
          if (room.status === 'ended') {
            socket.emit('error', { message: 'This quiz has ended and cannot be started again.' });
            return;
          }

          room.status = 'active';
          room.startedAt = new Date();
          room.currentQuestionIdx = 0;
          await liveRoomStore.set(code, room);
          const sanitizedQuestions = (room.questions || []).map((q) => ({
            id: q._id || q.id,
            title: q.title,
            options: (q.options || []).map((o) => o.text),
            correctIndex: (q.options || []).findIndex((o) => o.isCorrect),
            points: q.points || 10,
            timeLimitSeconds: q.timeLimitSeconds || 30,
          }));

          io.to(code).emit('quiz:started', {
            questionIdx: 0,
            questions: sanitizedQuestions,
            title: room.quizTitle,
          });

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
          const pts = isCorrect ? (Number(pointsAwarded) || 10) : 0;
          participant.score += pts;

          const currentQ = room.questions[room.currentQuestionIdx];
          participant.answers.push({
            questionId: currentQ ? currentQ._id : null,
            selectedText: selectedOptionText || '',
            isCorrect: Boolean(isCorrect),
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

          // Count submissions on current question
          const totalParticipants = room.participants.size;
          const submittedCount = Array.from(room.participants.values()).filter(
            (p) => p.lastAnsweredQIdx === room.currentQuestionIdx
          ).length;

          io.to(code).emit('leaderboard:updated', {
            leaderboard: liveLeaderboard,
            submittedCount,
            totalParticipants,
          });

          // Send feedback directly back to participant with their updated total score
          socket.emit('participant:answer-confirmed', {
            questionIdx: room.currentQuestionIdx,
            isCorrect: Boolean(isCorrect),
            currentScore: participant.score,
          });

          // If all joined participants answered, automatically advance after a brief 1.2s delay
          if (totalParticipants > 0 && submittedCount >= totalParticipants) {
            if (room.timerInterval) {
              clearInterval(room.timerInterval);
              room.timerInterval = null;
            }
            setTimeout(async () => {
              if (room.status !== 'active') return;
              if (room.currentQuestionIdx < room.questions.length - 1) {
                room.currentQuestionIdx += 1;
                io.to(code).emit('question:advanced', {
                  questionIdx: room.currentQuestionIdx,
                  autoAdvanced: true,
                });
                startQuestionTimer(code);
              } else {
                room.status = 'ended';
                await this.saveFinalAttempts(room);
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
            }, 1200);
          }
        }
      });

      // 5. Host advances to next question manually
      socket.on('host:next-question', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = await liveRoomStore.get(code) || this.rooms.get(code);
        if (room && room.status === 'active') {
          if (room.timerInterval) {
            clearInterval(room.timerInterval);
            room.timerInterval = null;
          }
          room.currentQuestionIdx += 1;
          await liveRoomStore.set(code, room);
          io.to(code).emit('question:advanced', { questionIdx: room.currentQuestionIdx });
          startQuestionTimer(code);
        }
      });

      // 6. Host finishes quiz (Permanent End - Saves attempts & prevents restarting)
      socket.on('host:finish-quiz', async ({ roomCode }) => {
        const code = roomCode.toUpperCase();
        const room = this.rooms.get(code);
        if (room) {
          if (room.timerInterval) {
            clearInterval(room.timerInterval);
            room.timerInterval = null;
          }
          room.status = 'ended';
          await liveRoomStore.set(code, room);
          await this.saveFinalAttempts(room);

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
            // Only remove from lobby if not started; keep participant records if in progress/ended
            if (room.status === 'lobby') {
              room.participants.delete(socket.id);
              liveRoomStore.set(code, room);
              const participantList = Array.from(room.participants.values()).map((p) => p.name);
              io.to(code).emit('lobby:updated', {
                participants: participantList,
                count: participantList.length,
              });
            }
            break;
          }
        }
      });
    });
  }
}

module.exports = new LiveSessionManager();
