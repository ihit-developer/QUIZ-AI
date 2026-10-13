import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Shield, Save, Upload, Camera, Trash2, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { authService } from '../../services/authService';
import toast from 'react-hot-toast';

export const Profile = () => {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const fileInputRef = useRef(null);

  // File upload handler to convert local picture into Base64 data URL
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be 5 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(String(reader.result));
      toast.success('Image selected. Save your profile to apply it everywhere.');
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault(); setChangingPassword(true);
    try { await authService.changePassword({ currentPassword, newPassword }); setCurrentPassword(''); setNewPassword(''); toast.success('Password updated successfully.'); }
    catch (err) { toast.error(err.response?.data?.message || 'Password could not be updated.'); }
    finally { setChangingPassword(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Sync with backend API
      const res = await authService.updateProfile({ name, bio, avatar });
      const savedUser = res?.data?.user || {};
      const updated = {
        ...user,
        ...savedUser,
        name: savedUser.name ?? name,
        bio: savedUser.bio ?? bio,
        avatar: savedUser.avatar ?? avatar,
      };
      setAvatar(updated.avatar || '');
      setUser(updated);
      localStorage.setItem('quizese_user', JSON.stringify(updated));
      toast.success('Profile and photo updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Profile could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Card style={{ padding: '2.5rem' }}>
        <Badge variant="primary" style={{ marginBottom: '0.65rem' }}>
          ACCOUNT PREFERENCES
        </Badge>

        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.25rem' }}>
          User Profile & Settings
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Manage your account identity, upload your custom profile photo, and configure role credentials
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Avatar Preview & Direct Local File Upload */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              flexWrap: 'wrap',
              backgroundColor: 'var(--surface-2)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-card)',
              border: '1.5px solid var(--border)',
            }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {avatar ? (
                <img
                  src={avatar}
                  alt="Avatar"
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--primary)',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: 'var(--on-primary)',
                    border: '3px solid var(--border)',
                  }}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Upload badge overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: 'var(--on-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--surface)',
                  cursor: 'pointer',
                }}
                title="Upload Photo"
              >
                <Camera size={14} />
              </button>
            </div>

            <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                Profile Photo
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Upload an image from your computer (PNG, JPG, or WEBP up to 5 MB).
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ minHeight: '34px', fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
                >
                  <Upload size={14} /> Choose Image File
                </Button>

                {avatar && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      setAvatar('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    style={{ minHeight: '34px', fontSize: '0.82rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Trash2 size={14} /> Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Input
            label="Full Name"
            icon={User}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
              Email Address (Fixed)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '0.9rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                <Mail size={18} />
              </div>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '0.75rem 1rem 0.75rem 2.6rem',
                  fontSize: '0.95rem',
                  minHeight: '44px',
                  cursor: 'not-allowed',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
              Account Role
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-btn)',
                padding: '0.75rem 1rem',
              }}
            >
              <Shield size={18} color="var(--primary)" />
              <span style={{ fontWeight: 800, textTransform: 'capitalize', color: 'var(--text)', fontSize: '0.95rem' }}>
                {user?.role || 'Participant'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                Assigned by security policy
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
              Short Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about your study focus, engineering interests, or certification goals..."
              style={{
                width: '100%',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-card)',
                padding: '0.75rem 1rem',
                fontSize: '0.92rem',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          <Button type="submit" disabled={saving} style={{ width: '100%', minHeight: '48px', fontSize: '1rem', marginTop: '0.5rem' }}>
            <Save size={18} /> {saving ? 'Saving Changes...' : 'Save Profile Changes'}
          </Button>
        </form>
      </Card>
      <Card style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '0.35rem' }}>Change Password</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Use your current password to set a new one.</p>
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <Button type="submit" disabled={changingPassword || newPassword.length < 6}>{changingPassword ? 'Updating Password...' : 'Update Password'}</Button>
        </form>
      </Card>
    </div>
  );
};
