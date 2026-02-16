import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import './SearchDesk.css';

export default function SearchDesk() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    setFile(file);
    setResults(null);
    setError('');
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'text/html': ['.html', '.htm'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/javascript': ['.js']
    }
  });

  const handleSearch = async () => {
    if (!file) return;
    
    setSearching(true);
    setError('');
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleProceedToUpload = () => {
    if (file) {
      // Store file in session storage to pass to upload page
      sessionStorage.setItem('pendingUpload', file.name);
      navigate('/upload', { state: { file } });
    } else {
      navigate('/upload');
    }
  };

  return (
    <div className="search-desk">
      <h1>search desk</h1>
      <p className="search-description">
        see if your idea already exists. no judgment. just discovery.
      </p>

      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''} ${error ? 'error' : ''}`}>
        <input {...getInputProps()} />
        {preview ? (
          <img src={preview} alt="preview" className="file-preview" />
        ) : file ? (
          <div className="file-info">
            <span className="file-name">{file.name}</span>
            <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        ) : (
          <div className="dropzone-content">
            <div className="dropzone-icon">✧</div>
            <p>drop your file here</p>
            <span className="dropzone-hint">or click to browse</span>
            <span className="dropzone-types">HTML, JS, PNG, JPG, GIF · up to 100MB</span>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {file && !searching && !results && (
        <button onClick={handleSearch} className="search-btn">
          search
        </button>
      )}

      {searching && (
        <div className="searching">
          <div className="spinner">✦</div>
          <p>searching...</p>
        </div>
      )}

      {results && (
        <div className="results">
          <h2>results</h2>
          
          {results.high && results.high.length > 0 && (
            <div className="result-section high">
              <h3>high similarity (70-100%)</h3>
              {results.high.map((r, i) => (
                <div key={i} className="result-card">
                  <div className="result-preview">◈</div>
                  <div className="result-info">
                    <div className="result-header">
                      <span className="result-title">{r.title}</span>
                      <span className="result-artist">{r.artist}</span>
                    </div>
                    <div className="result-score">{r.score}% similar</div>
                    {r.dimensions && (
                      <div className="result-dimensions">
                        {Object.entries(r.dimensions).map(([key, value]) => (
                          <span key={key}>{key}: {value}%</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.moderate && results.moderate.length > 0 && (
            <div className="result-section moderate">
              <h3>moderate similarity (40-70%)</h3>
              {results.moderate.map((r, i) => (
                <div key={i} className="result-item">
                  <span>{r.title}</span>
                  <span>{r.artist}</span>
                  <span className="result-score-small">{r.score}%</span>
                </div>
              ))}
            </div>
          )}

          {results.distant && results.distant.length > 0 && (
            <div className="result-section distant">
              <h3>distant echoes (20-40%)</h3>
              {results.distant.map((r, i) => (
                <div key={i} className="result-item">
                  <span>{r.title}</span>
                  <span>{r.artist}</span>
                  <span className="result-score-small">{r.score}%</span>
                </div>
              ))}
            </div>
          )}

          {(!results.high || results.high.length === 0) && 
           (!results.moderate || results.moderate.length === 0) && 
           (!results.distant || results.distant.length === 0) && (
            <div className="no-results">
              <p>No similar works found. Your idea might be completely new.</p>
            </div>
          )}

          <div className="result-actions">
            <button onClick={() => setResults(null)} className="start-over">start over</button>
            <button 
              onClick={handleProceedToUpload} 
              className="proceed-upload"
            >
              proceed to voting upload →
            </button>
          </div>
        </div>
      )}

      {!file && !searching && !results && (
        <div className="search-prompt">
          <p>Drop a file to see if similar works exist in the gallery.</p>
        </div>
      )}
    </div>
  );
}