export type TemplateCategory = 'standard' | 'booklet' | 'other' | 'multi-up';

export interface ImpositionGrid {
  cols: number;
  rows: number;
  unitWidthIn: number;
  unitHeightIn: number;
  marginLeftIn: number;
  marginTopIn: number;
  gapXIn: number;
  gapYIn: number;
  autoCenterOnSheet?: boolean;
  linkSpacing?: boolean;
  autoFitToMargins?: boolean;
  innerPaddingXIn?: number;
  innerPaddingYIn?: number;
  linkInnerPadding?: boolean;
}

export interface PrintTemplate {
  id: string;
  name: string;
  subtitle: string;
  category: TemplateCategory;
  sheetWidthIn: number;
  sheetHeightIn: number;
  orientation: 'portrait' | 'landscape';
  isBooklet?: boolean;
  bankTabs?: number;
  imposition?: ImpositionGrid;
  defaultBleedIn: number;
  defaultMarginXIn: number;
  defaultMarginYIn: number;
  badge?: string;
  isCustomSaved?: boolean;
  savedAt?: string;
  savedSetup?: {
    bleedIn: number;
    marginXIn: number;
    marginYIn: number;
    showCropMarks: boolean;
    showBleedGuide: boolean;
    showMarginGuide: boolean;
    showGridLines: boolean;
    relativeToMargin: boolean;
    numbering?: NumberingConfig;
    mailMerge?: MailMergeConfig;
    bankTabConfig?: BankTabConfig;
    masters?: {
      'master-a': MasterDesign;
      'master-b': MasterDesign;
    };
  };
}

export type ElementType =
  | 'text'
  | 'rect'
  | 'rounded-rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'star'
  | 'image'
  | 'qr';

export type SemanticRole =
  | 'company'
  | 'tagline'
  | 'name'
  | 'title'
  | 'phone'
  | 'email'
  | 'website'
  | 'address'
  | 'logo'
  | 'accent'
  | 'background'
  | 'qr'
  | 'body';

export type LayerBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface LayerEffects {
  dropShadow?: boolean;
  shadowColor?: string;
  shadowOffsetX?: number; // in pt
  shadowOffsetY?: number; // in pt
  shadowBlur?: number; // in pt
  outerGlow?: boolean;
  glowColor?: string;
  glowBlur?: number; // in pt
  fxStroke?: boolean;
  fxStrokeColor?: string;
  fxStrokeWidth?: number; // in pt
  brightness?: number; // 100 = normal
  contrast?: number; // 100 = normal
  saturate?: number; // 100 = normal
  blurPx?: number; // 0 = normal
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  role?: SemanticRole;
  name: string;
  // Coordinates in inches relative to the active design unit (e.g. 3.5x2" for a business card master, or full sheet for single-sheet docs)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  blendMode?: LayerBlendMode;
  effects?: LayerEffects;
  locked?: boolean;
  visible?: boolean;

  // Text properties
  text?: string;
  fontFamily?: string;
  fontSize?: number; // in pt
  fontWeight?: 'normal' | 'bold' | '300' | '500' | '600' | '700' | '800';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color?: string;
  highlightColor?: string;
  lineHeight?: number;
  letterSpacing?: number; // in px

  // Shape / Box properties
  fill?: string;
  stroke?: string;
  strokeWidth?: number; // in pt
  borderRadius?: number; // in px

  // Image / QR properties
  imageUrl?: string;
  qrValue?: string;

  // Sequential Print Numbering (Crash Numbering / Raffle Tickets / Invoices)
  isSequentialNumber?: boolean;
}

export type NumberingOrderMode =
  | 'across-then-down'
  | 'cut-and-stack'
  | 'same-per-sheet';

export interface NumberingConfig {
  enabled: boolean;
  startNumber: number;
  step: number;
  padDigits: number;
  prefix: string;
  suffix: string;
  orderMode: NumberingOrderMode;
  totalSheets: number;
}

export type VariableListCategory =
  | 'contacts'
  | 'badges'
  | 'products'
  | 'events'
  | 'custom';

export interface VariableDataList {
  id: string;
  name: string;
  category: VariableListCategory;
  description?: string;
  fields: string[];
  records: Record<string, string>[];
  updatedAt: string;
  sourceFileName?: string;
}

export interface MailMergeConfig {
  enabled: boolean;
  activeListId?: string;
  activeListName?: string;
  previewRecordIndex?: number;
  fields: string[];
  records: Record<string, string>[];
}

export interface BankTabConfig {
  enabled: boolean;
  count: number; // e.g. 3, 4, 5, 6, 8, 10
  labels: string[]; // Custom typed tab names: ["Section 1", "Section 2", ...]
  colors?: string[]; // Optional tab ear fill colors: ["#ffffff", "#fee2e2", ...]
  textColors?: string[]; // Optional tab text colors
  fontSizePt?: number; // Default 9.5 pt
  tabExtensionIn?: number; // Default 0.5 in (right ear width on 9x11 sheet)
  displayMode?: 'all-tabs' | 'single-tab-per-page';
}

export interface MasterDesign {
  id: 'master-a' | 'master-b';
  name: string; // e.g., "Master A (Front)" or "Master B (Back)"
  backgroundColor: string;
  backgroundImage?: string;
  elements: CanvasElement[];
}

export interface ProjectPage {
  id: string;
  name: string;
  side: 'front' | 'back';
  masterId: 'master-a' | 'master-b';
  ignoreMaster: boolean;
  // Optional extra elements placed directly on the page or overriding a specific slot index
  pageElements: CanvasElement[];
  slotOverrides?: Record<number, MasterDesign>;
  // Optional active tab index (0-based) when in single-tab-per-page divider set mode
  activeTabIndex?: number;
}

export interface PrintProject {
  id: string;
  title: string;
  template: PrintTemplate;
  bleedIn: number;
  marginXIn: number;
  marginYIn: number;
  showCropMarks: boolean;
  showBleedGuide: boolean;
  showMarginGuide: boolean;
  showGridLines: boolean;
  relativeToMargin: boolean;
  masters: {
    'master-a': MasterDesign;
    'master-b': MasterDesign;
  };
  pages: ProjectPage[];
  numbering?: NumberingConfig;
  mailMerge?: MailMergeConfig;
  bankTabConfig?: BankTabConfig;
}

export interface CornerPoint {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export interface AIExtractionResult {
  summary: string;
  frontDesign: {
    backgroundColor: string;
    backgroundImage?: string;
    elements: Omit<CanvasElement, 'id'>[];
  };
  backDesign?: {
    backgroundColor: string;
    backgroundImage?: string;
    elements: Omit<CanvasElement, 'id'>[];
  };
  extractedPalette: string[];
  detectedBusinessInfo: {
    company?: string;
    tagline?: string;
    name?: string;
    title?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  };
}

export type LockerFileType = 'image' | 'pdf' | 'document';

export interface LockerFileItem {
  id: string;
  name: string;
  fileType: LockerFileType;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  // High-res image data URL or PDF Page 1 thumbnail
  thumbnailUrl: string;
  // For images: full data URL; for PDFs/docs: array of rendered page data URLs
  dataUrl: string;
  pageDataUrls?: string[];
  pageCount?: number;
  widthPx?: number;
  heightPx?: number;
  tags?: string[];
  rawTextContent?: string;
}

export interface PhotoPrintSizePreset {
  id: string;
  label: string;
  subtitle: string;
  widthIn: number;
  heightIn: number;
  category: 'wallet' | 'standard' | 'poster' | 'custom';
}

export interface PhotoOutputSheetPreset {
  id: string;
  label: string;
  subtitle: string;
  widthIn: number;
  heightIn: number;
  category: 'standard-sheet' | 'poster-sheet' | 'custom';
}

export interface PhotoNUpOrderItem {
  id: string;
  lockerFileId: string;
  fileName: string;
  imageUrl: string;
  quantity: number;
  sizePresetId: string;
  widthIn: number;
  heightIn: number;
  fitMode: 'cover' | 'contain';
  allowRotate: boolean;
}

export interface PhotoPlacementOverride {
  placementKey: string; // `${orderId}::${copyIndex}`
  sheetIndex?: number;
  xIn?: number;
  yIn?: number;
  rotated?: boolean;
}

export interface PackedPhotoPlacement {
  placementKey?: string; // `${orderId}::${copyIndex}`
  orderId: string;
  lockerFileId: string;
  fileName: string;
  imageUrl: string;
  copyIndex: number; // 1..quantity
  xIn: number;
  yIn: number;
  widthIn: number;
  heightIn: number;
  requestedWidthIn: number;
  requestedHeightIn: number;
  rotated: boolean;
  fitMode: 'cover' | 'contain';
  isPinned?: boolean;
}

export interface PackedPhotoSheet {
  sheetIndex: number;
  sheetWidthIn: number;
  sheetHeightIn: number;
  placements: PackedPhotoPlacement[];
  utilizationPct: number;
}
