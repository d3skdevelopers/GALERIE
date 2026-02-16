import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Upload.css';

export default function Upload({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [file, setFile] = useState(location.state?.file || null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState('');
  const [medium, setMedium] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session) {
      setError('You must be signed in to upload');
      return;
    }
    if (!file) {
      setError('Please select a file');
      return;
    }
    if (!title) {
      setError('Please enter a title');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Upload file to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('artworks')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('artworks')
        .getPublicUrl(fileName);

      // Create artwork record
      const { error: dbError } = await supabase
        .from('artworks')
        .insert({
          title,
          description,
          year,
          medium,
          artist_id: session.user.id,
          file_url: publicUrl,
          file_type: fileExt,
          is_approved: false,
          owned_by: session.user.id,
          voting_ends: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

      if (dbError) throw dbError;

      // Success - redirect to voting page
      navigate('/voting?uploaded=true');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!session) {
    return (
      <div className="upload-container">
        <h1>upload to voting</h1>
        <p className="upload-prompt">Please sign in to upload your work</p>
        <button onClick={() => navigate('/login')} className="upload-button">
          sign in
        </button>
      </div>
    );
  }

  return (
    <div className="upload-container">
      <h1>upload to voting</h1>
      <p className="upload-description">
        Your work will be reviewed by the community over 7 days.
      </p>

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label>file</label>
          <input
            type="file"
            accept=".html,.htm,.js"
            onChange={handleFileChange}
            className="file-input"
          />
          {file && (
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., 'The Final Wood'"
            required
          />
        </div>

        <div className="form-group">
          <label>description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="tell us about your work..."
            rows={4}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>year</label>
            <input
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
            />
          </div>
          <div className="form-group">
            <label>medium</label>
            <input
              type="text"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              placeholder="Living HTML"
            />
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          type="submit" 
          disabled={uploading}
          className="upload-submit"
        >
          {uploading ? 'uploading...' : 'submit to voting'}
        </button>
      </form>
    </div>
  );
}