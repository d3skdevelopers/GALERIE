import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router-dom';
import './SearchDesk.css';

export default function SearchDesk() {
  const [file, setFile] = useState(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [preview, setPreview] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    setFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
    
    setResults(null);
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
    
    // Simulate API call
    setTimeout(() => {
      setResults({
        high: [
          { id: 1, title: 'v26 · The Final Wood', artist: '@you', score: 87, dimensions: { edge: 94, behavior: 89, neural: 82 } },
          { id: 2, title: 'v18 · Multiverse', artist: '@you', score: 76, dimensions: { edge: 71, texture: 84, neural: 73 } }
        ],
        moderate: [
          { id: 3, title: 'wave7 · Interference', artist: '@taka', score: 68 },
          { id: 4, title: 'cell12 · Slime', artist: '@julian', score: 59 },
          { id: 5, title: 'v14 · Awakened', artist: '@you', score: 52 }
        ],
        distant: [
          { id: 6, title: 'v1 · 1974', artist: '@you', score: 35 },
          { id: 7, title: 'glitch9 · Noise', artist: '@leo', score: 28 }
        ]
      });
      setSearching(false);
    }, 2000);
  };

  return (
    <div className="search-desk">
      <h1>search desk</h1>
      <p className="search-description">
        see if your idea already exists. no judgment. just discovery.
      </p>

      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
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

      {file && !searching && !results && (
        <button onClick={handleSearch} className="search-btn">
          search
        </button>
      )}

      {searching && (
        <div className="searching">
          <div className="spinner">✦</div>
          <p>comparing against {Math.floor(Math.random() * 1000) + 500} works...</p>
        </div>
      )}

      {results && (
        <div className="results">
          <h2>results</h2>
          
          {results.high.length > 0 && (
            <div className="result-section high">
              <h3>high similarity (70-100%)</h3>
              {results.high.map(r => (
                <div key={r.id} className="result-card">
                  <div className="result-preview">◈</div>
                  <div className="result-info">
                    <div className="result-header">
                      <Link to={`/artwork/${r.id}`} className="result-title">{r.title}</Link>
                      <span className="result-artist">{r.artist}</span>
                    </div>
                    <div className="result-score">{r.score}% similar</div>
                    {r.dimensions && (
                      <div className="result-dimensions">
                        <span>edge: {r.dimensions.edge}%</span>
                        <span>behavior: {r.dimensions.behavior}%</span>
                        <span>neural: {r.dimensions.neural}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.moderate.length > 0 && (
            <div className="result-section moderate">
              <h3>moderate similarity (40-70%)</h3>
              {results.moderate.map(r => (
                <div key={r.id} className="result-item">
                  <Link to={`/artwork/${r.id}`}>{r.title}</Link>
                  <span>{r.artist}</span>
                  <span className="result-score-small">{r.score}%</span>
                </div>
              ))}
            </div>
          )}

          {results.distant.length > 0 && (
            <div className="result-section distant">
              <h3>distant echoes (20-40%)</h3>
              {results.distant.map(r => (
                <div key={r.id} className="result-item">
                  <Link to={`/artwork/${r.id}`}>{r.title}</Link>
                  <span>{r.artist}</span>
                  <span className="result-score-small">{r.score}%</span>
                </div>
              ))}
            </div>
          )}

          <div className="result-actions">
            <button onClick={() => setResults(null)} className="start-over">start over</button>
            <button className="proceed-upload">proceed to voting upload →</button>
          </div>
        </div>
      )}
    </div>
  );
}