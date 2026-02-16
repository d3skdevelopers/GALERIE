-- Functions for vote counting
CREATE OR REPLACE FUNCTION increment_approval(artwork_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE artworks 
  SET approval_votes = approval_votes + 1
  WHERE id = artwork_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_rejection(artwork_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE artworks 
  SET rejection_votes = rejection_votes + 1
  WHERE id = artwork_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-approve when votes threshold met
CREATE OR REPLACE FUNCTION check_vote_threshold()
RETURNS trigger AS $$
BEGIN
  IF NEW.approval_votes >= 10 AND NEW.approval_votes > NEW.rejection_votes * 2 THEN
    NEW.is_approved := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_vote_threshold
  BEFORE UPDATE ON artworks
  FOR EACH ROW
  EXECUTE FUNCTION check_vote_threshold();