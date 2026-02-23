// ============================================================
// PIGMENT API Client
// REST: https://pigment-api.onrender.com
// WS:   wss://pigment-api.onrender.com  ← same host as REST
// ============================================================

const PIGMENT_API = import.meta.env.VITE_PIGMENT_API_URL || 'https://pigment-api.onrender.com';

// WebSocket uses same host — wss:// version of the API base
const _apiHost    = PIGMENT_API.replace(/^https?:\/\//, '');
const PIGMENT_WS  = import.meta.env.VITE_PIGMENT_WS_URL
  || `wss://${_apiHost}`;

const PIGMENT_KEY = import.meta.env.VITE_PIGMENT_API_KEY;

// ============================================================
// Core fetch helper — always attaches X-API-Key
// ============================================================
async function pigmentFetch(path, options = {}) {
  const url = `${PIGMENT_API}${path}`;

  const headers = {
    'X-API-Key': PIGMENT_KEY,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let message = `PIGMENT HTTP ${response.status}`;
    try {
      const err = await response.json();
      message = err.detail || err.error || err.message || message;
    } catch {}
    throw new Error(message);
  }

  return response.json();
}

// ============================================================
// 1. Users & Auth
// ============================================================

export async function pigmentCreateUser(email, plan = 'free') {
  return pigmentFetch('/v1/users', {
    method: 'POST',
    body: JSON.stringify({ email, plan })
  });
}

export async function pigmentAuth(apiKey = PIGMENT_KEY) {
  return pigmentFetch('/v1/auth', {
    method: 'POST',
    body: JSON.stringify({ api_key: apiKey })
  });
}

// ============================================================
// 2. Convert HTML → Genome
//
// The API has no server-side HTML renderer. The workflow is:
//   1. Render the HTML in an offscreen sandboxed iframe
//   2. Wait for it to paint (up to 3s)
//   3. Capture a screenshot via html2canvas
//   4. Send the PNG to /v1/convert/image-to-pg
//
// pigmentConvertHtml() orchestrates this whole flow.
// pigmentConvertImage() sends a File/Blob directly.
// ============================================================

/**
 * Render an HTML string in an offscreen iframe, capture a screenshot,
 * then send it to /v1/convert/image-to-pg to get a genome + features.
 *
 * @param {string} htmlSource — raw HTML string
 * @param {object} opts       — { width, height, polygons, tags }
 * @returns {{ genome, features, preview, polygons, width, height, fitness }}
 */
export async function pigmentConvertHtml(htmlSource, opts = {}) {
  const { width = 400, height = 400, polygons = 100 } = opts;

  // ── Step 1: render HTML in a hidden sandboxed iframe ──────
  const blob    = new Blob([htmlSource], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    position: fixed;
    left: -9999px;
    top: -9999px;
    width: ${width}px;
    height: ${height}px;
    border: none;
    visibility: hidden;
  `;
  iframe.sandbox = 'allow-scripts';
  document.body.appendChild(iframe);

  try {
    // Wait for iframe to load
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 3000); // max 3s
      iframe.onload  = () => { clearTimeout(timer); setTimeout(resolve, 400); };
      iframe.onerror = reject;
      iframe.src = blobUrl;
    });

    // ── Step 2: capture iframe content to canvas ────────────
    const canvas  = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx     = canvas.getContext('2d');

    // Try html2canvas if available, else fallback to blank PNG
    // (html2canvas is not bundled — works if loaded externally;
    //  otherwise we get a blank capture which PIGMENT still processes)
    let imageBlob;
    try {
      if (window.html2canvas) {
        const captured = await window.html2canvas(iframe.contentDocument.body, {
          canvas, width, height, useCORS: true, logging: false
        });
        imageBlob = await new Promise(r => captured.toBlob(r, 'image/png'));
      } else {
        // Fallback: draw a solid background so PIGMENT gets a valid image
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        imageBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      }
    } catch {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      imageBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    }

    // ── Step 3: send PNG to PIGMENT ─────────────────────────
    const imageFile = new File([imageBlob], 'capture.png', { type: 'image/png' });
    return await pigmentConvertImage(imageFile, { width, height, polygons });

  } finally {
    document.body.removeChild(iframe);
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Upload an image file to PIGMENT for genome conversion.
 *
 * @param {File|Blob} imageFile
 * @param {object} opts — { width, height, polygons, style }
 * @returns {{ genome, features, preview, polygons, width, height, fitness }}
 */
export async function pigmentConvertImage(imageFile, opts = {}) {
  const { width = 400, height = 400, polygons = 100 } = opts;

  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('polygons', String(polygons));
  formData.append('width', String(width));
  formData.append('height', String(height));
  formData.append('extract_features', 'true');
  formData.append('style', opts.style || 'preserve');

  // No Content-Type header — browser sets multipart boundary automatically
  const response = await fetch(`${PIGMENT_API}/v1/convert/image-to-pg`, {
    method: 'POST',
    headers: { 'X-API-Key': PIGMENT_KEY },
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `PIGMENT HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================
// 3. Works
// ============================================================

export async function pigmentSaveWork({ title, genome, features, tags = [], galerieId, galerieUrl }) {
  return pigmentFetch('/v1/works', {
    method: 'POST',
    body: JSON.stringify({
      title,
      content:  genome,
      features: features || [],
      tags:     ['galerie', ...tags],
      metadata: {
        galerie_id:   galerieId,
        original_url: galerieUrl || ''
      }
    })
  });
}

export async function pigmentListWorks(opts = {}) {
  const params = new URLSearchParams({
    limit:  opts.limit  || 20,
    offset: opts.offset || 0,
    ...(opts.style ? { style: opts.style } : {})
  });
  return pigmentFetch(`/v1/works?${params}`);
}

export async function pigmentGetWork(pigmentWorkId) {
  return pigmentFetch(`/v1/works/${pigmentWorkId}`);
}

export async function pigmentDeleteWork(pigmentWorkId) {
  return pigmentFetch(`/v1/works/${pigmentWorkId}`, { method: 'DELETE' });
}

// ============================================================
// 4. Evolution
// ============================================================

export async function pigmentEvolve({ pigmentWorkId, steps = 500, mutationRate = 1.0, prompt, returnHtml = true }) {
  return pigmentFetch('/v1/evolve', {
    method: 'POST',
    body: JSON.stringify({
      work_id:       pigmentWorkId,
      steps,
      mutation_rate: mutationRate,
      return_html:   returnHtml,
      ...(prompt ? { prompt } : {})
    })
  });
}

/**
 * Poll an evolution job.
 * NOTE: /v1/jobs/:id is not listed in the API index.
 * If this 404s, pigmentPollEvolve() is the fallback.
 */
export async function pigmentGetJob(jobId) {
  return pigmentFetch(`/v1/jobs/${jobId}`);
}

/**
 * Re-POST to /v1/evolve with the same job_id to get its current status.
 * Fallback if /v1/jobs/:id is unavailable.
 */
export async function pigmentPollEvolve(jobId) {
  return pigmentFetch('/v1/evolve', {
    method: 'POST',
    body: JSON.stringify({ job_id: jobId })
  });
}

// ============================================================
// 5. Kinship & Ancestry
// ============================================================

export async function pigmentGetKinship(pigmentWorkId) {
  return pigmentFetch('/v1/kinship', {
    method: 'POST',
    body: JSON.stringify({ work_id: pigmentWorkId })
  });
}

export async function pigmentGetAncestry(pigmentWorkId) {
  return pigmentFetch(`/v1/ancestry/${pigmentWorkId}`);
}

export async function pigmentFindSimilar({ workId, features, limit = 10 }) {
  const body = workId
    ? { work_id: workId, limit }
    : { features, limit };

  return pigmentFetch('/v1/search/similar', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

// ============================================================
// 6. Gallery
// ============================================================

export async function pigmentGetGallery({ limit = 24, offset = 0 } = {}) {
  return pigmentFetch(`/v1/gallery?limit=${limit}&offset=${offset}`);
}

// ============================================================
// 7. Training
// ============================================================

export async function pigmentSendTraining(records) {
  if (!Array.isArray(records) || records.length === 0) return;
  return pigmentFetch('/v1/training', {
    method: 'POST',
    body: JSON.stringify(records)
  });
}

export async function pigmentLogEvolution({ operatorUsed, mutationSuccess, offspringFitness, generation, galerieUser, artworkId, style }) {
  return pigmentSendTraining([{
    operator_used:     operatorUsed,
    mutation_success:  mutationSuccess,
    offspring_fitness: offspringFitness,
    generation,
    metadata: { galerie_user: galerieUser, artwork_id: artworkId, style }
  }]);
}

// ============================================================
// 8. WebSocket — evolution progress stream
// ============================================================

export function connectPigmentWs(userId, handlers = {}) {
  const { onTick, onDone, onKinship, onMilestone, onError, onOpen } = handlers;

  let ws = null;
  let closed = false;
  let reconnectTimer = null;

  function connect() {
    if (closed) return;

    // WS path on the REST API host: wss://pigment-api.onrender.com/ws/{userId}
    ws = new WebSocket(`${PIGMENT_WS}/ws/${userId}`);

    ws.onopen = () => {
      console.log('[PIGMENT WS] connected');
      onOpen?.();
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); }
      catch { console.warn('[PIGMENT WS] non-JSON:', event.data); return; }

      switch (msg.type) {
        case 'evolution_tick':
          onTick?.({
            jobId:      msg.job_id,
            generation: msg.generation,
            fitness:    msg.fitness,
            delta:      msg.fitness_delta,
            operator:   msg.operator,
            progress:   msg.progress
          });
          break;

        case 'evolution_done':
          onDone?.({
            jobId:         msg.job_id,
            parentId:      msg.parent_id,
            childId:       msg.child_id,
            html:          msg.html,
            fitnessBefore: msg.fitness_before,
            fitnessAfter:  msg.fitness_after,
            improvement:   msg.improvement,
            operator:      msg.operator,
            generation:    msg.generation,
            style:         msg.style
          });
          break;

        case 'kinship_update':
          onKinship?.({ workId: msg.work_id, newRelations: msg.new_relations });
          break;

        case 'fitness_milestone':
          onMilestone?.({ workId: msg.work_id, fitness: msg.fitness, milestone: msg.milestone });
          break;

        default:
          console.log('[PIGMENT WS] unhandled type:', msg.type, msg);
      }
    };

    ws.onerror = () => {
      onError?.(new Error('WebSocket connection error'));
    };

    ws.onclose = (event) => {
      console.log('[PIGMENT WS] closed:', event.code, event.reason);
      if (!closed && event.code !== 1000) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };
  }

  connect();

  return function disconnect() {
    closed = true;
    clearTimeout(reconnectTimer);
    if (ws) { ws.close(1000, 'client disconnect'); ws = null; }
  };
}

// ============================================================
// Helpers
// ============================================================

export function isPigmentEnabled() {
  return Boolean(PIGMENT_KEY);
}

export function fitnessLabel(fitness) {
  if (fitness === null || fitness === undefined) return '—';
  if (fitness >= 95) return 'exceptional';
  if (fitness >= 80) return 'strong';
  if (fitness >= 60) return 'developing';
  if (fitness >= 30) return 'emerging';
  return 'nascent';
}

export function fitnessPhase(fitness) {
  if (fitness === null || fitness === undefined) return null;
  if (fitness >= 60) return 'polish';
  if (fitness >= 30) return 'refine';
  return 'explore';
}

export async function storePigmentPreview(base64, userId, artworkId, supabase) {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const path = `${userId}/previews/${artworkId}.png`;

  const { error } = await supabase.storage
    .from('artworks')
    .upload(path, buffer, { contentType: 'image/png', upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from('artworks').getPublicUrl(path);
  return publicUrl;
}
