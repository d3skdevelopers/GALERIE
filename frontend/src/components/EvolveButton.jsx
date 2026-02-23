import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  pigmentEvolve,
  pigmentGetJob,
  pigmentPollEvolve,
  pigmentLogEvolution,
  connectPigmentWs,
  storePigmentPreview,
  fitnessLabel,
  isPigmentEnabled
} from '../lib/pigment';
import './EvolveButton.css';

/**
 * EvolveButton — triggers PIGMENT evolution on a single artwork.
 *
 * Props:
 *   artwork     — full artwork record from Supabase (needs pigment_work_id, id, title)
 *   session     — Supabase session (for user ID and token)
 *   onEvolved   — called with the new child artwork record after evolution completes
 */
export default function EvolveButton({ artwork, session, onEvolved }) {
  const [phase, setPhase] = useState('idle'); // idle | evolving | done | error
  const [progress, setProgress] = useState(0);  // 0–1
  const [generation, setGeneration] = useState(0);
  const [fitness, setFitness] = useState(null);
  const [operator, setOperator] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  const disconnectWs = useRef(null);
  const pollInterval  = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWs.current?.();
      clearInterval(pollInterval.current);
    };
  }, []);

  const canEvolve = isPigmentEnabled() && artwork?.pigment_work_id && phase === 'idle';
  const notRegistered = isPigmentEnabled() && !artwork?.pigment_work_id;

  // ── WebSocket handler ────────────────────────────────────
  const openWebSocket = useCallback((userId) => {
    if (disconnectWs.current) disconnectWs.current();

    disconnectWs.current = connectPigmentWs(userId, {
      onTick: ({ generation, fitness, progress, operator }) => {
        setGeneration(generation);
        setFitness(fitness);
        setProgress(progress);
        setOperator(operator || '');
      },

      onDone: async ({ childId, html, fitnessAfter, fitnessBefore, improvement, operator, generation, style }) => {
        disconnectWs.current?.();
        clearInterval(pollInterval.current);

        setPhase('done');
        setProgress(1);
        setFitness(fitnessAfter);

        // Store the evolved HTML in Supabase as a new artwork
        try {
          const childArtwork = await storeEvolvedArtwork({
            parentArtwork: artwork,
            childId,
            html,
            fitnessAfter,
            fitnessBefore,
            improvement,
            operator,
            generation,
            style,
            userId: session.user.id
          });

          setResult(childArtwork);
          onEvolved?.(childArtwork);

          // Send training data back to PIGMENT (non-blocking)
          pigmentLogEvolution({
            operatorUsed:     operator,
            mutationSuccess:  improvement > 0,
            offspringFitness: fitnessAfter,
            generation,
            galerieUser:      `@${session.user.user_metadata?.username || session.user.id}`,
            artworkId:        artwork.id,
            style
          }).catch(console.warn);
        } catch (err) {
          console.error('Failed to store evolved artwork:', err);
          setError('Evolution completed but failed to save. Refresh and try again.');
          setPhase('error');
        }
      },

      onMilestone: ({ fitness, milestone }) => {
        console.log(`[PIGMENT] Milestone: ${milestone} at fitness ${fitness}`);
      },

      onError: () => {
        // WS failed — fall back to polling
        startPolling();
      }
    });
  }, [artwork, session, onEvolved]);

  // ── Polling fallback ─────────────────────────────────────
  const startPolling = useCallback(() => {
    if (!jobId) return;
    clearInterval(pollInterval.current);

    pollInterval.current = setInterval(async () => {
      try {
        // Try /v1/jobs/:id first; fall back to re-POSTing /v1/evolve
        // with the job_id if that endpoint isn't available.
        let job;
        try {
          job = await pigmentGetJob(jobId);
        } catch (jobErr) {
          if (jobErr.message?.includes('404') || jobErr.message?.includes('Not Found')) {
            job = await pigmentPollEvolve(jobId);
          } else {
            throw jobErr;
          }
        }

        if (job.status === 'running') {
          const r = job.result || {};
          setGeneration(r.generation || 0);
          setFitness(r.fitness || null);
          setProgress(r.progress || 0);
        }

        if (job.status === 'completed' && job.result) {
          clearInterval(pollInterval.current);
          // Mirror what WS onDone does
          const r = job.result;
          disconnectWs.current?.();
          setPhase('done');
          setProgress(1);
          setFitness(r.fitness_after);

          const childArtwork = await storeEvolvedArtwork({
            parentArtwork: artwork,
            childId:       r.child_id,
            html:          r.html,
            fitnessAfter:  r.fitness_after,
            fitnessBefore: r.fitness_before,
            improvement:   r.improvement,
            operator:      r.operator,
            generation:    r.generation,
            style:         r.style,
            userId:        session.user.id
          });

          setResult(childArtwork);
          onEvolved?.(childArtwork);
        }

        if (job.status === 'failed') {
          clearInterval(pollInterval.current);
          setPhase('error');
          setError('Evolution job failed on PIGMENT side.');
        }
      } catch (err) {
        console.warn('[PIGMENT] Poll error:', err);
      }
    }, 5000);
  }, [jobId, artwork, session, onEvolved]);

  // Start polling when jobId changes and WS isn't connected
  useEffect(() => {
    if (jobId && phase === 'evolving') {
      // Give WS 3s to connect before falling back to polling
      const timeout = setTimeout(() => {
        if (phase === 'evolving') startPolling();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [jobId, phase, startPolling]);

  // ── Start evolution ──────────────────────────────────────
  async function handleEvolve() {
    if (!canEvolve) return;

    setPhase('evolving');
    setProgress(0);
    setFitness(artwork.pigment_fitness || null);
    setGeneration(artwork.generation || 0);
    setError('');
    setResult(null);
    setShowPrompt(false);

    try {
      // Connect WS first so we don't miss early ticks
      openWebSocket(session.user.id);

      // Queue the evolution job
      const job = await pigmentEvolve({
        pigmentWorkId: artwork.pigment_work_id,
        steps:         500,
        mutationRate:  1.0,
        prompt:        prompt.trim() || undefined,
        returnHtml:    true
      });

      setJobId(job.job_id);
    } catch (err) {
      disconnectWs.current?.();
      setPhase('error');
      setError(err.message || 'Failed to start evolution');
    }
  }

  function handleReset() {
    disconnectWs.current?.();
    clearInterval(pollInterval.current);
    setPhase('idle');
    setProgress(0);
    setFitness(null);
    setGeneration(0);
    setOperator('');
    setResult(null);
    setError('');
    setJobId(null);
    setPrompt('');
  }

  // ── Store evolved artwork in Supabase ────────────────────
  async function storeEvolvedArtwork({ parentArtwork, childId, html, fitnessAfter, fitnessBefore, improvement, operator, generation, style, userId }) {
    // Store the evolved HTML in Supabase storage
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const fileName = `${userId}/${Date.now()}-evolved-${childId}.html`;

    const { error: storageError } = await supabase.storage
      .from('artworks')
      .upload(fileName, htmlBlob, { contentType: 'text/html', upsert: false });

    if (storageError) throw storageError;

    const { data: { publicUrl: fileUrl } } = supabase.storage
      .from('artworks')
      .getPublicUrl(fileName);

    // Generate a title
    const genNum = generation || (parentArtwork.generation || 0) + 1;
    const evolvedTitle = `${parentArtwork.title} · gen ${genNum}`;

    // Insert child artwork record
    const { data: childRecord, error: dbError } = await supabase
      .from('artworks')
      .insert({
        title:           evolvedTitle,
        description:     `Evolved from "${parentArtwork.title}" via PIGMENT. Operator: ${operator}. Fitness: ${fitnessAfter?.toFixed(1)}%.`,
        medium:          parentArtwork.medium || 'Living HTML',
        year:            new Date().getFullYear(),
        artist_id:       userId,
        owned_by:        userId,
        file_url:        fileUrl,
        file_type:       'html',
        is_approved:     false,
        approval_votes:  0,
        rejection_votes: 0,
        voting_ends:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        // PIGMENT fields
        pigment_work_id: childId,
        pigment_fitness: fitnessAfter,
        pigment_style:   style,
        generation:      genNum,
        parent_id:       parentArtwork.id,
        is_evolved:      true,
        evolved_at:      new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) throw dbError;
    return childRecord;
  }

  // ── If PIGMENT not enabled ────────────────────────────────
  if (!isPigmentEnabled()) return null;

  // ── If not yet registered with PIGMENT ───────────────────
  if (notRegistered) {
    return (
      <div className="evolve-unavailable">
        <span className="evolve-icon">⚡</span>
        <span>not yet registered with PIGMENT</span>
      </div>
    );
  }

  // ── Idle state ────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="evolve-idle">
        {showPrompt ? (
          <div className="evolve-prompt-row">
            <input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. make it glitchy, more void…"
              className="evolve-prompt-input"
              onKeyDown={e => e.key === 'Enter' && handleEvolve()}
              autoFocus
            />
            <button onClick={handleEvolve} className="evolve-btn primary">
              ⚡ evolve
            </button>
            <button onClick={() => setShowPrompt(false)} className="evolve-cancel">✕</button>
          </div>
        ) : (
          <div className="evolve-actions">
            <button onClick={handleEvolve} className="evolve-btn primary">
              ⚡ evolve
            </button>
            <button onClick={() => setShowPrompt(true)} className="evolve-btn secondary">
              with prompt
            </button>
          </div>
        )}
        {artwork.pigment_fitness != null && (
          <div className="evolve-current-fitness">
            current fitness: <span>{artwork.pigment_fitness.toFixed(1)}%</span>
            <span className="fitness-label">· {fitnessLabel(artwork.pigment_fitness)}</span>
          </div>
        )}
      </div>
    );
  }

  // ── Evolving state ────────────────────────────────────────
  if (phase === 'evolving') {
    const pct = Math.round(progress * 100);
    return (
      <div className="evolve-progress">
        <div className="evolve-progress-header">
          <span className="evolve-icon spinning">⚡</span>
          <span className="evolve-status">evolving…</span>
          <span className="evolve-pct">{pct}%</span>
        </div>

        <div className="evolve-bar-track">
          <div className="evolve-bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="evolve-stats">
          <span>gen {generation.toLocaleString()}</span>
          {fitness != null && <span>fitness {fitness.toFixed(1)}%</span>}
          {operator && <span className="operator-tag">{operator}</span>}
        </div>
      </div>
    );
  }

  // ── Done state ────────────────────────────────────────────
  if (phase === 'done' && result) {
    const improvement = result.pigment_fitness - (artwork.pigment_fitness || 0);
    return (
      <div className="evolve-done">
        <div className="evolve-done-header">
          <span className="evolve-icon">✦</span>
          <span>evolution complete</span>
        </div>
        <div className="evolve-done-stats">
          <div className="evolve-stat">
            <span className="stat-label">new fitness</span>
            <span className="stat-value">{result.pigment_fitness?.toFixed(1)}%</span>
          </div>
          {improvement > 0 && (
            <div className="evolve-stat">
              <span className="stat-label">improvement</span>
              <span className="stat-value positive">+{improvement.toFixed(1)}%</span>
            </div>
          )}
          <div className="evolve-stat">
            <span className="stat-label">generation</span>
            <span className="stat-value">{result.generation}</span>
          </div>
        </div>
        <p className="evolve-done-note">
          Saved as <em>{result.title}</em> — now in voting queue.
        </p>
        <div className="evolve-done-actions">
          <a href={`/artwork/${result.id}`} className="view-evolved-btn">view evolved work →</a>
          <button onClick={handleReset} className="evolve-again-btn">evolve again</button>
        </div>
        <div className="pigment-attribution">⚡ evolved with <a href="https://pigment-org.github.io" target="_blank" rel="noreferrer">PIGMENT</a></div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="evolve-error">
        <span>⚠ {error || 'Evolution failed'}</span>
        <button onClick={handleReset} className="evolve-retry">retry</button>
      </div>
    );
  }

  return null;
}
