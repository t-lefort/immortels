/**
 * Renders a council's votes into a shareable PNG.
 *
 * Drawn on a plain <canvas> rather than pulled in through a DOM-to-image
 * library: the project ships no extra dependencies, and the layout here is
 * simple enough that hand-drawing it is shorter than configuring a library.
 *
 * Sized for a phone screenshot / messaging app (1080px wide, height grows
 * with the number of vote groups).
 */

const WIDTH = 1080;
const PADDING = 64;
const HEADER_HEIGHT = 200;
const GROUP_GAP = 28;
const FOOTER_HEIGHT = 80;

const COLORS = {
  background: '#0d0d0d',
  panel: 'rgba(255, 255, 255, 0.04)',
  panelBorder: 'rgba(255, 255, 255, 0.08)',
  eliminatedPanel: 'rgba(139, 0, 0, 0.22)',
  eliminatedBorder: 'rgba(139, 0, 0, 0.55)',
  gold: 'rgb(224, 160, 48)',
  red: '#ff4444',
  white: '#ffffff',
  muted: 'rgba(255, 255, 255, 0.45)',
  faint: 'rgba(255, 255, 255, 0.25)',
};

/**
 * Group votes by target, most-voted first.
 */
export function groupVotes(councilVotes) {
  const groups = new Map();
  for (const vote of councilVotes || []) {
    if (!groups.has(vote.targetId)) {
      groups.set(vote.targetId, {
        targetId: vote.targetId,
        targetName: vote.targetName,
        voters: [],
      });
    }
    groups.get(vote.targetId).voters.push(vote.voterName);
  }
  return [...groups.values()].sort((a, b) => b.voters.length - a.voters.length);
}

/**
 * Wrap `text` to fit `maxWidth`, returning the resulting lines.
 */
function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Build the PNG. Returns a Blob.
 *
 * @param {object} params
 * @param {Array}  params.councilVotes  [{ voterName, targetName, voterId, targetId }]
 * @param {object} params.eliminatedPlayer  highlighted target, may be null
 * @param {string} params.title
 * @param {string} params.subtitle
 */
export async function renderVoteImage({ councilVotes, eliminatedPlayer, title, subtitle }) {
  const groups = groupVotes(councilVotes);
  if (groups.length === 0) {
    throw new Error('Aucun vote à représenter.');
  }

  const contentWidth = WIDTH - PADDING * 2;
  const totalVotes = councilVotes.length;

  // First pass: measure so the canvas is exactly tall enough.
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = '26px Inter, "Segoe UI", system-ui, sans-serif';

  const layouts = groups.map(group => {
    const voterLines = wrapText(measure, group.voters.join(', '), contentWidth - 56);
    // name row + bar + voter lines + vertical padding
    const height = 52 + 14 + voterLines.length * 34 + 36;
    return { group, voterLines, height };
  });

  const bodyHeight = layouts.reduce((sum, l) => sum + l.height + GROUP_GAP, 0);
  const height = HEADER_HEIGHT + bodyHeight + FOOTER_HEIGHT;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, height);

  // Header
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 44px Inter, "Segoe UI", system-ui, sans-serif';
  ctx.fillText(title, WIDTH / 2, 84);

  if (subtitle) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '26px Inter, "Segoe UI", system-ui, sans-serif';
    ctx.fillText(subtitle, WIDTH / 2, 128);
  }

  // Divider
  const gradient = ctx.createLinearGradient(PADDING, 0, WIDTH - PADDING, 0);
  gradient.addColorStop(0, 'rgba(224, 160, 48, 0)');
  gradient.addColorStop(0.5, 'rgba(224, 160, 48, 0.6)');
  gradient.addColorStop(1, 'rgba(224, 160, 48, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(PADDING, 158, contentWidth, 2);

  // Vote groups
  ctx.textAlign = 'left';
  let y = HEADER_HEIGHT;

  for (const { group, voterLines, height: groupHeight } of layouts) {
    const isEliminated = eliminatedPlayer && group.targetId === eliminatedPlayer.id;
    const percentage = totalVotes > 0 ? Math.round((group.voters.length / totalVotes) * 100) : 0;

    roundedRect(ctx, PADDING, y, contentWidth, groupHeight, 16);
    ctx.fillStyle = isEliminated ? COLORS.eliminatedPanel : COLORS.panel;
    ctx.fill();
    ctx.strokeStyle = isEliminated ? COLORS.eliminatedBorder : COLORS.panelBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    const innerX = PADDING + 28;
    const innerWidth = contentWidth - 56;

    // Target name
    ctx.fillStyle = isEliminated ? COLORS.red : COLORS.white;
    ctx.font = 'bold 36px Inter, "Segoe UI", system-ui, sans-serif';
    ctx.fillText(group.targetName, innerX, y + 48);

    const nameWidth = ctx.measureText(group.targetName).width;
    if (isEliminated) {
      ctx.fillStyle = COLORS.red;
      ctx.font = 'bold 20px Inter, "Segoe UI", system-ui, sans-serif';
      ctx.fillText('ÉLIMINÉ(E)', innerX + nameWidth + 20, y + 46);
    }

    // Vote count, right aligned
    ctx.textAlign = 'right';
    ctx.fillStyle = isEliminated ? COLORS.red : COLORS.gold;
    ctx.font = 'bold 34px Inter, "Segoe UI", system-ui, sans-serif';
    const countText = `${group.voters.length}`;
    ctx.fillText(countText, PADDING + contentWidth - 28 - 70, y + 48);

    ctx.fillStyle = COLORS.faint;
    ctx.font = '24px Inter, "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`(${percentage}%)`, PADDING + contentWidth - 28, y + 48);
    ctx.textAlign = 'left';

    // Bar
    const barY = y + 66;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    roundedRect(ctx, innerX, barY, innerWidth, 8, 4);
    ctx.fill();
    ctx.fillStyle = isEliminated ? 'rgba(139, 0, 0, 0.8)' : 'rgba(224, 160, 48, 0.6)';
    roundedRect(ctx, innerX, barY, Math.max(8, (innerWidth * percentage) / 100), 8, 4);
    ctx.fill();

    // Voters
    ctx.fillStyle = COLORS.muted;
    ctx.font = '26px Inter, "Segoe UI", system-ui, sans-serif';
    let lineY = barY + 42;
    for (const line of voterLines) {
      ctx.fillText(line, innerX, lineY);
      lineY += 34;
    }

    y += groupHeight + GROUP_GAP;
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.faint;
  ctx.font = '24px Inter, "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Les Immortels', WIDTH / 2, height - 32);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossible de générer l'image."));
    }, 'image/png');
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Hand the image to the OS share sheet when available (mobile), so the admin
 * can drop it straight into the group chat, and fall back to a download on
 * desktop. Returns 'shared', 'downloaded' or 'cancelled'.
 */
export async function shareVoteImage(params, filename) {
  const blob = await renderVoteImage(params);
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: params.title });
      return 'shared';
    } catch (err) {
      // Dismissed share sheet — not an error worth surfacing
      if (err?.name === 'AbortError') return 'cancelled';
      // Anything else: fall through to the download path
    }
  }

  triggerDownload(blob, filename);
  return 'downloaded';
}
