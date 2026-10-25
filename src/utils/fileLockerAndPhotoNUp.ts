import { jsPDF } from 'jspdf';
import {
  CanvasElement,
  LockerFileItem,
  MasterDesign,
  PackedPhotoPlacement,
  PackedPhotoSheet,
  PhotoNUpOrderItem,
  PhotoOutputSheetPreset,
  PhotoPlacementOverride,
  PhotoPrintSizePreset,
  PrintProject,
  PrintTemplate,
  ProjectPage,
} from '../types/printstudio';
import { importFilesToBundle } from './documentImporter';

export const PHOTO_PRINT_SIZE_PRESETS: PhotoPrintSizePreset[] = [
  {
    id: 'photo-2.5x3.5',
    label: '2.5 × 3.5"',
    subtitle: 'Wallet Photo',
    widthIn: 2.5,
    heightIn: 3.5,
    category: 'wallet',
  },
  {
    id: 'photo-4x6',
    label: '4 × 6"',
    subtitle: 'Standard 4×6 Photo',
    widthIn: 4,
    heightIn: 6,
    category: 'standard',
  },
  {
    id: 'photo-5x7',
    label: '5 × 7"',
    subtitle: 'Standard 5×7 Photo',
    widthIn: 5,
    heightIn: 7,
    category: 'standard',
  },
  {
    id: 'photo-8x10',
    label: '8 × 10"',
    subtitle: '8×10 Portrait Frame',
    widthIn: 8,
    heightIn: 10,
    category: 'standard',
  },
  {
    id: 'photo-8.5x11',
    label: '8.5 × 11"',
    subtitle: 'Full Page / Letter Photo',
    widthIn: 8.5,
    heightIn: 11,
    category: 'standard',
  },
  {
    id: 'photo-11x14',
    label: '11 × 14"',
    subtitle: '11×14 Gallery Mat Print',
    widthIn: 11,
    heightIn: 14,
    category: 'standard',
  },
  {
    id: 'poster-12x18',
    label: '12 × 18"',
    subtitle: 'Small Poster Print',
    widthIn: 12,
    heightIn: 18,
    category: 'poster',
  },
  {
    id: 'poster-16x20',
    label: '16 × 20"',
    subtitle: 'Standard Poster Print',
    widthIn: 16,
    heightIn: 20,
    category: 'poster',
  },
  {
    id: 'poster-18x24',
    label: '18 × 24"',
    subtitle: 'Medium Poster / Sign',
    widthIn: 18,
    heightIn: 24,
    category: 'poster',
  },
  {
    id: 'poster-24x36',
    label: '24 × 36"',
    subtitle: 'Large Format Poster',
    widthIn: 24,
    heightIn: 36,
    category: 'poster',
  },
  {
    id: 'photo-custom',
    label: 'Custom Size',
    subtitle: 'Any W × H (in)',
    widthIn: 4,
    heightIn: 6,
    category: 'custom',
  },
];

export const PHOTO_OUTPUT_SHEET_PRESETS: PhotoOutputSheetPreset[] = [
  {
    id: 'out-8.5x11',
    label: '8.5 × 11"',
    subtitle: 'Letter Sheet',
    widthIn: 8.5,
    heightIn: 11,
    category: 'standard-sheet',
  },
  {
    id: 'out-8.5x14',
    label: '8.5 × 14"',
    subtitle: 'Legal Sheet',
    widthIn: 8.5,
    heightIn: 14,
    category: 'standard-sheet',
  },
  {
    id: 'out-11x17',
    label: '11 × 17"',
    subtitle: 'Tabloid / Ledger Sheet',
    widthIn: 11,
    heightIn: 17,
    category: 'standard-sheet',
  },
  {
    id: 'out-12x18',
    label: '12 × 18"',
    subtitle: 'Digital Press Sheet',
    widthIn: 12,
    heightIn: 18,
    category: 'standard-sheet',
  },
  {
    id: 'out-13x19',
    label: '13 × 19"',
    subtitle: 'Super B Photo Sheet',
    widthIn: 13,
    heightIn: 19,
    category: 'standard-sheet',
  },
  {
    id: 'out-16x20',
    label: '16 × 20"',
    subtitle: 'Poster Output Sheet',
    widthIn: 16,
    heightIn: 20,
    category: 'poster-sheet',
  },
  {
    id: 'out-18x24',
    label: '18 × 24"',
    subtitle: 'Medium Poster / Gang Sheet',
    widthIn: 18,
    heightIn: 24,
    category: 'poster-sheet',
  },
  {
    id: 'out-20x30',
    label: '20 × 30"',
    subtitle: '20×30 Poster Sheet',
    widthIn: 20,
    heightIn: 30,
    category: 'poster-sheet',
  },
  {
    id: 'out-24x36',
    label: '24 × 36"',
    subtitle: 'Large Format Roll / Poster Sheet',
    widthIn: 24,
    heightIn: 36,
    category: 'poster-sheet',
  },
  {
    id: 'out-36x48',
    label: '36 × 48"',
    subtitle: 'Wide Format Roll Sheet',
    widthIn: 36,
    heightIn: 48,
    category: 'poster-sheet',
  },
  {
    id: 'out-custom',
    label: 'Custom Output Size',
    subtitle: 'Specify W × H (in)',
    widthIn: 18,
    heightIn: 24,
    category: 'custom',
  },
];

// ==================== SAMPLE STARTER LOCKER ASSETS ====================

function buildSvgSampleDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

export const DEFAULT_STARTER_LOCKER_FILES: LockerFileItem[] = [
  {
    id: 'locker-sample-1',
    name: 'Alpine_Summit_Portrait.jpg',
    fileType: 'image',
    mimeType: 'image/svg+xml',
    sizeBytes: 248120,
    createdAt: '2026-10-23T14:00:00Z',
    widthPx: 1200,
    heightPx: 1800,
    tags: ['Photo', 'Portrait', 'Sample'],
    thumbnailUrl: buildSvgSampleDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200">
        <defs>
          <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="45%" stop-color="#1e3a8a"/>
            <stop offset="78%" stop-color="#f97316"/>
            <stop offset="100%" stop-color="#fde047"/>
          </linearGradient>
        </defs>
        <rect width="800" height="1200" fill="url(#sky1)"/>
        <circle cx="560" cy="460" r="110" fill="#fef08a" opacity="0.9"/>
        <polygon points="0,950 280,520 580,950" fill="#1e293b"/>
        <polygon points="220,980 520,460 800,980" fill="#0f172a"/>
        <polygon points="520,460 445,590 500,570 540,615 595,585" fill="#f8fafc" opacity="0.85"/>
        <rect y="940" width="800" height="260" fill="#020617"/>
        <text x="400" y="1080" fill="#f8fafc" font-family="Montserrat, sans-serif" font-size="38" font-weight="800" text-anchor="middle" letter-spacing="4">ALPINE SUMMIT</text>
        <text x="400" y="1130" fill="#94a3b8" font-family="Inter, sans-serif" font-size="22" font-weight="600" text-anchor="middle">HIGH-RES STUDIO SAMPLE PHOTO #1</text>
      </svg>
    `),
    dataUrl: '',
  },
  {
    id: 'locker-sample-2',
    name: 'Coastal_Sunset_Horizon.jpg',
    fileType: 'image',
    mimeType: 'image/svg+xml',
    sizeBytes: 312400,
    createdAt: '2026-10-23T14:05:00Z',
    widthPx: 1800,
    heightPx: 1200,
    tags: ['Photo', 'Landscape', 'Sample'],
    thumbnailUrl: buildSvgSampleDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
        <defs>
          <linearGradient id="sky2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#311042"/>
            <stop offset="50%" stop-color="#be123c"/>
            <stop offset="100%" stop-color="#fb923c"/>
          </linearGradient>
          <linearGradient id="sea2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="500" fill="url(#sky2)"/>
        <circle cx="600" cy="460" r="145" fill="#fde047"/>
        <rect y="480" width="1200" height="320" fill="url(#sea2)"/>
        <rect x="470" y="505" width="260" height="12" rx="6" fill="#fef08a" opacity="0.8"/>
        <rect x="510" y="535" width="180" height="10" rx="5" fill="#fed7aa" opacity="0.65"/>
        <rect x="545" y="565" width="110" height="8" rx="4" fill="#fed7aa" opacity="0.45"/>
        <text x="600" y="715" fill="#ffffff" font-family="Montserrat, sans-serif" font-size="40" font-weight="800" text-anchor="middle" letter-spacing="5">COASTAL HORIZON</text>
        <text x="600" y="755" fill="#bae6fd" font-family="Inter, sans-serif" font-size="20" font-weight="600" text-anchor="middle">LANDSCAPE PHOTO PRINT SAMPLE #2</text>
      </svg>
    `),
    dataUrl: '',
  },
  {
    id: 'locker-sample-3',
    name: 'Studio_Portrait_Editorial.png',
    fileType: 'image',
    mimeType: 'image/svg+xml',
    sizeBytes: 289000,
    createdAt: '2026-10-23T14:10:00Z',
    widthPx: 1200,
    heightPx: 1500,
    tags: ['Photo', 'Portrait', '8x10'],
    thumbnailUrl: buildSvgSampleDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
        <defs>
          <linearGradient id="bg3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#064e3b"/>
            <stop offset="55%" stop-color="#0f766e"/>
            <stop offset="100%" stop-color="#111827"/>
          </linearGradient>
        </defs>
        <rect width="800" height="1000" fill="url(#bg3)"/>
        <rect x="55" y="55" width="690" height="890" fill="none" stroke="#34d399" stroke-width="4" opacity="0.6"/>
        <circle cx="400" cy="390" r="165" fill="#10b981" opacity="0.25"/>
        <circle cx="400" cy="350" r="78" fill="#ecfdf5"/>
        <path d="M250,580 C250,460 550,460 550,580 Z" fill="#ecfdf5"/>
        <text x="400" y="750" fill="#ffffff" font-family="Playfair Display, serif" font-size="46" font-weight="700" text-anchor="middle">STUDIO PORTRAIT</text>
        <text x="400" y="805" fill="#6ee7b7" font-family="Inter, sans-serif" font-size="22" font-weight="600" text-anchor="middle" letter-spacing="3">GALLERY COLLECTION • SAMPLE #3</text>
      </svg>
    `),
    dataUrl: '',
  },
  {
    id: 'locker-sample-4',
    name: 'Grand_Opening_Poster_Art.png',
    fileType: 'image',
    mimeType: 'image/svg+xml',
    sizeBytes: 412800,
    createdAt: '2026-10-23T14:15:00Z',
    widthPx: 1800,
    heightPx: 2400,
    tags: ['Poster', 'Signage', 'Graphic'],
    thumbnailUrl: buildSvgSampleDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200">
        <rect width="900" height="1200" fill="#111827"/>
        <rect x="40" y="40" width="820" height="1120" rx="24" fill="none" stroke="#f59e0b" stroke-width="8"/>
        <rect x="100" y="130" width="700" height="110" rx="14" fill="#cc0000"/>
        <text x="450" y="202" fill="#ffffff" font-family="Montserrat, sans-serif" font-size="52" font-weight="900" text-anchor="middle" letter-spacing="4">GRAND OPENING</text>
        <text x="450" y="420" fill="#fde047" font-family="Montserrat, sans-serif" font-size="110" font-weight="900" text-anchor="middle">50% OFF</text>
        <text x="450" y="520" fill="#f8fafc" font-family="Inter, sans-serif" font-size="38" font-weight="700" text-anchor="middle">CUSTOM POSTERS &amp; PHOTO PRINTS</text>
        <line x1="180" y1="620" x2="720" y2="620" stroke="#475569" stroke-width="4"/>
        <text x="450" y="740" fill="#cbd5e1" font-family="Inter, sans-serif" font-size="30" font-weight="600" text-anchor="middle">4×6 • 5×7 • 8×10 • 11×14 • 18×24 • 24×36</text>
        <rect x="220" y="880" width="460" height="110" rx="55" fill="#f59e0b"/>
        <text x="450" y="950" fill="#0f172a" font-family="Montserrat, sans-serif" font-size="36" font-weight="900" text-anchor="middle">GEPPY'S PRINTSHOP</text>
      </svg>
    `),
    dataUrl: '',
  },
  {
    id: 'locker-sample-pdf-1',
    name: 'Printshop_Production_Spec_Sheet.pdf',
    fileType: 'pdf',
    mimeType: 'application/pdf',
    sizeBytes: 518400,
    createdAt: '2026-10-23T14:20:00Z',
    pageCount: 1,
    widthPx: 1020,
    heightPx: 1320,
    tags: ['PDF', 'Spec Sheet', 'Document'],
    thumbnailUrl: buildSvgSampleDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 1100">
        <rect width="850" height="1100" fill="#ffffff"/>
        <rect x="0" y="0" width="850" height="140" fill="#cc0000"/>
        <text x="60" y="88" fill="#ffffff" font-family="Montserrat, sans-serif" font-size="38" font-weight="800">GEPPY'S PRINTSHOP — SPEC SHEET</text>
        <rect x="60" y="200" width="730" height="180" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
        <text x="90" y="255" fill="#0f172a" font-family="Inter, sans-serif" font-size="26" font-weight="700">Standard Photo &amp; Poster Output Guide</text>
        <text x="90" y="305" fill="#475569" font-family="Inter, sans-serif" font-size="20">• Photo Sizes: 4×6", 5×7", 8×10", 8.5×11", 11×14"</text>
        <text x="90" y="345" fill="#475569" font-family="Inter, sans-serif" font-size="20">• Poster Gang Sheets: 12×18", 16×20", 18×24", 24×36"</text>
        <rect x="60" y="430" width="730" height="520" rx="12" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
        <text x="90" y="490" fill="#0f172a" font-family="Inter, sans-serif" font-size="24" font-weight="700">Pre-Flight Checklist</text>
        <text x="90" y="545" fill="#334155" font-family="Inter, sans-serif" font-size="20">1. Verify 300 DPI resolution on all uploaded photos &amp; PDFs</text>
        <text x="90" y="595" fill="#334155" font-family="Inter, sans-serif" font-size="20">2. Enable Crop / Trim Marks when gang-printing multiple sizes</text>
        <text x="90" y="645" fill="#334155" font-family="Inter, sans-serif" font-size="20">3. Check outer sheet margins (0.25" standard press gripper)</text>
      </svg>
    `),
    dataUrl: '',
  },
];

// Initialize `dataUrl` on sample items to match `thumbnailUrl`
DEFAULT_STARTER_LOCKER_FILES.forEach((item) => {
  item.dataUrl = item.thumbnailUrl;
  if (item.fileType === 'pdf') {
    item.pageDataUrls = [item.thumbnailUrl];
  }
});

// ==================== INDEXEDDB + FALLBACK FILE LOCKER STORAGE ====================

const DB_NAME = 'GeppysPrintshopFileLockerDB';
const STORE_NAME = 'locker_files';
const DB_VERSION = 1;
const FALLBACK_LS_KEY = 'geppys_file_locker_fallback_v1';

function openLockerDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadLockerFiles(): Promise<LockerFileItem[]> {
  try {
    const db = await openLockerDb();
    return await new Promise<LockerFileItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = req.result as LockerFileItem[];
        if (Array.isArray(result) && result.length > 0) {
          // Sort newest first
          result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          resolve(result);
        } else {
          // Seed starter files
          saveLockerFilesList(DEFAULT_STARTER_LOCKER_FILES).catch(() => {});
          resolve(DEFAULT_STARTER_LOCKER_FILES);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(FALLBACK_LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_STARTER_LOCKER_FILES;
  }
}

export async function saveLockerFilesList(
  items: LockerFileItem[]
): Promise<void> {
  try {
    const db = await openLockerDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      items.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width || 800,
        height: img.naturalHeight || img.height || 600,
      });
    img.onerror = () => resolve({ width: 800, height: 600 });
    img.src = dataUrl;
  });
}

/**
 * Ingests any user-uploaded File (Image, PDF, Word .docx, CSV, TXT, or JSON) into a LockerFileItem
 */
export async function ingestUploadedFileToLocker(
  file: File
): Promise<LockerFileItem> {
  const lower = file.name.toLowerCase();
  const nowIso = new Date().toISOString();
  const id = `locker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 1. Image files (.png, .jpg, .jpeg, .webp, .svg, .gif)
  if (
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(lower)
  ) {
    const dataUrl = await readFileAsDataUrl(file);
    const dims = await getImageDimensions(dataUrl);
    return {
      id,
      name: file.name,
      fileType: 'image',
      mimeType: file.type || 'image/png',
      sizeBytes: file.size,
      createdAt: nowIso,
      thumbnailUrl: dataUrl,
      dataUrl,
      widthPx: dims.width,
      heightPx: dims.height,
      tags: ['Image', `${dims.width}×${dims.height}px`],
    };
  }

  // 2. PDF files (.pdf) -> Render high-res page images via importFilesToBundle
  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
    try {
      const bundle = await importFilesToBundle([file]);
      const pageUrls = bundle.pages.map((p) => p.dataUrl);
      const firstPage = bundle.pages[0];
      return {
        id,
        name: file.name,
        fileType: 'pdf',
        mimeType: 'application/pdf',
        sizeBytes: file.size,
        createdAt: nowIso,
        thumbnailUrl: firstPage?.dataUrl || DEFAULT_STARTER_LOCKER_FILES[4].thumbnailUrl,
        dataUrl: firstPage?.dataUrl || '',
        pageDataUrls: pageUrls,
        pageCount: bundle.pages.length,
        widthPx: firstPage?.widthPx || 1020,
        heightPx: firstPage?.heightPx || 1320,
        tags: ['PDF', `${bundle.pages.length} Page${bundle.pages.length > 1 ? 's' : ''}`],
      };
    } catch {
      const fallbackUrl = DEFAULT_STARTER_LOCKER_FILES[4].thumbnailUrl;
      return {
        id,
        name: file.name,
        fileType: 'pdf',
        mimeType: 'application/pdf',
        sizeBytes: file.size,
        createdAt: nowIso,
        thumbnailUrl: fallbackUrl,
        dataUrl: fallbackUrl,
        pageCount: 1,
        tags: ['PDF'],
      };
    }
  }

  // 3. Word (.docx) or Text/CSV/JSON documents
  if (lower.endsWith('.docx')) {
    try {
      const bundle = await importFilesToBundle([file]);
      const pageUrls = bundle.pages.map((p) => p.dataUrl);
      const firstPage = bundle.pages[0];
      return {
        id,
        name: file.name,
        fileType: 'document',
        mimeType:
          file.type ||
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: file.size,
        createdAt: nowIso,
        thumbnailUrl: firstPage?.dataUrl || DEFAULT_STARTER_LOCKER_FILES[4].thumbnailUrl,
        dataUrl: firstPage?.dataUrl || '',
        pageDataUrls: pageUrls,
        pageCount: bundle.pages.length,
        tags: ['Word Doc', `${bundle.pages.length} Page${bundle.pages.length > 1 ? 's' : ''}`],
      };
    } catch {
      // fall through
    }
  }

  // Generic Document / CSV / JSON / TXT
  const textContent = await file.text().catch(() => '');
  const ext = (file.name.split('.').pop() || 'DOC').toUpperCase();
  const docThumbSvg = buildSvgSampleDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
      <rect width="600" height="800" fill="#f8fafc"/>
      <rect x="30" y="30" width="540" height="740" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
      <rect x="30" y="30" width="540" height="110" rx="16" fill="#1e293b"/>
      <text x="70" y="98" fill="#ffffff" font-family="Montserrat, sans-serif" font-size="34" font-weight="800">${ext} DOCUMENT</text>
      <text x="70" y="210" fill="#0f172a" font-family="Inter, sans-serif" font-size="24" font-weight="700">${file.name.slice(0, 32).replace(/[<>&"']/g, '')}</text>
      <line x1="70" y1="245" x2="530" y2="245" stroke="#e2e8f0" stroke-width="3"/>
      <text x="70" y="300" fill="#475569" font-family="monospace" font-size="18">${(textContent.split(/\r?\n/)[0] || '').slice(0, 42).replace(/[<>&"']/g, '')}</text>
      <text x="70" y="340" fill="#475569" font-family="monospace" font-size="18">${(textContent.split(/\r?\n/)[1] || '').slice(0, 42).replace(/[<>&"']/g, '')}</text>
      <text x="70" y="380" fill="#475569" font-family="monospace" font-size="18">${(textContent.split(/\r?\n/)[2] || '').slice(0, 42).replace(/[<>&"']/g, '')}</text>
    </svg>
  `);

  return {
    id,
    name: file.name,
    fileType: 'document',
    mimeType: file.type || 'text/plain',
    sizeBytes: file.size,
    createdAt: nowIso,
    thumbnailUrl: docThumbSvg,
    dataUrl: docThumbSvg,
    rawTextContent: textContent,
    tags: [ext, 'Document'],
  };
}

// ==================== 2D MAXRECTS GANG-SHEET PHOTO UPPER ====================

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ExpandedPhotoRequest {
  placementKey: string;
  orderId: string;
  lockerFileId: string;
  fileName: string;
  imageUrl: string;
  copyIndex: number;
  widthIn: number;
  heightIn: number;
  fitMode: 'cover' | 'contain';
  allowRotate: boolean;
}

function carveUsedBoxFromFreeRects(
  freeRects: FreeRect[],
  usedBox: FreeRect,
  eps: number = 0.0005
): FreeRect[] {
  const nextFree: FreeRect[] = [];
  for (const fr of freeRects) {
    if (
      usedBox.x >= fr.x + fr.width - eps ||
      usedBox.x + usedBox.width <= fr.x + eps ||
      usedBox.y >= fr.y + fr.height - eps ||
      usedBox.y + usedBox.height <= fr.y + eps
    ) {
      nextFree.push(fr);
      continue;
    }
    // Left slice
    if (usedBox.x > fr.x + eps) {
      nextFree.push({
        x: fr.x,
        y: fr.y,
        width: usedBox.x - fr.x,
        height: fr.height,
      });
    }
    // Right slice
    if (usedBox.x + usedBox.width < fr.x + fr.width - eps) {
      nextFree.push({
        x: usedBox.x + usedBox.width,
        y: fr.y,
        width: fr.x + fr.width - (usedBox.x + usedBox.width),
        height: fr.height,
      });
    }
    // Top slice
    if (usedBox.y > fr.y + eps) {
      nextFree.push({
        x: fr.x,
        y: fr.y,
        width: fr.width,
        height: usedBox.y - fr.y,
      });
    }
    // Bottom slice
    if (usedBox.y + usedBox.height < fr.y + fr.height - eps) {
      nextFree.push({
        x: fr.x,
        y: usedBox.y + usedBox.height,
        width: fr.width,
        height: fr.y + fr.height - (usedBox.y + usedBox.height),
      });
    }
  }

  // Prune degenerate or fully-contained free rectangles
  const pruned: FreeRect[] = [];
  for (let a = 0; a < nextFree.length; a++) {
    const ra = nextFree[a];
    if (ra.width < 0.25 || ra.height < 0.25) continue;
    let isContained = false;
    for (let b = 0; b < nextFree.length; b++) {
      if (a === b) continue;
      const rb = nextFree[b];
      if (
        ra.x >= rb.x - eps &&
        ra.y >= rb.y - eps &&
        ra.x + ra.width <= rb.x + rb.width + eps &&
        ra.y + ra.height <= rb.y + rb.height + eps
      ) {
        if (a > b || rb.width * rb.height > ra.width * ra.height + eps) {
          isContained = true;
          break;
        }
      }
    }
    if (!isContained) pruned.push(ra);
  }
  return pruned;
}

/**
 * Packs an array of `PhotoNUpOrderItem`s (each with its own quantity and target photo print size
 * like 4×6, 5×7, 8×10, 11×14, 16×20, 18×24, etc.) onto one or more Output Sheets (e.g., 18×24 or 24×36)
 * using a 2D MaxRects (Best Short Side Fit) nesting algorithm!
 * Also supports `overrides` (user-dragged coordinates and/or manual 90° rotations) and automatically
 * fits all remaining photos into the open spaces around pinned/dragged photos!
 */
export function packPhotoOrdersOntoSheets(params: {
  orders: PhotoNUpOrderItem[];
  sheetWidthIn: number;
  sheetHeightIn: number;
  marginIn: number;
  gapIn: number;
  overrides?: Record<string, PhotoPlacementOverride>;
}): PackedPhotoSheet[] {
  const {
    orders,
    sheetWidthIn,
    sheetHeightIn,
    marginIn,
    gapIn,
    overrides = {},
  } = params;
  const usableW = Math.max(1, sheetWidthIn - marginIn * 2);
  const usableH = Math.max(1, sheetHeightIn - marginIn * 2);

  // 1. Expand all orders by `quantity`
  const queue: ExpandedPhotoRequest[] = [];
  for (const ord of orders) {
    if (!ord.imageUrl || ord.quantity <= 0) continue;
    const count = Math.min(200, Math.max(1, Math.round(ord.quantity)));
    for (let c = 1; c <= count; c++) {
      queue.push({
        placementKey: `${ord.id}::${c}`,
        orderId: ord.id,
        lockerFileId: ord.lockerFileId,
        fileName: ord.fileName,
        imageUrl: ord.imageUrl,
        copyIndex: c,
        widthIn: Math.max(0.5, ord.widthIn),
        heightIn: Math.max(0.5, ord.heightIn),
        fitMode: ord.fitMode,
        allowRotate: ord.allowRotate,
      });
    }
  }

  if (queue.length === 0) {
    return [
      {
        sheetIndex: 0,
        sheetWidthIn,
        sheetHeightIn,
        placements: [],
        utilizationPct: 0,
      },
    ];
  }

  // Sort largest-area first so larger prints (e.g. 11×14, 8×10) anchor cleanly and smaller prints (5×7, 4×6, wallets) fill remaining spaces
  const sortedQueue = [...queue].sort(
    (a, b) => b.widthIn * b.heightIn - a.widthIn * a.heightIn
  );

  const EPS = 0.0005;

  const runPackPass = (preferRotated: boolean): PackedPhotoSheet[] => {
    const remaining = [...sortedQueue];
    const sheets: PackedPhotoSheet[] = [];

    while (remaining.length > 0 && sheets.length < 100) {
      const sheetIdx = sheets.length;
      const placements: PackedPhotoPlacement[] = [];

      // Free rectangles within [marginIn, marginIn + usableW] × [marginIn, marginIn + usableH]
      // We inflate placed items by `gapIn` on right/bottom by modeling free space as `usableW + gapIn` × `usableH + gapIn`
      let freeRects: FreeRect[] = [
        {
          x: marginIn,
          y: marginIn,
          width: usableW + gapIn,
          height: usableH + gapIn,
        },
      ];

      let placedAnyOnThisSheet = false;

      // STEP A: Place any user-dragged / pinned photos targeting this sheet FIRST, and carve their space so other photos auto-fit around them!
      let pIdx = 0;
      while (pIdx < remaining.length) {
        const req = remaining[pIdx];
        const ov = overrides[req.placementKey];
        const targetSheet = ov?.sheetIndex ?? 0;
        if (
          ov &&
          ov.xIn !== undefined &&
          ov.yIn !== undefined &&
          targetSheet === sheetIdx
        ) {
          const isRot = ov.rotated ?? false;
          const rawW = isRot ? req.heightIn : req.widthIn;
          const rawH = isRot ? req.widthIn : req.heightIn;
          const finalW = Math.min(sheetWidthIn, rawW);
          const finalH = Math.min(sheetHeightIn, rawH);

          const clampedX = Math.max(
            0,
            Math.min(sheetWidthIn - finalW, ov.xIn)
          );
          const clampedY = Math.max(
            0,
            Math.min(sheetHeightIn - finalH, ov.yIn)
          );

          placements.push({
            placementKey: req.placementKey,
            orderId: req.orderId,
            lockerFileId: req.lockerFileId,
            fileName: req.fileName,
            imageUrl: req.imageUrl,
            copyIndex: req.copyIndex,
            xIn: Number(clampedX.toFixed(4)),
            yIn: Number(clampedY.toFixed(4)),
            widthIn: Number(finalW.toFixed(4)),
            heightIn: Number(finalH.toFixed(4)),
            requestedWidthIn: req.widthIn,
            requestedHeightIn: req.heightIn,
            rotated: isRot,
            fitMode: req.fitMode,
            isPinned: true,
          });

          const usedBox: FreeRect = {
            x: clampedX,
            y: clampedY,
            width: finalW + gapIn,
            height: finalH + gapIn,
          };
          freeRects = carveUsedBoxFromFreeRects(freeRects, usedBox, EPS);
          remaining.splice(pIdx, 1);
          placedAnyOnThisSheet = true;
        } else {
          pIdx++;
        }
      }

      // STEP B: Greedily place remaining items into current sheet's freeRects (around any pinned items!)
      // Always prefer a consistent orientation (`preferRotated`) across the sheet so copies don't randomly mix orientations,
      // and only fall back to the alternate 90° orientation if an item cannot fit in `preferRotated` on the current sheet!
      let i = 0;
      while (i < remaining.length) {
        const req = remaining[i];
        const ov = overrides[req.placementKey];
        // If this item is pinned to a LATER sheet, skip it for this sheet
        if (
          ov &&
          ov.xIn !== undefined &&
          ov.yIn !== undefined &&
          (ov.sheetIndex ?? 0) > sheetIdx
        ) {
          i++;
          continue;
        }

        const forcedRot = ov?.rotated;

        // If this single photo is larger than the entire usable sheet even when rotated,
        // and the sheet is currently empty, clamp/scale it to fit this sheet so it never loops infinitely
        const fitsNormalOnEmpty =
          req.widthIn <= usableW + EPS && req.heightIn <= usableH + EPS;
        const fitsRotatedOnEmpty =
          req.allowRotate &&
          req.heightIn <= usableW + EPS &&
          req.widthIn <= usableH + EPS;

        let wToPlace = req.widthIn;
        let hToPlace = req.heightIn;
        if (
          !fitsNormalOnEmpty &&
          !fitsRotatedOnEmpty &&
          placements.length === 0
        ) {
          const scaleNormal = Math.min(
            usableW / req.widthIn,
            usableH / req.heightIn
          );
          const scaleRot = req.allowRotate
            ? Math.min(usableW / req.heightIn, usableH / req.widthIn)
            : 0;
          if (scaleRot > scaleNormal) {
            wToPlace = Number((req.heightIn * scaleRot).toFixed(3));
            hToPlace = Number((req.widthIn * scaleRot).toFixed(3));
          } else {
            wToPlace = Number((req.widthIn * scaleNormal).toFixed(3));
            hToPlace = Number((req.heightIn * scaleNormal).toFixed(3));
          }
        }

        const findBestFreeRectForOrientation = (
          tryRot: boolean
        ): { rectIdx: number; rotated: boolean } | null => {
          const itemWWithGap = (tryRot ? hToPlace : wToPlace) + gapIn;
          const itemHWithGap = (tryRot ? wToPlace : hToPlace) + gapIn;

          let bestIdx = -1;
          let bestY = Number.POSITIVE_INFINITY;
          let bestX = Number.POSITIVE_INFINITY;
          let bestShortSide = Number.POSITIVE_INFINITY;

          for (let fIdx = 0; fIdx < freeRects.length; fIdx++) {
            const fr = freeRects[fIdx];
            if (
              fr.width + EPS >= itemWWithGap &&
              fr.height + EPS >= itemHWithGap
            ) {
              const leftoverX = Math.abs(fr.width - itemWWithGap);
              const leftoverY = Math.abs(fr.height - itemHWithGap);
              const shortSide = Math.min(leftoverX, leftoverY);

              // Top-Left priority (pack cleanly row-by-row from top to bottom, left to right) with BSSF tie-breaker
              if (
                fr.y < bestY - EPS ||
                (Math.abs(fr.y - bestY) <= EPS &&
                  (fr.x < bestX - EPS ||
                    (Math.abs(fr.x - bestX) <= EPS &&
                      shortSide < bestShortSide - EPS)))
              ) {
                bestIdx = fIdx;
                bestY = fr.y;
                bestX = fr.x;
                bestShortSide = shortSide;
              }
            }
          }

          return bestIdx !== -1 ? { rectIdx: bestIdx, rotated: tryRot } : null;
        };

        let chosenMatch: { rectIdx: number; rotated: boolean } | null = null;

        if (forcedRot !== undefined) {
          chosenMatch = findBestFreeRectForOrientation(forcedRot);
        } else {
          const primaryRot = preferRotated && req.allowRotate ? true : false;
          chosenMatch = findBestFreeRectForOrientation(primaryRot);
          // Only rotate to the opposite orientation if it does NOT fit in the consistent primary orientation on this sheet
          if (!chosenMatch && req.allowRotate) {
            chosenMatch = findBestFreeRectForOrientation(!primaryRot);
          }
        }

        if (chosenMatch) {
          const chosenFr = freeRects[chosenMatch.rectIdx];
          const bestRotated = chosenMatch.rotated;
          const finalW = bestRotated ? hToPlace : wToPlace;
          const finalH = bestRotated ? wToPlace : hToPlace;
          const usedBox: FreeRect = {
            x: chosenFr.x,
            y: chosenFr.y,
            width: finalW + gapIn,
            height: finalH + gapIn,
          };

          placements.push({
            placementKey: req.placementKey,
            orderId: req.orderId,
            lockerFileId: req.lockerFileId,
            fileName: req.fileName,
            imageUrl: req.imageUrl,
            copyIndex: req.copyIndex,
            xIn: Number(chosenFr.x.toFixed(4)),
            yIn: Number(chosenFr.y.toFixed(4)),
            widthIn: Number(finalW.toFixed(4)),
            heightIn: Number(finalH.toFixed(4)),
            requestedWidthIn: req.widthIn,
            requestedHeightIn: req.heightIn,
            rotated: bestRotated,
            fitMode: req.fitMode,
            isPinned: forcedRot !== undefined,
          });

          freeRects = carveUsedBoxFromFreeRects(freeRects, usedBox, EPS);
          remaining.splice(i, 1);
          placedAnyOnThisSheet = true;
        } else {
          i++;
        }
      }

      if (!placedAnyOnThisSheet && remaining.length > 0) {
        // Fallback safety: pop one item onto sheet
        const forced = remaining.shift()!;
        const ov = overrides[forced.placementKey];
        const isRot = ov?.rotated ?? false;
        placements.push({
          placementKey: forced.placementKey,
          orderId: forced.orderId,
          lockerFileId: forced.lockerFileId,
          fileName: forced.fileName,
          imageUrl: forced.imageUrl,
          copyIndex: forced.copyIndex,
          xIn: marginIn,
          yIn: marginIn,
          widthIn: Math.min(usableW, isRot ? forced.heightIn : forced.widthIn),
          heightIn: Math.min(usableH, isRot ? forced.widthIn : forced.heightIn),
          requestedWidthIn: forced.widthIn,
          requestedHeightIn: forced.heightIn,
          rotated: isRot,
          fitMode: forced.fitMode,
        });
      }

      const usedArea = placements.reduce(
        (acc, p) => acc + p.widthIn * p.heightIn,
        0
      );
      const totalSheetArea = Math.max(1, sheetWidthIn * sheetHeightIn);
      const utilizationPct = Math.min(
        100,
        Math.round((usedArea / totalSheetArea) * 100)
      );

      sheets.push({
        sheetIndex: sheetIdx,
        sheetWidthIn,
        sheetHeightIn,
        placements,
        utilizationPct,
      });
    }

    return sheets;
  };

  const sheetsUpright = runPackPass(false);
  const canTryRotatedPass = sortedQueue.some((q) => q.allowRotate);
  if (!canTryRotatedPass) {
    return sheetsUpright;
  }

  const sheetsRotated = runPackPass(true);

  // Helper to check if all placements on the sheets share the same orientation
  const isUniformOrientation = (list: PackedPhotoSheet[]): boolean => {
    const all = list.flatMap((s) => s.placements);
    if (all.length <= 1) return true;
    const firstRot = all[0].rotated;
    return all.every((p) => p.rotated === firstRot);
  };

  // Prefer the rotated pass ONLY if it uses fewer sheets, OR if upright had to mix orientations on the same sheet count while rotated kept everything uniform
  if (sheetsRotated.length < sheetsUpright.length) {
    return sheetsRotated;
  }
  if (
    sheetsRotated.length === sheetsUpright.length &&
    !isUniformOrientation(sheetsUpright) &&
    isUniformOrientation(sheetsRotated)
  ) {
    return sheetsRotated;
  }

  return sheetsUpright;
}

// ==================== HIGH-RES RENDERING & STUDIO PROJECT GENERATION ====================

function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Pre-crops/rotates a single photo placement to a clean DataURL matching its exact target aspect ratio
 * (`cover` or `contain` + optional 90° rotation) so that when opened as a CanvasElement in StudioEditor,
 * it never stretches or distorts!
 */
async function renderPlacementFittedImageDataUrl(
  placement: PackedPhotoPlacement,
  dpi: number = 150
): Promise<string> {
  const img = await loadHtmlImage(placement.imageUrl);
  if (!img) return placement.imageUrl;

  const targetWPx = Math.max(60, Math.round(placement.widthIn * dpi));
  const targetHPx = Math.max(60, Math.round(placement.heightIn * dpi));

  const canvas = document.createElement('canvas');
  canvas.width = targetWPx;
  canvas.height = targetHPx;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWPx, targetHPx);

  const imgW = img.naturalWidth || img.width || 800;
  const imgH = img.naturalHeight || img.height || 600;

  // Rotate image content 90° CW if and only if this placement is rotated 90° (`placement.rotated === true`)
  const shouldRotateImageContent = Boolean(placement.rotated);

  ctx.save();
  let drawW = targetWPx;
  let drawH = targetHPx;

  if (shouldRotateImageContent) {
    ctx.translate(targetWPx / 2, targetHPx / 2);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-targetHPx / 2, -targetWPx / 2);
    drawW = targetHPx;
    drawH = targetWPx;
  }

  const scale =
    placement.fitMode === 'contain'
      ? Math.min(drawW / imgW, drawH / imgH)
      : Math.max(drawW / imgW, drawH / imgH);

  const finalW = imgW * scale;
  const finalH = imgH * scale;
  const offsetX = (drawW - finalW) / 2;
  const offsetY = (drawH - finalH) / 2;

  ctx.drawImage(img, offsetX, offsetY, finalW, finalH);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Renders an entire PackedPhotoSheet to a high-DPI HTMLCanvasElement (including optional trim/cut marks)
 */
export async function renderPackedPhotoSheetToCanvas(
  sheet: PackedPhotoSheet,
  includeCropMarks: boolean = true,
  dpi: number = 180
): Promise<HTMLCanvasElement> {
  // Adaptive DPI for huge poster sheets (e.g. 24x36 or 36x48) so browser canvas stays fast and within memory limits
  const maxDimIn = Math.max(sheet.sheetWidthIn, sheet.sheetHeightIn);
  const safeDpi =
    maxDimIn >= 36 ? Math.min(dpi, 110) : maxDimIn >= 24 ? Math.min(dpi, 140) : dpi;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sheet.sheetWidthIn * safeDpi);
  canvas.height = Math.round(sheet.sheetHeightIn * safeDpi);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const pl of sheet.placements) {
    const px = pl.xIn * safeDpi;
    const py = pl.yIn * safeDpi;
    const pw = pl.widthIn * safeDpi;
    const ph = pl.heightIn * safeDpi;

    const img = await loadHtmlImage(pl.imageUrl);
    if (img) {
      const imgW = img.naturalWidth || img.width || 800;
      const imgH = img.naturalHeight || img.height || 600;
      const rotateImg = Boolean(pl.rotated);

      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();

      let drawW = pw;
      let drawH = ph;
      if (rotateImg) {
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate(Math.PI / 2);
        ctx.translate(-ph / 2, -pw / 2);
        drawW = ph;
        drawH = pw;
      } else {
        ctx.translate(px, py);
      }

      const scale =
        pl.fitMode === 'contain'
          ? Math.min(drawW / imgW, drawH / imgH)
          : Math.max(drawW / imgW, drawH / imgH);
      const sw = imgW * scale;
      const sh = imgH * scale;
      ctx.drawImage(img, (drawW - sw) / 2, (drawH - sh) / 2, sw, sh);
      ctx.restore();
    }

    // Draw corner crop/trim ticks around each packed photo if requested
    if (includeCropMarks) {
      ctx.save();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.max(1, safeDpi / 140);
      const tickLen = 0.14 * safeDpi;
      const tickGap = 0.03 * safeDpi;

      // Top-Left corner ticks
      ctx.beginPath();
      ctx.moveTo(px - tickGap - tickLen, py);
      ctx.lineTo(px - tickGap, py);
      ctx.moveTo(px, py - tickGap - tickLen);
      ctx.lineTo(px, py - tickGap);

      // Top-Right corner ticks
      ctx.moveTo(px + pw + tickGap, py);
      ctx.lineTo(px + pw + tickGap + tickLen, py);
      ctx.moveTo(px + pw, py - tickGap - tickLen);
      ctx.lineTo(px + pw, py - tickGap);

      // Bottom-Left corner ticks
      ctx.moveTo(px - tickGap - tickLen, py + ph);
      ctx.lineTo(px - tickGap, py + ph);
      ctx.moveTo(px, py + ph + tickGap);
      ctx.lineTo(px, py + ph + tickGap + tickLen);

      // Bottom-Right corner ticks
      ctx.moveTo(px + pw + tickGap, py + ph);
      ctx.lineTo(px + pw + tickGap + tickLen, py + ph);
      ctx.moveTo(px + pw, py + ph + tickGap);
      ctx.lineTo(px + pw, py + ph + tickGap + tickLen);
      ctx.stroke();

      // Subtle hairline trim border around the photo
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);
      ctx.restore();
    }
  }

  return canvas;
}

/**
 * Directly exports all packed photo sheets to a multi-page Print-Ready PDF at the exact output dimensions (e.g. 18×24", 24×36")
 */
export async function exportPackedPhotosToPdf(params: {
  sheets: PackedPhotoSheet[];
  includeCropMarks: boolean;
  fileNamePrefix?: string;
}): Promise<void> {
  const { sheets, includeCropMarks, fileNamePrefix = 'Photo_Upper_GangSheet' } =
    params;
  if (sheets.length === 0) return;

  const first = sheets[0];
  const orient =
    first.sheetWidthIn > first.sheetHeightIn ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation: orient,
    unit: 'in',
    format: [first.sheetWidthIn, first.sheetHeightIn],
  });

  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    if (i > 0) {
      const shOrient =
        sh.sheetWidthIn > sh.sheetHeightIn ? 'landscape' : 'portrait';
      pdf.addPage([sh.sheetWidthIn, sh.sheetHeightIn], shOrient);
    }
    const canvas = await renderPackedPhotoSheetToCanvas(
      sh,
      includeCropMarks,
      200
    );
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.94),
      'JPEG',
      0,
      0,
      sh.sheetWidthIn,
      sh.sheetHeightIn
    );
  }

  pdf.save(
    `${fileNamePrefix}_${first.sheetWidthIn}x${first.sheetHeightIn}in.pdf`
  );
}

/**
 * Builds a complete editable multi-page `PrintProject` from the packed photo sheets
 * so the user can open and customize their nested photo layout on the Studio Canvas!
 */
export async function buildProjectFromPackedPhotos(params: {
  sheets: PackedPhotoSheet[];
  marginIn: number;
  includeCropMarks: boolean;
}): Promise<PrintProject> {
  const { sheets, marginIn, includeCropMarks } = params;
  const first = sheets[0] || {
    sheetIndex: 0,
    sheetWidthIn: 18,
    sheetHeightIn: 24,
    placements: [],
    utilizationPct: 0,
  };

  const sheetW = first.sheetWidthIn;
  const sheetH = first.sheetHeightIn;
  const totalPhotos = sheets.reduce((acc, s) => acc + s.placements.length, 0);

  const template: PrintTemplate = {
    id: `photo-upper-${Date.now()}`,
    name: `Photo Upper (${sheetW} × ${sheetH}")`,
    subtitle: `${totalPhotos} Photos on ${sheets.length} Sheet${
      sheets.length > 1 ? 's' : ''
    }`,
    category: 'other',
    sheetWidthIn: sheetW,
    sheetHeightIn: sheetH,
    orientation: sheetW > sheetH ? 'landscape' : 'portrait',
    badge: 'Photo Upper',
    defaultBleedIn: 0,
    defaultMarginXIn: marginIn,
    defaultMarginYIn: marginIn,
  };

  // Build elements for each sheet page (pre-rendering each photo's aspect crop/rotation so it displays 1:1)
  const sheetElementsList: CanvasElement[][] = [];
  const maxDim = Math.max(sheetW, sheetH);
  const cropDpi = maxDim >= 24 ? 110 : 140;

  for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
    const sh = sheets[sIdx];
    const els: CanvasElement[] = [];

    for (let pIdx = 0; pIdx < sh.placements.length; pIdx++) {
      const pl = sh.placements[pIdx];
      const fittedUrl = await renderPlacementFittedImageDataUrl(pl, cropDpi);
      els.push({
        id: `nup-img-s${sIdx + 1}-p${pIdx + 1}-${Date.now()}`,
        type: 'image',
        role: 'logo',
        name: `${pl.fileName.replace(/\.[^.]+$/, '')} (${pl.requestedWidthIn}×${
          pl.requestedHeightIn
        }" #${pl.copyIndex})`,
        x: Number(pl.xIn.toFixed(3)),
        y: Number(pl.yIn.toFixed(3)),
        width: Number(pl.widthIn.toFixed(3)),
        height: Number(pl.heightIn.toFixed(3)),
        rotation: 0,
        opacity: 1,
        imageUrl: fittedUrl,
      });
    }
    sheetElementsList.push(els);
  }

  const firstSheetMaster: MasterDesign = {
    id: 'master-a',
    name: 'Master A (Front)',
    backgroundColor: '#ffffff',
    elements: sheetElementsList[0] || [],
  };

  const backMaster: MasterDesign = {
    id: 'master-b',
    name: 'Master B (Back)',
    backgroundColor: '#ffffff',
    elements: [],
  };

  const pages: ProjectPage[] = sheets.map((sh, idx) => {
    const pageMaster: MasterDesign = {
      id: 'master-a',
      name: `Sheet ${idx + 1} (${sh.placements.length} photos)`,
      backgroundColor: '#ffffff',
      elements: sheetElementsList[idx] || [],
    };
    return {
      id: `page-photo-nup-${idx + 1}-${Date.now()}`,
      name: `Sheet ${idx + 1} (${sh.placements.length} Photos)`,
      side: 'front',
      masterId: 'master-a',
      ignoreMaster: idx > 0,
      pageElements: [],
      slotOverrides: idx > 0 ? { 0: pageMaster } : undefined,
    };
  });

  return {
    id: `proj-photo-upper-${Date.now()}`,
    title: `Photo Upper ${sheetW}×${sheetH}" (${totalPhotos} Prints)`,
    template,
    bleedIn: 0,
    marginXIn: marginIn,
    marginYIn: marginIn,
    showCropMarks: includeCropMarks,
    showBleedGuide: false,
    showMarginGuide: true,
    showGridLines: true,
    relativeToMargin: false,
    masters: {
      'master-a': firstSheetMaster,
      'master-b': backMaster,
    },
    pages,
  };
}
