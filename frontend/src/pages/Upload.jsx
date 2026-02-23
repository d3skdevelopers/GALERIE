import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  pigmentConvertHtml,
  pigmentConvertImage,
  pigmentSaveWork,
  storePigmentPreview,
  isPigmentEnabled
} from '../lib/pigment';
import './Upload.css';

const ALLOWED_TYPES = ['html', 'htm', 'js', 'png', 'jpg', 'jpeg', 'gif'];
const HTML_TYPES    = ['html', 'htm', 'js'];
const IMAGE_TYPES   = ['png', 'jpg', 'jpeg', 'gif'];

export default function Upload({ session }) {
  const navigate  = useNavigate();
  const [file, setFile]               = useState(null);
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear]               = useState('');
  const [medium, setMedium]           = useState('');
  const [uploading, setUploading]     = useState(false);
  const [progress, setProgress]       = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError]             = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    const ext = selected.name.split('.').pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      setError(`File type .${ext} not supported. Use: ${ALLOWED_TYPES.join(', ')}`);
      return;
    }
    setError('');
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title) return;

    setUploading(true);
    setError('');
    setProgressStep(0);

    try {
      const fileExt  = file.name.split('.').pop().toLowerCase();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${session.user.id}/${Date.now()}-${safeName}`;
      const isHtml   = HTML_TYPES.includes(fileExt);
      const isImage  = IMAGE_TYPES.includes(fileExt);

      // ── Step 1: Upload to Supabase storage ──────────────
      setProgress('uploading file…');
      setProgressStep(1);

      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl: fileUrl } } = supabase.storage
        .from('artworks')
        .getPublicUrl(fileName);

      // ── Step 2: PIGMENT conversion (non-fatal) ───────────
      let pigmentData = null;
      let previewUrl  = null;

      if (isPigmentEnabled()) {
        setProgress('converting with PIGMENT…');
        setProgressStep(2);

        try {
          if (isHtml) {
            // Send HTML source directly — PIGMENT renders server-side
            const htmlSource = await file.text();
            pigmentData = await pigmentConvertHtml(htmlSource, {
              width: 400, height: 400, polygons: 100, tags: ['galerie']
            });
          } else if (isImage) {
            pigmentData = await pigmentConvertImage(file, {
              width: 400, height: 400, polygons: 100
            });
          }
        } catch (pigErr) {
          console.warn('PIGMENT conversion failed (non-fatal):', pigErr.message);
        }
      }

      // ── Step 3: Store PIGMENT preview (non-fatal) ────────
      if (pigmentData?.preview) {
        setProgress('storing preview…');
        setProgressStep(3);
        try {
          const tempKey = `temp-${Date.now()}`;
          previewUrl = await storePigmentPreview(
            pigmentData.preview, session.user.id, tempKey, supabase
          );
        } catch (previewErr) {
          console.warn('Preview store failed (non-fatal):', previewErr.message);
        }
      }

      // ── Step 4: Save to Supabase DB ──────────────────────
      setProgress('saving artwork…');
      setProgressStep(4);

      const { data: artwork, error: dbError } = await supabase
        .from('artworks')
        .insert({
          title:           title.trim(),
          description:     description.trim(),
          year:            year ? parseInt(year) : null,
          medium:          medium.trim() || (isHtml ? 'Living HTML' : ''),
          artist_id:       session.user.id,
          owned_by:        session.user.id,
          file_url:        fileUrl,
          file_type:       fileExt,
          is_approved:     false,
          approval_votes:  0,
          rejection_votes: 0,
          voting_ends:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          genome:          pigmentData?.genome   || null,
          features:        pigmentData?.features || null,
          preview_url:     previewUrl            || null,
          pigment_style:   pigmentData?.style    || null,
          generation:      0,
          is_evolved:      false
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // ── Step 5: Register with PIGMENT (non-fatal) ────────
      if (isPigmentEnabled() && pigmentData?.genome && artwork) {
        try {
          const pigmentWork = await pigmentSaveWork({
            title:      title.trim(),
            genome:     pigmentData.genome,
            features:   pigmentData.features,
            tags:       ['galerie'],
            galerieId:  artwork.id,
            galerieUrl: `${window.location.origin}/artwork/${artwork.id}`
          });
          // Write PIGMENT's ID back onto our record
          await supabase
            .from('artworks')
            .update({ pigment_work_id: pigmentWork.id })
            .eq('id', artwork.id);
        } catch (regErr) {
          console.warn('PIGMENT registration failed (non-fatal):', regErr.message);
        }
      }

      navigate('/voting?uploaded=true');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. Please try again.');
      setProgress('');
      setProgressStep(0);
    } finally {
      setUploading(false);
    }
  };

  const pigmentEnabled = isPigmentEnabled();
  const totalSteps = pigmentEnabled ? 4 : 2;
  const stepLabels = [
    'upload file',
    ...(pigmentEnabled ? ['convert with PIGMENT', 'store preview'] : []),
    'save artwork'
  ];

  return (
    <div className="upload-container">
      <h1>submit to voting</h1>
      <p className="upload-description">
        Your work is reviewed by the community for 7 days. 5 approvals gains it entry to the gallery.
        {pigmentEnabled && (
          <span className="pigment-note"> HTML works are automatically converted by PIGMENT for kinship mapping and evolution.</span>
        )}
      </p>

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label>file <span className="required">*</span></label>
          <div className="file-input-area">
            <input
              type="file"
              accept=".html,.htm,.js,.png,.jpg,.jpeg,.gif"
              onChange={handleFileChange}
              className="file-input"
              id="artwork-file"
            />
            <label htmlFor="artwork-file" className="file-label">
              {file ? (
                <span className="file-selected">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(0)} KB</span>
                </span>
              ) : (
                <span className="file-prompt">
                  <span className="file-icon">✦</span>
                  <span>choose file</span>
                  <span className="file-hint">HTML, JS, PNG, JPG, GIF</span>
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>title <span className="required">*</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Final Wood"
            required
          />
        </div>

        <div className="form-group">
          <label>description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="tell us about this work…"
            rows={4}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              min="1900"
              max={new Date().getFullYear()}
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

        {uploading && (
          <div className="upload-progress">
            <div className="progress-steps">
              {stepLabels.map((label, i) => (
                <div
                  key={label}
                  className={`progress-step ${
                    progressStep > i + 1 ? 'done' :
                    progressStep === i + 1 ? 'active' : ''
                  }`}
                >
                  <span className="step-dot" />
                  <span className="step-label">{label}</span>
                </div>
              ))}
            </div>
            <p className="progress-text">{progress}</p>
          </div>
        )}

        <button type="submit" disabled={uploading || !file || !title} className="submit-btn">
          {uploading ? progress || 'uploading…' : 'submit to voting'}
        </button>
      </form>
    </div>
  );
}
