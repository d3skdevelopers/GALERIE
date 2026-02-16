import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './KinshipMap.css';

export default function KinshipMap() {
  const { artworkId } = useParams();
  const [artwork, setArtwork] = useState(null);
  const [kinship, setKinship] = useState([]);
  const [dimensions, setDimensions] = useState('all');
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    fetchArtwork();
    fetchKinship();
  }, [artworkId]);

  async function fetchArtwork() {
    const { data } = await supabase
      .from('artworks')
      .select('*, profiles(username)')
      .eq('id', artworkId)
      .single();
    
    setArtwork(data);
  }

  async function fetchKinship() {
    const { data } = await supabase
      .from('kinship')
      .select(`
        *,
        artwork_a:artwork_a_id (*, profiles(username)),
        artwork_b:artwork_b_id (*, profiles(username))
      `)
      .or(`artwork_a_id.eq.${artworkId},artwork_b_id.eq.${artworkId}`)
      .order('similarity_score', { ascending: false })
      .limit(20);
    
    setKinship(data || []);
  }

  const getRelatedArtworks = () => {
    return kinship.map(k => {
      const isA = k.artwork_a?.id === artworkId;
      return {
        artwork: isA ? k.artwork_b : k.artwork_a,
        score: k.similarity_score,
        dimensions: k.dimensions
      };
    });
  };

  const filterByDimension = (items) => {
    if (dimensions === 'all') return items;
    return items.sort((a, b) => 
      (b.dimensions?.[dimensions] || 0) - (a.dimensions?.[dimensions] || 0)
    );
  };

  if (!artwork) return <div className="loading">loading...</div>;

  const related = filterByDimension(getRelatedArtworks());

  return (
    <div className="kinship-map">
      <div className="kinship-header">
        <Link to={`/artwork/${artworkId}`} className="back-link">← back to artwork</Link>
        <h1>kinship map</h1>
        <p className="kinship-description">
          how <span className="highlight">{artwork.title}</span> connects to other works
        </p>
      </div>

      <div className="kinship-visualization">
        <div className="graph-container">
          <div className="center-node" onClick={() => setSelectedNode(artwork)}>
            <div className="node-circle main">
              <span className="node-title">{artwork.title}</span>
              <span className="node-artist">@{artwork.profiles?.username}</span>
            </div>
          </div>

          <div className="related-nodes">
            {related.slice(0, 8).map((item, index) => (
              <div 
                key={item.artwork.id}
                className="related-node"
                style={{ '--index': index }}
                onClick={() => setSelectedNode(item.artwork)}
              >
                <div className="connection-line"></div>
                <div className="node-circle related">
                  <span className="node-score">{Math.round(item.score * 100)}%</span>
                </div>
                <div className="node-tooltip">
                  <span className="tooltip-title">{item.artwork.title}</span>
                  <span className="tooltip-artist">@{item.artwork.profiles?.username}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="kinship-details">
        <div className="dimension-filter">
          <h3>filter by dimension</h3>
          <div className="filter-buttons">
            <button 
              className={dimensions === 'all' ? 'active' : ''}
              onClick={() => setDimensions('all')}
            >all</button>
            <button 
              className={dimensions === 'edge' ? 'active' : ''}
              onClick={() => setDimensions('edge')}
            >edge topology</button>
            <button 
              className={dimensions === 'color' ? 'active' : ''}
              onClick={() => setDimensions('color')}
            >color field</button>
            <button 
              className={dimensions === 'texture' ? 'active' : ''}
              onClick={() => setDimensions('texture')}
            >texture</button>
            <button 
              className={dimensions === 'behavior' ? 'active' : ''}
              onClick={() => setDimensions('behavior')}
            >behavior</button>
            <button 
              className={dimensions === 'neural' ? 'active' : ''}
              onClick={() => setDimensions('neural')}
            >neural style</button>
          </div>
        </div>

        <div className="kinship-list">
          <h3>all connections</h3>
          {related.map(item => (
            <Link 
              to={`/artwork/${item.artwork.id}`} 
              key={item.artwork.id}
              className="kinship-item"
            >
              <div className="kinship-item-preview">◈</div>
              <div className="kinship-item-info">
                <div className="kinship-item-header">
                  <span className="kinship-item-title">{item.artwork.title}</span>
                  <span className="kinship-item-artist">@{item.artwork.profiles?.username}</span>
                </div>
                <div className="kinship-scores">
                  <span className="overall-score">
                    overall: {Math.round(item.score * 100)}%
                  </span>
                  {item.dimensions && (
                    <div className="dimension-scores">
                      <span>edge: {Math.round(item.dimensions.edge * 100)}%</span>
                      <span>color: {Math.round(item.dimensions.color * 100)}%</span>
                      <span>texture: {Math.round(item.dimensions.texture * 100)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {selectedNode && (
        <div className="node-modal" onClick={() => setSelectedNode(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedNode(null)}>✕</button>
            <div className="modal-preview">✦</div>
            <h2>{selectedNode.title}</h2>
            <p className="modal-artist">@{selectedNode.profiles?.username}</p>
            {selectedNode.description && (
              <p className="modal-description">{selectedNode.description}</p>
            )}
            <Link to={`/artwork/${selectedNode.id}`} className="modal-link">
              view artwork →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}