import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './EditProfile.css';

export default function EditProfile({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [session]);

  async function fetchProfile() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setUsername(data.username || '');
        setFullName(data.full_name || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const { error } = await supabase
        .from('profiles')
        .update({
          username,
          full_name: fullName,
          bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);

      if (error) throw error;
      
      navigate(`/artist/${username}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar(e) {
    try {
      setUploading(true);
      setError('');

      const file = e.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (error) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="edit-profile-container">
        <div className="loading">loading...</div>
      </div>
    );
  }

  return (
    <div className="edit-profile-container">
      <h1>edit profile</h1>
      
      <div className="avatar-section">
        <div className="avatar-preview">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" />
          ) : (
            <div className="avatar-placeholder">✦</div>
          )}
        </div>
        
        <div className="avatar-upload">
          <label htmlFor="avatar" className="upload-button">
            {uploading ? 'uploading...' : 'change avatar'}
          </label>
          <input
            type="file"
            id="avatar"
            accept="image/*"
            onChange={uploadAvatar}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <form onSubmit={updateProfile} className="edit-profile-form">
        <div className="form-group">
          <label>username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <small>this will change your profile URL</small>
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
            placeholder="tell us about yourself..."
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button type="submit" disabled={loading} className="save-button">
            {loading ? 'saving...' : 'save changes'}
          </button>
          <button 
            type="button" 
            onClick={() => navigate(`/artist/${username}`)} 
            className="cancel-button"
          >
            cancel
          </button>
        </div>
      </form>
    </div>
  );
}