import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { pigmentGetAncestry, fitnessLabel, fitnessPhase, isPigmentEnabled } from '../lib/pigment';
import { renderGenomeToCanvas, extractGenomeMeta, countPolygons } from '../lib/pigment-local';
import EvolveButton from '../components/EvolveButton';
import './Focus.css';

// Renders HTML artwork as output only — source never exposed via src=""
function HtmlFocus({ fileUrl, title }) {
  const [srcdoc, setSrcdoc]   = useState('');
  const [failed, setFailed]   = useState(false);

  useEffect(() => {
    if (!fileUrl) return;
    fetch(fileUrl)
      .then(r => { if (!r.ok) throw new Error(); return r.text(); })
      .then(html => setSrcdoc(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<base\s[^>]*>/gi, '')))
      .catch(() => setFailed(true));
  }, [fileUrl]);

  if (failed) return (
    <div className="artwork-placeholder">
      <span>◈</span><p>Could not render artwork</p>
    </div>
  );

  return (
    <div className="html-focus-wrap">
      <div className="html-focus-shield" aria-hidden="true" />
      <iframe
        title={title}
        srcDoc={srcdoc || ' '}
        sandbox="allow-scripts"
        className="artwork-iframe"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export default function Focus({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [artwork, setArtwork]       = useState(null);
  const [related, setRelated]       = useState([]);
  const [articles, setArticles]     = useState([]);
  const [ancestry, setAncestry]     = useState(null);
  const [children, setChildren]     = useState([]);
  const [showInfo, setShowInfo]     = useState(true);
  const [loading, setLoading]       = useState(true);
  const [evolvedChild, setEvolvedChild] = useState(null); // set when evolution completes
  const genomeCanvasRef = useRef(null);

  // Render genome locally when no preview_url exists
  useEffect(() => {
    if (!artwork?.genome || artwork?.preview_url) return;
    if (!genomeCanvasRef.current) return;
    try {
      renderGenomeToCanvas(
        { canvas: { width: 400, height: 400 }, palette: {}, polygons: [] }, // placeholder
        genomeCanvasRef.current, 400, 400
      );
      // Import inline to avoid circular issues
      import('../lib/pigment-local').then(({ parseGenome: pg, renderGenomeToCanvas: rg }) => {
        if (!genomeCanvasRef.current || !artwork.genome) return;
        rg(pg(artwork.genome), genomeCanvasRef.current, 400, 400);
      });
    } catch (err) {
      console.warn('[PIGMENT local] Preview render failed:', err);
    }
  }, [artwork?.genome, artwork?.preview_url]);

  useEffect(() => {
    setAncestry(null);
    setChildren([]);
    setEvolvedChild(null);
    loadArtwork();
  }, [id]);

  async function loadArtwork() {
    setLoading(true);

    const [artRes, kinRes, articleRes, childrenRes] = await Promise.all([
      supabase
        .from('artworks')
        .select('*, profiles(username, full_name, avatar_url)')
        .eq('id', id)
        .single(),
      supabase
        .from('kinship')
        .select('*, artwork_b:artwork_b_id(id, title, profiles(username))')
        .eq('artwork_a_id', id)
        .order('similarity_score', { ascending: false })
        .limit(5),
      supabase
        .from('articles')
        .select('id, title, push_count, author:author_id(username)')
        .contains('artwork_ids', [id])
        .limit(5),
      // Load evolved children of this artwork
      supabase
        .from('artworks')
        .select('id, title, pigment_fitness, generation, is_approved, created_at')
        .eq('parent_id', id)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    if (artRes.error) { navigate('/'); return; }

    setArtwork(artRes.data);
    setRelated(kinRes.data  || []);
    setArticles(articleRes.data || []);
    setChildren(childrenRes.data || []);
    setLoading(false);

    // Load PIGMENT ancestry if this is a PIGMENT work (non-blocking)
    if (isPigmentEnabled() && artRes.data?.pigment_work_id) {
      pigmentGetAncestry(artRes.data.pigment_work_id)
        .then(data => setAncestry(data))
        .catch(() => {}); // non-fatal
    }
  }

  function handleEvolved(childArtwork) {
    setEvolvedChild(childArtwork);
    // Add to children list immediately
    setChildren(prev => [childArtwork, ...prev]);
  }

  const isImage = ['png', 'jpg', 'jpeg', 'gif'].includes(artwork?.file_type);
  const isCode  = ['html', 'htm', 'js'].includes(artwork?.file_type);
  const isOwner = session && artwork && session.user.id === artwork.artist_id;
  const hasEvolution = isPigmentEnabled() && artwork?.pigment_work_id;

  if (loading) return (
    <div className="focus-container dark-bg">
      <div className="loading" style={{ color: 'white' }}>loading…</div>
    </div>
  );
  if (!artwork) return null;

  return (
    <div className="focus-container">
      <div className="focus-top-bar">
        <button
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/room/1')}
          className="focus-back"
        >
          ← back
        </button>
        <button className="info-toggle" onClick={() => setShowInfo(!showInfo)}>
          {showInfo ? '✕' : 'ⓘ'}
        </button>
      </div>

      {/* Artwork display */}
      <div className="focus-artwork">
        {/* Priority: preview_url → iframe (code) → image → local genome render → placeholder */}
        {artwork.preview_url && !isCode && (
          <img src={artwork.preview_url} alt={artwork.title} className="artwork-preview-img" />
        )}
        {isImage && (
          <img src={artwork.file_url} alt={artwork.title} className="artwork-img" />
        )}
        {isCode && (
          <HtmlFocus fileUrl={artwork.file_url} title={artwork.title} />
        )}
        {/* Local genome fallback — renders .pg genome without API when no preview exists */}
        {!isImage && !isCode && !artwork.preview_url && artwork.genome && (
          <canvas
            ref={genomeCanvasRef}
            className="artwork-genome-canvas"
            title={`${countPolygons(artwork.genome)} polygons · ${fitnessPhase(artwork.pigment_fitness)} phase`}
          />
        )}
        {!isImage && !isCode && !artwork.preview_url && !artwork.genome && (
          <div className="artwork-placeholder">
            <span>◈</span>
            <p>{artwork.file_type?.toUpperCase()} file</p>
            <a href={artwork.file_url} target="_blank" rel="noreferrer" className="open-link">open file ↗</a>
          </div>
        )}

        {/* PIGMENT fitness badge on artwork */}
        {artwork.pigment_fitness != null && (
          <div className="fitness-badge">
            <span className="fitness-num">{artwork.pigment_fitness.toFixed(0)}</span>
            <span className="fitness-pct">%</span>
            <span className="fitness-word">{fitnessLabel(artwork.pigment_fitness)}</span>
          </div>
        )}

        {/* Evolved badge */}
        {artwork.is_evolved && (
          <div className="evolved-badge">
            ⚡ evolved · gen {artwork.generation}
          </div>
        )}
      </div>

      {showInfo && (
        <div className="focus-panel">
          <h2>{artwork.title}</h2>
          <p className="focus-artist">
            by <Link to={`/artist/${artwork.profiles?.username}`}>@{artwork.profiles?.username}</Link>
          </p>

          <div className="focus-meta">
            {artwork.year   && <span>{artwork.year}</span>}
            {artwork.medium && <span>{artwork.medium}</span>}
            {artwork.pigment_style && (
              <span className="style-tag">{artwork.pigment_style}</span>
            )}
            {artwork.generation > 0 && (
              <span className="gen-tag">gen {artwork.generation}</span>
            )}
            {artwork.genome && (
              <span className="poly-tag" title="polygon count">
                {countPolygons(artwork.genome)} poly
              </span>
            )}
            {artwork.pigment_fitness != null && (
              <span className="phase-tag">{fitnessPhase(artwork.pigment_fitness)}</span>
            )}
          </div>

          {/* PIGMENT fitness meter */}
          {artwork.pigment_fitness != null && (
            <div className="focus-fitness">
              <div className="fitness-track">
                <div
                  className="fitness-fill"
                  style={{ width: `${artwork.pigment_fitness}%` }}
                />
              </div>
              <span className="fitness-label-text">
                fitness {artwork.pigment_fitness.toFixed(1)}% · {fitnessLabel(artwork.pigment_fitness)}
              </span>
            </div>
          )}

          {artwork.description && (
            <div className="focus-desc">
              <h4>about</h4>
              <p>{artwork.description}</p>
            </div>
          )}

          {/* Parent work */}
          {artwork.parent_id && (
            <div className="focus-section">
              <h4>evolved from</h4>
              <Link to={`/artwork/${artwork.parent_id}`} className="parent-link">
                ← view parent work
              </Link>
            </div>
          )}

          {/* PIGMENT ancestry lineage */}
          {ancestry?.lineage?.length > 0 && (
            <div className="focus-section">
              <h4>lineage · {ancestry.lineage.length} generations</h4>
              <div className="lineage-track">
                {ancestry.lineage.map((gen, i) => (
                  <div key={gen.id} className="lineage-node">
                    <div
                      className="lineage-dot"
                      style={{ opacity: 0.3 + (i / ancestry.lineage.length) * 0.7 }}
                      title={`${gen.title} · fitness ${gen.fitness?.toFixed(1)}%`}
                    />
                    {i < ancestry.lineage.length - 1 && <div className="lineage-line" />}
                  </div>
                ))}
                <div className="lineage-node current">
                  <div className="lineage-dot current" title="this work" />
                </div>
              </div>
              <div className="fitness-history">
                {ancestry.fitness_history?.slice(-4).map((point, i) => (
                  <span key={i} className="fh-point">
                    gen {point.generation} · {point.fitness?.toFixed(0)}%
                    {point.operator && <em> ({point.operator})</em>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Evolved children */}
          {children.length > 0 && (
            <div className="focus-section">
              <h4>evolutions ({children.length})</h4>
              {children.map(child => (
                <Link to={`/artwork/${child.id}`} key={child.id} className="child-link">
                  <span className="child-title">{child.title}</span>
                  {child.pigment_fitness != null && (
                    <span className="child-fitness">{child.pigment_fitness.toFixed(0)}%</span>
                  )}
                  {!child.is_approved && <span className="child-pending">in voting</span>}
                </Link>
              ))}
            </div>
          )}

          {/* Post-evolution result banner */}
          {evolvedChild && (
            <div className="evolved-result-banner">
              <span>⚡ evolved: <em>{evolvedChild.title}</em></span>
              <Link to={`/artwork/${evolvedChild.id}`}>view →</Link>
            </div>
          )}

          {/* GALERIE kinship */}
          {related.length > 0 && (
            <div className="focus-section">
              <h4>kinship</h4>
              {related.map(k => (
                <Link to={`/artwork/${k.artwork_b?.id}`} key={k.id} className="kinship-link">
                  <span className="kin-score">{Math.round(k.similarity_score * 100)}%</span>
                  <span className="kin-title">{k.artwork_b?.title}</span>
                </Link>
              ))}
              <Link to={`/kinship/${id}`} className="view-all-kinship">view full map →</Link>
            </div>
          )}

          {/* Articles */}
          {articles.length > 0 && (
            <div className="focus-section">
              <h4>written about</h4>
              {articles.map(a => (
                <Link to={`/article/${a.id}`} key={a.id} className="article-link">
                  {a.title}
                </Link>
              ))}
            </div>
          )}

          {/* Evolve button — only for owner, only if PIGMENT-registered */}
          {isOwner && hasEvolution && (
            <div className="focus-section evolve-section">
              <h4>evolve with PIGMENT</h4>
              <EvolveButton
                artwork={artwork}
                session={session}
                onEvolved={handleEvolved}
              />
            </div>
          )}

          {/* Evolve teaser — owner but not yet converted */}
          {isOwner && isPigmentEnabled() && !artwork.pigment_work_id && artwork.file_type === 'html' && (
            <div className="focus-section">
              <h4>evolve with PIGMENT</h4>
              <p className="evolve-pending-note">
                This work is being registered with PIGMENT. Evolution will be available shortly.
              </p>
            </div>
          )}

          <div className="focus-actions">
            <Link to={`/kinship/${id}`} className="action-btn">explore kinship</Link>
            {session && <Link to={`/write?artwork=${id}`} className="action-btn">write about this</Link>}
          </div>

          {/* PIGMENT attribution on evolved works */}
          {artwork.is_evolved && (
            <div className="focus-pigment-attr">
              ⚡ evolved with{' '}
              <a href="https://pigment-org.github.io" target="_blank" rel="noreferrer">PIGMENT</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
