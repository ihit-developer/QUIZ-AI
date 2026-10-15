import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Plus,
  Trash2,
  Wand2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Settings,
  HelpCircle,
  FileText,
  Clock,
  Shield,
  Check,
  ClipboardPaste,
} from 'lucide-react';
import { quizService } from '../../services/quizService';
import { AIQuestionGeneratorModal } from '../../components/quiz/AIQuestionGeneratorModal';
import { ShareQuizModal } from '../../components/quiz/ShareQuizModal';
import { Stepper } from '../../components/ui/Stepper';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import toast from 'react-hot-toast';

export const QuizBuilder = () => {
  const navigate = useNavigate();
  const { id: editQuizId } = useParams();
  const isEditMode = Boolean(editQuizId);

  const [currentStep, setCurrentStep] = useState(1);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [publishedQuiz, setPublishedQuiz] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(isEditMode);
  const [showPasteImporter, setShowPasteImporter] = useState(false);
  const [pastedQuestions, setPastedQuestions] = useState('');

  // Form State
  const [details, setDetails] = useState({
    title: '',
    description: '',
    category: 'Computer Science',
    language: 'English',
    mode: 'self_paced',
  });

  const [settings, setSettings] = useState({
    timeLimitMinutes: 15,
    perQuestionTimer: false,
    shuffleQuestions: false,
    shuffleOptions: true,
    attemptsAllowed: 1,
    passingScorePercent: 70,
    negativeMarking: false,
    allowGuests: true,
    requireLogin: false,
    showResultsImmediately: true,
    showCorrectAnswersAfterSubmit: true,
    antiCheat: {
      enforceFullscreen: true,
      detectTabSwitch: true,
      disableCopyPaste: true,
      maxViolationsAllowed: 3,
    },
  });
  const [schedule, setSchedule] = useState({ endsAt: '' });

  const [questions, setQuestions] = useState([
    {
      title: 'What is the primary benefit of declarative state management in modern web frameworks?',
      type: 'mcq_single',
      difficulty: 'medium',
      topicTag: 'Architecture',
      points: 10,
      timeLimitSeconds: 30,
      explanation: 'Declarative state ensures the UI remains a predictable pure function of state.',
      options: [
        { text: 'Predictable UI synchronization with state', isCorrect: true },
        { text: 'Direct manual manipulation of DOM nodes', isCorrect: false },
        { text: 'Elimination of all network latency', isCorrect: false },
        { text: 'Automatic CSS minification', isCorrect: false },
      ],
    },
  ]);

  // Load existing quiz if in edit mode
  useEffect(() => {
    if (editQuizId) {
      quizService
        .getQuizById(editQuizId)
        .then((res) => {
          if (res.success && res.data) {
            const q = res.data.quiz;
            setDetails({
              title: q.title || '',
              description: q.description || '',
              category: q.category || 'Computer Science',
              language: q.language || 'English',
              mode: q.mode || 'self_paced',
            });
            if (q.settings) setSettings(q.settings);
            if (q.schedule?.endsAt) setSchedule({ endsAt: new Date(q.schedule.endsAt).toISOString().slice(0, 16) });
            if (res.data.questions && res.data.questions.length > 0) {
              setQuestions(res.data.questions);
            }
          }
        })
        .catch(() => {
          toast.error('Failed to load quiz details for editing');
        })
        .finally(() => {
          setLoadingQuiz(false);
        });
    }
  }, [editQuizId]);

  // Question editing helpers
  const addEmptyQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        title: 'New question prompt...',
        type: 'mcq_single',
        difficulty: 'medium',
        topicTag: 'General',
        points: 10,
        timeLimitSeconds: 30,
        explanation: '',
        options: [
          { text: 'Option 1', isCorrect: true },
          { text: 'Option 2', isCorrect: false },
          { text: 'Option 3', isCorrect: false },
          { text: 'Option 4', isCorrect: false },
        ],
      },
    ]);
  };

  const removeQuestion = (idx) => {
    if (questions.length <= 1) {
      toast.error('A quiz must have at least one question.');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx, field, value) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const updateOptionText = (qIdx, optIdx, text) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIdx].options];
      opts[optIdx] = { ...opts[optIdx], text };
      copy[qIdx] = { ...copy[qIdx], options: opts };
      return copy;
    });
  };

  const toggleOptionCorrect = (qIdx, optIdx) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const isSingle = copy[qIdx].type === 'mcq_single' || copy[qIdx].type === 'true_false';
      const opts = copy[qIdx].options.map((opt, i) => {
        if (isSingle) {
          return { ...opt, isCorrect: i === optIdx };
        }
        if (i === optIdx) {
          return { ...opt, isCorrect: !opt.isCorrect };
        }
        return opt;
      });
      copy[qIdx] = { ...copy[qIdx], options: opts };
      return copy;
    });
  };

  const handleAIQuestions = (aiQuestions) => {
    setQuestions((prev) => [...prev, ...aiQuestions]);
    toast.success(`Appended ${aiQuestions.length} AI questions to this quiz!`);
  };

  const normaliseImportedQuestion = (raw) => {
    const choices = raw.options || raw.choices || raw.answers || [];
    const answer = raw.correctAnswer ?? raw.answer ?? raw.correct ?? raw.correctIndex;
    const answerIndex = typeof answer === 'number'
      ? answer
      : choices.findIndex((choice, index) => {
          const text = typeof choice === 'string' ? choice : choice.text;
          return String(answer || '').trim().toLowerCase() === text?.trim().toLowerCase()
            || String(answer || '').trim().toUpperCase() === String.fromCharCode(65 + index);
        });
    const options = choices.map((choice, index) => ({
      text: typeof choice === 'string' ? choice.trim() : String(choice.text || '').trim(),
      isCorrect: answerIndex === index || Boolean(choice.isCorrect),
    })).filter((choice) => choice.text);
    return options.length >= 2 && (raw.title || raw.question || raw.prompt)
      ? {
          title: String(raw.title || raw.question || raw.prompt).trim(),
          type: 'mcq_single', difficulty: raw.difficulty || 'medium', topicTag: raw.topicTag || 'General',
          points: Number(raw.points) || 10, timeLimitSeconds: Number(raw.timeLimitSeconds) || 30,
          explanation: raw.explanation || '', options,
        }
      : null;
  };

  const importPastedQuestions = () => {
    let imported = [];
    try {
      const parsed = JSON.parse(pastedQuestions);
      imported = (Array.isArray(parsed) ? parsed : parsed.questions || []).map(normaliseImportedQuestion).filter(Boolean);
    } catch {
      const blocks = pastedQuestions.trim().split(/\r?\n\s*\r?\n/);
      imported = blocks.map((block) => {
        const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const answerLine = lines.find((line) => /^(answer|correct answer)\s*:/i.test(line));
        const optionLines = lines.filter((line) => /^[A-Da-d][.)]\s+/.test(line));
        const options = optionLines.map((line) => ({ text: line.replace(/^[A-Da-d][.)]\s+/, ''), isCorrect: false }));
        const answer = answerLine?.replace(/^(answer|correct answer)\s*:\s*/i, '').trim();
        const answerIndex = /^[A-D]$/i.test(answer || '')
          ? answer.toUpperCase().charCodeAt(0) - 65
          : options.findIndex((option) => option.text.toLowerCase() === String(answer || '').toLowerCase());
        if (answerIndex >= 0) options[answerIndex].isCorrect = true;
        const title = lines.filter((line) => !optionLines.includes(line) && line !== answerLine).join(' ')
          .replace(/^\d+[.)]\s*/, '');
        return normaliseImportedQuestion({ title, options });
      }).filter(Boolean);
    }
    if (!imported.length) {
      toast.error('Could not find valid multiple-choice questions. Include at least two options and an Answer: A line.');
      return;
    }
    setQuestions((current) => [...current, ...imported]);
    setPastedQuestions('');
    setShowPasteImporter(false);
    toast.success(`Added ${imported.length} question${imported.length === 1 ? '' : 's'} from pasted text.`);
  };

  const handlePublish = async () => {
    if (!details.title.trim()) {
      toast.error('Quiz title is required.');
      setCurrentStep(1);
      return;
    }

    if (questions.length === 0) {
      toast.error('Add at least one question.');
      setCurrentStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: details.title,
        description: details.description,
        category: details.category,
        language: details.language,
        mode: details.mode,
        settings,
        schedule: { endsAt: schedule.endsAt ? new Date(schedule.endsAt).toISOString() : null },
        questions,
      };

      if (isEditMode) {
        const res = await quizService.updateQuiz(editQuizId, payload);
        if (res.success) {
          toast.success('Quiz updated successfully!');
          navigate('/dashboard');
        }
      } else {
        const res = await quizService.createQuiz(payload);
        if (res.success) {
          setPublishedQuiz(res.data.quiz);
          setIsShareModalOpen(true);
          toast.success('Quiz published with Join Code & QR!');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Details', icon: FileText },
    { num: 2, label: 'Questions', icon: HelpCircle },
    { num: 3, label: 'Settings', icon: Settings },
    { num: 4, label: 'Review & Publish', icon: CheckCircle2 },
  ];

  if (loadingQuiz) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Loading quiz editor...</span>
      </div>
    );
  }

  return (
    <div className="app-page builder-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Badge variant="primary" style={{ marginBottom: '0.4rem' }}>
            CREATOR WIZARD
          </Badge>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)' }}>
            {isEditMode ? 'Edit Assessment' : 'Create & Publish Quiz'}
          </h1>
        </div>

        <Button onClick={() => setIsAIModalOpen(true)}>
          <Wand2 size={18} /> Generate Questions with AI
        </Button>
      </div>

      {/* Stepper Progress Bar */}
      <Stepper
        steps={steps}
        currentStep={currentStep}
        onStepClick={(num) => setCurrentStep(num)}
      />

      {/* Step 1: Details */}
      {currentStep === 1 && (
        <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>
            Step 1: General Quiz Details
          </h2>

          <Input
            label="Quiz Title"
            required
            value={details.title}
            onChange={(e) => setDetails({ ...details, title: e.target.value })}
            placeholder="e.g. Distributed Systems & Concurrency Benchmark"
          />

          {/* Quiz Mode Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
              EXAMINATION MODE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div
                onClick={() => setDetails({ ...details, mode: 'self_paced' })}
                style={{
                  border: details.mode === 'self_paced' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: details.mode === 'self_paced' ? 'var(--primary-soft)' : 'var(--surface-2)',
                  borderRadius: 'var(--radius-card)',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: details.mode === 'self_paced' ? 'var(--primary-text)' : 'var(--text)' }}>
                    📝 Self-Paced Exam
                  </span>
                  {details.mode === 'self_paced' && (
                    <span className="badge badge-primary">Active</span>
                  )}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Students solve questions independently anytime with a timer. Ideal for homework, exams, and asynchronous practice.
                </p>
              </div>

              <div
                onClick={() => setDetails({ ...details, mode: 'live' })}
                style={{
                  border: details.mode === 'live' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: details.mode === 'live' ? 'var(--primary-soft)' : 'var(--surface-2)',
                  borderRadius: 'var(--radius-card)',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: details.mode === 'live' ? 'var(--primary-text)' : 'var(--text)' }}>
                    ⚡ Live Multiplayer Arena
                  </span>
                  {details.mode === 'live' && (
                    <span className="badge badge-primary">Active</span>
                  )}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Host projects questions to a group screen. Students answer in real-time on phones with synchronized countdowns and podium rankings.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
                Subject Domain
              </label>
              <select
                value={details.category}
                onChange={(e) => setDetails({ ...details, category: e.target.value })}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  color: 'var(--text)',
                  fontSize: '0.95rem',
                  minHeight: '44px',
                }}
              >
                <option value="Computer Science">Computer Science & Algorithms</option>
                <option value="Mathematics">Applied Mathematics & Statistics</option>
                <option value="Natural Sciences">Physics & Natural Sciences</option>
                <option value="Business">Business Administration</option>
                <option value="Medical">Medical Sciences</option>
                <option value="Other">General Knowledge</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
                Quiz Language
              </label>
              <select value={details.language} onChange={(e) => setDetails({ ...details, language: e.target.value })} style={{ width: '100%', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '0.75rem 1rem', color: 'var(--text)', fontSize: '0.95rem', minHeight: '44px' }}>
                <option value="English">English</option>
                <option value="Urdu">Urdu (اردو)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
              Instructions / Description
            </label>
            <textarea
              rows={3}
              value={details.description}
              onChange={(e) => setDetails({ ...details, description: e.target.value })}
              placeholder="Instructions for students before starting..."
              style={{
                width: '100%',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-btn)',
                padding: '0.75rem 1rem',
                color: 'var(--text)',
                fontSize: '0.95rem',
                lineHeight: 1.5,
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <Button onClick={() => setCurrentStep(2)}>
              Next: Question Editor <ArrowRight size={18} />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Questions Editor */}
      {currentStep === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>
                Step 2: Questions Repository ({questions.length})
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Add options, mark correct answers with the checkmark, and adjust time limits
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="secondary" onClick={() => setShowPasteImporter((visible) => !visible)}>
                <ClipboardPaste size={16} /> Paste Questions
              </Button>
              <Button variant="secondary" onClick={() => setIsAIModalOpen(true)}>
                <Wand2 size={16} /> AI Auto-Generate
              </Button>
              <Button onClick={addEmptyQuestion}>
                <Plus size={16} /> Add Question
              </Button>
            </div>
          </div>

          {showPasteImporter && (
            <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>Paste AI Questions</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Paste JSON or blocks like: question, A. option, B. option, Answer: A. Separate questions with a blank line.
                </p>
              </div>
              <textarea
                rows={9}
                value={pastedQuestions}
                onChange={(event) => setPastedQuestions(event.target.value)}
                placeholder={'What is 2 + 2?\nA. 3\nB. 4\nC. 5\nD. 6\nAnswer: B'}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-btn)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button variant="secondary" onClick={() => setShowPasteImporter(false)}>Cancel</Button>
                <Button onClick={importPastedQuestions}>Add Pasted Questions</Button>
              </div>
            </Card>
          )}

          {/* Questions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {questions.map((q, qIdx) => (
              <Card
                key={qIdx}
                style={{
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  backgroundColor: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--on-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                      }}
                    >
                      {qIdx + 1}
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                      Question #{qIdx + 1}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeQuestion(qIdx)}
                    style={{
                      color: 'var(--hero)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                    }}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                </div>

                <Input
                  label="Question Prompt"
                  value={q.title}
                  onChange={(e) => updateQuestion(qIdx, 'title', e.target.value)}
                  placeholder="Enter the question text here..."
                  required
                />

                {/* Options List */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>
                    ANSWER CHOICES (Click the checkmark to designate the correct answer)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.35rem 0.65rem',
                          backgroundColor: opt.isCorrect ? 'var(--primary-soft)' : 'var(--surface-2)',
                          border: opt.isCorrect ? '2px solid var(--primary)' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-btn)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleOptionCorrect(qIdx, optIdx)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: opt.isCorrect ? 'none' : '1.5px solid var(--border)',
                            backgroundColor: opt.isCorrect ? 'var(--primary)' : 'transparent',
                            color: 'var(--on-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                          title={opt.isCorrect ? 'Correct Answer' : 'Mark as Correct'}
                          aria-label="Toggle correct option"
                        >
                          {opt.isCorrect && <Check size={14} />}
                        </button>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                          placeholder={`Option ${optIdx + 1}`}
                          style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text)',
                            fontSize: '0.9rem',
                            fontWeight: opt.isCorrect ? 700 : 500,
                            padding: '0.35rem',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '0.35rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                      Points Value
                    </label>
                    <input
                      type="number"
                      value={q.points}
                      onChange={(e) => updateQuestion(qIdx, 'points', Number(e.target.value))}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-btn)',
                        padding: '0.5rem 0.75rem',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                      Difficulty Level
                    </label>
                    <select
                      value={q.difficulty}
                      onChange={(e) => updateQuestion(qIdx, 'difficulty', e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-btn)',
                        padding: '0.5rem 0.75rem',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        minHeight: '38px',
                      }}
                    >
                      <option value="easy">Easy (1x Weight)</option>
                      <option value="medium">Medium (2x Weight)</option>
                      <option value="hard">Hard (3x Weight)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                      Question Time Limit (Seconds)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={3600}
                      value={q.timeLimitSeconds || 30}
                      onChange={(e) => updateQuestion(qIdx, 'timeLimitSeconds', Math.max(5, Number(e.target.value) || 5))}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-btn)',
                        padding: '0.5rem 0.75rem',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <Button variant="secondary" onClick={() => setCurrentStep(1)}>
              <ArrowLeft size={18} /> Back: Details
            </Button>
            <Button onClick={() => setCurrentStep(3)}>
              Next: Quiz Settings <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Settings */}
      {currentStep === 3 && (
        <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>
            Step 3: Assessment Parameters & Integrity Rules
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
                Overall Time Limit (Minutes)
              </label>
              <input
                type="number"
                min={1}
                max={240}
                value={settings.timeLimitMinutes}
                onChange={(e) => setSettings({ ...settings, timeLimitMinutes: Number(e.target.value) })}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  color: 'var(--text)',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)', paddingTop: '1.8rem' }}>
              <input
                type="checkbox"
                checked={settings.perQuestionTimer}
                onChange={(e) => setSettings({ ...settings, perQuestionTimer: e.target.checked })}
                style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }}
              />
              Use each question's time limit
            </label>

            {details.mode === 'self_paced' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
                  Due date and time (optional)
                </label>
                <input
                  type="datetime-local"
                  value={schedule.endsAt}
                  onChange={(e) => setSchedule({ endsAt: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '0.75rem 1rem', color: 'var(--text)', fontSize: '0.95rem' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Students can attempt any time until this deadline. The per-attempt time limit above still applies.</p>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
                Passing Score Percentage
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.passingScorePercent}
                onChange={(e) => setSettings({ ...settings, passingScorePercent: Number(e.target.value) })}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  color: 'var(--text)',
                  fontSize: '0.95rem',
                }}
              />
            </div>
          </div>

          {/* Anti-cheat configuration */}
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--surface-2)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Shield size={18} color="var(--primary)" />
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                Anti-Cheat Integrity Rules
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={settings.antiCheat.detectTabSwitch}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      antiCheat: { ...settings.antiCheat, detectTabSwitch: e.target.checked },
                    })
                  }
                  style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }}
                />
                Detect Tab Switching Violations
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={settings.antiCheat.enforceFullscreen}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      antiCheat: { ...settings.antiCheat, enforceFullscreen: e.target.checked },
                    })
                  }
                  style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }}
                />
                Enforce Fullscreen During Exam
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <Button variant="secondary" onClick={() => setCurrentStep(2)}>
              <ArrowLeft size={18} /> Back: Questions
            </Button>
            <Button onClick={() => setCurrentStep(4)}>
              Next: Review & Publish <ArrowRight size={18} />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Review & Publish */}
      {currentStep === 4 && (
        <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>
            Step 4: Assessment Summary & Final Publish
          </h2>

          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--surface-2)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div>
              <span className="badge badge-primary">{details.category}</span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', marginTop: '0.35rem' }}>
                {details.title}
              </h3>
              {details.description && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {details.description}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span className="badge badge-info">{questions.length} Questions</span>
              <span className="badge badge-info">{settings.timeLimitMinutes} Mins Duration</span>
              <span className="badge badge-info">Pass: {settings.passingScorePercent}%</span>
              <span className="badge badge-primary">
                {details.mode === 'live' ? '⚡ Live Arena' : '📝 Self-Paced'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <Button variant="secondary" onClick={() => setCurrentStep(3)}>
              <ArrowLeft size={18} /> Back: Settings
            </Button>
            <Button onClick={handlePublish} disabled={submitting}>
              <CheckCircle2 size={18} />
              {submitting
                ? 'Publishing Assessment...'
                : isEditMode
                ? 'Save & Update Assessment'
                : 'Publish Assessment Now'}
            </Button>
          </div>
        </Card>
      )}

      {/* AI Modal */}
      <AIQuestionGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onQuestionsGenerated={handleAIQuestions}
        language={details.language}
      />

      {/* Share Modal */}
      <ShareQuizModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          if (publishedQuiz?.joinCode && publishedQuiz.mode === 'live') {
            navigate(`/live/${publishedQuiz.joinCode}`);
          } else {
            navigate('/dashboard');
          }
        }}
        quiz={publishedQuiz}
      />
    </div>
  );
};
