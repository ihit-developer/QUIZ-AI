import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Download,
  Users,
  Award,
  TrendingUp,
  Clock,
  ArrowLeft,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsService } from '../../services/analyticsService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { PageSkeletonLoader } from '../../components/ui/Skeleton';
import toast from 'react-hot-toast';

// 100% RED Monochromatic Theme Palette for Recharts
const RED_PALETTE = {
  primary: '#E11D48',
  dark: '#9F1239',
  deep: '#7F1D1D',
  blush: '#FDA4AF',
  soft: '#FFE4E6',
};

export const HostAnalytics = () => {
  const { quizId = 'demo_quiz_1' } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await analyticsService.getQuizAnalytics(quizId);
        if (res.success) {
          setData(res.data.analytics);
        }
      } catch (err) {
        const message = err.response?.data?.message || 'Failed to load quiz analytics.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [quizId]);

  if (loading) {
    return <PageSkeletonLoader />;
  }

  if (error || !data) {
    return (
      <Card style={{ maxWidth: '620px', margin: '3rem auto', padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={34} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
        <h1 style={{ color: 'var(--text)', fontSize: '1.35rem', fontWeight: 900 }}>Quiz analytics unavailable</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.65rem 0 1.25rem' }}>{error || 'There is no analytics data available for this quiz yet.'}</p>
        <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
      </Card>
    );
  }

  const exportCSV = async () => {
    try {
      const csv = await analyticsService.exportCSV(quizId);
      const url = URL.createObjectURL(csv);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(data?.quizTitle || 'quiz-results').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV export downloaded.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not export results.');
    }
  };

  const totalAttempts = data?.totalAttempts || 0;
  const passedAttempts = Math.round((totalAttempts * (data?.passingRate || 0)) / 100);
  const failedAttempts = Math.max(0, totalAttempts - passedAttempts);

  const pieData = [
    { name: 'Cleared / Passed', value: passedAttempts },
    { name: 'Needs Practice', value: failedAttempts },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link
            to="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--primary)',
              fontSize: '0.85rem',
              fontWeight: 800,
              marginBottom: '0.5rem',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} /> Back to Quizzes
          </Link>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)' }}>
            {data?.quizTitle || 'Quiz Cohort Telemetry & Analytics'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Live performance diagnostics, cohort distribution, and question accuracy
          </p>
        </div>

        <Button
          variant="primary"
          onClick={exportCSV}
          disabled={!totalAttempts}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <FileSpreadsheet size={16} /> Export Results (CSV)
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <StatCard
          label="Total Attempts"
          value={totalAttempts}
          subtext={`Completion: ${data?.completionRate || 0}%`}
          icon={Users}
        />
        <StatCard
          label="Average Score"
          value={`${data?.averageScore || 0}%`}
          subtext={`Passing Rate: ${data?.passingRate || 0}%`}
          icon={Award}
        />
        <StatCard
          label="Highest Score"
          value={`${data?.highestScore || 0}%`}
          subtext={`Lowest: ${data?.lowestScore || 0}%`}
          icon={TrendingUp}
        />
        <StatCard
          label="Cleared Students"
          value={passedAttempts}
          subtext="Met Passing Threshold"
          icon={CheckCircle2}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Score Distribution Chart */}
        <Card style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.25rem' }}>
            Score Distribution
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Participant count across grade brackets
          </p>

          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.scoreDistribution || []}>
                <XAxis dataKey="range" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis stroke="var(--text-muted)" allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    boxShadow: 'none',
                  }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Pass/Fail Pie Chart */}
        <Card style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.25rem' }}>
            Pass vs Needs Practice Ratio
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Certification clearance percentage
          </p>

          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  innerRadius={52}
                  paddingAngle={4}
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  <Cell fill="var(--primary)" />
                  <Cell fill="var(--border)" />
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    boxShadow: 'none',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text)' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--primary)', display: 'inline-block' }} />
              Passed ({passedAttempts})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text)' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--border)', display: 'inline-block' }} />
              Needs Practice ({failedAttempts})
            </div>
          </div>
        </Card>
      </div>

      {/* Question Accuracy Telemetry */}
      {data?.questionStats && data.questionStats.length > 0 && (
        <Card style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.25rem' }}>
            Question Accuracy & Difficulty Telemetry
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Evaluate question difficulty and identify drop-off or confusion points
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.questionStats.map((q, idx) => (
              <div
                key={idx}
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '0.75rem',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    QUESTION {idx + 1}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', marginTop: '0.15rem' }}>
                    {q.questionTitle}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ width: '120px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Accuracy</span>
                      <span style={{ color: 'var(--primary)' }}>{q.accuracy}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${q.accuracy}%`,
                          background: 'var(--primary)',
                          borderRadius: '9999px',
                        }}
                      />
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '0.25rem 0.65rem',
                      borderRadius: '0.4rem',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      background: q.accuracy < 50 ? 'var(--primary-soft)' : 'var(--surface)',
                      border: `1px solid ${q.accuracy < 50 ? 'var(--primary)' : 'var(--border)'}`,
                      color: q.accuracy < 50 ? 'var(--primary)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {q.accuracy < 50 ? 'Challenging' : 'Normal'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cohort Leaderboard & At-Risk Flag Table */}
      {data?.leaderboard && data.leaderboard.length > 0 && (
        <Card style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)' }}>
                Cohort Attempts & Student Performance Roster
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                At-risk participants are flagged with labeled red alerts for teacher follow-up
              </p>
            </div>
            <Badge variant="neutral">{data.leaderboard.length} Candidates</Badge>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Rank</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Candidate</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Score</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Percentage</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Duration</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cohort Standing</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((item, idx) => {
                  const isAtRisk = item.percentage < 60;
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isAtRisk ? 'var(--primary-soft)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        #{item.rank}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: 'var(--text)' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text)' }}>
                        {item.score} pts
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: isAtRisk ? 'var(--primary)' : 'var(--text)' }}>
                        {item.percentage}%
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                        {Math.floor(item.durationSeconds / 60)}m {item.durationSeconds % 60}s
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isAtRisk ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '0.35rem',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              background: 'var(--surface)',
                              border: '1.5px solid var(--primary)',
                              color: 'var(--primary)',
                            }}
                          >
                            <AlertCircle size={12} /> At Risk (&lt;60%)
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '0.35rem',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <CheckCircle2 size={12} color="var(--primary)" /> Passed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
