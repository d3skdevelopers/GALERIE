import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import './WriteArticle.css';

// ── Toolbar button ────────────────────────────────────────────
function ToolBtn({ label, title, onClick }) {
  return (
    <button type="button" className="toolbar-btn" title={title} onClick={onClick}>
      {label}
    </button>
  );
}

export default function WriteArticle({ session }) {
  const navigate            = useNavigate();
  const [searchParams]      = useSearchParams();
  const preselectedArtwork  = searchParams.get('artwork');
  const textareaRef         = useRef(null);
  const imgInputRef         = useRef(null);

  const [title, setTitle]               = useState('');
  const [body, setBody]                 = useState('');
  const [userArtworks, setUserArtworks] = useState([]);
  const [selectedArtworks, setSelectedArtworks] = useState(
    preselectedArtwork ? [preselectedArtwork] : []
  );
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState('');
  const [preview, setPreview]   = useState(false);

  useEffect(() => {
    if (!session) { navigate('/login'); return; }
    supabase
      .from('artworks')
      .select('id, title')
      .eq('artist_id', session.user.id)
      .eq('is_approved', true)
      .then(({ data }) => setUserArtworks(data || []));
  }, [session]);

  // ── Helpers ───────────────────────────────────────────────────
  const insertAtCursor = (before, after = '') => {
    const ta    = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = body.slice(start, end);
    const next  = body.slice(0, start) + before + sel + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + before.length + sel.length + after.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const wrapSelection = (marker) => {
    const ta    = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = body.slice(start, end) || 'text';
    const next  = body.slice(0, start) + marker + sel + marker + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    });
  };

  // ── Image upload ──────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Images must be JPEG, PNG, GIF, or WebP.'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.'); return;
    }

    setUploading(true);
    setError('');

    try {
      const ext  = file.name.split('.').pop();
      const path = `${session.user.id}/article-images/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('artworks')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('artworks')
        .getPublicUrl(path);

      // Insert markdown image syntax at cursor
      insertAtCursor(`![${file.name.replace(/\.[^.]+$/, '')}](${publicUrl})`);
    } catch (err) {
      setError(`Image upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ── Toggle artwork reference ───────────────────────────────────
  const toggleArtwork = (id) => {
    setSelectedArtworks(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  // ── Save ───────────────────────────────────────────────────────
  const saveArticle = async (isDraft) => {
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return; }
    isDraft ? setSaving(true) : setLoading(true);
    setError(''); setSaved('');
    try {
      const article = await apiFetch('/api/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          body:  body.trim(),
          artworkIds: selectedArtworks,
          isDraft
        })
      });
      if (isDraft) { setSaved('Draft saved'); setSaving(false); }
      else navigate(`/article/${article.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false); setLoading(false);
    }
  };

  // ── Preview renderer (mirrors ReadArticle's renderBody) ────────
  const renderPreview = (text) => {
    return text.split('\n\n').map((para, i) => {
      if (!para.trim()) return null;
      // Images: ![alt](url)
      const imgMatch = para.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        return <img key={i} src={imgMatch[2]} alt={imgMatch[1]} className="article-img" />;
      }
      // Inline: bold **x**, italic _x_, @mentions, images embedded in text
      const rendered = renderInline(para);
      return <p key={i}>{rendered}</p>;
    });
  };

  const renderInline = (text) => {
    // Split on @username, **bold**, _italic_, ![img](url)
    const parts = [];
    const re = /!\[([^\]]*)\]\(([^)]+)\)|@([a-zA-Z0-9_]+)|\*\*(.+?)\*\*|_(.+?)_/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[1] !== undefined) {
        parts.push(<img key={m.index} src={m[2]} alt={m[1]} className="article-img-inline" />);
      } else if (m[3]) {
        parts.push(<a key={m.index} href={`/artist/${m[3]}`} className="mention">@{m[3]}</a>);
      } else if (m[4]) {
        parts.push(<strong key={m.index}>{m[4]}</strong>);
      } else if (m[5]) {
        parts.push(<em key={m.index}>{m[5]}</em>);
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  return (
    <div className="write-container">
      <div className="write-header">
        <h1>write article</h1>
        <button
          type="button"
          className={`preview-toggle ${preview ? 'active' : ''}`}
          onClick={() => setPreview(p => !p)}
        >
          {preview ? 'edit' : 'preview'}
        </button>
      </div>

      {preview ? (
        <div className="write-preview">
          <h2 className="preview-title">{title || <em className="ph">untitled</em>}</h2>
          <div className="article-text preview-body">
            {body ? renderPreview(body) : <p className="ph">Nothing written yet.</p>}
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); saveArticle(false); }} className="write-form">
          <div className="form-group">
            <label>title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. On the Grammar of Noise"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>body</label>

            {/* Toolbar */}
            <div className="toolbar">
              <ToolBtn label="B" title="Bold (**text**)" onClick={() => wrapSelection('**')} />
              <ToolBtn label="I" title="Italic (_text_)" onClick={() => wrapSelection('_')} />
              <ToolBtn label="@" title="Mention artist" onClick={() => insertAtCursor('@')} />
              <ToolBtn label="↵" title="New paragraph (blank line)" onClick={() => insertAtCursor('\n\n')} />
              <div className="toolbar-sep" />
              <label className="toolbar-img-btn" title="Insert image">
                {uploading ? <span className="uploading-spin">↑</span> : '⊕ image'}
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <span className="toolbar-hint">@username to mention · **bold** · _italic_ · ![alt](url) for images</span>
            </div>

            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={18}
              placeholder={"Write your thoughts.\n\nBlank line = new paragraph.\n@mention artists by username.\n\nUpload images with ⊕ image above."}
            />
            <small>{body.length} characters</small>
          </div>

          {userArtworks.length > 0 && (
            <div className="form-group">
              <label>referenced artworks <span className="opt">(optional)</span></label>
              <div className="artwork-chips">
                {userArtworks.map(a => (
                  <button
                    type="button"
                    key={a.id}
                    className={`chip ${selectedArtworks.includes(a.id) ? 'selected' : ''}`}
                    onClick={() => toggleArtwork(a.id)}
                  >
                    {a.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          {saved && <div className="success-message">{saved}</div>}

          <div className="write-actions">
            <button type="submit" disabled={loading || saving} className="publish-btn">
              {loading ? 'publishing…' : 'publish'}
            </button>
            <button type="button" onClick={() => saveArticle(true)} disabled={saving || loading} className="draft-btn">
              {saving ? 'saving…' : 'save draft'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="cancel-btn">cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
