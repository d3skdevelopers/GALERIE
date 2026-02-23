import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './KinshipMap.css';

// ── Force-directed graph using D3 ────────────────────────────
// D3 is loaded via dynamic import so the main bundle stays small.
function ForceGraph({ artwork, related }) {
  const svgRef     = useRef(null);
  const simRef     = useRef(null);
  const [hovered, setHovered] = useState(null);
  const navigate   = useNavigate();

  const buildGraph = useCallback(async () => {
    const d3 = await import('d3');
    const svg = d3.select(svgRef.current);
    const width  = svgRef.current.clientWidth  || 700;
    const height = svgRef.current.clientHeight || 420;

    svg.selectAll('*').remove();

    // ── Build nodes + links ───────────────────────────────────
    const centerNode = { id: artwork.id, title: artwork.title, username: artwork.profiles?.username, isCenter: true };
    const relatedNodes = related.map(r => ({
      id: r.artwork.id,
      title: r.artwork.title,
      username: r.artwork.profiles?.username,
      score: r.score,
      isCenter: false
    }));
    const nodes = [centerNode, ...relatedNodes];
    const links = relatedNodes.map(r => ({ source: artwork.id, target: r.id, score: r.score }));

    // ── Simulation ────────────────────────────────────────────
    if (simRef.current) simRef.current.stop();

    simRef.current = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => 120 + (1 - d.score) * 80).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(42));

    // ── Defs: arrow marker ────────────────────────────────────
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -3 6 6')
      .attr('refX', 30).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
        .attr('d', 'M0,-3L6,0L0,3')
        .attr('fill', '#C9A84C')
        .attr('opacity', 0.4);

    // ── Links ─────────────────────────────────────────────────
    const link = svg.append('g').selectAll('line')
      .data(links).join('line')
        .attr('stroke', '#C9A84C')
        .attr('stroke-opacity', d => 0.15 + d.score * 0.55)
        .attr('stroke-width', d => 1 + d.score * 2)
        .attr('marker-end', 'url(#arrowhead)');

    // ── Link labels ───────────────────────────────────────────
    const linkLabel = svg.append('g').selectAll('text')
      .data(links).join('text')
        .attr('text-anchor', 'middle')
        .attr('font-size', '10')
        .attr('fill', '#C9A84C')
        .attr('opacity', 0.7)
        .text(d => `${Math.round(d.score * 100)}%`);

    // ── Node groups ───────────────────────────────────────────
    const node = svg.append('g').selectAll('g')
      .data(nodes).join('g')
        .attr('cursor', d => d.isCenter ? 'default' : 'pointer')
        .call(d3.drag()
          .on('start', (event, d) => {
            if (!event.active) simRef.current.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) simRef.current.alphaTarget(0);
            d.fx = null; d.fy = null;
          }))
        .on('click', (event, d) => { if (!d.isCenter) navigate(`/artwork/${d.id}`); })
        .on('mouseenter', (event, d) => setHovered(d.id))
        .on('mouseleave', () => setHovered(null));

    // ── Node circles ─────────────────────────────────────────
    node.append('circle')
      .attr('r', d => d.isCenter ? 32 : 22)
      .attr('fill', d => d.isCenter ? '#C9A84C' : 'var(--bg-secondary, #1a1a1a)')
      .attr('stroke', d => d.isCenter ? '#C9A84C' : '#C9A84C')
      .attr('stroke-width', d => d.isCenter ? 0 : 1)
      .attr('stroke-opacity', 0.5);

    // ── Node titles ───────────────────────────────────────────
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.isCenter ? '-0.2em' : '-0.2em')
      .attr('font-size', d => d.isCenter ? '9' : '8')
      .attr('font-weight', '600')
      .attr('fill', d => d.isCenter ? '#0a0a0a' : 'var(--text, #e0e0e0)')
      .text(d => d.title.length > 14 ? d.title.slice(0, 13) + '…' : d.title);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.9em')
      .attr('font-size', '7')
      .attr('fill', d => d.isCenter ? '#0a0a0a' : 'var(--text-secondary, #888)')
      .text(d => `@${d.username}`);

    // ── Tick ─────────────────────────────────────────────────
    simRef.current.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2 - 4);

      node.attr('transform', d =>
        `translate(${Math.max(36, Math.min(width - 36, d.x))},${Math.max(36, Math.min(height - 36, d.y))})`
      );
    });
  }, [artwork, related, navigate]);

  useEffect(() => {
    if (!artwork || !related.length) return;
    buildGraph();
    return () => { if (simRef.current) simRef.current.stop(); };
  }, [buildGraph]);

  // Reheat on window resize
  useEffect(() => {
    const onResize = () => { if (simRef.current) { buildGraph(); } };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [buildGraph]);

  return (
    <div className="force-graph-wrap">
      <svg ref={svgRef} className="force-graph-svg" />
      {hovered && hovered !== artwork.id && (
        <div className="graph-hover-hint">click to open →</div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function KinshipMap() {
  const { artworkId } = useParams();
  const [artwork, setArtwork] = useState(null);
  const [kinship, setKinship] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('artworks').select('*, profiles(username)').eq('id', artworkId).single(),
      supabase
        .from('kinship')
        .select('*, artwork_a:artwork_a_id(id,title,profiles(username)), artwork_b:artwork_b_id(id,title,profiles(username))')
        .or(`artwork_a_id.eq.${artworkId},artwork_b_id.eq.${artworkId}`)
        .order('similarity_score', { ascending: false })
        .limit(20)
    ]).then(([artRes, kinRes]) => {
      setArtwork(artRes.data);
      setKinship(kinRes.data || []);
      setLoading(false);
    });
  }, [artworkId]);

  const related = kinship.map(k => {
    const isA = k.artwork_a?.id === artworkId;
    return { artwork: isA ? k.artwork_b : k.artwork_a, score: k.similarity_score };
  }).filter(r => r.artwork);

  if (loading) return <div className="kinship-page"><div className="loading">loading…</div></div>;
  if (!artwork) return <div className="kinship-page"><p>Artwork not found.</p></div>;

  return (
    <div className="kinship-page">
      <div className="kin-header">
        <Link to={`/artwork/${artworkId}`} className="back-link">← back to artwork</Link>
        <h1>kinship map</h1>
        <p className="kin-sub">
          connections for <span className="highlight">{artwork.title}</span>
        </p>
      </div>

      {related.length === 0 ? (
        <div className="no-kin">
          <p>No kinship data yet. Kinship is calculated when artworks are approved.</p>
          <p className="no-kin-sub">If this work was recently approved, try recalculating from the artwork page.</p>
        </div>
      ) : (
        <>
          <ForceGraph artwork={artwork} related={related} />

          <div className="kin-list">
            <h3>all connections ({related.length})</h3>
            {related.map(item => (
              <Link to={`/artwork/${item.artwork.id}`} key={item.artwork.id} className="kin-row">
                <span className="kin-score">{Math.round(item.score * 100)}%</span>
                <div className="kin-info">
                  <span className="kin-title">{item.artwork.title}</span>
                  <span className="kin-artist">@{item.artwork.profiles?.username}</span>
                </div>
                <span className="kin-arrow">→</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
