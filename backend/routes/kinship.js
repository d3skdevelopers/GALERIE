import express from 'express';

const router = express.Router();

export default function kinshipRoutes(supabase) {

  // GET kinship for an artwork
  router.get('/:artworkId', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('kinship')
        .select(`
          *,
          artwork_a:artwork_a_id(*, profiles(username)),
          artwork_b:artwork_b_id(*, profiles(username))
        `)
        .or(`artwork_a_id.eq.${req.params.artworkId},artwork_b_id.eq.${req.params.artworkId}`)
        .order('similarity_score', { ascending: false })
        .limit(20);

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST calculate kinship for a newly approved artwork
  // Uses PIGMENT feature vectors (cosine similarity) when available,
  // falls back to medium+year metadata similarity.
  router.post('/calculate/:artworkId', async (req, res) => {
    try {
      const { artworkId } = req.params;

      const { data: sourceArtwork, error: sourceError } = await supabase
        .from('artworks')
        .select('*')
        .eq('id', artworkId)
        .single();

      if (sourceError || !sourceArtwork) {
        return res.status(404).json({ error: 'Artwork not found' });
      }

      const { data: allArtworks, error: allError } = await supabase
        .from('artworks')
        .select('*')
        .eq('is_approved', true)
        .neq('id', artworkId);

      if (allError) throw allError;

      if (!allArtworks || allArtworks.length === 0) {
        return res.json({ message: 'No other artworks to compare', kinshipCreated: 0 });
      }

      const useVectors = Array.isArray(sourceArtwork.features) && sourceArtwork.features.length > 0;
      const kinshipRecords = [];

      for (const other of allArtworks) {
        let score, dimensions;

        const otherHasVector = Array.isArray(other.features) && other.features.length > 0;

        if (useVectors && otherHasVector) {
          // Primary: cosine similarity on PIGMENT feature vectors
          const cosine = cosineSimilarity(sourceArtwork.features, other.features);
          const medium = mediumSimilarity(sourceArtwork.medium, other.medium);
          const year   = yearSimilarity(sourceArtwork.year, other.year);

          // Weighted: visual features dominate (80%), metadata as tiebreaker (20%)
          score = cosine * 0.8 + medium * 0.12 + year * 0.08;
          dimensions = { visual: cosine, medium, year, method: 'vector' };
        } else {
          // Fallback: metadata only
          const medium = mediumSimilarity(sourceArtwork.medium, other.medium);
          const year   = yearSimilarity(sourceArtwork.year, other.year);
          score = medium * 0.6 + year * 0.4;
          dimensions = { medium, year, method: 'metadata' };
        }

        if (score > 0.1) {
          // Check if kinship already exists (either direction)
          const { data: existing } = await supabase
            .from('kinship')
            .select('id')
            .or(`and(artwork_a_id.eq.${artworkId},artwork_b_id.eq.${other.id}),and(artwork_a_id.eq.${other.id},artwork_b_id.eq.${artworkId})`)
            .maybeSingle();

          if (!existing) {
            kinshipRecords.push({
              artwork_a_id: artworkId,
              artwork_b_id: other.id,
              similarity_score: Math.min(1, parseFloat(score.toFixed(3))),
              dimensions
            });
          }
        }
      }

      if (kinshipRecords.length > 0) {
        const { error: insertError } = await supabase
          .from('kinship')
          .insert(kinshipRecords);

        if (insertError) throw insertError;
      }

      res.json({
        artworkId,
        kinshipCreated: kinshipRecords.length,
        method: useVectors ? 'vector' : 'metadata',
        compared: allArtworks.length
      });
    } catch (error) {
      console.error('Kinship calculation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

// ── Similarity functions ──────────────────────────────────────

// Cosine similarity between two numeric arrays (PIGMENT feature vectors)
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
}

function mediumSimilarity(mediumA, mediumB) {
  if (!mediumA || !mediumB) return 0.2;
  const a = mediumA.toLowerCase();
  const b = mediumB.toLowerCase();
  if (a === b) return 1.0;
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

function yearSimilarity(yearA, yearB) {
  if (!yearA || !yearB) return 0.3;
  const diff = Math.abs(Number(yearA) - Number(yearB));
  if (diff === 0)   return 1.0;
  if (diff <= 2)  return 0.8;
  if (diff <= 5)  return 0.6;
  if (diff <= 10) return 0.4;
  return 0.1;
}
