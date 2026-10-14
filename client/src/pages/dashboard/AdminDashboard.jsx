import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  FileQuestion,
  Activity,
  UserX,
  UserCheck,
  Pencil,
  Trash2,
  Search,
  Clock,
  Sparkles,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { PageSkeletonLoader } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [statsRes, usersRes, logsRes] = await Promise.all([
          adminService.getStats(),
          adminService.getUsers(),
          adminService.getAuditLogs(),
        ]);

        if (statsRes.success) setStats(statsRes.data.stats);
        if (usersRes.success) setUsers(usersRes.data.users);
        if (logsRes.success) setAuditLogs(logsRes.data.logs);
      } catch {
        toast.error('Failed to load admin controls');
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, []);

  const handleToggleBlock = async (userId) => {
    try {
      const res = await adminService.toggleBlockUser(userId);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isBlocked: !u.isBlocked } : u))
        );
        toast.success(res.message);
      }
    } catch {
      toast.error('Action failed');
    }
  };

  const handleSaveUser = async (event) => {
    event.preventDefault(); setSavingUser(true);
    try {
      const res = await adminService.updateUser(editingUser.id || editingUser._id, { name: editingUser.name, role: editingUser.role, isBlocked: editingUser.isBlocked });
      if (res.success) { setUsers((previous) => previous.map((user) => (user.id === (editingUser.id || editingUser._id) ? res.data.user : user))); setEditingUser(null); toast.success(res.message); }
    } catch (error) { toast.error(error.response?.data?.message || 'Could not update user.'); }
    finally { setSavingUser(false); }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete ${user.name}'s account? This cannot be undone.`)) return;
    try { const res = await adminService.deleteUser(user.id || user._id); if (res.success) { setUsers((previous) => previous.filter((item) => (item.id || item._id) !== (user.id || user._id))); toast.success(res.message); } }
    catch (error) { toast.error(error.response?.data?.message || 'Could not delete user.'); }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <PageSkeletonLoader />;
  }

  return (
    <div className="app-page admin-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <Card
        style={{
          padding: '2rem 2.25rem',
          backgroundColor: 'var(--surface-2)',
          border: '1.5px solid var(--border)',
        }}
      >
        <Badge variant="primary" style={{ marginBottom: '0.5rem' }}>
          PLATFORM ADMINISTRATION CONSOLE
        </Badge>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)' }}>
          Admin Super-Panel & Governance
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
          User directory moderation, permissions oversight, and security audit trail
        </p>
      </Card>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || users.length}
          description="Registered profiles"
          icon={Users}
        />
        <StatCard
          title="Active Quizzes"
          value={stats?.totalQuizzes || '24'}
          description="Live & self-paced"
          icon={FileQuestion}
        />
        <StatCard
          title="Completed Attempts"
          value={stats?.totalAttempts || '142'}
          description="Recorded submissions"
          icon={Activity}
        />
        <StatCard
          title="Admin Security"
          value="Online"
          description="Audit logger active"
          icon={Shield}
        />
      </div>

      {/* User Directory Management Table */}
      <Card style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)' }}>
              User Directory Management
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Inspect user roles, status, and enforce account governance
            </p>
          </div>

          <div style={{ width: '280px' }}>
            <Input
              icon={Search}
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Table headers={['User', 'Role', 'Status', 'Joined Date', 'Actions']}>
          {filteredUsers.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No users match your search criteria.
              </td>
            </tr>
          ) : (
            filteredUsers.map((u) => (
              <TableRow key={u.id || u._id}>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
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
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{u.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className="badge badge-primary"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {u.role}
                  </span>
                </TableCell>
                <TableCell>
                  {u.isBlocked ? (
                    <span className="badge badge-error">Suspended</span>
                  ) : (
                    <span className="badge badge-success">Active</span>
                  )}
                </TableCell>
                <TableCell style={{ color: 'var(--text-muted)' }}>
                  {new Date(u.createdAt || Date.now()).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => handleToggleBlock(u.id || u._id)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: 'var(--radius-btn)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      border: '1px solid var(--border)',
                      backgroundColor: u.isBlocked ? 'var(--primary)' : 'var(--surface-2)',
                      color: u.isBlocked ? 'var(--on-primary)' : 'var(--primary-text)',
                    }}
                  >
                    {u.isBlocked ? <UserCheck size={14} /> : <UserX size={14} />}
                    {u.isBlocked ? 'Unsuspend' : 'Suspend'}
                  </button>
                  <button type="button" onClick={() => setEditingUser({ ...u })} style={{ marginLeft: '0.4rem', padding: '0.4rem', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)' }} title="Edit user"><Pencil size={14} /></button>
                  <button type="button" onClick={() => handleDeleteUser(u)} style={{ marginLeft: '0.4rem', padding: '0.4rem', color: 'var(--primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)' }} title="Delete user"><Trash2 size={14} /></button>
                </TableCell>
              </TableRow>
            ))
          )}
        </Table>
      </Card>

      {editingUser && (
        <Card style={{ padding: '1.75rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '1rem' }}>Edit User</h2>
          <form onSubmit={handleSaveUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            <Input label="Name" value={editingUser.name} onChange={(event) => setEditingUser({ ...editingUser, name: event.target.value })} required />
            <div><label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>Role</label><select value={editingUser.role} onChange={(event) => setEditingUser({ ...editingUser, role: event.target.value })} style={{ width: '100%', minHeight: '44px', padding: '0.7rem', borderRadius: 'var(--radius-btn)', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}><option value="participant">Participant</option><option value="host">Host</option><option value="admin">Admin</option></select></div>
            <Button type="submit" disabled={savingUser}>{savingUser ? 'Saving...' : 'Save User'}</Button>
            <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
          </form>
        </Card>
      )}

      {/* Security Audit Trail */}
      <Card style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)' }}>
          Security Audit Trail
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {auditLogs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No critical governance events logged recently.
            </p>
          ) : (
            auditLogs.slice(0, 12).map((log, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  backgroundColor: 'var(--surface-2)',
                  borderRadius: 'var(--radius-btn)',
                  border: '1px solid var(--border)',
                  fontSize: '0.88rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <Clock size={16} color="var(--primary)" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{String(log.action || '').replaceAll('_', ' ')}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.resource || 'System activity'} · by {log.performedBy || 'System'}{log.ipAddress ? ` · ${log.ipAddress}` : ''}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
