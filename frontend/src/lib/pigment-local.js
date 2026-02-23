// ============================================================
// PIGMENT Local Renderer
// Extracted from PIGMENT v6 engine (o.html)
//
// Use this when:
//   - API preview image is unavailable / not yet generated
//   - Offline / API is down
//   - Fast local thumbnail generation needed
//   - Displaying genome in genome viewer modal
//
// Does NOT require any API key or network call.
// ============================================================

/**
 * Parse a .pg genome string into a structured object.
 *
 * Genome format:
 *   -- @fitness 91.3%
 *   -- Generations: 1247
 *
 *   canvas { width: 400  height: 400 }
 *
 *   palette {
 *     c0: #ff3366
 *     c1: #002244
 *   }
 *
 *   layer evolved {
 *     zone poly_0 {
 *       color: palette.c0
 *       opacity: 0.82
 *       points: 120,140 180,120 160,200
 *     }
 *   }
 *
 * @param {string} content — raw .pg genome string
 * @returns {{ canvas, palette, polygons, metadata }}
 */
export function parseGenome(content) {
  const genome = {
    canvas:   { width: 400, height: 400 },
    palette:  {},
    polygons: [],
    metadata: {}
  };

  const lines = content.split('\n');
  let section     = null;
  let currentZone = null;

  for (const line of lines) {
    const t = line.trim();

    // Comment / metadata lines
    if (t.startsWith('--')) {
      // @key value format (e.g. -- @fitness 91.3)
      const kvMatch = t.match(/--\s*@(\w+)\s+(.+)/);
      if (kvMatch) {
        genome.metadata[kvMatch[1]] = kvMatch[2].trim();
      }
      // Inline fitness/generations (older format)
      if (t.includes('Fitness:'))     genome.metadata.fitness     = t.split('Fitness:')[1].trim();
      if (t.includes('Generations:')) genome.metadata.generations = t.split('Generations:')[1].trim();
      continue;
    }

    // Closing brace — finalise zone or section
    if (!t || t === '}') {
      if (currentZone) {
        genome.polygons.push(currentZone);
        currentZone = null;
      }
      if (t === '}') section = null;
      continue;
    }

    // Section openers
    if (t === 'canvas {')             { section = 'canvas';  continue; }
    if (t === 'palette {')            { section = 'palette'; continue; }
    if (t.startsWith('layer '))       { section = 'layer';   continue; }

    // canvas block
    if (section === 'canvas') {
      const m = t.match(/(\w+):\s*(\d+)/);
      if (m) genome.canvas[m[1]] = parseInt(m[2]);
    }

    // palette block
    if (section === 'palette') {
      const m = t.match(/(\w+):\s*(#[0-9a-fA-F]{6})/);
      if (m) genome.palette[m[1]] = m[2];
    }

    // layer block — zones
    if (section === 'layer') {
      if (t.startsWith('zone ')) {
        currentZone = { name: t.split(' ')[1], points: [], color: '#ffffff', opacity: 1 };
        continue;
      }
      if (currentZone) {
        const colorMatch   = t.match(/color:\s*palette\.(\w+)/);
        const opacityMatch = t.match(/opacity:\s*([0-9.]+)/);
        const pointsMatch  = t.match(/points:\s*(.+)/);

        if (colorMatch) {
          currentZone.colorName = colorMatch[1];
          currentZone.color     = genome.palette[colorMatch[1]] || '#ffffff';
        }
        if (opacityMatch) {
          currentZone.opacity = parseFloat(opacityMatch[1]);
        }
        if (pointsMatch) {
          currentZone.points = pointsMatch[1].trim().split(/\s+/).map(pair => {
            const [x, y] = pair.split(',').map(parseFloat);
            return { x, y };
          });
        }
      }
    }
  }

  return genome;
}

/**
 * Render a parsed genome onto a canvas element.
 * Black background, polygons layered in order.
 *
 * @param {object}          genome    — from parseGenome()
 * @param {HTMLCanvasElement} canvas  — target canvas
 * @param {number}          [width]   — override width
 * @param {number}          [height]  — override height
 */
export function renderGenomeToCanvas(genome, canvas, width, height) {
  const w = width  || genome.canvas?.width  || 400;
  const h = height || genome.canvas?.height || 400;

  canvas.width  = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  const scaleX = w / (genome.canvas?.width  || w);
  const scaleY = h / (genome.canvas?.height || h);

  for (const poly of genome.polygons) {
    if (!poly.points || poly.points.length < 3) continue;

    // Parse hex color to RGB
    const hex = (poly.color || '#ffffff').replace('#', '');
    const r   = parseInt(hex.slice(0, 2), 16);
    const g   = parseInt(hex.slice(2, 4), 16);
    const b   = parseInt(hex.slice(4, 6), 16);
    const a   = Math.max(0, Math.min(1, poly.opacity ?? 1));

    ctx.beginPath();
    ctx.moveTo(poly.points[0].x * scaleX, poly.points[0].y * scaleY);
    for (let i = 1; i < poly.points.length; i++) {
      ctx.lineTo(poly.points[i].x * scaleX, poly.points[i].y * scaleY);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.fill();
  }
}

/**
 * Render a genome string to a new offscreen canvas and return as data URL.
 * Useful for generating preview thumbnails without touching the DOM.
 *
 * @param {string} genomeString
 * @param {number} [width=400]
 * @param {number} [height=400]
 * @returns {string} — data:image/png;base64,...
 */
export function genomeToDataUrl(genomeString, width = 400, height = 400) {
  const genome = parseGenome(genomeString);
  const canvas = document.createElement('canvas');
  renderGenomeToCanvas(genome, canvas, width, height);
  return canvas.toDataURL('image/png');
}

/**
 * React hook — render genome into a ref canvas whenever the genome string changes.
 *
 * Usage:
 *   const canvasRef = useRef(null);
 *   useGenomeRenderer(canvasRef, artwork.genome, 400, 400);
 *
 * @param {React.RefObject} canvasRef
 * @param {string|null}     genomeString
 * @param {number}          width
 * @param {number}          height
 */
export function useGenomeRenderer(canvasRef, genomeString, width = 400, height = 400) {
  // Import useEffect inline so this file works with or without React
  // Caller is responsible for calling this inside a React component
  if (!genomeString || !canvasRef?.current) return;

  try {
    const genome = parseGenome(genomeString);
    renderGenomeToCanvas(genome, canvasRef.current, width, height);
  } catch (err) {
    console.warn('[PIGMENT local] Genome render failed:', err);
  }
}

/**
 * Extract metadata from a genome string without full parsing.
 * Fast — only reads comment lines.
 *
 * @param {string} genomeString
 * @returns {{ fitness, generations, version, width, height }}
 */
export function extractGenomeMeta(genomeString) {
  if (!genomeString) return {};
  const meta = {};

  for (const line of genomeString.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('--')) {
      // Stop at first non-comment, non-blank line after canvas block
      if (t && !t.startsWith('canvas') && !t.match(/^\s*width|height/)) break;
    }
    const kv = t.match(/--\s*@(\w+)\s+(.+)/);
    if (kv) {
      meta[kv[1]] = kv[2].trim();
      continue;
    }
    if (t.includes('Fitness:'))     meta.fitness     = parseFloat(t.split('Fitness:')[1]);
    if (t.includes('Generations:')) meta.generations = parseInt(t.split('Generations:')[1]);
  }

  // Also grab canvas dimensions
  const wMatch = genomeString.match(/width:\s*(\d+)/);
  const hMatch = genomeString.match(/height:\s*(\d+)/);
  if (wMatch) meta.width  = parseInt(wMatch[1]);
  if (hMatch) meta.height = parseInt(hMatch[1]);

  return meta;
}

/**
 * Count polygons in a genome string without full parsing.
 */
export function countPolygons(genomeString) {
  if (!genomeString) return 0;
  return (genomeString.match(/zone poly_/g) || []).length;
}

/**
 * Export a parsed genome back to .pg string format.
 * Useful if you modify the genome object and need to re-serialise.
 *
 * @param {object} genome — from parseGenome()
 * @param {{ fitness, generations }} [meta]
 * @returns {string}
 */
export function serializeGenome(genome, meta = {}) {
  let out = `-- PIGMENT Genome v6.0.0\n`;
  if (meta.fitness != null)     out += `-- @fitness ${meta.fitness}\n`;
  if (meta.generations != null) out += `-- @generation ${meta.generations}\n`;
  out += '\n';

  out += `canvas {\n  width: ${genome.canvas.width}\n  height: ${genome.canvas.height}\n}\n\n`;

  out += `palette {\n`;
  for (const [key, value] of Object.entries(genome.palette)) {
    out += `  ${key}: ${value}\n`;
  }
  out += `}\n\nlayer evolved {\n`;

  genome.polygons.forEach((poly, i) => {
    out += `  zone poly_${i} {\n`;
    out += `    color: palette.${poly.colorName || 'c0'}\n`;
    out += `    opacity: ${poly.opacity.toFixed(2)}\n`;
    out += `    points: ${poly.points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}\n`;
    out += `  }\n`;
  });

  out += `}\n`;
  return out;
}
