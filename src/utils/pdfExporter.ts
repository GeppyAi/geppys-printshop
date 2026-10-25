import { jsPDF } from 'jspdf';
import {
  CanvasElement,
  MasterDesign,
  PrintProject,
} from '../types/printstudio';
import { getDesignUnitSize } from '../data/templates';

/**
 * Deterministic scannable-style QR matrix generator for rendering QR elements cleanly at any DPI
 */
export function drawQrMatrix(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  value: string,
  color: string = '#0f172a'
) {
  const cells = 15;
  const cellSize = size / cells;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = color;

  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinder = (r: number, c: number) => {
    const inTL = r < 4 && c < 4;
    const inTR = r < 4 && c >= cells - 4;
    const inBL = r >= cells - 4 && c < 4;
    return inTL || inTR || inBL;
  };

  // Draw 3 finder patterns
  const drawFinderBox = (r0: number, c0: number) => {
    ctx.fillRect(x + c0 * cellSize, y + r0 * cellSize, 4 * cellSize, 4 * cellSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      x + (c0 + 0.65) * cellSize,
      y + (r0 + 0.65) * cellSize,
      2.7 * cellSize,
      2.7 * cellSize
    );
    ctx.fillStyle = color;
    ctx.fillRect(
      x + (c0 + 1.25) * cellSize,
      y + (r0 + 1.25) * cellSize,
      1.5 * cellSize,
      1.5 * cellSize
    );
  };

  drawFinderBox(0, 0);
  drawFinderBox(0, cells - 4);
  drawFinderBox(cells - 4, 0);

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (isFinder(r, c)) continue;
      const bit = ((hash >>> ((r * cells + c) % 28)) ^ (r * 7 + c * 13)) & 1;
      if (bit) {
        ctx.fillRect(
          x + c * cellSize,
          y + r * cellSize,
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
      }
    }
  }
  ctx.restore();
}

async function loadImageAsync(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Word-wraps text to fit within `maxWidthPx` on a 2D canvas context,
 * matching the StudioEditor's CSS `whitespace-pre-wrap break-words` behavior 1:1.
 */
function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number
): string[] {
  const paragraphs = text.split(/\r?\n/);
  const wrappedLines: string[] = [];
  // Small 1px tolerance so sub-pixel rounding doesn't trigger an unintended wrap
  const limit = Math.max(4, maxWidthPx + 1);

  for (const para of paragraphs) {
    if (!para) {
      wrappedLines.push('');
      continue;
    }

    const words = para.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine === '' ? word : `${currentLine} ${word}`;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth <= limit) {
        currentLine = testLine;
      } else {
        if (currentLine !== '') {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          // Single word is wider than the box (`break-words` fallback)
          let chunk = '';
          for (const ch of word) {
            const nextChunk = chunk + ch;
            if (ctx.measureText(nextChunk).width > limit && chunk !== '') {
              wrappedLines.push(chunk);
              chunk = ch;
            } else {
              chunk = nextChunk;
            }
          }
          currentLine = chunk;
        }
      }
    }

    wrappedLines.push(currentLine);
  }

  return wrappedLines;
}

/**
 * Draws a 5-pointed star inside the bounding box (x, y, w, h)
 */
function drawStarShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.4;
  const spikes = 5;

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/**
 * Computes the 0-based sequential item index for a given sheet index and N-up slot index,
 * honoring 'across-then-down', 'cut-and-stack', or 'same-per-sheet' order modes.
 */
export function getSequentialItemOffset(
  project: PrintProject,
  sheetSeqIndex: number,
  slotIndex: number
): number {
  const orderMode = project.numbering?.orderMode || 'across-then-down';
  const slotsPerSheet = project.template.imposition
    ? Math.max(
        1,
        project.template.imposition.cols * project.template.imposition.rows
      )
    : 1;

  const frontPageCount = Math.max(
    1,
    project.pages.filter((p) => p.side === 'front').length
  );
  const mailMergeRecordCount = project.mailMerge?.enabled
    ? project.mailMerge.records.length
    : 0;
  const mailMergeSheets =
    mailMergeRecordCount > 0
      ? Math.ceil(mailMergeRecordCount / slotsPerSheet)
      : 1;
  const totalFrontSheets = Math.max(
    project.numbering?.totalSheets || 1,
    mailMergeSheets,
    frontPageCount
  );

  if (orderMode === 'cut-and-stack') {
    return slotIndex * totalFrontSheets + sheetSeqIndex;
  }
  if (orderMode === 'same-per-sheet') {
    return sheetSeqIndex;
  }
  return sheetSeqIndex * slotsPerSheet + slotIndex;
}

/**
 * Computes the formatted sequential print number (e.g. "No. 0001") for a given sheet index and slot index.
 */
export function formatSequentialNumber(
  project: PrintProject,
  sheetSeqIndex: number,
  slotIndex: number
): string {
  const cfg = project.numbering || {
    enabled: true,
    startNumber: 1,
    step: 1,
    padDigits: 4,
    prefix: 'No. ',
    suffix: '',
    orderMode: 'across-then-down' as const,
    totalSheets: 1,
  };

  const itemOffset = getSequentialItemOffset(project, sheetSeqIndex, slotIndex);
  const rawNum = (cfg.startNumber ?? 1) + itemOffset * (cfg.step ?? 1);
  const absStr =
    (cfg.padDigits ?? 4) > 0
      ? String(Math.abs(rawNum)).padStart(cfg.padDigits, '0')
      : String(Math.abs(rawNum));
  const signedNum = rawNum < 0 ? `-${absStr}` : absStr;

  return `${cfg.prefix ?? ''}${signedNum}${cfg.suffix ?? ''}`;
}

/**
 * Resolves the display text of a CanvasElement for a specific page/sheet and N-up slot,
 * substituting BOTH sequential print numbers (`{{NUM}}` / `isSequentialNumber`)
 * AND Mail Merge variable data fields (`{{Name}}`, `{{Address}}`, `{{Company}}`, etc.).
 */
export function resolveElementDisplayText(
  el: CanvasElement,
  project?: PrintProject,
  pageIndex: number = 0,
  slotIndex: number = 0,
  overrideSheetSeqIndex?: number
): string {
  const rawText = el.text || '';
  if (!project) return rawText;

  const hasNumToken =
    rawText.includes('{{NUM}}') || rawText.includes('{{NUMBER}}');
  const hasMergeBraces = rawText.includes('{{') && rawText.includes('}}');

  if (!el.isSequentialNumber && !hasNumToken && !hasMergeBraces) {
    return rawText;
  }

  // Determine which numbered/merged sheet index this page corresponds to
  let sheetSeqIdx = overrideSheetSeqIndex ?? 0;
  if (overrideSheetSeqIndex === undefined) {
    let frontCountBefore = 0;
    for (let i = 0; i < pageIndex && i < project.pages.length; i++) {
      if (project.pages[i]?.side === 'front') {
        frontCountBefore++;
      }
    }
    const currentPage = project.pages[pageIndex];
    if (currentPage && currentPage.side === 'back' && frontCountBefore > 0) {
      // Back side pairs with the immediately preceding front sheet
      sheetSeqIdx = frontCountBefore - 1;
    } else {
      sheetSeqIdx = frontCountBefore;
    }
  }

  let output = rawText;

  // 1. Substitute Sequential Print Number (`{{NUM}}`, `{{NUMBER}}`, or pure `isSequentialNumber`)
  if (el.isSequentialNumber || hasNumToken) {
    const formattedNum = formatSequentialNumber(project, sheetSeqIdx, slotIndex);
    if (hasNumToken) {
      output = output
        .split('{{NUM}}')
        .join(formattedNum)
        .split('{{NUMBER}}')
        .join(formattedNum);
    } else if (el.isSequentialNumber && !hasMergeBraces) {
      return formattedNum;
    }
  }

  // 2. Substitute Mail Merge / Variable Data fields (`{{FieldName}}`) if records exist
  if (
    output.includes('{{') &&
    project.mailMerge &&
    project.mailMerge.records.length > 0
  ) {
    const baseOffset = getSequentialItemOffset(
      project,
      sheetSeqIdx,
      slotIndex
    );
    const previewShift =
      overrideSheetSeqIndex === undefined
        ? project.mailMerge.previewRecordIndex || 0
        : 0;
    const itemOffset = Math.max(0, baseOffset + previewShift);
    const records = project.mailMerge.records;
    const record = records[itemOffset % records.length] || records[0];
    if (record) {
      output = output.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, fieldKey) => {
        const cleanKey = String(fieldKey).trim();
        if (cleanKey === 'NUM' || cleanKey === 'NUMBER') {
          return formatSequentialNumber(project, sheetSeqIdx, slotIndex);
        }
        // Case-insensitive lookup in the recipient/variable record
        if (cleanKey in record) return record[cleanKey];
        const foundKey = Object.keys(record).find(
          (k) => k.toLowerCase() === cleanKey.toLowerCase()
        );
        return foundKey ? record[foundKey] : match;
      });
    }
  }

  return output;
}

/**
 * Renders a single MasterDesign unit onto a 2D canvas context at (offsetX, offsetY) with scale `dpi`.
 */
export async function renderMasterUnitToContext(
  ctx: CanvasRenderingContext2D,
  master: MasterDesign,
  offsetX: number,
  offsetY: number,
  unitWidthIn: number,
  unitHeightIn: number,
  dpi: number,
  project?: PrintProject,
  pageIndex: number = 0,
  slotIndex: number = 0,
  overrideSheetSeqIndex?: number
) {
  const wPx = unitWidthIn * dpi;
  const hPx = unitHeightIn * dpi;

  ctx.save();
  ctx.beginPath();
  ctx.rect(offsetX, offsetY, wPx, hPx);
  ctx.clip();

  // Background color
  ctx.fillStyle = master.backgroundColor || '#ffffff';
  ctx.fillRect(offsetX, offsetY, wPx, hPx);

  // Optional background image
  if (master.backgroundImage) {
    const bgImg = await loadImageAsync(master.backgroundImage);
    if (bgImg) {
      ctx.drawImage(bgImg, offsetX, offsetY, wPx, hPx);
    }
  }

  for (const el of master.elements) {
    if (el.visible === false) continue;
    const ex = offsetX + el.x * dpi;
    const ey = offsetY + el.y * dpi;
    const ew = el.width * dpi;
    const eh = el.height * dpi;

    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    if (el.blendMode && el.blendMode !== 'normal') {
      ctx.globalCompositeOperation =
        el.blendMode as GlobalCompositeOperation;
    }

    // Apply Photoshop-style Layer Effects (Drop Shadow / Outer Glow / Filter adjustments)
    if (el.effects) {
      const fx = el.effects;
      if (fx.dropShadow) {
        ctx.shadowColor = fx.shadowColor || 'rgba(15, 23, 42, 0.45)';
        ctx.shadowBlur = ((fx.shadowBlur ?? 6) * dpi) / 72;
        ctx.shadowOffsetX = ((fx.shadowOffsetX ?? 2) * dpi) / 72;
        ctx.shadowOffsetY = ((fx.shadowOffsetY ?? 2) * dpi) / 72;
      } else if (fx.outerGlow) {
        ctx.shadowColor = fx.glowColor || '#f59e0b';
        ctx.shadowBlur = ((fx.glowBlur ?? 10) * dpi) / 72;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      const filters: string[] = [];
      if (fx.brightness !== undefined && fx.brightness !== 100) {
        filters.push(`brightness(${fx.brightness}%)`);
      }
      if (fx.contrast !== undefined && fx.contrast !== 100) {
        filters.push(`contrast(${fx.contrast}%)`);
      }
      if (fx.saturate !== undefined && fx.saturate !== 100) {
        filters.push(`saturate(${fx.saturate}%)`);
      }
      if (fx.blurPx && fx.blurPx > 0) {
        filters.push(`blur(${(fx.blurPx * dpi) / 72}px)`);
      }
      if (filters.length > 0) {
        ctx.filter = filters.join(' ');
      }
    }

    if (el.rotation) {
      ctx.translate(ex + ew / 2, ey + eh / 2);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-(ex + ew / 2), -(ey + eh / 2));
    }

    if (el.type === 'rect' || el.type === 'rounded-rect') {
      const r = el.type === 'rounded-rect' ? ((el.borderRadius || 6) * dpi) / 72 : 0;
      if (el.fill && el.fill !== 'transparent') {
        ctx.beginPath();
        ctx.roundRect(ex, ey, ew, eh, r);
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
      if (el.stroke && el.stroke !== 'transparent' && el.strokeWidth) {
        const bw = (el.strokeWidth * dpi) / 72;
        ctx.beginPath();
        // Inset by bw/2 to match CSS `box-sizing: border-box` in StudioEditor
        ctx.roundRect(
          ex + bw / 2,
          ey + bw / 2,
          Math.max(0, ew - bw),
          Math.max(0, eh - bw),
          Math.max(0, r - bw / 2)
        );
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = bw;
        ctx.stroke();
      }
      if (el.text || el.isSequentialNumber) {
        const resolvedBadgeText = resolveElementDisplayText(
          el,
          project,
          pageIndex,
          slotIndex,
          overrideSheetSeqIndex
        );
        const fontPt = el.fontSize || 11;
        const fontPx = (fontPt * dpi) / 72;
        ctx.fillStyle = el.color || '#ffffff';
        ctx.font = `${el.fontWeight || 'bold'} ${fontPx}px "${
          el.fontFamily || 'Inter'
        }", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const badgeLines = wrapTextLines(ctx, resolvedBadgeText, ew * 0.96);
        const badgeLineH = fontPx * 1.05;
        const totalBadgeH = (badgeLines.length - 1) * badgeLineH;
        const startY = ey + eh / 2 - totalBadgeH / 2;
        badgeLines.forEach((line, idx) => {
          ctx.fillText(line, ex + ew / 2, startY + idx * badgeLineH);
        });
      }
    } else if (el.type === 'circle') {
      ctx.beginPath();
      ctx.ellipse(ex + ew / 2, ey + eh / 2, ew / 2, eh / 2, 0, 0, Math.PI * 2);
      if (el.fill && el.fill !== 'transparent') {
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
      if (el.stroke && el.stroke !== 'transparent' && el.strokeWidth) {
        const bw = (el.strokeWidth * dpi) / 72;
        ctx.beginPath();
        ctx.ellipse(
          ex + ew / 2,
          ey + eh / 2,
          Math.max(0, ew / 2 - bw / 2),
          Math.max(0, eh / 2 - bw / 2),
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = bw;
        ctx.stroke();
      }
    } else if (el.type === 'star') {
      drawStarShape(ctx, ex, ey, ew, eh, el.fill || '#eab308');
    } else if (el.type === 'line' || el.type === 'arrow') {
      ctx.strokeStyle = el.stroke || el.fill || '#94a3b8';
      ctx.lineWidth = Math.max(1, ((el.strokeWidth || 1) * dpi) / 72);
      ctx.beginPath();
      ctx.moveTo(ex, ey + eh / 2);
      ctx.lineTo(ex + ew, ey + eh / 2);
      ctx.stroke();
    } else if (el.type === 'qr') {
      const resolvedQrVal = resolveElementDisplayText(
        { ...el, text: el.qrValue || 'https://geppysprintshop.com' },
        project,
        pageIndex,
        slotIndex,
        overrideSheetSeqIndex
      );
      drawQrMatrix(
        ctx,
        ex,
        ey,
        Math.min(ew, eh),
        resolvedQrVal,
        el.fill || '#0f172a'
      );
    } else if (el.type === 'image' && el.imageUrl) {
      const img = await loadImageAsync(el.imageUrl);
      if (img) {
        ctx.drawImage(img, ex, ey, ew, eh);
      }
    } else if (el.type === 'text' && (el.text || el.isSequentialNumber)) {
      // Optional highlight background matching StudioEditor
      if (el.highlightColor && el.highlightColor !== 'transparent') {
        ctx.fillStyle = el.highlightColor;
        ctx.fillRect(ex, ey, ew, eh);
      }

      const fontPt = el.fontSize || 10;
      const fontPx = (fontPt * dpi) / 72;
      const style = el.fontStyle === 'italic' ? 'italic ' : '';
      const weight = el.fontWeight || 'normal';
      ctx.font = `${style}${weight} ${fontPx}px "${
        el.fontFamily || 'Inter'
      }", sans-serif`;

      if ('letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
          el.letterSpacing ? `${(el.letterSpacing * dpi) / 72}px` : '0px';
      }

      ctx.fillStyle = el.color || '#0f172a';
      ctx.textBaseline = 'top';

      let displayTxt = resolveElementDisplayText(
        el,
        project,
        pageIndex,
        slotIndex,
        overrideSheetSeqIndex
      );
      if (el.textTransform === 'uppercase') displayTxt = displayTxt.toUpperCase();
      if (el.textTransform === 'lowercase') displayTxt = displayTxt.toLowerCase();
      if (el.textTransform === 'capitalize') {
        displayTxt = displayTxt.replace(/\b\w/g, (ch) => ch.toUpperCase());
      }

      // Word-wrap lines to `ew` so multi-line text boxes match the live StudioEditor DOM 1:1
      const lines = wrapTextLines(ctx, displayTxt, ew);
      const lineH = fontPx * (el.lineHeight || 1.22);
      const halfLeading = Math.max(0, (lineH - fontPx) * 0.25);

      lines.forEach((line, idx) => {
        let tx = ex;
        if (el.textAlign === 'center') {
          ctx.textAlign = 'center';
          tx = ex + ew / 2;
        } else if (el.textAlign === 'right') {
          ctx.textAlign = 'right';
          tx = ex + ew;
        } else {
          ctx.textAlign = 'left';
        }

        const ty = ey + idx * lineH + halfLeading;

        if (el.effects?.fxStroke && (el.effects.fxStrokeWidth ?? 0) > 0) {
          ctx.save();
          ctx.strokeStyle = el.effects.fxStrokeColor || '#0f172a';
          ctx.lineWidth = ((el.effects.fxStrokeWidth || 1) * dpi * 2) / 72;
          ctx.lineJoin = 'round';
          ctx.strokeText(line, tx, ty);
          ctx.restore();
        }

        ctx.fillText(line, tx, ty);

        // Optional underline / line-through decoration
        if (
          el.textDecoration &&
          el.textDecoration !== 'none' &&
          line.trim().length > 0
        ) {
          const lineW = ctx.measureText(line).width;
          let lineStartX = tx;
          if (el.textAlign === 'center') lineStartX = tx - lineW / 2;
          else if (el.textAlign === 'right') lineStartX = tx - lineW;

          const decY =
            el.textDecoration === 'underline'
              ? ty + fontPx * 0.92
              : ty + fontPx * 0.52;
          ctx.save();
          ctx.strokeStyle = el.color || '#0f172a';
          ctx.lineWidth = Math.max(1, fontPx * 0.06);
          ctx.beginPath();
          ctx.moveTo(lineStartX, decY);
          ctx.lineTo(lineStartX + lineW, decY);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders a complete sheet page (including all N-up imposition slots and crop marks) to a high-res Canvas
 */
export async function renderSheetPageToCanvas(
  project: PrintProject,
  sideOrPageIndex: 'front' | 'back' | number = 0,
  dpi: number = 220,
  overrideSheetSeqIndex?: number
): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font readiness errors
    }
  }
  const { template } = project;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(template.sheetWidthIn * dpi);
  canvas.height = Math.round(template.sheetHeightIn * dpi);
  const ctx = canvas.getContext('2d')!;

  // White paper sheet
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const resolvedPageIdx =
    typeof sideOrPageIndex === 'number'
      ? sideOrPageIndex
      : Math.max(
          0,
          project.pages.findIndex((p) => p.side === sideOrPageIndex)
        );

  const pageObj =
    typeof sideOrPageIndex === 'number'
      ? project.pages[sideOrPageIndex] || project.pages[0]
      : project.pages.find((p) => p.side === sideOrPageIndex) || project.pages[0];

  const baseMaster =
    pageObj
      ? project.masters[pageObj.masterId]
      : sideOrPageIndex === 'back'
      ? project.masters['master-b']
      : project.masters['master-a'];

  const { widthIn: unitW, heightIn: unitH } = getDesignUnitSize(template);

  if (template.imposition) {
    const {
      cols,
      rows,
      marginLeftIn,
      marginTopIn,
      gapXIn,
      gapYIn,
      innerPaddingXIn = 0,
      innerPaddingYIn = 0,
    } = template.imposition;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const slotIdx = r * cols + c;
        const slotMaster = pageObj?.slotOverrides?.[slotIdx] || baseMaster;
        const slotX = (marginLeftIn + c * (unitW + gapXIn)) * dpi;
        const slotY = (marginTopIn + r * (unitH + gapYIn)) * dpi;
        await renderMasterUnitToContext(
          ctx,
          slotMaster,
          slotX,
          slotY,
          unitW,
          unitH,
          dpi,
          project,
          resolvedPageIdx,
          slotIdx,
          overrideSheetSeqIndex
        );

        // If non-bleed inner white padding is active, draw clean white margin bands inside the slot edges
        if (innerPaddingXIn > 0 || innerPaddingYIn > 0) {
          const padXPx = innerPaddingXIn * dpi;
          const padYPx = innerPaddingYIn * dpi;
          const slotWPx = unitW * dpi;
          const slotHPx = unitH * dpi;
          ctx.fillStyle = '#ffffff';
          if (padXPx > 0) {
            ctx.fillRect(slotX, slotY, padXPx, slotHPx);
            ctx.fillRect(slotX + slotWPx - padXPx, slotY, padXPx, slotHPx);
          }
          if (padYPx > 0) {
            ctx.fillRect(slotX, slotY, slotWPx, padYPx);
            ctx.fillRect(slotX, slotY + slotHPx - padYPx, slotWPx, padYPx);
          }
        }
      }
    }

    // Draw professional trim/crop marks around the N-up grid (including double marks when H/V spacing > 0)
    if (project.showCropMarks) {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.max(1, dpi / 150);
      const markLen = 0.18 * dpi;
      const markOffset = 0.06 * dpi;

      const xCutPositions = new Set<number>();
      for (let c = 0; c < cols; c++) {
        const leftEdge = marginLeftIn + c * (unitW + gapXIn);
        const rightEdge = leftEdge + unitW;
        xCutPositions.add(Number(leftEdge.toFixed(4)));
        xCutPositions.add(Number(rightEdge.toFixed(4)));
        if (c < cols - 1 && gapXIn > 0.001) {
          xCutPositions.add(Number((rightEdge + gapXIn / 2).toFixed(4)));
        }
      }

      const yCutPositions = new Set<number>();
      for (let r = 0; r < rows; r++) {
        const topEdge = marginTopIn + r * (unitH + gapYIn);
        const botEdge = topEdge + unitH;
        yCutPositions.add(Number(topEdge.toFixed(4)));
        yCutPositions.add(Number(botEdge.toFixed(4)));
        if (r < rows - 1 && gapYIn > 0.001) {
          yCutPositions.add(Number((botEdge + gapYIn / 2).toFixed(4)));
        }
      }

      const topY = marginTopIn * dpi;
      const botY = (marginTopIn + rows * unitH + (rows - 1) * gapYIn) * dpi;
      const leftX = marginLeftIn * dpi;
      const rightX = (marginLeftIn + cols * unitW + (cols - 1) * gapXIn) * dpi;

      xCutPositions.forEach((xIn) => {
        const x = xIn * dpi;
        ctx.beginPath();
        ctx.moveTo(x, topY - markOffset - markLen);
        ctx.lineTo(x, topY - markOffset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, botY + markOffset);
        ctx.lineTo(x, botY + markOffset + markLen);
        ctx.stroke();
      });

      yCutPositions.forEach((yIn) => {
        const y = yIn * dpi;
        ctx.beginPath();
        ctx.moveTo(leftX - markOffset - markLen, y);
        ctx.lineTo(leftX - markOffset, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rightX + markOffset, y);
        ctx.lineTo(rightX + markOffset + markLen, y);
        ctx.stroke();
      });
    }
  } else {
    // Full-sheet template (e.g. 8.5x11, 3 Bank Tabs, Business Card Single, Envelope)
    const slotMaster = pageObj?.slotOverrides?.[0] || baseMaster;
    await renderMasterUnitToContext(
      ctx,
      slotMaster,
      0,
      0,
      unitW,
      unitH,
      dpi,
      project,
      resolvedPageIdx,
      0,
      overrideSheetSeqIndex
    );
  }

  // Render Bank Tab Ears & Custom Typed Tab Names along the right tab extension (e.g. 8.5" to 9.0" on 9x11 tab stock)
  const bankTabCount =
    project.bankTabConfig?.enabled === false
      ? 0
      : project.bankTabConfig?.count || template.bankTabs || 0;

  if (bankTabCount > 0) {
    const tabCfg = project.bankTabConfig;
    const tabExtIn = tabCfg?.tabExtensionIn || 0.5;
    const tabExtPx = tabExtIn * dpi;
    const earLeftX = canvas.width - tabExtPx;
    const shoulderIn = 0.25;
    const notchGapIn = 0.06;
    const usableHeightIn = Math.max(1, template.sheetHeightIn - shoulderIn * 2);
    const singleTabHeightIn =
      (usableHeightIn - notchGapIn * Math.max(0, bankTabCount - 1)) /
      bankTabCount;

    const isSingleTabMode = tabCfg?.displayMode === 'single-tab-per-page';
    const activeTabForPage =
      pageObj?.activeTabIndex !== undefined
        ? pageObj.activeTabIndex
        : resolvedPageIdx % bankTabCount;

    ctx.save();
    // Clear the 0.5" tab bank strip on the right edge first so die-cut notches stay clean
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(earLeftX, 0, tabExtPx, canvas.height);

    // Subtle vertical body-to-tab fold/trim line at 8.5" (canvas.width - tabExtPx)
    if (project.showCropMarks) {
      ctx.save();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1, dpi / 180);
      ctx.setLineDash([0.06 * dpi, 0.04 * dpi]);
      ctx.beginPath();
      ctx.moveTo(earLeftX, 0);
      ctx.lineTo(earLeftX, canvas.height);
      ctx.stroke();
      ctx.restore();
    }

    for (let tIdx = 0; tIdx < bankTabCount; tIdx++) {
      if (isSingleTabMode && tIdx !== activeTabForPage) {
        continue;
      }
      const tabTopIn = shoulderIn + tIdx * (singleTabHeightIn + notchGapIn);
      const tabY = tabTopIn * dpi;
      const tabH = singleTabHeightIn * dpi;
      const fillCol = tabCfg?.colors?.[tIdx] || '#ffffff';
      const txtCol = tabCfg?.textColors?.[tIdx] || '#0f172a';
      const labelTxt =
        tabCfg?.labels?.[tIdx] !== undefined
          ? tabCfg.labels[tIdx]
          : `Tab ${tIdx + 1}`;
      const rPx = Math.min(0.1 * dpi, tabExtPx * 0.35);

      // Draw rounded-right tab ear shape
      ctx.beginPath();
      ctx.moveTo(earLeftX, tabY);
      ctx.lineTo(canvas.width - rPx, tabY);
      ctx.quadraticCurveTo(canvas.width, tabY, canvas.width, tabY + rPx);
      ctx.lineTo(canvas.width, tabY + tabH - rPx);
      ctx.quadraticCurveTo(
        canvas.width,
        tabY + tabH,
        canvas.width - rPx,
        tabY + tabH
      );
      ctx.lineTo(earLeftX, tabY + tabH);
      ctx.closePath();

      ctx.fillStyle = fillCol;
      ctx.fill();

      ctx.strokeStyle = project.showCropMarks ? '#94a3b8' : '#e2e8f0';
      ctx.lineWidth = Math.max(1, dpi / 160);
      ctx.stroke();

      // Draw rotated Tab Name centered inside the tab ear
      if (labelTxt.trim().length > 0) {
        const fontPt = tabCfg?.fontSizePt || 9.5;
        const fontPx = (fontPt * dpi) / 72;
        ctx.save();
        ctx.translate(earLeftX + tabExtPx / 2, tabY + tabH / 2);
        // Rotate 90deg clockwise (standard binder tab reading top-to-bottom on right-hand tabs)
        ctx.rotate(Math.PI / 2);
        ctx.font = `700 ${fontPx}px "Inter", sans-serif`;
        ctx.fillStyle = txtCol;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelTxt, 0, 0, Math.max(10, tabH - 0.16 * dpi));
        ctx.restore();
      }
    }
    ctx.restore();
  }

  return canvas;
}

/**
 * Exports the project as a print-ready PDF (supports multi-page booklets, N-up sheets, 2-sided designs, and multi-sheet sequential numbering runs)
 */
export async function exportPrintReadyPdf(
  project: PrintProject,
  includeBackSide: boolean = true
): Promise<void> {
  const { sheetWidthIn, sheetHeightIn, orientation } = project.template;
  const pdf = new jsPDF({
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'in',
    format: [sheetWidthIn, sheetHeightIn],
  });

  const slotsPerSheet = project.template.imposition
    ? Math.max(
        1,
        project.template.imposition.cols * project.template.imposition.rows
      )
    : 1;

  const hasVariableData =
    Boolean(project.numbering?.enabled) ||
    Boolean(
      project.mailMerge?.enabled && (project.mailMerge?.records?.length || 0) > 0
    ) ||
    project.masters['master-a'].elements.some(
      (e) =>
        e.isSequentialNumber ||
        (e.text && e.text.includes('{{') && e.text.includes('}}'))
    ) ||
    project.masters['master-b'].elements.some(
      (e) =>
        e.isSequentialNumber ||
        (e.text && e.text.includes('{{') && e.text.includes('}}'))
    );

  const frontPages = project.pages.filter((p) => p.side === 'front');
  const mailMergeSheetsNeeded =
    project.mailMerge?.enabled && project.mailMerge.records.length > 0
      ? Math.ceil(project.mailMerge.records.length / slotsPerSheet)
      : 1;
  const requestedBatchSheets = Math.max(
    project.numbering?.totalSheets || 1,
    mailMergeSheetsNeeded
  );

  // If sequential numbering or mail merge is active with a batch sheet count > existing front pages, export all sheets automatically!
  if (hasVariableData && requestedBatchSheets > frontPages.length) {
    let addedFirstPage = false;
    const backTemplatePage = project.pages.find((p) => p.side === 'back');
    const backMasterHasContent =
      (project.masters['master-b']?.elements?.length || 0) > 0 ||
      Boolean(
        backTemplatePage?.slotOverrides &&
          Object.keys(backTemplatePage.slotOverrides).length > 0
      );

    for (let sheetIdx = 0; sheetIdx < requestedBatchSheets; sheetIdx++) {
      if (addedFirstPage) {
        pdf.addPage([sheetWidthIn, sheetHeightIn], orientation);
      }
      const frontCanvas = await renderSheetPageToCanvas(
        project,
        0,
        240,
        sheetIdx
      );
      pdf.addImage(
        frontCanvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        sheetWidthIn,
        sheetHeightIn
      );
      addedFirstPage = true;

      if (includeBackSide && backTemplatePage && backMasterHasContent) {
        pdf.addPage([sheetWidthIn, sheetHeightIn], orientation);
        const backPageIdx = project.pages.findIndex((p) => p.side === 'back');
        const backCanvas = await renderSheetPageToCanvas(
          project,
          backPageIdx >= 0 ? backPageIdx : 'back',
          240,
          sheetIdx
        );
        pdf.addImage(
          backCanvas.toDataURL('image/png'),
          'PNG',
          0,
          0,
          sheetWidthIn,
          sheetHeightIn
        );
      }
    }
  } else {
    const pagesToExport = includeBackSide
      ? project.pages
      : project.pages.filter((p, idx) => p.side === 'front' || idx === 0);
    const hasBankTabs =
      project.bankTabConfig?.enabled !== false &&
      Boolean(project.bankTabConfig?.count || project.template.bankTabs);

    let exportedCount = 0;
    for (let i = 0; i < pagesToExport.length; i++) {
      const pg = pagesToExport[i];
      const realPageIdx = project.pages.findIndex((p) => p.id === pg.id);
      const hasOverrideContent =
        pg.slotOverrides && Object.keys(pg.slotOverrides).length > 0;
      const masterElements = project.masters[pg.masterId]?.elements || [];
      if (
        exportedCount > 0 &&
        !hasOverrideContent &&
        masterElements.length === 0 &&
        !(hasBankTabs && pg.side === 'front')
      ) {
        continue;
      }
      if (exportedCount > 0) {
        pdf.addPage([sheetWidthIn, sheetHeightIn], orientation);
      }
      const pageCanvas = await renderSheetPageToCanvas(
        project,
        realPageIdx >= 0 ? realPageIdx : i,
        240
      );
      const pageDataUrl = pageCanvas.toDataURL('image/png');
      pdf.addImage(pageDataUrl, 'PNG', 0, 0, sheetWidthIn, sheetHeightIn);
      exportedCount++;
    }
  }

  const safeTitle = project.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  pdf.save(`${safeTitle}_PrintReady.pdf`);
}
