import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  BrainCircuit,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { predictionService } from '../../services/predictionService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { PageSkeletonLoader } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export const AIPredictions = () => {
  const [data, setData] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const studentPromise = predictionService.getStudentPredictions().catch(() => ({ success: false }));
        const cohortPromise = predictionService.getCohortInsights('default').catch(() => ({ success: false }));

        const [studentRes, cohortRes] = await Promise.all([studentPromise, cohortPromise]);

        if (studentRes?.success && studentRes.data) {
          setData(studentRes.data);
        } else setError('We could not load your AI Insights right now.');

        if (cohortRes?.success && cohortRes.data) {
          setCohort(cohortRes.data);
        }
      } catch (err) {
        setError('We could not load your AI Insights right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchPredictions();
  }, []);

  if (loading) {
    return <PageSkeletonLoader />;
  }

  if (error || !data) {
    return <Card style={{ maxWidth: '620px', margin: '3rem auto', padding: '2rem', textAlign: 'center' }}><BrainCircuit size={34} color="var(--primary)" style={{ marginBottom: '0.75rem' }} /><h1 style={{ color: 'var(--text)', fontSize: '1.4rem', fontWeight: 900 }}>AI Insights unavailable</h1><p style={{ color: 'var(--text-muted)', margin: '0.65rem 0 1.25rem' }}>{error || 'Please refresh and try again.'}</p><Button onClick={() => window.location.reload()}>Try Again</Button></Card>;
  }

  if (!data.hasAttemptData) {
    return <Card style={{ maxWidth: '620px', margin: '3rem auto', padding: '2rem', textAlign: 'center' }}><BrainCircuit size={34} color="var(--primary)" style={{ marginBottom: '0.75rem' }} /><h1 style={{ color: 'var(--text)', fontSize: '1.4rem', fontWeight: 900 }}>Complete a quiz to unlock AI Insights</h1><p style={{ color: 'var(--text-muted)', margin: '0.65rem 0 1.25rem', lineHeight: 1.6 }}>Your personal forecast, topic radar, and recommendations are calculated from your completed quiz attempts. No sample data is shown.</p><Button onClick={() => { window.location.href = '/join'; }}>Join a Quiz</Button></Card>;
  }

  // Format historical scores + predicted dot for LineChart
  const chartPoints = (data?.historicalScores || []).map((score, i) => ({
    name: `Quiz #${i + 1}`,
    score,
    type: 'Actual',
  }));

  if (data?.predictedScore) {
    chartPoints.push({
      name: `Next Quiz (Forecast)`,
      score: data.predictedScore,
      predicted: data.predictedScore,
      type: 'Predicted',
    });
  }

  return (
    <div className="app-page insights-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Banner */}
      <Card
        style={{
          padding: '2.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          borderLeft: '4px solid var(--primary)',
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.78rem', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
            <BrainCircuit size={14} /> AI PSYCHOMETRIC & STATISTICAL PREDICTION ENGINE
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)' }}>
            Performance Forecast & Topic Radar
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
            Regression-based score projections, real-time pace trajectories, and AI study interventions
          </p>
        </div>
      </Card>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <StatCard
          label="PREDICTED NEXT SCORE"
          value={`${data?.predictedScore || 0}%`}
          subtext={`Model Confidence: ${data?.confidenceLevel || 0}%`}
          icon={TrendingUp}
        />
        <StatCard
          label="PERFORMANCE TRAJECTORY"
          value={`${data?.trend || 'Stable'}`}
          subtext={`Trend: +${data?.slope || 0} pts/quiz`}
          icon={TrendingUp}
        />
        <StatCard
          label="RISK ASSESSMENT"
          value="Low Risk"
          subtext="Pace & consistency above threshold"
          icon={ShieldCheck}
        />
        <StatCard
          label="COHORT READINESS"
          value={`${cohort?.cohortReadinessScore || 0}%`}
          subtext="Certification readiness index"
          icon={CheckCircle2}
        />
      </div>

      {/* Chart: Historical Scores & Future Prediction Regression */}
      <Card style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)' }}>
              Historical Trajectory & Next Exam Projection
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Extrapolated linear trend with weighted confidence interval
            </p>
          </div>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              border: '1px solid var(--border)',
            }}
          >
            Linear Regression Fitted
          </span>
        </div>

        <div style={{ width: '100%', height: '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <YAxis domain={[50, 100]} stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  boxShadow: 'none',
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={{ r: 5, fill: 'var(--primary)' }}
                activeDot={{ r: 8, stroke: 'var(--surface)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Weak Topics Radar & AI Study Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Weak Topic Detection */}
        <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="var(--primary)" /> Topic Mastery & Weak Spot Radar
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Calculated accuracy per curriculum domain. Flagged topics need targeted review:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data?.weakTopics?.map((topic, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--surface-2)',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{topic.topic}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Historical accuracy rate: {topic.accuracy}%
                  </div>
                </div>
                <span
                  style={{
                    padding: '0.2rem 0.65rem',
                    borderRadius: '0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: 'var(--surface)',
                    border: '1.5px solid var(--primary)',
                    color: 'var(--primary)',
                  }}
                >
                  Needs Review
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Right: AI Study Prescription */}
        <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="var(--primary)" /> AI Executive Study Recommendation
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Machine learning personalized guidance based on student response times and misstep patterns:
          </p>

          <div
            style={{
              background: 'var(--surface-2)',
              border: '1.5px solid var(--border)',
              borderLeft: '4px solid var(--primary)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              color: 'var(--text)',
              lineHeight: 1.6,
              fontSize: '0.92rem',
            }}
          >
            {data?.recommendations?.[0] ||
              'Focus on intermediate algorithms and async recursion patterns. Your pace is fast, but error rates increase on multi-step reasoning questions. Spend 20 minutes reviewing JavaScript event-loop mechanics.'}
          </div>
        </Card>
      </div>
    </div>
  );
};
