import React, { useState } from 'react';
import { BrainCircuit, Wand2, Loader2, X } from 'lucide-react';
import { quizService } from '../../services/quizService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import toast from 'react-hot-toast';

export const AIQuestionGeneratorModal = ({ isOpen, onClose, onQuestionsGenerated, language = 'English' }) => {
  const [topic, setTopic] = useState('Computer Science & Web Development');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(5);
  const [contextText, setContextText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error('Please specify a topic');
      return;
    }

    setLoading(true);
    try {
      const res = await quizService.generateAIQuestions({
        topic,
        difficulty,
        count: Number(count),
        contextText,
        language,
      });

      if (res.success && res.data.questions) {
        toast.success(`Generated ${res.data.questions.length} questions with AI!`);
        onQuestionsGenerated(res.data.questions);
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate AI questions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card-solid"
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '2rem',
          backgroundColor: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            color: 'var(--text-muted)',
            padding: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--on-primary)',
            }}
          >
            <BrainCircuit size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)' }}>
              AI Question Generator
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Generate complete multiple-choice questions with Claude AI
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <Input
            label="Subject / Topic Prompt"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Distributed Systems & Docker"
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  minHeight: '44px',
                }}
              >
                <option value="easy">Easy (Foundational)</option>
                <option value="medium">Medium (Standard)</option>
                <option value="hard">Hard (Advanced)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
                Question Count
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  minHeight: '44px',
                }}
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
              Optional Context Notes / Textbook Snippet
            </label>
            <textarea
              rows={3}
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Paste lecture notes or reference text here..."
              style={{
                width: '100%',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-btn)',
                padding: '0.75rem 1rem',
                color: 'var(--text)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {loading ? 'Synthesizing Questions...' : 'Generate Questions'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
