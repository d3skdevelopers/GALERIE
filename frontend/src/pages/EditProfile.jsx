import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './EditProfile.css';

export default function EditProfile({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!session) { navigate('/login'); return; }
    loadProfile();
  }, [session]);

  async function loadProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (data) {
      setUsername(data.username || '');
      setFullName(data.full_name || '');
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url);
    }
    setLoading(false);
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return; }
    if (!file.type.startsWith('image/')) { setError('File must be an image'); return; }

    setUploading(true);
    setError('');

    try {
      const ext = file.name.split('.').pop();
      const path = `${session.user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Add cache buster
      const url = `${publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id);
      setAvatarUrl(url);
      setSuccess('Avatar updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // FIX: Check username uniqueness (excluding self)
    if (username) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', session.user.id)
        .single();

      if (existing) {
        setError('Username already taken');
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username, full_name: fullName, bio })
      .eq('id', session.user.id);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Profile saved');
      setTimeout(() => navigate(`/artist/${username}`), 800);
    }
    setSaving(false);
  }

  if (loading) return <div className="edit-container"><div className="loading">loading…</div></div>;

  return (
    <div className="edit-container">
      <h1>edit profile</h1>

      <div className="avatar-section">
        <div className="avatar-circle">
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" />
            : <div className="avatar-ph">✦</div>
          }
        </div>
        <div>
          <label htmlFor="avatar-upload" className="change-avatar-btn">
            {uploading ? 'uploading…' : 'change avatar'}
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <p className="avatar-hint">JPG, PNG, GIF · max 5MB</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="edit-form">
        <div className="form-group">
          <label>username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            required
          />
          <small>changing this changes your profile URL</small>
        </div>

        <div className="form-group">
          <label>full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="a few words about you and your practice…"
            maxLength={500}
          />
          <small>{bio.length}/500</small>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="form-actions">
          <button type="submit" disabled={saving} className="save-btn">
            {saving ? 'saving…' : 'save changes'}
          </button>
          <button type="button" onClick={() => navigate(`/artist/${username}`)} className="cancel-btn">
            cancel
          </button>
        </div>
      </form>
    </div>
  );
}
