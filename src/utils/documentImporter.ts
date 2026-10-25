import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import {
  CanvasElement,
  MasterDesign,
  PrintProject,
  PrintTemplate,
  ProjectPage,
} from '../types/printstudio';
import { getDesignUnitSize } from '../data/templates';

// Configure PDF.js worker using Vite's asset URL resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ImportedPageItem {
  pageNumber: number;
  title: string;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  extractedTextLines: string[];
}

export interface ImportedDocumentBundle {
  fileName: string;
  fileType: 'pdf' | 'docx' | 'image' | 'svg' | 'txt';
  pages: ImportedPageItem[];
}

export type ImpositionMode =
  | 'repeat-multi-up' // Repeat Page 1 on Front slots, Page 2 on Back slots (e.g., 10-up Business Cards, 4-up Postcards, 2-up Half-Sheet Flyers)
  | 'booklet-saddle' // True Saddle-Stitch Printer Spreads (Page N + Page 1, Page 2 + Page N-1)
  | 'booklet-reader' // Reader Spreads (2 pages side-by-side in sequential order: 1+2, 3+4)
  | 'sequential-multi-up' // Place Page 1 in Slot 1, Page 2 in Slot 2, etc.
  | 'single-per-sheet'; // 1 imported page per sheet page

export type PageScalingMode = 'fit' | 'fill' | 'margin';

/**
 * Parses and renders a PDF file into high-resolution page images + extracted text lines
 */
async function importPdfFile(file: File): Promise<ImportedDocumentBundle> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: ImportedPageItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.2 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    // Also extract text content so user can optionally make text boxes editable
    let textLines: string[] = [];
    try {
      const textContent = await page.getTextContent();
      const rawStrings = textContent.items
        .map((item) => ('str' in item ? item.str.trim() : ''))
        .filter(Boolean);
      textLines = rawStrings.slice(0, 25);
    } catch {
      // Ignore text extraction errors on pure raster PDFs
    }

    pages.push({
      pageNumber: i,
      title: `Page ${i}`,
      dataUrl: canvas.toDataURL('image/png'),
      widthPx: canvas.width,
      heightPx: canvas.height,
      extractedTextLines: textLines,
    });
  }

  return {
    fileName: file.name,
    fileType: 'pdf',
    pages,
  };
}

/**
 * Renders an array of text paragraphs into paginated high-res document pages
 * (used for Word .docx and .txt/.md imports)
 */
function renderTextParagraphsToPages(
  fileName: string,
  fileType: 'docx' | 'txt',
  paragraphs: string[]
): ImportedDocumentBundle {
  const cleanParas = paragraphs.map((p) => p.trim()).filter(Boolean);
  const parasPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(cleanParas.length / parasPerPage));
  const pages: ImportedPageItem[] = [];

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const slice = cleanParas.slice(
      pIdx * parasPerPage,
      (pIdx + 1) * parasPerPage
    );
    const canvas = document.createElement('canvas');
    canvas.width = 1020;
    canvas.height = 1320;
    const ctx = canvas.getContext('2d')!;

    // Clean document page background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle header accent
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(72, 64, canvas.width - 144, 4);

    let cursorY = 110;
    slice.forEach((para, idx) => {
      const isHeading = idx === 0 && pIdx === 0;
      ctx.fillStyle = isHeading ? '#0f172a' : '#334155';
      ctx.font = isHeading
        ? 'bold 34px Inter, sans-serif'
        : '400 21px Inter, sans-serif';

      // Word-wrap paragraph
      const words = para.split(/\s+/);
      let line = '';
      const maxWidth = canvas.width - 144;
      const lineHeight = isHeading ? 44 : 32;

      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth) {
          ctx.fillText(line, 72, cursorY);
          line = word;
          cursorY += lineHeight;
        } else {
          line = test;
        }
      }
      if (line) {
        ctx.fillText(line, 72, cursorY);
        cursorY += lineHeight + 18;
      }
    });

    // Page number footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Page ${pIdx + 1} of ${totalPages}`,
      canvas.width / 2,
      canvas.height - 48
    );

    pages.push({
      pageNumber: pIdx + 1,
      title: `Doc Page ${pIdx + 1}`,
      dataUrl: canvas.toDataURL('image/png'),
      widthPx: canvas.width,
      heightPx: canvas.height,
      extractedTextLines: slice,
    });
  }

  return {
    fileName,
    fileType,
    pages,
  };
}

/**
 * Universal File Importer: Supports .pdf, .docx, .txt/.md, .svg, .png, .jpg, .webp
 */
export async function importFilesToBundle(
  fileList: FileList | File[]
): Promise<ImportedDocumentBundle> {
  const files = Array.from(fileList);
  if (files.length === 0) {
    throw new Error('No files selected');
  }

  const first = files[0];
  const lowerName = first.name.toLowerCase();

  // 1. PDF Import
  if (lowerName.endsWith('.pdf') || first.type === 'application/pdf') {
    return importPdfFile(first);
  }

  // 2. Word (.docx) Import via Mammoth
  if (
    lowerName.endsWith('.docx') ||
    first.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const arrayBuffer = await first.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const paras = result.value
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return renderTextParagraphsToPages(
      first.name,
      'docx',
      paras.length > 0 ? paras : [first.name, 'Imported Word Document']
    );
  }

  // 3. Plain Text / Markdown / RTF Import
  if (
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.rtf')
  ) {
    const text = await first.text();
    const paras = text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return renderTextParagraphsToPages(first.name, 'txt', paras);
  }

  // 4. Single or Multiple Images / SVGs (each image becomes a page in the bundle!)
  const imagePages: ImportedPageItem[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(f);
    });

    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width || 1050, h: img.height || 600 });
      img.onerror = () => resolve({ w: 1050, h: 600 });
      img.src = dataUrl;
    });

    imagePages.push({
      pageNumber: i + 1,
      title: f.name,
      dataUrl,
      widthPx: dims.w,
      heightPx: dims.h,
      extractedTextLines: [],
    });
  }

  return {
    fileName: files.length === 1 ? first.name : `${files.length} Design Files`,
    fileType: lowerName.endsWith('.svg') ? 'svg' : 'image',
    pages: imagePages,
  };
}

/**
 * Converts a single ImportedPageItem into a MasterDesign unit of size (unitW x unitH inches)
 */
function buildMasterFromImportedPage(
  page: ImportedPageItem | undefined,
  unitW: number,
  unitH: number,
  scalingMode: PageScalingMode,
  marginXIn: number,
  marginYIn: number,
  includeEditableTextOverlay: boolean
): MasterDesign {
  if (!page) {
    return {
      id: 'master-a',
      name: 'Blank Sheet Panel',
      backgroundColor: '#ffffff',
      elements: [],
    };
  }

  let x = 0;
  let y = 0;
  let w = unitW;
  let h = unitH;

  if (scalingMode === 'margin') {
    x = marginXIn;
    y = marginYIn;
    w = Math.max(0.5, unitW - marginXIn * 2);
    h = Math.max(0.5, unitH - marginYIn * 2);
  } else if (scalingMode === 'fit') {
    const srcRatio = page.widthPx / Math.max(1, page.heightPx);
    const dstRatio = unitW / Math.max(0.1, unitH);
    if (srcRatio > dstRatio) {
      w = unitW;
      h = Number((unitW / srcRatio).toFixed(3));
      x = 0;
      y = Number(((unitH - h) / 2).toFixed(3));
    } else {
      h = unitH;
      w = Number((unitH * srcRatio).toFixed(3));
      y = 0;
      x = Number(((unitW - w) / 2).toFixed(3));
    }
  }

  const elements: CanvasElement[] = [
    {
      id: `imp-page-img-${page.pageNumber}-${Date.now()}`,
      type: 'image',
      role: 'background',
      name: `Imported ${page.title}`,
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      opacity: 1,
      imageUrl: page.dataUrl,
    },
  ];

  // If user also requested editable text boxes extracted from the PDF/Doc
  if (includeEditableTextOverlay && page.extractedTextLines.length > 0) {
    page.extractedTextLines.slice(0, 6).forEach((line, idx) => {
      elements.push({
        id: `imp-txt-${page.pageNumber}-${idx}-${Date.now()}`,
        type: 'text',
        role: idx === 0 ? 'company' : 'body',
        name: `Extracted Text ${idx + 1}`,
        x: Number((unitW * 0.08).toFixed(2)),
        y: Number((unitH * (0.12 + idx * 0.13)).toFixed(2)),
        width: Number((unitW * 0.84).toFixed(2)),
        height: Number((unitH * 0.11).toFixed(2)),
        rotation: 0,
        opacity: 1,
        text: line,
        fontFamily: 'Inter',
        fontSize: idx === 0 ? 13 : 9.5,
        fontWeight: idx === 0 ? '700' : '500',
        color: '#0f172a',
        highlightColor: '#ffffffd9',
        textAlign: 'left',
      });
    });
  }

  return {
    id: 'master-a',
    name: page.title,
    backgroundColor: '#ffffff',
    elements,
  };
}

/**
 * Builds a complete PrintProject from an ImportedDocumentBundle using the chosen
 * ImpositionMode (Repeat Multi-Up, Saddle-Stitch Booklet, Reader Booklet, Sequential Multi-Up, or 1-Per-Sheet)
 */
export function buildImposedProjectFromImport(params: {
  bundle: ImportedDocumentBundle;
  targetTemplate: PrintTemplate;
  impositionMode: ImpositionMode;
  scalingMode: PageScalingMode;
  includeEditableTextOverlay: boolean;
}): PrintProject {
  const {
    bundle,
    targetTemplate,
    impositionMode,
    scalingMode,
    includeEditableTextOverlay,
  } = params;

  const { widthIn: unitW, heightIn: unitH } = getDesignUnitSize(targetTemplate);
  const mx = targetTemplate.defaultMarginXIn;
  const my = targetTemplate.defaultMarginYIn;

  const masterA = buildMasterFromImportedPage(
    bundle.pages[0],
    unitW,
    unitH,
    scalingMode,
    mx,
    my,
    includeEditableTextOverlay
  );
  masterA.id = 'master-a';
  masterA.name = 'Master A (Front)';

  const masterB = buildMasterFromImportedPage(
    bundle.pages[1] || bundle.pages[0],
    unitW,
    unitH,
    scalingMode,
    mx,
    my,
    includeEditableTextOverlay
  );
  masterB.id = 'master-b';
  masterB.name = 'Master B (Back)';

  const projectPages: ProjectPage[] = [];

  // MODE 1: Repeat Multi-Up (e.g. 10-up Business Card, 4-up Postcard, 2-up Flyer)
  if (impositionMode === 'repeat-multi-up') {
    projectPages.push({
      id: 'page-front-1',
      name: 'Sheet 1 — Front (Master A)',
      side: 'front',
      masterId: 'master-a',
      ignoreMaster: false,
      pageElements: [],
    });
    if (bundle.pages.length >= 2) {
      projectPages.push({
        id: 'page-back-1',
        name: 'Sheet 1 — Back (Master B)',
        side: 'back',
        masterId: 'master-b',
        ignoreMaster: false,
        pageElements: [],
      });
    }
  }
  // MODE 2: Saddle-Stitch Booklet Imposition (Pairs [Page N | Page 1], [Page 2 | Page N-1], etc.)
  else if (impositionMode === 'booklet-saddle') {
    const totalRaw = bundle.pages.length;
    const paddedTotal = Math.max(4, Math.ceil(totalRaw / 4) * 4);
    const sheetsCount = paddedTotal / 4;

    for (let s = 0; s < sheetsCount; s++) {
      // Front of Sheet s: Left = (paddedTotal - 2*s), Right = (1 + 2*s)
      const leftFrontIdx = paddedTotal - 1 - 2 * s;
      const rightFrontIdx = 2 * s;

      // Back of Sheet s: Left = (2 + 2*s), Right = (paddedTotal - 1 - 2*s)
      const leftBackIdx = 2 * s + 1;
      const rightBackIdx = paddedTotal - 2 - 2 * s;

      projectPages.push({
        id: `booklet-sheet-${s + 1}-front`,
        name: `Sheet ${s + 1} Front (Pages ${leftFrontIdx + 1} & ${
          rightFrontIdx + 1
        })`,
        side: 'front',
        masterId: 'master-a',
        ignoreMaster: false,
        pageElements: [],
        slotOverrides: {
          0: buildMasterFromImportedPage(
            bundle.pages[leftFrontIdx],
            unitW,
            unitH,
            scalingMode,
            mx,
            my,
            includeEditableTextOverlay
          ),
          1: buildMasterFromImportedPage(
            bundle.pages[rightFrontIdx],
            unitW,
            unitH,
            scalingMode,
            mx,
            my,
            includeEditableTextOverlay
          ),
        },
      });

      projectPages.push({
        id: `booklet-sheet-${s + 1}-back`,
        name: `Sheet ${s + 1} Back (Pages ${leftBackIdx + 1} & ${
          rightBackIdx + 1
        })`,
        side: 'back',
        masterId: 'master-b',
        ignoreMaster: false,
        pageElements: [],
        slotOverrides: {
          0: buildMasterFromImportedPage(
            bundle.pages[leftBackIdx],
            unitW,
            unitH,
            scalingMode,
            mx,
            my,
            includeEditableTextOverlay
          ),
          1: buildMasterFromImportedPage(
            bundle.pages[rightBackIdx],
            unitW,
            unitH,
            scalingMode,
            mx,
            my,
            includeEditableTextOverlay
          ),
        },
      });
    }
  }
  // MODE 3: Booklet Reader Spreads (Sequential 2-up: [1 | 2], [3 | 4], ...)
  else if (impositionMode === 'booklet-reader') {
    const spreadsCount = Math.ceil(bundle.pages.length / 2);
    for (let s = 0; s < spreadsCount; s++) {
      const pLeft = bundle.pages[s * 2];
      const pRight = bundle.pages[s * 2 + 1];
      projectPages.push({
        id: `spread-${s + 1}`,
        name: `Spread ${s + 1} (Pages ${s * 2 + 1}–${s * 2 + 2})`,
        side: s % 2 === 0 ? 'front' : 'back',
        masterId: 'master-a',
        ignoreMaster: false,
        pageElements: [],
        slotOverrides: {
          0: buildMasterFromImportedPage(
            pLeft,
            unitW,
            unitH,
            scalingMode,
            mx,
            my,
            includeEditableTextOverlay
          ),
          1: buildMasterFromImportedPage(
            pRight,
            unitW,
            unitH,
            scalingMode,
            mx,
            my,
            includeEditableTextOverlay
          ),
        },
      });
    }
  }
  // MODE 4: Sequential Multi-Up (Page 1 -> Slot 1, Page 2 -> Slot 2, etc.)
  else if (impositionMode === 'sequential-multi-up' && targetTemplate.imposition) {
    const slotsPerSheet =
      targetTemplate.imposition.cols * targetTemplate.imposition.rows;
    const totalSheets = Math.max(
      1,
      Math.ceil(bundle.pages.length / slotsPerSheet)
    );

    for (let sh = 0; sh < totalSheets; sh++) {
      const overrides: Record<number, MasterDesign> = {};
      for (let slot = 0; slot < slotsPerSheet; slot++) {
        const pageItem =
          bundle.pages[(sh * slotsPerSheet + slot) % bundle.pages.length];
        overrides[slot] = buildMasterFromImportedPage(
          pageItem,
          unitW,
          unitH,
          scalingMode,
          mx,
          my,
          includeEditableTextOverlay
        );
      }
      projectPages.push({
        id: `seq-sheet-${sh + 1}`,
        name: `Sheet ${sh + 1} (${slotsPerSheet}-Up Collated)`,
        side: sh % 2 === 0 ? 'front' : 'back',
        masterId: 'master-a',
        ignoreMaster: false,
        pageElements: [],
        slotOverrides: overrides,
      });
    }
  }
  // MODE 5: 1 Imported Page Per Sheet
  else {
    bundle.pages.forEach((pg, idx) => {
      projectPages.push({
        id: `sheet-page-${idx + 1}`,
        name: `Page ${idx + 1} (${pg.title})`,
        side: idx % 2 === 0 ? 'front' : 'back',
        masterId: idx === 1 ? 'master-b' : 'master-a',
        ignoreMaster: false,
        pageElements: [],
        slotOverrides: {
          0: buildMasterFromImportedPage(
            pg,
            unitW,
            unitH,
            scalingMode,
            mx,
            my,
            includeEditableTextOverlay
          ),
        },
      });
    });
  }

  return {
    id: `proj-import-${Date.now()}`,
    title: `${bundle.fileName.replace(/\.[^.]+$/, '')} — ${targetTemplate.name}`,
    template: targetTemplate,
    bleedIn: targetTemplate.defaultBleedIn,
    marginXIn: targetTemplate.defaultMarginXIn,
    marginYIn: targetTemplate.defaultMarginYIn,
    showCropMarks: true,
    showBleedGuide: true,
    showMarginGuide: true,
    showGridLines: true,
    relativeToMargin: false,
    masters: {
      'master-a': masterA,
      'master-b': masterB,
    },
    pages: projectPages,
  };
}

/**
 * Generates realistic multi-page sample documents (4-Page Booklet PDF/Doc, 2-Sided Business Card PDF, Promo Flyer)
 * so the user can test Booklet & Multi-Up Quick Import with 1 click!
 */
export function generateSampleImportBundle(
  preset: 'booklet-4page' | 'bcard-2sided' | 'flyer-2up'
): ImportedDocumentBundle {
  if (preset === 'booklet-4page') {
    const pagesData = [
      {
        title: 'Page 1 — Front Cover',
        bg: '#0f172a',
        accent: '#eab308',
        heading: '2026 ANNUAL CHARITY GALA',
        sub: 'EVENING PROGRAM & AUCTION GUIDE',
        lines: [
          'Saturday, November 14th • 6:00 PM',
          'The Grand Ballroom at Symphony Hall',
          'Black Tie Optional • Hosted by Geppy Foundation',
        ],
      },
      {
        title: 'Page 2 — Inside Left (Schedule)',
        bg: '#ffffff',
        accent: '#b91c1c',
        heading: 'ORDER OF EVENTS',
        sub: 'EVENING SCHEDULE',
        lines: [
          '6:00 PM — Welcome Cocktail Reception',
          '7:00 PM — Opening Remarks & Keynote',
          '7:30 PM — Three-Course Gala Dinner',
          '8:45 PM — Live Charity Auction',
          '9:30 PM — Live Jazz Orchestra & Dancing',
        ],
      },
      {
        title: 'Page 3 — Inside Right (Menu)',
        bg: '#ffffff',
        accent: '#b91c1c',
        heading: 'CHEF’S DINNER MENU',
        sub: 'AUTUMN HARVEST SELECTION',
        lines: [
          'First Course: Roasted Butternut Squash Bisque',
          'Main Entrée: Herb-Crusted Filet Mignon & Wild Salmon',
          'Dessert: Dark Chocolate Gold Leaf Torte',
          'Paired with Reserve Napa Valley Wines',
        ],
      },
      {
        title: 'Page 4 — Back Cover (Sponsors)',
        bg: '#1e293b',
        accent: '#eab308',
        heading: 'THANK YOU TO OUR SPONSORS',
        sub: 'PLATINUM & GOLD PARTNERS',
        lines: [
          '• Geppy’s Commercial PrintStudio',
          '• Sterling & Vance Financial Group',
          '• Apex Architecture & Engineering',
          'www.charitygala2026.org • Printed in USA',
        ],
      },
    ];

    const pages: ImportedPageItem[] = pagesData.map((p, idx) => {
      const c = document.createElement('canvas');
      c.width = 825;
      c.height = 1275; // 5.5 x 8.5 aspect ratio at 150dpi
      const ctx = c.getContext('2d')!;

      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, c.width, c.height);

      // Decorative border
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 6;
      ctx.strokeRect(42, 42, c.width - 84, c.height - 84);

      const isDark = p.bg !== '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillStyle = p.accent;
      ctx.font = 'bold 22px Montserrat, sans-serif';
      ctx.fillText(p.sub, c.width / 2, 240);

      ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
      ctx.font = '800 40px Playfair Display, Georgia, serif';
      ctx.fillText(p.heading, c.width / 2, 310);

      // Divider
      ctx.fillStyle = p.accent;
      ctx.fillRect(c.width / 2 - 90, 355, 180, 4);

      ctx.font = '500 26px Inter, sans-serif';
      ctx.fillStyle = isDark ? '#e2e8f0' : '#334155';
      p.lines.forEach((line, lIdx) => {
        ctx.fillText(line, c.width / 2, 470 + lIdx * 78);
      });

      // Footer page badge
      ctx.fillStyle = p.accent;
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText(`— Page ${idx + 1} —`, c.width / 2, c.height - 90);

      return {
        pageNumber: idx + 1,
        title: p.title,
        dataUrl: c.toDataURL('image/png'),
        widthPx: c.width,
        heightPx: c.height,
        extractedTextLines: [p.heading, p.sub, ...p.lines],
      };
    });

    return {
      fileName: 'Charity_Gala_4Page_Booklet.pdf',
      fileType: 'pdf',
      pages,
    };
  }

  if (preset === 'bcard-2sided') {
    // 2-page PDF (Front & Back Business Card) ready for 10-up or 24-up imposition
    const makeCardPage = (isFront: boolean): ImportedPageItem => {
      const c = document.createElement('canvas');
      c.width = 1050;
      c.height = 600;
      const ctx = c.getContext('2d')!;

      if (isFront) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1050, 600);
        ctx.fillStyle = '#0f766e';
        ctx.fillRect(0, 0, 1050, 175);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(0, 175, 1050, 14);

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 38px Montserrat, sans-serif';
        ctx.fillText('SUMMIT HVAC & MECHANICAL', 65, 95);
        ctx.fillStyle = '#fef08a';
        ctx.font = '600 20px Inter, sans-serif';
        ctx.fillText('HEATING • COOLING • COMMERCIAL REFRIGERATION', 65, 138);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 42px Inter, sans-serif';
        ctx.fillText('Derek Reynolds', 65, 290);
        ctx.fillStyle = '#0f766e';
        ctx.font = '600 25px Inter, sans-serif';
        ctx.fillText('Master HVAC Technician • EPA Certified', 65, 332);

        ctx.fillStyle = '#334155';
        ctx.font = '500 23px Inter, sans-serif';
        ctx.fillText('24/7 Dispatch: (555) 410-8822', 65, 425);
        ctx.fillText('Email: service@summithvacpro.com', 65, 470);
        ctx.fillText('850 Commerce Blvd • www.summithvacpro.com', 65, 515);
      } else {
        ctx.fillStyle = '#0f766e';
        ctx.fillRect(0, 0, 1050, 600);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(0, 540, 1050, 60);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 44px Montserrat, sans-serif';
        ctx.fillText('SUMMIT HVAC & MECHANICAL', 525, 250);
        ctx.fillStyle = '#fef08a';
        ctx.font = '600 26px Inter, sans-serif';
        ctx.fillText('$50 OFF ANY SEASONAL SYSTEM TUNE-UP', 525, 320);
        ctx.fillStyle = '#ffffff';
        ctx.font = '500 24px Inter, sans-serif';
        ctx.fillText('www.summithvacpro.com • (555) 410-8822', 525, 390);
      }

      return {
        pageNumber: isFront ? 1 : 2,
        title: isFront ? 'Page 1 (Card Front)' : 'Page 2 (Card Back)',
        dataUrl: c.toDataURL('image/png'),
        widthPx: 1050,
        heightPx: 600,
        extractedTextLines: isFront
          ? [
              'SUMMIT HVAC & MECHANICAL',
              'Derek Reynolds',
              'Master HVAC Technician',
              '(555) 410-8822',
              'service@summithvacpro.com',
            ]
          : [
              'SUMMIT HVAC & MECHANICAL',
              '$50 OFF ANY SEASONAL SYSTEM TUNE-UP',
              'www.summithvacpro.com',
            ],
      };
    };

    return {
      fileName: 'Summit_HVAC_2Sided_Card.pdf',
      fileType: 'pdf',
      pages: [makeCardPage(true), makeCardPage(false)],
    };
  }

  // flyer-2up
  const c = document.createElement('canvas');
  c.width = 825;
  c.height = 1275;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fffbeb';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(0, 0, c.width, 260);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 54px Montserrat, sans-serif';
  ctx.fillText('GRAND OPENING SALE', c.width / 2, 130);
  ctx.fillStyle = '#fef08a';
  ctx.font = '700 28px Inter, sans-serif';
  ctx.fillText('TAKE 30% OFF ALL CUSTOM PRINTING ORDERS', c.width / 2, 195);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 38px Inter, sans-serif';
  ctx.fillText('Business Cards • Banners • Booklets • Flyers', c.width / 2, 420);
  ctx.font = '500 28px Inter, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('Same-Day Turnaround Available', c.width / 2, 520);
  ctx.fillText('Bring in a photo or PDF — we handle the rest!', c.width / 2, 580);

  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 5;
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(90, 740, c.width - 180, 320);
  ctx.fillStyle = '#cc0000';
  ctx.font = '800 42px Montserrat, sans-serif';
  ctx.fillText('PROMO CODE: GEPPY30', c.width / 2, 880);
  ctx.fillStyle = '#475569';
  ctx.font = '600 24px Inter, sans-serif';
  ctx.fillText('Valid through December 31 • 742 Evergreen Terrace', c.width / 2, 960);

  return {
    fileName: 'Grand_Opening_Promo_Flyer.docx',
    fileType: 'docx',
    pages: [
      {
        pageNumber: 1,
        title: 'Promo Flyer Page 1',
        dataUrl: c.toDataURL('image/png'),
        widthPx: c.width,
        heightPx: c.height,
        extractedTextLines: [
          'GRAND OPENING SALE',
          'TAKE 30% OFF ALL CUSTOM PRINTING ORDERS',
          'Business Cards • Banners • Booklets • Flyers',
          'PROMO CODE: GEPPY30',
        ],
      },
    ],
  };
}
