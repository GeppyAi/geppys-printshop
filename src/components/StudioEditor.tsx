import React, { useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowUpRight,
  Bold,
  BookmarkCheck,
  CheckCircle2,
  Circle,
  Clipboard,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FlipHorizontal,
  FolderOpen,
  GripVertical,
  Hand,
  Hash,
  Image as ImageIcon,
  Italic,
  Layers,
  LayoutGrid,
  Link2,
  Lock,
  Mail,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer,
  MoveDown,
  MoveUp,
  Plus,
  Printer,
  QrCode,
  Redo2,
  RotateCcw,
  RotateCw,
  Scissors,
  Search,
  Sparkles,
  Square,
  Star,
  Strikethrough,
  Trash2,
  Type as TypeIcon,
  Underline,
  Undo2,
  Unlink2,
  Unlock,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BankTabConfig,
  CanvasElement,
  ElementType,
  ImpositionGrid,
  LayerBlendMode,
  LayerEffects,
  MailMergeConfig,
  MasterDesign,
  NumberingConfig,
  NumberingOrderMode,
  PrintProject,
  PrintTemplate,
  VariableDataList,
  VariableListCategory,
} from '../types/printstudio';
import {
  DEFAULT_SAMPLE_MAIL_MERGE,
  DEFAULT_TAB_ACCENT_PALETTE,
  DEFAULT_VARIABLE_LISTS,
  PRINT_TEMPLATES,
  adaptDesignToTemplate,
  createDefaultBankTabConfig,
  exportVariableListToCsvString,
  getDesignUnitSize,
  loadSavedVariableLists,
  rotateMasterDesign90,
  saveVariableListsToStorage,
} from '../data/templates';
import { applyPromptToCurrentMaster } from '../services/geminiService';
import {
  exportPrintReadyPdf,
  formatSequentialNumber,
  renderSheetPageToCanvas,
  resolveElementDisplayText,
} from '../utils/pdfExporter';
import {
  ingestUploadedFileToLocker,
  loadLockerFiles,
  saveLockerFilesList,
} from '../utils/fileLockerAndPhotoNUp';

interface StudioEditorProps {
  project: PrintProject;
  onUpdateProject: (updater: (prev: PrintProject) => PrintProject) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onBackToDashboard: () => void;
  onOpenAIScanModal: () => void;
  onOpenAIDesignerModal: () => void;
  onOpenQuickImportModal: () => void;
  onOpenMultiTemplateModal: () => void;
  onOpenFileLocker?: (tab?: 'locker' | 'photo-nup') => void;
  onSwitchTemplateWithAdaptation: (tpl: PrintTemplate) => void;
  onSaveProjectJson?: () => void;
  onImportProjectJson?: (file: File) => void;
  onSaveCurrentAsTemplate?: (customTemplate: PrintTemplate) => void;
  aiBannerMessage?: string | null;
  onDismissAiBanner?: () => void;
}

const FONT_FAMILIES = [
  'Inter',
  'Montserrat',
  'Playfair Display',
  'Cinzel',
  'Oswald',
  'DM Sans',
  'Cormorant Garamond',
  'JetBrains Mono',
];

const LAYER_BLEND_MODES: { value: LayerBlendMode; label: string; group: string }[] = [
  { value: 'normal', label: 'Normal', group: 'Basic' },
  { value: 'darken', label: 'Darken', group: 'Darken' },
  { value: 'multiply', label: 'Multiply (Ink Overprint)', group: 'Darken' },
  { value: 'color-burn', label: 'Color Burn', group: 'Darken' },
  { value: 'lighten', label: 'Lighten', group: 'Lighten' },
  { value: 'screen', label: 'Screen', group: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge', group: 'Lighten' },
  { value: 'overlay', label: 'Overlay', group: 'Contrast' },
  { value: 'soft-light', label: 'Soft Light', group: 'Contrast' },
  { value: 'hard-light', label: 'Hard Light', group: 'Contrast' },
  { value: 'difference', label: 'Difference', group: 'Inversion' },
  { value: 'exclusion', label: 'Exclusion', group: 'Inversion' },
  { value: 'hue', label: 'Hue', group: 'Component' },
  { value: 'saturation', label: 'Saturation', group: 'Component' },
  { value: 'color', label: 'Color', group: 'Component' },
  { value: 'luminosity', label: 'Luminosity', group: 'Component' },
];

export const StudioEditor: React.FC<StudioEditorProps> = ({
  project,
  onUpdateProject,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onBackToDashboard,
  onOpenAIScanModal,
  onOpenAIDesignerModal,
  onOpenQuickImportModal,
  onOpenMultiTemplateModal,
  onOpenFileLocker,
  onSwitchTemplateWithAdaptation,
  onSaveProjectJson,
  onImportProjectJson,
  onSaveCurrentAsTemplate,
  aiBannerMessage,
  onDismissAiBanner,
}) => {
  const [activeMenuTab, setActiveMenuTab] = useState<
    'File' | 'Home' | 'Insert' | 'Layout' | 'View' | 'AI Studio' | 'Help'
  >('Home');
  const [leftTab, setLeftTab] = useState<'pages' | 'masters'>('pages');
  const [rightTab, setRightTab] = useState<'properties' | 'layers' | 'ai'>('properties');
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [activeTool, setActiveTool] = useState<'select' | 'hand' | ElementType>('select');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [clipboardElement, setClipboardElement] = useState<CanvasElement | null>(null);

  // Canvas view mode: 'sheet' shows full 8.5x11 (with 10-up grid), 'unit' zooms into a single 3.5x2 Master card for precision editing
  const [canvasViewMode, setCanvasViewMode] = useState<'sheet' | 'unit'>('sheet');
  const [zoom, setZoom] = useState<number>(100);

  // Find & Replace modal state
  const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');

  // Proof Every Order Modal state (inspired by the Print Perfect Guarantee sticker on the monitor)
  const [showProofModal, setShowProofModal] = useState<boolean>(false);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // In-editor conversational AI prompt
  const [aiQuickPrompt, setAiQuickPrompt] = useState<string>('');
  const [isAiUpdating, setIsAiUpdating] = useState<boolean>(false);
  const [aiChatHistory, setAiChatHistory] = useState<
    { prompt: string; summary: string }[]
  >([]);

  // Dragging / Resizing / Rotating element state on canvas
  type DragMode =
    | 'move'
    | 'rotate'
    | 'resize-nw'
    | 'resize-n'
    | 'resize-ne'
    | 'resize-e'
    | 'resize-se'
    | 'resize-s'
    | 'resize-sw'
    | 'resize-w';

  const [dragState, setDragState] = useState<{
    elementId: string;
    mode: DragMode;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startRotation: number;
    centerClientX: number;
    centerClientY: number;
    pxPerInch: number;
  } | null>(null);

  const imageUploadRef = useRef<HTMLInputElement>(null);
  const projectJsonUploadRef = useRef<HTMLInputElement>(null);
  const csvUploadRef = useRef<HTMLInputElement>(null);

  // Save Current Properties Setup as Home Page Template state
  const [showSaveTemplateForm, setShowSaveTemplateForm] =
    useState<boolean>(false);
  const [customTemplateNameInput, setCustomTemplateNameInput] =
    useState<string>('');
  const [saveTemplateIncludeDesign, setSaveTemplateIncludeDesign] =
    useState<boolean>(true);
  const [savedTemplateNotice, setSavedTemplateNotice] = useState<string | null>(
    null
  );

  // Mail Merge & Variable Data List Manager UI state
  const [savedVariableLists, setSavedVariableLists] = useState<
    VariableDataList[]
  >(() => loadSavedVariableLists());
  const [showListManagerModal, setShowListManagerModal] =
    useState<boolean>(false);
  const [showCreateListForm, setShowCreateListForm] = useState<boolean>(false);
  const [newListNameInput, setNewListNameInput] = useState<string>('');
  const [newListCategoryInput, setNewListCategoryInput] =
    useState<VariableListCategory>('custom');
  const [newListColumnsInput, setNewListColumnsInput] = useState<string>(
    'Name, Company, Address, CityStateZip'
  );
  const [listSearchQuery, setListSearchQuery] = useState<string>('');
  const [renamingColumnOldName, setRenamingColumnOldName] = useState<
    string | null
  >(null);
  const [renamingColumnNewName, setRenamingColumnNewName] =
    useState<string>('');
  const [showPasteCsvModal, setShowPasteCsvModal] = useState<boolean>(false);
  const [pasteCsvText, setPasteCsvText] = useState<string>('');
  const [pasteListNameInput, setPasteListNameInput] = useState<string>('');
  const [newMergeFieldName, setNewMergeFieldName] = useState<string>('');

  // Bank Tabs / Multi-Tab Divider inline canvas editing state
  const [editingCanvasTabIndex, setEditingCanvasTabIndex] = useState<
    number | null
  >(null);

  // Photoshop-style Layers Palette drag-and-drop & Layer Style (fx) state
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<
    'above' | 'below' | null
  >(null);
  const [showLayerFxPanel, setShowLayerFxPanel] = useState<boolean>(false);
  const [editingLayerNameId, setEditingLayerNameId] = useState<string | null>(
    null
  );

  // Smart Guides & Magnetic Auto-Snap Alignment state (Snap to Card Center, Safe Margins, Card Edges & Other Elements)
  interface SmartSnapGuide {
    axis: 'x' | 'y';
    positionIn: number;
    label: string;
    kind: 'center' | 'margin' | 'edge' | 'object';
  }
  const [smartSnapEnabled, setSmartSnapEnabled] = useState<boolean>(true);
  const [activeSnapGuides, setActiveSnapGuides] = useState<SmartSnapGuide[]>([]);

  // Left Panel Pages drag-and-drop rearrange state
  const [draggedPageIdx, setDraggedPageIdx] = useState<number | null>(null);
  const [dragOverPageIdx, setDragOverPageIdx] = useState<number | null>(null);
  const [dragOverPagePos, setDragOverPagePos] = useState<
    'above' | 'below' | null
  >(null);

  const currentPage = project.pages[activePageIndex] || project.pages[0];
  const activeMasterKey = currentPage.masterId;
  const activeMaster: MasterDesign =
    currentPage.slotOverrides?.[activeSlotIndex] ||
    project.masters[activeMasterKey];
  const { widthIn: unitW, heightIn: unitH } = getDesignUnitSize(project.template);

  const selectedElement =
    activeMaster.elements.find((e) => e.id === selectedElementId) || null;

  const updateActiveMaster = (updater: (m: MasterDesign) => MasterDesign) => {
    onUpdateProject((prev) => {
      const pg = prev.pages[activePageIndex] || prev.pages[0];
      if (pg?.slotOverrides?.[activeSlotIndex]) {
        const updatedSlotMaster = updater(pg.slotOverrides[activeSlotIndex]);
        return {
          ...prev,
          pages: prev.pages.map((p, idx) =>
            idx === activePageIndex
              ? {
                  ...p,
                  slotOverrides: {
                    ...p.slotOverrides,
                    [activeSlotIndex]: updatedSlotMaster,
                  },
                }
              : p
          ),
        };
      }
      return {
        ...prev,
        masters: {
          ...prev.masters,
          [activeMasterKey]: updater(prev.masters[activeMasterKey]),
        },
      };
    });
  };

  const updateSelectedElement = (patch: Partial<CanvasElement>) => {
    if (!selectedElementId) return;
    updateActiveMaster((m) => ({
      ...m,
      elements: m.elements.map((el) =>
        el.id === selectedElementId ? { ...el, ...patch } : el
      ),
    }));
  };

  const handleAddElement = (type: ElementType) => {
    const newId = `el-${Date.now()}`;
    let newEl: CanvasElement;

    if (type === 'text') {
      newEl = {
        id: newId,
        type: 'text',
        role: 'body',
        name: 'Text Box',
        x: Number((unitW * 0.15).toFixed(2)),
        y: Number((unitH * 0.35).toFixed(2)),
        width: Number((unitW * 0.6).toFixed(2)),
        height: 0.28,
        rotation: 0,
        opacity: 1,
        text: 'Double-click or edit in sidebar',
        fontFamily: 'Inter',
        fontSize: 10,
        fontWeight: '600',
        color: '#0f172a',
        textAlign: 'left',
      };
    } else if (type === 'rect' || type === 'rounded-rect') {
      newEl = {
        id: newId,
        type,
        role: 'accent',
        name: type === 'rounded-rect' ? 'Rounded Badge' : 'Rectangle Shape',
        x: Number((unitW * 0.2).toFixed(2)),
        y: Number((unitH * 0.25).toFixed(2)),
        width: Number((unitW * 0.35).toFixed(2)),
        height: Number((unitH * 0.25).toFixed(2)),
        rotation: 0,
        opacity: 1,
        fill: '#cc0000',
        borderRadius: type === 'rounded-rect' ? 8 : 0,
      };
    } else if (type === 'circle') {
      newEl = {
        id: newId,
        type: 'circle',
        role: 'accent',
        name: 'Circle Shape',
        x: Number((unitW * 0.35).toFixed(2)),
        y: Number((unitH * 0.25).toFixed(2)),
        width: 0.45,
        height: 0.45,
        rotation: 0,
        opacity: 1,
        fill: '#d97706',
      };
    } else if (type === 'line' || type === 'arrow') {
      newEl = {
        id: newId,
        type,
        role: 'accent',
        name: type === 'arrow' ? 'Arrow Line' : 'Divider Line',
        x: Number((unitW * 0.12).toFixed(2)),
        y: Number((unitH * 0.5).toFixed(2)),
        width: Number((unitW * 0.75).toFixed(2)),
        height: 0.04,
        rotation: 0,
        opacity: 1,
        stroke: '#cc0000',
        strokeWidth: 1.5,
      };
    } else if (type === 'qr') {
      newEl = {
        id: newId,
        type: 'qr',
        role: 'qr',
        name: 'QR Code',
        x: Number((unitW - 0.65).toFixed(2)),
        y: Number((unitH - 0.65).toFixed(2)),
        width: 0.5,
        height: 0.5,
        rotation: 0,
        opacity: 1,
        qrValue: 'https://geppysprintshop.com',
        fill: '#0f172a',
      };
    } else {
      newEl = {
        id: newId,
        type: 'rounded-rect',
        role: 'logo',
        name: 'Star / Badge Emblem',
        x: Number((unitW * 0.1).toFixed(2)),
        y: Number((unitH * 0.15).toFixed(2)),
        width: 0.45,
        height: 0.45,
        rotation: 0,
        opacity: 1,
        fill: '#eab308',
        borderRadius: 99,
        text: '★',
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
      };
    }

    updateActiveMaster((m) => ({
      ...m,
      elements: [...m.elements, newEl],
    }));
    setSelectedElementId(newId);
    setActiveTool('select');
  };

  /**
   * Updates the project's Sequential Print Numbering configuration
   */
  const handleUpdateNumbering = (patch: Partial<NumberingConfig>) => {
    onUpdateProject((prev) => {
      const current: NumberingConfig = prev.numbering || {
        enabled: true,
        startNumber: 1,
        step: 1,
        padDigits: 4,
        prefix: 'No. ',
        suffix: '',
        orderMode: 'across-then-down',
        totalSheets: Math.max(
          1,
          prev.pages.filter((p) => p.side === 'front').length
        ),
      };
      return {
        ...prev,
        numbering: {
          ...current,
          ...patch,
        },
      };
    });
  };

  /**
   * Inserts a Sequential Print Numbering box (e.g., "No. 0001") or a synchronized
   * Raffle Ticket Stub + Main Ticket dual numbering pair on the active Master.
   */
  const handleAddNumberingElement = (options?: {
    asTicketStubPair?: boolean;
    verticalStub?: boolean;
  }) => {
    const baseCount = activeMaster.elements.filter(
      (e) => e.isSequentialNumber || e.text?.includes('{{NUM}}')
    ).length;

    const id1 = `num-${Date.now()}`;
    const mainW = Number(Math.min(1.25, Math.max(0.75, unitW * 0.28)).toFixed(2));
    const mainH = 0.24;

    const mainEl: CanvasElement = {
      id: id1,
      type: 'text',
      role: 'body',
      name: options?.asTicketStubPair
        ? 'Ticket Main Number'
        : `Sequential Number #${baseCount + 1}`,
      x: Number(Math.max(0.08, unitW - mainW - 0.14).toFixed(2)),
      y: Number(Math.max(0.08, unitH * 0.12).toFixed(2)),
      width: mainW,
      height: mainH,
      rotation: 0,
      opacity: 1,
      text: '{{NUM}}',
      isSequentialNumber: true,
      fontFamily: 'JetBrains Mono',
      fontSize: 11,
      fontWeight: 'bold',
      color: '#cc0000',
      textAlign: 'right',
    };

    const newElements: CanvasElement[] = [mainEl];

    if (options?.asTicketStubPair) {
      const stubId = `num-stub-${Date.now() + 1}`;
      const stubEl: CanvasElement = {
        id: stubId,
        type: 'text',
        role: 'body',
        name: 'Ticket Stub Number',
        x: Number(Math.max(0.08, unitW * 0.06).toFixed(2)),
        y: options.verticalStub
          ? Number(Math.max(0.1, unitH * 0.38).toFixed(2))
          : Number(Math.max(0.08, unitH * 0.12).toFixed(2)),
        width: mainW,
        height: mainH,
        rotation: options.verticalStub ? 270 : 0,
        opacity: 1,
        text: '{{NUM}}',
        isSequentialNumber: true,
        fontFamily: 'JetBrains Mono',
        fontSize: 10.5,
        fontWeight: 'bold',
        color: '#cc0000',
        textAlign: 'center',
      };
      newElements.unshift(stubEl);
    }

    onUpdateProject((prev) => {
      const currentNum: NumberingConfig = prev.numbering || {
        enabled: true,
        startNumber: 1,
        step: 1,
        padDigits: 4,
        prefix: 'No. ',
        suffix: '',
        orderMode: 'across-then-down',
        totalSheets: Math.max(
          1,
          prev.pages.filter((p) => p.side === 'front').length
        ),
      };
      const pg = prev.pages[activePageIndex] || prev.pages[0];
      if (pg?.slotOverrides?.[activeSlotIndex]) {
        const curSlot = pg.slotOverrides[activeSlotIndex];
        return {
          ...prev,
          numbering: { ...currentNum, enabled: true },
          pages: prev.pages.map((p, idx) =>
            idx === activePageIndex
              ? {
                  ...p,
                  slotOverrides: {
                    ...p.slotOverrides,
                    [activeSlotIndex]: {
                      ...curSlot,
                      elements: [...curSlot.elements, ...newElements],
                    },
                  },
                }
              : p
          ),
        };
      }
      const curMaster = prev.masters[activeMasterKey];
      return {
        ...prev,
        numbering: { ...currentNum, enabled: true },
        masters: {
          ...prev.masters,
          [activeMasterKey]: {
            ...curMaster,
            elements: [...curMaster.elements, ...newElements],
          },
        },
      };
    });

    setSelectedElementId(id1);
    setActiveTool('select');
    setRightTab('properties');
  };

  /**
   * Populates the Left Pages Panel with `targetSheets` numbered Front sheets
   * so the user can click through and inspect every numbered sheet in the run.
   */
  const handlePopulateNumberedSheets = (targetSheets: number) => {
    const clamped = Math.max(1, Math.min(200, Math.round(targetSheets)));
    onUpdateProject((prev) => {
      const existingFronts = prev.pages.filter((p) => p.side === 'front');
      const existingBacks = prev.pages.filter((p) => p.side === 'back');
      const nextFronts = [...existingFronts];

      while (nextFronts.length < clamped) {
        const sheetNum = nextFronts.length + 1;
        nextFronts.push({
          id: `page-num-${Date.now()}-${sheetNum}`,
          name: `Numbered Sheet ${sheetNum}`,
          side: 'front',
          masterId: 'master-a',
          ignoreMaster: false,
          pageElements: [],
        });
      }
      if (nextFronts.length > clamped) {
        nextFronts.length = clamped;
      }

      const combinedPages = [...nextFronts, ...existingBacks];
      return {
        ...prev,
        pages: combinedPages,
        numbering: {
          ...(prev.numbering || {
            enabled: true,
            startNumber: 1,
            step: 1,
            padDigits: 4,
            prefix: 'No. ',
            suffix: '',
            orderMode: 'across-then-down',
            totalSheets: clamped,
          }),
          enabled: true,
          totalSheets: clamped,
        },
      };
    });
    setLeftTab('pages');
  };

  /**
   * Parses CSV or Tab-Separated (Excel/Sheets paste) text into MailMergeConfig fields & records
   */
  const parseCsvToMailMerge = (rawText: string): MailMergeConfig | null => {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 1) return null;

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const splitRow = (line: string): string[] => {
      if (delimiter === '\t') return line.split('\t').map((s) => s.trim());
      const cols: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          cols.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      cols.push(cur.trim());
      return cols;
    };

    const headers = splitRow(lines[0]).map(
      (h, idx) => h.replace(/^["']|["']$/g, '') || `Field${idx + 1}`
    );
    const records: Record<string, string>[] = [];

    for (let r = 1; r < lines.length; r++) {
      const vals = splitRow(lines[r]);
      const rec: Record<string, string> = {};
      headers.forEach((h, cIdx) => {
        rec[h] = (vals[cIdx] || '').replace(/^["']|["']$/g, '');
      });
      records.push(rec);
    }

    if (records.length === 0) {
      const emptyRec: Record<string, string> = {};
      headers.forEach((h) => {
        emptyRec[h] = `Sample ${h}`;
      });
      records.push(emptyRec);
    }

    return {
      enabled: true,
      fields: headers,
      records,
    };
  };

  const syncVariableListsState = (nextLists: VariableDataList[]) => {
    setSavedVariableLists(nextLists);
    saveVariableListsToStorage(nextLists);
  };

  const handleUpdateMailMerge = (patch: Partial<MailMergeConfig>) => {
    const cur: MailMergeConfig =
      project.mailMerge || JSON.parse(JSON.stringify(DEFAULT_SAMPLE_MAIL_MERGE));
    const nextMm: MailMergeConfig = {
      ...cur,
      ...patch,
    };

    onUpdateProject((prev) => ({
      ...prev,
      mailMerge: nextMm,
    }));

    // Keep the active saved list in `savedVariableLists` synchronized with any column/row/name edits
    if (
      nextMm.activeListId &&
      (patch.fields !== undefined ||
        patch.records !== undefined ||
        patch.activeListName !== undefined)
    ) {
      setSavedVariableLists((prevLists) => {
        const exists = prevLists.some((l) => l.id === nextMm.activeListId);
        if (!exists) return prevLists;
        const updated = prevLists.map((l) =>
          l.id === nextMm.activeListId
            ? {
                ...l,
                name: nextMm.activeListName || l.name,
                fields: nextMm.fields,
                records: nextMm.records,
                updatedAt: new Date().toISOString(),
              }
            : l
        );
        saveVariableListsToStorage(updated);
        return updated;
      });
    }
  };

  /**
   * Switches the project's active Variable Data / Mail Merge list to a saved list by ID
   */
  const handleSelectVariableList = (listId: string) => {
    const found = savedVariableLists.find((l) => l.id === listId);
    if (!found) return;
    setRenamingColumnOldName(null);
    onUpdateProject((prev) => ({
      ...prev,
      mailMerge: {
        enabled: true,
        activeListId: found.id,
        activeListName: found.name,
        previewRecordIndex: 0,
        fields: JSON.parse(JSON.stringify(found.fields)),
        records: JSON.parse(JSON.stringify(found.records)),
      },
    }));
  };

  /**
   * Creates a brand-new Variable Data / Contact list from scratch, saves it to the library, and activates it
   */
  const handleCreateVariableListFromScratch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const listName =
      newListNameInput.trim() ||
      `Custom List ${savedVariableLists.length + 1}`;
    const parsedCols = newListColumnsInput
      .split(',')
      .map((s) => s.trim().replace(/[^a-zA-Z0-9_ -]/g, ''))
      .filter(Boolean);
    const fields =
      parsedCols.length > 0 ? parsedCols : ['Title', 'Subtitle', 'Value'];

    const starterRecords: Record<string, string>[] = [1, 2, 3].map((rowNum) => {
      const rec: Record<string, string> = {};
      fields.forEach((f) => {
        rec[f] = `${f} ${rowNum}`;
      });
      return rec;
    });

    const newList: VariableDataList = {
      id: `list-custom-${Date.now()}`,
      name: listName,
      category: newListCategoryInput,
      description: `Custom variable list (${fields.join(', ')})`,
      fields,
      records: starterRecords,
      updatedAt: new Date().toISOString(),
    };

    const nextLists = [newList, ...savedVariableLists];
    syncVariableListsState(nextLists);

    onUpdateProject((prev) => ({
      ...prev,
      mailMerge: {
        enabled: true,
        activeListId: newList.id,
        activeListName: newList.name,
        previewRecordIndex: 0,
        fields: newList.fields,
        records: newList.records,
      },
    }));

    setNewListNameInput('');
    setShowCreateListForm(false);
  };

  /**
   * Imports raw CSV/TSV text (from file upload or clipboard paste) as a named Saved List in the library
   */
  const handleImportCsvAsNewSavedList = (
    rawText: string,
    suggestedName: string,
    sourceFileName?: string
  ) => {
    const parsed = parseCsvToMailMerge(rawText);
    if (!parsed) return;

    const cleanName =
      suggestedName.trim() ||
      (sourceFileName
        ? sourceFileName.replace(/\.(csv|tsv|txt)$/i, '')
        : `Imported List ${savedVariableLists.length + 1}`);

    const newList: VariableDataList = {
      id: `list-csv-${Date.now()}`,
      name: cleanName,
      category: 'contacts',
      description: sourceFileName
        ? `Imported from ${sourceFileName} (${parsed.records.length} rows)`
        : `Imported spreadsheet (${parsed.records.length} rows)`,
      fields: parsed.fields,
      records: parsed.records,
      updatedAt: new Date().toISOString(),
      sourceFileName,
    };

    const nextLists = [newList, ...savedVariableLists];
    syncVariableListsState(nextLists);

    onUpdateProject((prev) => ({
      ...prev,
      mailMerge: {
        enabled: true,
        activeListId: newList.id,
        activeListName: newList.name,
        previewRecordIndex: 0,
        fields: newList.fields,
        records: newList.records,
      },
    }));
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name;
    const baseName = fileName.replace(/\.(csv|tsv|txt)$/i, '');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleImportCsvAsNewSavedList(reader.result, baseName, fileName);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDuplicateVariableList = (listId: string) => {
    const src = savedVariableLists.find((l) => l.id === listId);
    if (!src) return;
    const dup: VariableDataList = {
      ...JSON.parse(JSON.stringify(src)),
      id: `list-dup-${Date.now()}`,
      name: `${src.name} (Copy)`,
      updatedAt: new Date().toISOString(),
    };
    const nextLists = [dup, ...savedVariableLists];
    syncVariableListsState(nextLists);
    handleSelectVariableList(dup.id);
  };

  const handleDeleteVariableList = (listId: string) => {
    if (savedVariableLists.length <= 1) return;
    const nextLists = savedVariableLists.filter((l) => l.id !== listId);
    syncVariableListsState(nextLists);
    if (project.mailMerge?.activeListId === listId && nextLists[0]) {
      const fallback = nextLists[0];
      onUpdateProject((prev) => ({
        ...prev,
        mailMerge: {
          enabled: Boolean(prev.mailMerge?.enabled),
          activeListId: fallback.id,
          activeListName: fallback.name,
          previewRecordIndex: 0,
          fields: JSON.parse(JSON.stringify(fallback.fields)),
          records: JSON.parse(JSON.stringify(fallback.records)),
        },
      }));
    }
  };

  /**
   * Renames a column/variable field in the active list AND updates any `{{OldField}}` tags on canvas elements
   */
  const handleRenameColumnInActiveList = (
    oldField: string,
    rawNewField: string
  ) => {
    const cleanNew = rawNewField.trim().replace(/[{}]/g, '');
    setRenamingColumnOldName(null);
    if (!cleanNew || cleanNew === oldField) return;

    const mm: MailMergeConfig =
      project.mailMerge || JSON.parse(JSON.stringify(DEFAULT_SAMPLE_MAIL_MERGE));
    if (mm.fields.includes(cleanNew)) return;

    const nextFields = mm.fields.map((f) => (f === oldField ? cleanNew : f));
    const nextRecords = mm.records.map((rec) => {
      const nextRec: Record<string, string> = {};
      Object.keys(rec).forEach((k) => {
        nextRec[k === oldField ? cleanNew : k] = rec[k];
      });
      return nextRec;
    });

    handleUpdateMailMerge({
      fields: nextFields,
      records: nextRecords,
    });

    // Also update any `{{oldField}}` tags on Master A and Master B elements so canvas variables stay linked
    const oldTokenRegex = new RegExp(
      `\\{\\{\\s*${oldField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`,
      'gi'
    );
    const newToken = `{{${cleanNew}}}`;
    onUpdateProject((prev) => ({
      ...prev,
      masters: {
        'master-a': {
          ...prev.masters['master-a'],
          elements: prev.masters['master-a'].elements.map((el) => ({
            ...el,
            text: el.text ? el.text.replace(oldTokenRegex, newToken) : el.text,
            qrValue: el.qrValue
              ? el.qrValue.replace(oldTokenRegex, newToken)
              : el.qrValue,
          })),
        },
        'master-b': {
          ...prev.masters['master-b'],
          elements: prev.masters['master-b'].elements.map((el) => ({
            ...el,
            text: el.text ? el.text.replace(oldTokenRegex, newToken) : el.text,
            qrValue: el.qrValue
              ? el.qrValue.replace(oldTokenRegex, newToken)
              : el.qrValue,
          })),
        },
      },
    }));
  };

  const handleDeleteColumnFromActiveList = (fieldToDelete: string) => {
    const mm: MailMergeConfig =
      project.mailMerge || JSON.parse(JSON.stringify(DEFAULT_SAMPLE_MAIL_MERGE));
    if (mm.fields.length <= 1) return;
    const nextFields = mm.fields.filter((f) => f !== fieldToDelete);
    const nextRecords = mm.records.map((rec) => {
      const copy = { ...rec };
      delete copy[fieldToDelete];
      return copy;
    });
    handleUpdateMailMerge({
      fields: nextFields,
      records: nextRecords,
    });
  };

  const handleExportActiveListToCsv = () => {
    const mm: MailMergeConfig =
      project.mailMerge || JSON.parse(JSON.stringify(DEFAULT_SAMPLE_MAIL_MERGE));
    const csvContent = exportVariableListToCsvString(mm.fields, mm.records);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (mm.activeListName || 'Variable_Data_List').replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );
    a.href = url;
    a.download = `${safeName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Inserts a Mail Merge `{{FieldName}}` token into the selected text box or creates a new text layer for that field
   */
  const handleInsertMergeField = (fieldName: string) => {
    const token = `{{${fieldName}}}`;
    if (!project.mailMerge?.enabled) {
      handleUpdateMailMerge({ enabled: true });
    }
    if (selectedElement && selectedElement.type === 'text') {
      const curText = selectedElement.text || '';
      updateSelectedElement({
        text: curText ? `${curText} ${token}` : token,
      });
      return;
    }

    const newId = `merge-${Date.now()}`;
    const existingMergeCount = activeMaster.elements.filter((el) =>
      el.text?.includes('{{')
    ).length;

    const newEl: CanvasElement = {
      id: newId,
      type: 'text',
      role: 'body',
      name: `Merge: ${fieldName}`,
      x: Number(Math.min(unitW * 0.6, 0.25).toFixed(2)),
      y: Number(
        Math.min(unitH - 0.3, 0.28 + existingMergeCount * 0.22).toFixed(2)
      ),
      width: Number(Math.max(1.1, unitW * 0.65).toFixed(2)),
      height: 0.24,
      rotation: 0,
      opacity: 1,
      text: token,
      fontFamily: 'Inter',
      fontSize: 10,
      fontWeight: '600',
      color: '#0f172a',
      textAlign: 'left',
    };

    updateActiveMaster((m) => ({
      ...m,
      elements: [...m.elements, newEl],
    }));
    setSelectedElementId(newId);
    setActiveTool('select');
  };

  /**
   * Inserts a complete formatted Multi-Line Mailing Address block (`{{Name}}\n{{Company}}\n{{Address}}\n{{CityStateZip}}`)
   */
  const handleInsertMailingAddressBlock = () => {
    if (!project.mailMerge?.enabled) {
      handleUpdateMailMerge({ enabled: true });
    }
    const fields =
      project.mailMerge?.fields || DEFAULT_SAMPLE_MAIL_MERGE.fields;
    const blockLines =
      fields.includes('Name') && fields.includes('Address')
        ? [
            '{{Name}}',
            fields.includes('Company') ? '{{Company}}' : '',
            '{{Address}}',
            fields.includes('CityStateZip') ? '{{CityStateZip}}' : '',
          ]
            .filter(Boolean)
            .join('\n')
        : fields
            .slice(0, 4)
            .map((f) => `{{${f}}}`)
            .join('\n');

    const newId = `addr-${Date.now()}`;
    const blockW = Number(Math.min(unitW * 0.72, 2.8).toFixed(2));
    const blockH = Number(Math.min(unitH * 0.48, 0.95).toFixed(2));

    const newEl: CanvasElement = {
      id: newId,
      type: 'text',
      role: 'address',
      name: 'Mail Merge Address Block',
      x: Number(((unitW - blockW) / 2).toFixed(2)),
      y: Number(((unitH - blockH) / 2).toFixed(2)),
      width: blockW,
      height: blockH,
      rotation: 0,
      opacity: 1,
      text: blockLines,
      fontFamily: 'Inter',
      fontSize: 10,
      fontWeight: '500',
      color: '#0f172a',
      textAlign: 'left',
      lineHeight: 1.28,
    };

    updateActiveMaster((m) => ({
      ...m,
      elements: [...m.elements, newEl],
    }));
    setSelectedElementId(newId);
    setActiveTool('select');
  };

  /**
   * Updates Bank Tab configuration (count, labels, colors, fontSizePt, displayMode)
   */
  const handleUpdateBankTabConfig = (patch: Partial<BankTabConfig>) => {
    onUpdateProject((prev) => {
      const baseCount =
        patch.count ||
        prev.bankTabConfig?.count ||
        prev.template.bankTabs ||
        3;
      const curCfg: BankTabConfig =
        prev.bankTabConfig || createDefaultBankTabConfig(baseCount);
      const nextCount = patch.count ?? curCfg.count;

      const nextLabels = [...(patch.labels ?? curCfg.labels)];
      while (nextLabels.length < nextCount) {
        nextLabels.push(`Tab ${nextLabels.length + 1}`);
      }

      const nextColors = [
        ...(patch.colors ?? curCfg.colors ?? Array(nextCount).fill('#ffffff')),
      ];
      while (nextColors.length < nextCount) {
        nextColors.push('#ffffff');
      }

      const nextCfg: BankTabConfig = {
        ...curCfg,
        ...patch,
        count: nextCount,
        labels: nextLabels,
        colors: nextColors,
      };

      return {
        ...prev,
        bankTabConfig: nextCfg,
        template: {
          ...prev.template,
          bankTabs: nextCfg.enabled ? nextCount : undefined,
        },
      };
    });
  };

  /**
   * Changes the number of Bank Tabs (or disables them when count === 0).
   * If enabling Bank Tabs on a standard 8.5x11 sheet, widens sheet to 9x11" (8.5" body + 0.5" tab ear).
   */
  const handleSetBankTabCount = (newCount: number) => {
    setEditingCanvasTabIndex(null);
    if (newCount <= 0) {
      onUpdateProject((prev) => ({
        ...prev,
        bankTabConfig: prev.bankTabConfig
          ? { ...prev.bankTabConfig, enabled: false }
          : undefined,
        template: {
          ...prev.template,
          bankTabs: undefined,
        },
      }));
      return;
    }

    onUpdateProject((prev) => {
      const curCfg =
        prev.bankTabConfig || createDefaultBankTabConfig(newCount);
      const nextLabels = [...curCfg.labels];
      while (nextLabels.length < newCount) {
        nextLabels.push(`Tab ${nextLabels.length + 1}`);
      }
      const nextColors = [
        ...(curCfg.colors || Array(newCount).fill('#ffffff')),
      ];
      while (nextColors.length < newCount) {
        nextColors.push('#ffffff');
      }

      const shouldExpandWidthTo9 =
        prev.template.sheetWidthIn === 8.5 &&
        prev.template.sheetHeightIn === 11 &&
        !prev.template.imposition;

      return {
        ...prev,
        bankTabConfig: {
          ...curCfg,
          enabled: true,
          count: newCount,
          labels: nextLabels,
          colors: nextColors,
        },
        template: {
          ...prev.template,
          bankTabs: newCount,
          sheetWidthIn: shouldExpandWidthTo9
            ? 9
            : prev.template.sheetWidthIn,
        },
      };
    });
  };

  const handleUpdateSingleTabLabel = (tabIdx: number, newLabel: string) => {
    const activeCount =
      project.bankTabConfig?.count || project.template.bankTabs || 3;
    const curCfg =
      project.bankTabConfig || createDefaultBankTabConfig(activeCount);
    const nextLabels = Array.from({ length: activeCount }, (_, i) =>
      i === tabIdx ? newLabel : curCfg.labels[i] ?? `Tab ${i + 1}`
    );
    handleUpdateBankTabConfig({
      enabled: true,
      count: activeCount,
      labels: nextLabels,
    });
  };

  const handleUpdateSingleTabColor = (tabIdx: number, newColor: string) => {
    const activeCount =
      project.bankTabConfig?.count || project.template.bankTabs || 3;
    const curCfg =
      project.bankTabConfig || createDefaultBankTabConfig(activeCount);
    const nextColors = Array.from({ length: activeCount }, (_, i) =>
      i === tabIdx ? newColor : curCfg.colors?.[i] || '#ffffff'
    );
    handleUpdateBankTabConfig({
      enabled: true,
      count: activeCount,
      colors: nextColors,
    });
  };

  const handleAutoColorCodeTabs = (resetToWhite: boolean = false) => {
    const activeCount =
      project.bankTabConfig?.count || project.template.bankTabs || 3;
    const nextColors = Array.from({ length: activeCount }, (_, i) =>
      resetToWhite
        ? '#ffffff'
        : DEFAULT_TAB_ACCENT_PALETTE[i % DEFAULT_TAB_ACCENT_PALETTE.length]
    );
    handleUpdateBankTabConfig({
      enabled: true,
      count: activeCount,
      colors: nextColors,
    });
  };

  /**
   * Creates 1 Front Page per Bank Tab in the Left Pages Panel (e.g. Page 1: Tab 1, Page 2: Tab 2, ..., Page N: Tab N)
   * and sets displayMode to 'single-tab-per-page' so each divider sheet has its own collated tab ear!
   */
  const handleBuildTabDividerPages = () => {
    const activeCount =
      project.bankTabConfig?.count || project.template.bankTabs || 3;
    const curCfg =
      project.bankTabConfig || createDefaultBankTabConfig(activeCount);

    onUpdateProject((prev) => {
      const existingBacks = prev.pages.filter((p) => p.side === 'back');
      const newFrontPages = Array.from({ length: activeCount }, (_, i) => {
        const tabLabel = curCfg.labels[i] || `Tab ${i + 1}`;
        const existingFront = prev.pages.filter((p) => p.side === 'front')[i];
        return {
          id: existingFront?.id || `page-tab-${Date.now()}-${i + 1}`,
          name: `Tab ${i + 1}: ${tabLabel.slice(0, 18)}`,
          side: 'front' as const,
          masterId: 'master-a' as const,
          ignoreMaster: existingFront?.ignoreMaster ?? false,
          pageElements: existingFront?.pageElements || [],
          slotOverrides: existingFront?.slotOverrides,
          activeTabIndex: i,
        };
      });

      return {
        ...prev,
        pages: [...newFrontPages, ...existingBacks],
        bankTabConfig: {
          ...curCfg,
          enabled: true,
          count: activeCount,
          displayMode: 'single-tab-per-page',
        },
        template: {
          ...prev.template,
          bankTabs: activeCount,
        },
      };
    });
    setActivePageIndex(0);
    setLeftTab('pages');
  };

  /**
   * Saves the current Properties setup (Sheet Size, Orientation, Multi-Up Imposition & Margins,
   * Bleed, Safe Margins, Sequential Numbering, Mail Merge, Bank Tabs, and optionally Master A/B Design)
   * as a reusable Custom Template on the Home Page Dashboard!
   */
  const handleSaveCurrentSetupAsTemplate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onSaveCurrentAsTemplate) return;

    const imp = project.template.imposition;
    const defaultName = imp
      ? `${imp.cols * imp.rows}-Up (${imp.cols}×${imp.rows}) ${
          imp.marginLeftIn > 0 ? `${imp.marginLeftIn}" Out` : 'Custom'
        } Sheet`
      : `${project.template.sheetWidthIn}×${project.template.sheetHeightIn}" Custom Setup`;

    const finalName = customTemplateNameInput.trim() || defaultName;
    const subtitleParts: string[] = [
      `${project.template.sheetWidthIn} × ${project.template.sheetHeightIn}"`,
    ];
    if (imp) {
      subtitleParts.push(
        `${imp.cols}×${imp.rows} (${imp.cols * imp.rows}-Up)`
      );
      if (imp.marginLeftIn > 0 || imp.gapXIn > 0) {
        subtitleParts.push(
          `${imp.marginLeftIn}" Out / ${imp.gapXIn}" Ctr`
        );
      }
    }
    if (
      project.bankTabConfig?.enabled !== false &&
      (project.bankTabConfig?.count || project.template.bankTabs)
    ) {
      const tc = project.bankTabConfig?.count || project.template.bankTabs;
      subtitleParts.push(`${tc} Bank Tabs`);
    }
    if (project.numbering?.enabled) {
      subtitleParts.push('Numbered');
    }
    if (project.mailMerge?.enabled) {
      subtitleParts.push('Mail Merge');
    }

    const newSavedTpl: PrintTemplate = {
      ...JSON.parse(JSON.stringify(project.template)),
      id: `saved-tpl-${Date.now()}`,
      name: finalName,
      subtitle: subtitleParts.join(' • '),
      category: imp ? 'other' : project.template.category,
      defaultBleedIn: project.bleedIn,
      defaultMarginXIn: project.marginXIn,
      defaultMarginYIn: project.marginYIn,
      badge: 'Saved Preset',
      isCustomSaved: true,
      savedAt: new Date().toISOString(),
      savedSetup: {
        bleedIn: project.bleedIn,
        marginXIn: project.marginXIn,
        marginYIn: project.marginYIn,
        showCropMarks: project.showCropMarks,
        showBleedGuide: project.showBleedGuide,
        showMarginGuide: project.showMarginGuide,
        showGridLines: project.showGridLines,
        relativeToMargin: project.relativeToMargin,
        numbering: project.numbering
          ? JSON.parse(JSON.stringify(project.numbering))
          : undefined,
        mailMerge: project.mailMerge
          ? JSON.parse(JSON.stringify(project.mailMerge))
          : undefined,
        bankTabConfig: project.bankTabConfig
          ? JSON.parse(JSON.stringify(project.bankTabConfig))
          : undefined,
        masters: saveTemplateIncludeDesign
          ? JSON.parse(JSON.stringify(project.masters))
          : undefined,
      },
    };

    onSaveCurrentAsTemplate(newSavedTpl);
    setShowSaveTemplateForm(false);
    setSavedTemplateNotice(`Saved "${finalName}" to Home Page Templates!`);
    setTimeout(() => {
      setSavedTemplateNotice(null);
    }, 5500);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Also save uploaded image into the File Locker automatically
    ingestUploadedFileToLocker(file)
      .then(async (item) => {
        const existing = await loadLockerFiles();
        await saveLockerFilesList([item, ...existing]);
      })
      .catch(() => {
        // Ignore locker storage errors
      });
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const newId = `img-${Date.now()}`;
        const newEl: CanvasElement = {
          id: newId,
          type: 'image',
          role: 'logo',
          name: file.name.slice(0, 20),
          x: Number((unitW * 0.1).toFixed(2)),
          y: Number((unitH * 0.12).toFixed(2)),
          width: Number((unitW * 0.35).toFixed(2)),
          height: Number((unitH * 0.35).toFixed(2)),
          rotation: 0,
          opacity: 1,
          imageUrl: reader.result,
        };
        updateActiveMaster((m) => ({
          ...m,
          elements: [...m.elements, newEl],
        }));
        setSelectedElementId(newId);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteSelected = () => {
    if (!selectedElementId) return;
    updateActiveMaster((m) => ({
      ...m,
      elements: m.elements.filter((el) => el.id !== selectedElementId),
    }));
    setSelectedElementId(null);
  };

  const handleCopy = () => {
    if (selectedElement) setClipboardElement({ ...selectedElement });
  };

  const handleCut = () => {
    if (selectedElement) {
      setClipboardElement({ ...selectedElement });
      handleDeleteSelected();
    }
  };

  const handlePaste = () => {
    if (!clipboardElement) return;
    const newId = `el-${Date.now()}`;
    const pasted: CanvasElement = {
      ...clipboardElement,
      id: newId,
      name: `${clipboardElement.name} (Copy)`,
      x: Number(Math.min(unitW - 0.3, clipboardElement.x + 0.12).toFixed(2)),
      y: Number(Math.min(unitH - 0.2, clipboardElement.y + 0.12).toFixed(2)),
    };
    updateActiveMaster((m) => ({
      ...m,
      elements: [...m.elements, pasted],
    }));
    setSelectedElementId(newId);
  };

  const handleLayerOrder = (
    dir: 'up' | 'down' | 'front' | 'back',
    targetElementId?: string
  ) => {
    const idToMove = targetElementId || selectedElementId;
    if (!idToMove) return;
    updateActiveMaster((m) => {
      const idx = m.elements.findIndex((e) => e.id === idToMove);
      if (idx === -1) return m;
      const copy = [...m.elements];
      const [item] = copy.splice(idx, 1);

      if (dir === 'front') {
        copy.push(item);
      } else if (dir === 'back') {
        copy.unshift(item);
      } else {
        const targetIdx = dir === 'up' ? idx + 1 : idx - 1;
        if (targetIdx < 0 || targetIdx > copy.length) return m;
        copy.splice(targetIdx, 0, item);
      }
      return { ...m, elements: copy };
    });
  };

  /**
   * Reorders layers via drag-and-drop in the visual Layers Palette.
   * Note: The Layers Palette displays elements in reverse order (top-most layer at top of list).
   */
  const handleReorderLayersByDrag = (
    sourceId: string,
    targetId: string,
    position: 'above' | 'below'
  ) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    updateActiveMaster((m) => {
      // Visual top-to-bottom list (index 0 = top-most layer on canvas)
      const visualList = [...m.elements].reverse();
      const fromIdx = visualList.findIndex((e) => e.id === sourceId);
      if (fromIdx === -1) return m;
      const [movedItem] = visualList.splice(fromIdx, 1);

      const toIdx = visualList.findIndex((e) => e.id === targetId);
      if (toIdx === -1) return m;
      const insertIdx = position === 'above' ? toIdx : toIdx + 1;
      visualList.splice(insertIdx, 0, movedItem);

      return {
        ...m,
        elements: visualList.reverse(),
      };
    });
  };

  const handleDuplicateLayer = (targetElementId?: string) => {
    const idToDup = targetElementId || selectedElementId;
    if (!idToDup) return;
    const newId = `el-${Date.now()}`;
    updateActiveMaster((m) => {
      const idx = m.elements.findIndex((e) => e.id === idToDup);
      if (idx === -1) return m;
      const orig = m.elements[idx];
      const dup: CanvasElement = {
        ...orig,
        id: newId,
        name: `${orig.name} Copy`,
        x: Number((orig.x + 0.08).toFixed(3)),
        y: Number((orig.y + 0.08).toFixed(3)),
        effects: orig.effects ? { ...orig.effects } : undefined,
      };
      const copy = [...m.elements];
      copy.splice(idx + 1, 0, dup);
      return { ...m, elements: copy };
    });
    setSelectedElementId(newId);
  };

  const updateSelectedElementEffects = (patch: Partial<LayerEffects>) => {
    if (!selectedElementId) return;
    updateActiveMaster((m) => ({
      ...m,
      elements: m.elements.map((el) =>
        el.id === selectedElementId
          ? {
              ...el,
              effects: {
                ...(el.effects || {}),
                ...patch,
              },
            }
          : el
      ),
    }));
  };

  /**
   * Generates CSS properties for Photoshop-style Blend Modes (mix-blend-mode) and Layer Effects (fx)
   */
  const getElementLayerStyleCss = (
    el: CanvasElement
  ): React.CSSProperties => {
    const style: React.CSSProperties = {
      mixBlendMode: (el.blendMode || 'normal') as React.CSSProperties['mixBlendMode'],
    };
    if (el.effects) {
      const fx = el.effects;
      const filters: string[] = [];
      if (fx.dropShadow) {
        const ox = (((fx.shadowOffsetX ?? 2) * pxPerInch) / 72).toFixed(1);
        const oy = (((fx.shadowOffsetY ?? 2) * pxPerInch) / 72).toFixed(1);
        const blur = (((fx.shadowBlur ?? 6) * pxPerInch) / 72).toFixed(1);
        const col = fx.shadowColor || 'rgba(15,23,42,0.45)';
        filters.push(`drop-shadow(${ox}px ${oy}px ${blur}px ${col})`);
      }
      if (fx.outerGlow) {
        const blur = (((fx.glowBlur ?? 10) * pxPerInch) / 72).toFixed(1);
        const col = fx.glowColor || '#f59e0b';
        filters.push(`drop-shadow(0px 0px ${blur}px ${col})`);
      }
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
        filters.push(`blur(${((fx.blurPx * pxPerInch) / 72).toFixed(1)}px)`);
      }
      if (filters.length > 0) {
        style.filter = filters.join(' ');
      }
      if (fx.fxStroke && (fx.fxStrokeWidth || 1) > 0) {
        const sw = Math.max(1, ((fx.fxStrokeWidth || 1.5) * pxPerInch) / 72);
        style.outline = `${sw}px solid ${fx.fxStrokeColor || '#cc0000'}`;
      }
    }
    return style;
  };

  const handleAlignElement = (
    align:
      | 'left'
      | 'center'
      | 'right'
      | 'top'
      | 'middle'
      | 'bottom'
      | 'center-both'
  ) => {
    if (!selectedElement) return;
    const mx = project.relativeToMargin ? project.marginXIn : 0;
    const my = project.relativeToMargin ? project.marginYIn : 0;
    const w = selectedElement.width;
    const h = selectedElement.height;
    const rad = ((selectedElement.rotation || 0) * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));
    const visualW = w * absCos + h * absSin;
    const visualH = w * absSin + h * absCos;

    if (align === 'left')
      updateSelectedElement({
        x: Number((mx + (visualW - w) / 2).toFixed(3)),
      });
    if (align === 'center')
      updateSelectedElement({
        x: Number(((unitW - w) / 2).toFixed(3)),
      });
    if (align === 'right')
      updateSelectedElement({
        x: Number((unitW - mx - (visualW + w) / 2).toFixed(3)),
      });
    if (align === 'top')
      updateSelectedElement({
        y: Number((my + (visualH - h) / 2).toFixed(3)),
      });
    if (align === 'middle')
      updateSelectedElement({
        y: Number(((unitH - h) / 2).toFixed(3)),
      });
    if (align === 'bottom')
      updateSelectedElement({
        y: Number((unitH - my - (visualH + h) / 2).toFixed(3)),
      });
    if (align === 'center-both')
      updateSelectedElement({
        x: Number(((unitW - w) / 2).toFixed(3)),
        y: Number(((unitH - h) / 2).toFixed(3)),
      });
  };

  const handleFindAndReplace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!findText) return;
    updateActiveMaster((m) => ({
      ...m,
      elements: m.elements.map((el) => {
        if (el.text && el.text.includes(findText)) {
          return {
            ...el,
            text: el.text.split(findText).join(replaceText),
          };
        }
        return el;
      }),
    }));
    setShowFindReplace(false);
  };

  const handleRunInEditorAiPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuickPrompt.trim()) return;
    setIsAiUpdating(true);
    try {
      const { updatedMaster, summary } = await applyPromptToCurrentMaster({
        master: activeMaster,
        prompt: aiQuickPrompt,
        unitWidthIn: unitW,
        unitHeightIn: unitH,
      });
      updateActiveMaster(() => updatedMaster);
      setAiChatHistory((prev) => [
        { prompt: aiQuickPrompt, summary },
        ...prev,
      ]);
      setAiQuickPrompt('');
    } finally {
      setIsAiUpdating(false);
    }
  };

  const handleOpenProofModal = async () => {
    setShowProofModal(true);
    const canvas = await renderSheetPageToCanvas(
      project,
      activePageIndex,
      160
    );
    setProofPreviewUrl(canvas.toDataURL('image/png'));
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportPrintReadyPdf(project, true);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Updates N-Up Imposition parameters (cols, rows, H/V gutter spacing, outer white margins,
   * center link, and auto-fitting non-bleed items to margins & spacing)
   */
  const handleUpdateImposition = (patch: Partial<ImpositionGrid>) => {
    onUpdateProject((prev) => {
      const sheetW = prev.template.sheetWidthIn;
      const sheetH = prev.template.sheetHeightIn;
      const curImp: ImpositionGrid = prev.template.imposition || {
        cols: 2,
        rows: 2,
        unitWidthIn: Number((sheetW / 2).toFixed(3)),
        unitHeightIn: Number((sheetH / 2).toFixed(3)),
        marginLeftIn: 0,
        marginTopIn: 0,
        gapXIn: 0,
        gapYIn: 0,
        autoCenterOnSheet: true,
        linkSpacing: true,
        autoFitToMargins: false,
        innerPaddingXIn: 0,
        innerPaddingYIn: 0,
        linkInnerPadding: true,
      };

      const oldUnitW = curImp.unitWidthIn;
      const oldUnitH = curImp.unitHeightIn;

      const next: ImpositionGrid = {
        ...curImp,
        ...patch,
      };

      // If user edited margins, gaps, cols, or rows, ensure we fit item sizes to the sheet margins & spacing
      if (
        patch.marginLeftIn !== undefined ||
        patch.marginTopIn !== undefined ||
        patch.gapXIn !== undefined ||
        patch.gapYIn !== undefined ||
        patch.cols !== undefined ||
        patch.rows !== undefined
      ) {
        if (patch.autoFitToMargins === undefined) {
          next.autoFitToMargins = true;
        }
      }

      // If linkSpacing is enabled, keep Horizontal & Vertical margins/gaps synchronized
      if (next.linkSpacing !== false) {
        if (patch.gapXIn !== undefined && patch.gapYIn === undefined) {
          next.gapYIn = patch.gapXIn;
        } else if (patch.gapYIn !== undefined && patch.gapXIn === undefined) {
          next.gapXIn = patch.gapYIn;
        }
        if (
          patch.marginLeftIn !== undefined &&
          patch.marginTopIn === undefined
        ) {
          next.marginTopIn = patch.marginLeftIn;
        } else if (
          patch.marginTopIn !== undefined &&
          patch.marginLeftIn === undefined
        ) {
          next.marginLeftIn = patch.marginTopIn;
        }
      }

      // PRINT-SHOP MULTI-UP CENTER LINK RULE:
      // When Center Link (`autoCenterOnSheet !== false`) is active on a multi-up sheet (e.g. 4-Up):
      // Each item has `m` (e.g. 1/4" = 0.25") of white space on all 4 sides of its cut piece.
      // Therefore:
      //  - Outside Left & Right of the full page = `m` (e.g. 1/4" = 0.25")
      //  - Center White Space (`gapXIn` / `gapYIn`) between items = `2 * m` (e.g. 1/4" + 1/4" = 1/2" = 0.50")!
      if (next.autoCenterOnSheet !== false) {
        const editedOuterMargin =
          (patch.marginLeftIn !== undefined ||
            patch.marginTopIn !== undefined) &&
          patch.gapXIn === undefined &&
          patch.gapYIn === undefined;
        const editedCenterGap =
          (patch.gapXIn !== undefined || patch.gapYIn !== undefined) &&
          patch.marginLeftIn === undefined &&
          patch.marginTopIn === undefined;

        if (editedOuterMargin) {
          // User set Outside Margin (e.g. 1/4" = 0.25") -> Center White Space becomes 2x (1/2" = 0.50")
          next.gapXIn = Number((next.marginLeftIn * 2).toFixed(4));
          next.gapYIn = Number((next.marginTopIn * 2).toFixed(4));
        } else if (editedCenterGap) {
          // User set Center White Space (e.g. 1/2" = 0.50") -> Outside Margin becomes 1/2 of center (1/4" = 0.25")
          next.marginLeftIn = Number((next.gapXIn / 2).toFixed(4));
          next.marginTopIn = Number((next.gapYIn / 2).toFixed(4));
        } else if (patch.autoCenterOnSheet === true) {
          // User just turned Center Link ON: sync Center = 2x Outside
          if (next.marginLeftIn > 0 || next.marginTopIn > 0) {
            next.gapXIn = Number((next.marginLeftIn * 2).toFixed(4));
            next.gapYIn = Number((next.marginTopIn * 2).toFixed(4));
            next.autoFitToMargins = true;
          } else if (next.gapXIn > 0 || next.gapYIn > 0) {
            next.marginLeftIn = Number((next.gapXIn / 2).toFixed(4));
            next.marginTopIn = Number((next.gapYIn / 2).toFixed(4));
            next.autoFitToMargins = true;
          }
        }
      }

      // If linkInnerPadding is enabled and user changed innerPaddingXIn or innerPaddingYIn, sync both
      if (next.linkInnerPadding) {
        if (
          patch.innerPaddingXIn !== undefined &&
          patch.innerPaddingYIn === undefined
        ) {
          next.innerPaddingYIn = patch.innerPaddingXIn;
        } else if (
          patch.innerPaddingYIn !== undefined &&
          patch.innerPaddingXIn === undefined
        ) {
          next.innerPaddingXIn = patch.innerPaddingYIn;
        }
      }

      // Check whether the current unitWidthIn / unitHeightIn plus margins & gaps would overflow the physical sheet
      const rawGridW =
        2 * next.marginLeftIn +
        next.cols * next.unitWidthIn +
        (next.cols - 1) * next.gapXIn;
      const rawGridH =
        2 * next.marginTopIn +
        next.rows * next.unitHeightIn +
        (next.rows - 1) * next.gapYIn;

      // If autoFitToMargins is enabled OR the grid + margins + gaps exceed the physical sheet dimensions,
      // calculate unitWidthIn / unitHeightIn so Outside L/R = marginLeftIn and Center = gapXIn!
      if (next.autoFitToMargins || rawGridW > sheetW + 0.002) {
        const availW =
          sheetW - 2 * next.marginLeftIn - (next.cols - 1) * next.gapXIn;
        next.unitWidthIn = Number(
          Math.max(0.5, availW / Math.max(1, next.cols)).toFixed(3)
        );
      }
      if (next.autoFitToMargins || rawGridH > sheetH + 0.002) {
        const availH =
          sheetH - 2 * next.marginTopIn - (next.rows - 1) * next.gapYIn;
        next.unitHeightIn = Number(
          Math.max(0.5, availH / Math.max(1, next.rows)).toFixed(3)
        );
      }

      if (!next.autoFitToMargins && next.autoCenterOnSheet !== false) {
        // For fixed-size die-cut cards (e.g. 3.5"x2" 10-up on 8.5"x11" where autoFitToMargins is false),
        // center the fixed card grid on the sheet
        const totalGridW =
          next.cols * next.unitWidthIn + (next.cols - 1) * next.gapXIn;
        const totalGridH =
          next.rows * next.unitHeightIn + (next.rows - 1) * next.gapYIn;
        next.marginLeftIn = Number(
          Math.max(0, (sheetW - totalGridW) / 2).toFixed(3)
        );
        next.marginTopIn = Number(
          Math.max(0, (sheetH - totalGridH) / 2).toFixed(3)
        );
      }

      const nextTemplate: PrintTemplate = {
        ...prev.template,
        imposition: next,
      };

      // If unitWidthIn or unitHeightIn changed, proportionally adapt Master A, Master B, and any slotOverrides!
      const sizeChanged =
        Math.abs(next.unitWidthIn - oldUnitW) > 0.005 ||
        Math.abs(next.unitHeightIn - oldUnitH) > 0.005;

      const updatedMasterA = sizeChanged
        ? adaptDesignToTemplate(
            prev.masters['master-a'],
            oldUnitW,
            oldUnitH,
            nextTemplate
          )
        : prev.masters['master-a'];
      const updatedMasterB = sizeChanged
        ? adaptDesignToTemplate(
            prev.masters['master-b'],
            oldUnitW,
            oldUnitH,
            nextTemplate
          )
        : prev.masters['master-b'];

      const updatedPages = sizeChanged
        ? prev.pages.map((pg) => {
            if (!pg.slotOverrides) return pg;
            const newOverrides: Record<number, MasterDesign> = {};
            for (const [k, m] of Object.entries(pg.slotOverrides)) {
              newOverrides[Number(k)] = adaptDesignToTemplate(
                m,
                oldUnitW,
                oldUnitH,
                nextTemplate
              );
            }
            return { ...pg, slotOverrides: newOverrides };
          })
        : prev.pages;

      return {
        ...prev,
        template: nextTemplate,
        masters: {
          'master-a': updatedMasterA,
          'master-b': updatedMasterB,
        },
        pages: updatedPages,
      };
    });
  };

  /**
   * Switches between Portrait and Landscape AND rotates/transposes the safe margin guides,
   * imposition grid (cols <-> rows, unitWidthIn <-> unitHeightIn, gaps & margins), and unit artwork
   * so green cut guides, blue margin guides, and slots stay 100% aligned with the rotated sheet!
   */
  const handleSetOrientation = (targetOrientation: 'portrait' | 'landscape') => {
    onUpdateProject((prev) => {
      const oldSheetW = prev.template.sheetWidthIn;
      const oldSheetH = prev.template.sheetHeightIn;
      const newSheetW =
        targetOrientation === 'portrait'
          ? Math.min(oldSheetW, oldSheetH)
          : Math.max(oldSheetW, oldSheetH);
      const newSheetH =
        targetOrientation === 'portrait'
          ? Math.max(oldSheetW, oldSheetH)
          : Math.min(oldSheetW, oldSheetH);

      const dimsSwapped =
        Math.abs(newSheetW - oldSheetW) > 0.002 ||
        Math.abs(newSheetH - oldSheetH) > 0.002;

      if (!dimsSwapped && prev.template.orientation === targetOrientation) {
        return prev;
      }

      const { widthIn: oldUnitW, heightIn: oldUnitH } = getDesignUnitSize(
        prev.template
      );

      let nextImposition = prev.template.imposition;
      if (nextImposition && dimsSwapped) {
        const imp = nextImposition;
        const transposed: ImpositionGrid = {
          ...imp,
          cols: imp.rows,
          rows: imp.cols,
          unitWidthIn: imp.unitHeightIn,
          unitHeightIn: imp.unitWidthIn,
          marginLeftIn: imp.marginTopIn,
          marginTopIn: imp.marginLeftIn,
          gapXIn: imp.gapYIn,
          gapYIn: imp.gapXIn,
          innerPaddingXIn: imp.innerPaddingYIn,
          innerPaddingYIn: imp.innerPaddingXIn,
        };

        // Ensure transposed grid fits inside newSheetW x newSheetH (including 2x outer margins)
        const rawW =
          2 * transposed.marginLeftIn +
          transposed.cols * transposed.unitWidthIn +
          (transposed.cols - 1) * transposed.gapXIn;
        const rawH =
          2 * transposed.marginTopIn +
          transposed.rows * transposed.unitHeightIn +
          (transposed.rows - 1) * transposed.gapYIn;

        if (transposed.autoFitToMargins || rawW > newSheetW + 0.002) {
          const availW =
            newSheetW -
            2 * transposed.marginLeftIn -
            (transposed.cols - 1) * transposed.gapXIn;
          transposed.unitWidthIn = Number(
            Math.max(0.5, availW / Math.max(1, transposed.cols)).toFixed(3)
          );
        }
        if (transposed.autoFitToMargins || rawH > newSheetH + 0.002) {
          const availH =
            newSheetH -
            2 * transposed.marginTopIn -
            (transposed.rows - 1) * transposed.gapYIn;
          transposed.unitHeightIn = Number(
            Math.max(0.5, availH / Math.max(1, transposed.rows)).toFixed(3)
          );
        }

        if (transposed.autoCenterOnSheet !== false) {
          const totalW =
            transposed.cols * transposed.unitWidthIn +
            (transposed.cols - 1) * transposed.gapXIn;
          const totalH =
            transposed.rows * transposed.unitHeightIn +
            (transposed.rows - 1) * transposed.gapYIn;
          transposed.marginLeftIn = Number(
            Math.max(0, (newSheetW - totalW) / 2).toFixed(3)
          );
          transposed.marginTopIn = Number(
            Math.max(0, (newSheetH - totalH) / 2).toFixed(3)
          );
        }

        nextImposition = transposed;
      }

      const nextTemplate: PrintTemplate = {
        ...prev.template,
        orientation: targetOrientation,
        sheetWidthIn: newSheetW,
        sheetHeightIn: newSheetH,
        imposition: nextImposition,
      };

      const { widthIn: newUnitW, heightIn: newUnitH } =
        getDesignUnitSize(nextTemplate);
      const unitChanged =
        Math.abs(newUnitW - oldUnitW) > 0.005 ||
        Math.abs(newUnitH - oldUnitH) > 0.005;

      // When Portrait <-> Landscape swaps the sheet/unit dimensions, rotate ALL elements 90° together
      // so the entire layout rotates as one cohesive design without stretching or distorting!
      const rotDirection: 'cw' | 'ccw' =
        targetOrientation === 'landscape' ? 'cw' : 'ccw';

      const transformMaster = (m: MasterDesign): MasterDesign => {
        if (dimsSwapped) {
          return rotateMasterDesign90(
            m,
            oldUnitW,
            oldUnitH,
            newUnitW,
            newUnitH,
            rotDirection
          );
        }
        return unitChanged
          ? adaptDesignToTemplate(m, oldUnitW, oldUnitH, nextTemplate)
          : m;
      };

      const updatedMasterA = transformMaster(prev.masters['master-a']);
      const updatedMasterB = transformMaster(prev.masters['master-b']);

      const updatedPages =
        dimsSwapped || unitChanged
          ? prev.pages.map((pg) => {
              if (!pg.slotOverrides) return pg;
              const newOverrides: Record<number, MasterDesign> = {};
              for (const [k, m] of Object.entries(pg.slotOverrides)) {
                newOverrides[Number(k)] = transformMaster(m);
              }
              return { ...pg, slotOverrides: newOverrides };
            })
          : prev.pages;

      return {
        ...prev,
        marginXIn: dimsSwapped ? prev.marginYIn : prev.marginXIn,
        marginYIn: dimsSwapped ? prev.marginXIn : prev.marginYIn,
        template: nextTemplate,
        masters: {
          'master-a': updatedMasterA,
          'master-b': updatedMasterB,
        },
        pages: updatedPages,
      };
    });
  };

  /**
   * Rotates the entire sheet layout (Sheet W <-> H, Orientation, Safe Margins, Imposition Grid,
   * and all elements on Master A, Master B, and all Pages) by 90° Clockwise ('cw') or Counter-Clockwise ('ccw')
   * so everything rotates together in lockstep!
   */
  const handleRotateEntireLayout90 = (direction: 'cw' | 'ccw' = 'cw') => {
    onUpdateProject((prev) => {
      const oldSheetW = prev.template.sheetWidthIn;
      const oldSheetH = prev.template.sheetHeightIn;
      const newSheetW = oldSheetH;
      const newSheetH = oldSheetW;
      const nextOrientation: 'portrait' | 'landscape' =
        newSheetW > newSheetH
          ? 'landscape'
          : newSheetW < newSheetH
          ? 'portrait'
          : prev.template.orientation === 'portrait'
          ? 'landscape'
          : 'portrait';

      const { widthIn: oldUnitW, heightIn: oldUnitH } = getDesignUnitSize(
        prev.template
      );

      let nextImposition = prev.template.imposition;
      if (nextImposition) {
        const imp = nextImposition;
        const transposed: ImpositionGrid = {
          ...imp,
          cols: imp.rows,
          rows: imp.cols,
          unitWidthIn: imp.unitHeightIn,
          unitHeightIn: imp.unitWidthIn,
          marginLeftIn: imp.marginTopIn,
          marginTopIn: imp.marginLeftIn,
          gapXIn: imp.gapYIn,
          gapYIn: imp.gapXIn,
          innerPaddingXIn: imp.innerPaddingYIn,
          innerPaddingYIn: imp.innerPaddingXIn,
        };

        const rawW =
          2 * transposed.marginLeftIn +
          transposed.cols * transposed.unitWidthIn +
          (transposed.cols - 1) * transposed.gapXIn;
        const rawH =
          2 * transposed.marginTopIn +
          transposed.rows * transposed.unitHeightIn +
          (transposed.rows - 1) * transposed.gapYIn;

        if (transposed.autoFitToMargins || rawW > newSheetW + 0.002) {
          const availW =
            newSheetW -
            2 * transposed.marginLeftIn -
            (transposed.cols - 1) * transposed.gapXIn;
          transposed.unitWidthIn = Number(
            Math.max(0.5, availW / Math.max(1, transposed.cols)).toFixed(3)
          );
        }
        if (transposed.autoFitToMargins || rawH > newSheetH + 0.002) {
          const availH =
            newSheetH -
            2 * transposed.marginTopIn -
            (transposed.rows - 1) * transposed.gapYIn;
          transposed.unitHeightIn = Number(
            Math.max(0.5, availH / Math.max(1, transposed.rows)).toFixed(3)
          );
        }

        if (transposed.autoCenterOnSheet !== false) {
          const totalW =
            transposed.cols * transposed.unitWidthIn +
            (transposed.cols - 1) * transposed.gapXIn;
          const totalH =
            transposed.rows * transposed.unitHeightIn +
            (transposed.rows - 1) * transposed.gapYIn;
          transposed.marginLeftIn = Number(
            Math.max(0, (newSheetW - totalW) / 2).toFixed(3)
          );
          transposed.marginTopIn = Number(
            Math.max(0, (newSheetH - totalH) / 2).toFixed(3)
          );
        }

        nextImposition = transposed;
      }

      const nextTemplate: PrintTemplate = {
        ...prev.template,
        orientation: nextOrientation,
        sheetWidthIn: newSheetW,
        sheetHeightIn: newSheetH,
        imposition: nextImposition,
      };

      const { widthIn: newUnitW, heightIn: newUnitH } =
        getDesignUnitSize(nextTemplate);

      const updatedMasterA = rotateMasterDesign90(
        prev.masters['master-a'],
        oldUnitW,
        oldUnitH,
        newUnitW,
        newUnitH,
        direction
      );
      const updatedMasterB = rotateMasterDesign90(
        prev.masters['master-b'],
        oldUnitW,
        oldUnitH,
        newUnitW,
        newUnitH,
        direction
      );

      const updatedPages = prev.pages.map((pg) => {
        if (!pg.slotOverrides) return pg;
        const newOverrides: Record<number, MasterDesign> = {};
        for (const [k, m] of Object.entries(pg.slotOverrides)) {
          newOverrides[Number(k)] = rotateMasterDesign90(
            m,
            oldUnitW,
            oldUnitH,
            newUnitW,
            newUnitH,
            direction
          );
        }
        return { ...pg, slotOverrides: newOverrides };
      });

      return {
        ...prev,
        marginXIn: prev.marginYIn,
        marginYIn: prev.marginXIn,
        template: nextTemplate,
        masters: {
          'master-a': updatedMasterA,
          'master-b': updatedMasterB,
        },
        pages: updatedPages,
      };
    });
  };

  /**
   * Rotates the Safe Margin Guides (Margin X <-> Margin Y) and N-Up Imposition Cut Grid / Slots 90°
   * on the current sheet, rotating the slot artwork 90° to match the rotated slot orientation!
   */
  const handleRotateGuidesAndGrid = () => {
    onUpdateProject((prev) => {
      // If this is a 1-Up full-sheet layout (no N-up imposition), rotating 90° should rotate the entire sheet & layout 90° CW!
      if (!prev.template.imposition) {
        const oldW = prev.template.sheetWidthIn;
        const oldH = prev.template.sheetHeightIn;
        const newW = oldH;
        const newH = oldW;
        const nextOrient: 'portrait' | 'landscape' =
          newW > newH
            ? 'landscape'
            : newW < newH
            ? 'portrait'
            : prev.template.orientation === 'portrait'
            ? 'landscape'
            : 'portrait';

        const nextTemplate: PrintTemplate = {
          ...prev.template,
          orientation: nextOrient,
          sheetWidthIn: newW,
          sheetHeightIn: newH,
        };

        return {
          ...prev,
          marginXIn: prev.marginYIn,
          marginYIn: prev.marginXIn,
          template: nextTemplate,
          masters: {
            'master-a': rotateMasterDesign90(
              prev.masters['master-a'],
              oldW,
              oldH,
              newW,
              newH,
              'cw'
            ),
            'master-b': rotateMasterDesign90(
              prev.masters['master-b'],
              oldW,
              oldH,
              newW,
              newH,
              'cw'
            ),
          },
          pages: prev.pages.map((pg) => {
            if (!pg.slotOverrides) return pg;
            const newOverrides: Record<number, MasterDesign> = {};
            for (const [k, m] of Object.entries(pg.slotOverrides)) {
              newOverrides[Number(k)] = rotateMasterDesign90(
                m,
                oldW,
                oldH,
                newW,
                newH,
                'cw'
              );
            }
            return { ...pg, slotOverrides: newOverrides };
          }),
        };
      }

      const sheetW = prev.template.sheetWidthIn;
      const sheetH = prev.template.sheetHeightIn;
      const { widthIn: oldUnitW, heightIn: oldUnitH } = getDesignUnitSize(
        prev.template
      );

      let nextImposition = prev.template.imposition;
      if (nextImposition) {
        const imp = nextImposition;
        const rotatedImp: ImpositionGrid = {
          ...imp,
          cols: imp.rows,
          rows: imp.cols,
          unitWidthIn: imp.unitHeightIn,
          unitHeightIn: imp.unitWidthIn,
          marginLeftIn: imp.marginTopIn,
          marginTopIn: imp.marginLeftIn,
          gapXIn: imp.gapYIn,
          gapYIn: imp.gapXIn,
          innerPaddingXIn: imp.innerPaddingYIn,
          innerPaddingYIn: imp.innerPaddingXIn,
        };

        const rawW =
          2 * rotatedImp.marginLeftIn +
          rotatedImp.cols * rotatedImp.unitWidthIn +
          (rotatedImp.cols - 1) * rotatedImp.gapXIn;
        const rawH =
          2 * rotatedImp.marginTopIn +
          rotatedImp.rows * rotatedImp.unitHeightIn +
          (rotatedImp.rows - 1) * rotatedImp.gapYIn;

        if (rotatedImp.autoFitToMargins || rawW > sheetW + 0.002) {
          const availW =
            sheetW -
            2 * rotatedImp.marginLeftIn -
            (rotatedImp.cols - 1) * rotatedImp.gapXIn;
          rotatedImp.unitWidthIn = Number(
            Math.max(0.5, availW / Math.max(1, rotatedImp.cols)).toFixed(3)
          );
        }
        if (rotatedImp.autoFitToMargins || rawH > sheetH + 0.002) {
          const availH =
            sheetH -
            2 * rotatedImp.marginTopIn -
            (rotatedImp.rows - 1) * rotatedImp.gapYIn;
          rotatedImp.unitHeightIn = Number(
            Math.max(0.5, availH / Math.max(1, rotatedImp.rows)).toFixed(3)
          );
        }

        if (rotatedImp.autoCenterOnSheet !== false) {
          const totalW =
            rotatedImp.cols * rotatedImp.unitWidthIn +
            (rotatedImp.cols - 1) * rotatedImp.gapXIn;
          const totalH =
            rotatedImp.rows * rotatedImp.unitHeightIn +
            (rotatedImp.rows - 1) * rotatedImp.gapYIn;
          rotatedImp.marginLeftIn = Number(
            Math.max(0, (sheetW - totalW) / 2).toFixed(3)
          );
          rotatedImp.marginTopIn = Number(
            Math.max(0, (sheetH - totalH) / 2).toFixed(3)
          );
        }

        nextImposition = rotatedImp;
      }

      const nextTemplate: PrintTemplate = {
        ...prev.template,
        imposition: nextImposition,
      };

      const { widthIn: newUnitW, heightIn: newUnitH } =
        getDesignUnitSize(nextTemplate);

      const updatedMasterA = rotateMasterDesign90(
        prev.masters['master-a'],
        oldUnitW,
        oldUnitH,
        newUnitW,
        newUnitH,
        'cw'
      );
      const updatedMasterB = rotateMasterDesign90(
        prev.masters['master-b'],
        oldUnitW,
        oldUnitH,
        newUnitW,
        newUnitH,
        'cw'
      );

      const updatedPages = prev.pages.map((pg) => {
        if (!pg.slotOverrides) return pg;
        const newOverrides: Record<number, MasterDesign> = {};
        for (const [k, m] of Object.entries(pg.slotOverrides)) {
          newOverrides[Number(k)] = rotateMasterDesign90(
            m,
            oldUnitW,
            oldUnitH,
            newUnitW,
            newUnitH,
            'cw'
          );
        }
        return { ...pg, slotOverrides: newOverrides };
      });

      return {
        ...prev,
        marginXIn: prev.marginYIn,
        marginYIn: prev.marginXIn,
        template: nextTemplate,
        masters: {
          'master-a': updatedMasterA,
          'master-b': updatedMasterB,
        },
        pages: updatedPages,
      };
    });
  };

  /**
   * Left Panel Page Management: Add, Duplicate, Delete, and Rearrange Pages
   */
  const handleAddPage = () => {
    const nextIdx = project.pages.length;
    onUpdateProject((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        {
          id: `page-${Date.now()}`,
          name: `Page ${prev.pages.length + 1}`,
          side: prev.pages.length % 2 === 0 ? 'front' : 'back',
          masterId: prev.pages.length % 2 === 0 ? 'master-a' : 'master-b',
          ignoreMaster: false,
          pageElements: [],
        },
      ],
    }));
    setActivePageIndex(nextIdx);
    setSelectedElementId(null);
  };

  const handleDuplicatePage = (targetIdx: number = activePageIndex) => {
    const insertAt = targetIdx + 1;
    onUpdateProject((prev) => {
      const sourcePage = prev.pages[targetIdx];
      if (!sourcePage) return prev;

      // Deep-clone slotOverrides and pageElements so edits to the duplicate don't mutate the original
      let clonedOverrides: Record<number, MasterDesign> | undefined;
      if (sourcePage.slotOverrides) {
        clonedOverrides = {};
        for (const [slotKey, masterVal] of Object.entries(
          sourcePage.slotOverrides
        )) {
          clonedOverrides[Number(slotKey)] = {
            ...masterVal,
            elements: masterVal.elements.map((el) => ({
              ...el,
              id: `${el.id}-dup-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 6)}`,
              effects: el.effects ? { ...el.effects } : undefined,
            })),
          };
        }
      }

      const duplicatedPage = {
        ...sourcePage,
        id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${sourcePage.name} Copy`,
        pageElements: sourcePage.pageElements.map((el) => ({
          ...el,
          id: `${el.id}-dup-${Date.now()}`,
          effects: el.effects ? { ...el.effects } : undefined,
        })),
        slotOverrides: clonedOverrides,
      };

      const nextPages = [...prev.pages];
      nextPages.splice(insertAt, 0, duplicatedPage);
      return {
        ...prev,
        pages: nextPages,
      };
    });
    setActivePageIndex(insertAt);
    setSelectedElementId(null);
  };

  const handleDeletePage = (targetIdx: number = activePageIndex) => {
    if (project.pages.length <= 1) {
      // If only 1 page remains, clear any slot overrides / page elements rather than leaving 0 pages
      onUpdateProject((prev) => ({
        ...prev,
        pages: prev.pages.map((pg, i) =>
          i === 0
            ? { ...pg, slotOverrides: undefined, pageElements: [] }
            : pg
        ),
      }));
      setSelectedElementId(null);
      return;
    }

    const nextActive =
      activePageIndex > targetIdx
        ? activePageIndex - 1
        : Math.min(project.pages.length - 2, activePageIndex);

    onUpdateProject((prev) => ({
      ...prev,
      pages: prev.pages.filter((_, idx) => idx !== targetIdx),
    }));
    setActivePageIndex(Math.max(0, nextActive));
    setSelectedElementId(null);
  };

  const handleMovePage = (fromIdx: number, toIdx: number) => {
    if (
      fromIdx === toIdx ||
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= project.pages.length ||
      toIdx >= project.pages.length
    ) {
      return;
    }

    onUpdateProject((prev) => {
      const nextPages = [...prev.pages];
      const [moved] = nextPages.splice(fromIdx, 1);
      nextPages.splice(toIdx, 0, moved);
      return {
        ...prev,
        pages: nextPages,
      };
    });

    if (activePageIndex === fromIdx) {
      setActivePageIndex(toIdx);
    } else if (fromIdx < activePageIndex && toIdx >= activePageIndex) {
      setActivePageIndex(activePageIndex - 1);
    } else if (fromIdx > activePageIndex && toIdx <= activePageIndex) {
      setActivePageIndex(activePageIndex + 1);
    }
  };

  // Calculate pixel scale for the canvas
  // Base scale: 72 px per inch at 100% zoom in sheet view, or 180 px per inch in single-card Master view
  const basePxPerInch = canvasViewMode === 'unit' ? 185 : 64;
  const pxPerInch = (basePxPerInch * zoom) / 100;

  const displayedWidthIn =
    canvasViewMode === 'unit' ? unitW : project.template.sheetWidthIn;
  const displayedHeightIn =
    canvasViewMode === 'unit' ? unitH : project.template.sheetHeightIn;

  const canvasWidthPx = displayedWidthIn * pxPerInch;
  const canvasHeightPx = displayedHeightIn * pxPerInch;

  // Fit an oversized or off-canvas element cleanly back inside the card/unit boundaries
  const handleFitElementToUnit = (targetId?: string) => {
    const idToFit = targetId || selectedElementId;
    if (!idToFit) return;
    updateActiveMaster((m) => ({
      ...m,
      elements: m.elements.map((el) => {
        if (el.id !== idToFit) return el;
        const maxW = Number((unitW * 0.85).toFixed(3));
        const maxH = Number((unitH * 0.85).toFixed(3));
        const aspect = el.width > 0 && el.height > 0 ? el.width / el.height : 1.5;
        let nextW = Math.min(el.width, maxW);
        let nextH = Number((nextW / aspect).toFixed(3));
        if (nextH > maxH) {
          nextH = maxH;
          nextW = Number((nextH * aspect).toFixed(3));
        }
        nextW = Math.max(0.25, nextW);
        nextH = Math.max(0.15, nextH);
        const nextX = Number(((unitW - nextW) / 2).toFixed(3));
        const nextY = Number(((unitH - nextH) / 2).toFixed(3));
        return {
          ...el,
          x: nextX,
          y: nextY,
          width: nextW,
          height: nextH,
        };
      }),
    }));
  };

  // Pointer move handler for dragging, 8-handle resizing (all corners & edges), and rotating elements on canvas
  // Includes Magnetic Smart Guides (Auto-Snap to Card Center, Safe Margins, Card Edges, and Other Objects)
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const dxIn = (e.clientX - dragState.startClientX) / dragState.pxPerInch;
    const dyIn = (e.clientY - dragState.startClientY) / dragState.pxPerInch;

    const shouldSnap = smartSnapEnabled && !e.altKey;
    const centerThresholdIn = 9.5 / dragState.pxPerInch; // Stronger magnetic pull for Page/Card Center
    const edgeThresholdIn = 6.5 / dragState.pxPerInch; // Standard magnetic pull for Margins, Edges & Other Objects

    const safeXIn = project.template.imposition
      ? Math.min(project.marginXIn, unitW * 0.22)
      : project.marginXIn;
    const safeYIn = project.template.imposition
      ? Math.min(project.marginYIn, unitH * 0.22)
      : project.marginYIn;

    type SnapCandidate = {
      posIn: number;
      label: string;
      kind: 'center' | 'margin' | 'edge' | 'object';
    };

    const buildSnapTargets = (): {
      xTargets: SnapCandidate[];
      yTargets: SnapCandidate[];
    } => {
      const xTargets: SnapCandidate[] = [
        { posIn: unitW / 2, label: '✦ Center X', kind: 'center' },
        { posIn: 0, label: 'Left Edge', kind: 'edge' },
        { posIn: unitW, label: 'Right Edge', kind: 'edge' },
      ];
      const yTargets: SnapCandidate[] = [
        { posIn: unitH / 2, label: '✦ Center Y', kind: 'center' },
        { posIn: 0, label: 'Top Edge', kind: 'edge' },
        { posIn: unitH, label: 'Bottom Edge', kind: 'edge' },
      ];

      if (safeXIn > 0.005) {
        xTargets.push(
          { posIn: safeXIn, label: 'Left Margin', kind: 'margin' },
          { posIn: unitW - safeXIn, label: 'Right Margin', kind: 'margin' }
        );
      }
      if (safeYIn > 0.005) {
        yTargets.push(
          { posIn: safeYIn, label: 'Top Margin', kind: 'margin' },
          { posIn: unitH - safeYIn, label: 'Bottom Margin', kind: 'margin' }
        );
      }

      for (const other of activeMaster.elements) {
        if (other.id === dragState.elementId || other.visible === false) continue;
        const shortName = other.name.slice(0, 14);
        const oRad = ((other.rotation || 0) * Math.PI) / 180;
        const oCos = Math.abs(Math.cos(oRad));
        const oSin = Math.abs(Math.sin(oRad));
        const oVisW = other.width * oCos + other.height * oSin;
        const oVisH = other.width * oSin + other.height * oCos;
        const oCx = other.x + other.width / 2;
        const oCy = other.y + other.height / 2;
        xTargets.push(
          {
            posIn: oCx,
            label: `Align ${shortName} Ctr`,
            kind: 'object',
          },
          { posIn: oCx - oVisW / 2, label: `Align ${shortName} L`, kind: 'object' },
          {
            posIn: oCx + oVisW / 2,
            label: `Align ${shortName} R`,
            kind: 'object',
          }
        );
        yTargets.push(
          {
            posIn: oCy,
            label: `Align ${shortName} Mid`,
            kind: 'object',
          },
          { posIn: oCy - oVisH / 2, label: `Align ${shortName} T`, kind: 'object' },
          {
            posIn: oCy + oVisH / 2,
            label: `Align ${shortName} B`,
            kind: 'object',
          }
        );
      }

      return { xTargets, yTargets };
    };

    if (dragState.mode === 'move') {
      let nextX = dragState.startX + dxIn;
      let nextY = dragState.startY + dyIn;
      const w = dragState.startW;
      const h = dragState.startH;
      const dRad = ((dragState.startRotation || 0) * Math.PI) / 180;
      const dCos = Math.abs(Math.cos(dRad));
      const dSin = Math.abs(Math.sin(dRad));
      const visW = w * dCos + h * dSin;
      const visH = w * dSin + h * dCos;
      const newGuides: SmartSnapGuide[] = [];

      if (shouldSnap) {
        const { xTargets, yTargets } = buildSnapTargets();

        // Check X alignment: Element Center (w/2), Visual Left ((w - visW)/2), Visual Right ((w + visW)/2)
        let bestXMatch: {
          snappedX: number;
          guide: SmartSnapGuide;
          score: number;
        } | null = null;

        const elXRefs = [
          { offset: w / 2, refLabel: 'Center', weight: 0.75 }, // Prefer snapping element center
          { offset: (w - visW) / 2, refLabel: 'Left', weight: 1.0 },
          { offset: (w + visW) / 2, refLabel: 'Right', weight: 1.0 },
        ];

        for (const t of xTargets) {
          const thresh =
            t.kind === 'center' ? centerThresholdIn : edgeThresholdIn;
          for (const ref of elXRefs) {
            const dist = Math.abs(nextX + ref.offset - t.posIn);
            if (dist <= thresh) {
              // Favor Center-to-Center magnetic lock
              const weightedScore =
                dist * ref.weight * (t.kind === 'center' ? 0.65 : 1.0);
              if (!bestXMatch || weightedScore < bestXMatch.score) {
                bestXMatch = {
                  snappedX: t.posIn - ref.offset,
                  score: weightedScore,
                  guide: {
                    axis: 'x',
                    positionIn: Number(t.posIn.toFixed(4)),
                    label:
                      t.kind === 'center' && ref.refLabel === 'Center'
                        ? '✦ Center X'
                        : t.label,
                    kind: t.kind,
                  },
                };
              }
            }
          }
        }

        if (bestXMatch) {
          nextX = bestXMatch.snappedX;
          newGuides.push(bestXMatch.guide);
        }

        // Check Y alignment: Element Middle (h/2), Top (0), Bottom (h)
        let bestYMatch: {
          snappedY: number;
          guide: SmartSnapGuide;
          score: number;
        } | null = null;

        const elYRefs = [
          { offset: h / 2, refLabel: 'Middle', weight: 0.75 }, // Prefer snapping element vertical center
          { offset: (h - visH) / 2, refLabel: 'Top', weight: 1.0 },
          { offset: (h + visH) / 2, refLabel: 'Bottom', weight: 1.0 },
        ];

        for (const t of yTargets) {
          const thresh =
            t.kind === 'center' ? centerThresholdIn : edgeThresholdIn;
          for (const ref of elYRefs) {
            const dist = Math.abs(nextY + ref.offset - t.posIn);
            if (dist <= thresh) {
              const weightedScore =
                dist * ref.weight * (t.kind === 'center' ? 0.65 : 1.0);
              if (!bestYMatch || weightedScore < bestYMatch.score) {
                bestYMatch = {
                  snappedY: t.posIn - ref.offset,
                  score: weightedScore,
                  guide: {
                    axis: 'y',
                    positionIn: Number(t.posIn.toFixed(4)),
                    label:
                      t.kind === 'center' && ref.refLabel === 'Middle'
                        ? '✦ Center Y'
                        : t.label,
                    kind: t.kind,
                  },
                };
              }
            }
          }
        }

        if (bestYMatch) {
          nextY = bestYMatch.snappedY;
          newGuides.push(bestYMatch.guide);
        }
      }

      setActiveSnapGuides(newGuides);
      updateActiveMaster((m) => ({
        ...m,
        elements: m.elements.map((el) =>
          el.id === dragState.elementId
            ? {
                ...el,
                x: Number(nextX.toFixed(3)),
                y: Number(nextY.toFixed(3)),
              }
            : el
        ),
      }));
    } else if (dragState.mode === 'rotate') {
      const rawAngleRad = Math.atan2(
        e.clientY - dragState.centerClientY,
        e.clientX - dragState.centerClientX
      );
      // Top handle is -90 deg in screen space, so +90 aligns 0 deg to upright
      let deg = Math.round((rawAngleRad * 180) / Math.PI + 90);
      deg = ((deg % 360) + 360) % 360;
      if (e.shiftKey) {
        deg = (Math.round(deg / 15) * 15) % 360;
      } else if (shouldSnap) {
        // Magnetic angle snap within 3 degrees of 0, 45, 90, 135, 180, 225, 270, 315
        for (const cardinal of [0, 45, 90, 135, 180, 225, 270, 315, 360]) {
          if (Math.abs(deg - cardinal) <= 3) {
            deg = cardinal % 360;
            break;
          }
        }
      }
      setActiveSnapGuides([]);
      updateActiveMaster((m) => ({
        ...m,
        elements: m.elements.map((el) =>
          el.id === dragState.elementId ? { ...el, rotation: deg } : el
        ),
      }));
    } else if (dragState.mode.startsWith('resize-')) {
      // Project pointer delta onto the element's local rotated axes so corner/side dragging feels natural at any angle
      const rad = ((dragState.startRotation || 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localDx = dxIn * cos + dyIn * sin;
      const localDy = -dxIn * sin + dyIn * cos;

      const minW = 0.12;
      const minH = 0.08;
      let nextX = dragState.startX;
      let nextY = dragState.startY;
      let nextW = dragState.startW;
      let nextH = dragState.startH;

      const dir = dragState.mode.replace('resize-', '');
      if (dir.includes('e')) {
        nextW = Math.max(minW, dragState.startW + localDx);
      }
      if (dir.includes('w')) {
        nextW = Math.max(minW, dragState.startW - localDx);
        nextX = dragState.startX + (dragState.startW - nextW);
      }
      if (dir.includes('s')) {
        nextH = Math.max(minH, dragState.startH + localDy);
      }
      if (dir.includes('n')) {
        nextH = Math.max(minH, dragState.startH - localDy);
        nextY = dragState.startY + (dragState.startH - nextH);
      }

      const newGuides: SmartSnapGuide[] = [];
      // Magnetic snap while resizing unrotated elements
      if (shouldSnap && Math.abs(dragState.startRotation || 0) < 0.5) {
        const { xTargets, yTargets } = buildSnapTargets();

        if (dir.includes('e')) {
          const rightEdge = nextX + nextW;
          for (const t of xTargets) {
            const thresh =
              t.kind === 'center' ? centerThresholdIn : edgeThresholdIn;
            if (Math.abs(rightEdge - t.posIn) <= thresh) {
              nextW = Math.max(minW, t.posIn - nextX);
              newGuides.push({
                axis: 'x',
                positionIn: Number(t.posIn.toFixed(4)),
                label: t.label,
                kind: t.kind,
              });
              break;
            }
          }
        } else if (dir.includes('w')) {
          for (const t of xTargets) {
            const thresh =
              t.kind === 'center' ? centerThresholdIn : edgeThresholdIn;
            if (Math.abs(nextX - t.posIn) <= thresh) {
              const fixedRight = dragState.startX + dragState.startW;
              if (fixedRight - t.posIn >= minW) {
                nextX = t.posIn;
                nextW = fixedRight - t.posIn;
                newGuides.push({
                  axis: 'x',
                  positionIn: Number(t.posIn.toFixed(4)),
                  label: t.label,
                  kind: t.kind,
                });
                break;
              }
            }
          }
        }

        if (dir.includes('s')) {
          const botEdge = nextY + nextH;
          for (const t of yTargets) {
            const thresh =
              t.kind === 'center' ? centerThresholdIn : edgeThresholdIn;
            if (Math.abs(botEdge - t.posIn) <= thresh) {
              nextH = Math.max(minH, t.posIn - nextY);
              newGuides.push({
                axis: 'y',
                positionIn: Number(t.posIn.toFixed(4)),
                label: t.label,
                kind: t.kind,
              });
              break;
            }
          }
        } else if (dir.includes('n')) {
          for (const t of yTargets) {
            const thresh =
              t.kind === 'center' ? centerThresholdIn : edgeThresholdIn;
            if (Math.abs(nextY - t.posIn) <= thresh) {
              const fixedBottom = dragState.startY + dragState.startH;
              if (fixedBottom - t.posIn >= minH) {
                nextY = t.posIn;
                nextH = fixedBottom - t.posIn;
                newGuides.push({
                  axis: 'y',
                  positionIn: Number(t.posIn.toFixed(4)),
                  label: t.label,
                  kind: t.kind,
                });
                break;
              }
            }
          }
        }
      }

      setActiveSnapGuides(newGuides);
      updateActiveMaster((m) => ({
        ...m,
        elements: m.elements.map((el) =>
          el.id === dragState.elementId
            ? {
                ...el,
                x: Number(nextX.toFixed(3)),
                y: Number(nextY.toFixed(3)),
                width: Number(nextW.toFixed(3)),
                height: Number(nextH.toFixed(3)),
              }
            : el
        ),
      }));
    }
  };

  /**
   * Helper to render the visual appearance of a single CanvasElement
   * (Evaluates sequential print numbering per page and per N-up slot!)
   */
  const renderElementVisualContent = (
    el: CanvasElement,
    fontPx: number,
    slotIndex: number = 0
  ) => {
    const displayText = resolveElementDisplayText(
      el,
      project,
      activePageIndex,
      slotIndex
    );
    return (
      <>
        {(el.type === 'rect' || el.type === 'rounded-rect') && (
          <div
            style={{
              backgroundColor: el.fill || 'transparent',
              borderColor: el.stroke || 'transparent',
              borderWidth: el.strokeWidth
                ? `${(el.strokeWidth * pxPerInch) / 72}px`
                : 0,
              borderStyle: el.strokeWidth ? 'solid' : 'none',
              borderRadius:
                el.type === 'rounded-rect'
                  ? `${((el.borderRadius || 6) * pxPerInch) / 72}px`
                  : 0,
              color: el.color || '#ffffff',
              fontFamily: el.fontFamily || 'Inter',
              fontSize: `${fontPx}px`,
              fontWeight: el.fontWeight || 'bold',
            }}
            className="w-full h-full flex items-center justify-center text-center leading-none"
          >
            {displayText}
          </div>
        )}

        {el.type === 'circle' && (
          <div
            style={{
              backgroundColor: el.fill || '#d97706',
              borderColor: el.stroke || 'transparent',
              borderWidth: el.strokeWidth
                ? `${(el.strokeWidth * pxPerInch) / 72}px`
                : 0,
            }}
            className="w-full h-full rounded-full"
          />
        )}

        {el.type === 'star' && (
          <div
            style={{
              color: el.fill || '#eab308',
            }}
            className="w-full h-full flex items-center justify-center"
          >
            <Star className="w-full h-full fill-current" />
          </div>
        )}

        {(el.type === 'line' || el.type === 'arrow') && (
          <div className="w-full h-full flex items-center">
            <div
              style={{
                backgroundColor: el.stroke || el.fill || '#94a3b8',
                height: `${Math.max(
                  1,
                  ((el.strokeWidth || 1) * pxPerInch) / 72
                )}px`,
              }}
              className="w-full"
            />
          </div>
        )}

        {el.type === 'image' && el.imageUrl && (
          <img
            src={el.imageUrl}
            alt={el.name}
            className="w-full h-full object-contain pointer-events-none"
          />
        )}

        {el.type === 'qr' && (
          <div
            style={{
              borderColor: el.fill || '#0f172a',
            }}
            className="w-full h-full bg-white p-0.5 border flex flex-col justify-between"
          >
            <div className="grid grid-cols-5 gap-0.5 w-full h-full">
              {Array.from({ length: 25 }).map((_, qi) => (
                <div
                  key={qi}
                  style={{
                    backgroundColor:
                      [
                        0, 1, 3, 4, 5, 6, 8, 9, 12, 15, 16, 18, 20, 21, 23, 24,
                      ].includes(qi)
                        ? el.fill || '#0f172a'
                        : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {el.type === 'text' && (
          <div
            style={{
              fontFamily: el.fontFamily || 'Inter',
              fontSize: `${fontPx}px`,
              fontWeight: el.fontWeight || 'normal',
              fontStyle: el.fontStyle || 'normal',
              textDecoration: el.textDecoration || 'none',
              textAlign: el.textAlign || 'left',
              textTransform: el.textTransform || 'none',
              color: el.color || '#0f172a',
              backgroundColor: el.highlightColor || 'transparent',
              lineHeight: el.lineHeight || 1.22,
              letterSpacing: el.letterSpacing
                ? `${(el.letterSpacing * pxPerInch) / 72}px`
                : undefined,
            }}
            className="w-full h-full whitespace-pre-wrap break-words overflow-visible pointer-events-none"
          >
            {displayText}
          </div>
        )}
      </>
    );
  };

  /**
   * Renders the elements of a single Master unit (either inside each slot of the N-up grid or in the zoomed 1-up view).
   * Uses a two-layer architecture:
   *  1. Clipped Card Print Surface (`overflow-hidden`) so printed card edges stay crisp.
   *  2. Unclipped Interactive Selection & Out-of-Bounds Overlay (`overflow-visible`) so outlines, ghost previews,
   *     all 4 corner handles, all 4 edge handles, and the rotation handle remain visible and grabbable even
   *     when an item is scaled or dragged far beyond the edge of the card/designer!
   */
  const renderMasterUnitInteractive = (
    slotIndex: number,
    isInteractiveSlot: boolean
  ) => {
    const slotMaster =
      currentPage.slotOverrides?.[slotIndex] ||
      project.masters[activeMasterKey];

    const startElementInteraction = (
      e: React.PointerEvent<HTMLElement>,
      el: CanvasElement,
      mode: DragMode,
      boxEl: HTMLElement | null
    ) => {
      e.stopPropagation();
      setActiveSlotIndex(slotIndex);
      setSelectedElementId(el.id);
      if (el.locked) return;
      const rect = boxEl?.getBoundingClientRect();
      const centerClientX = rect ? rect.left + rect.width / 2 : e.clientX;
      const centerClientY = rect ? rect.top + rect.height / 2 : e.clientY;
      setDragState({
        elementId: el.id,
        mode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: el.x,
        startY: el.y,
        startW: el.width,
        startH: el.height,
        startRotation: el.rotation || 0,
        centerClientX,
        centerClientY,
        pxPerInch,
      });
    };

    return (
      <div
        key={slotIndex}
        onClick={(e) => {
          setActiveSlotIndex(slotIndex);
          if (e.target === e.currentTarget) {
            setSelectedElementId(null);
          }
        }}
        style={{
          width: `${unitW * pxPerInch}px`,
          height: `${unitH * pxPerInch}px`,
        }}
        className="relative overflow-visible select-none"
      >
        {/* LAYER 1: Clipped Card Artwork Surface (Shows accurate trimmed appearance within the unit boundary) */}
        <div
          onClick={(e) => {
            setActiveSlotIndex(slotIndex);
            if (e.target === e.currentTarget) {
              setSelectedElementId(null);
            }
          }}
          style={{
            backgroundColor: slotMaster.backgroundColor || '#ffffff',
            backgroundImage: slotMaster.backgroundImage
              ? `url(${slotMaster.backgroundImage})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          className="absolute inset-0 overflow-hidden"
        >
          {slotMaster.elements.map((el) => {
            if (el.visible === false) return null;
            const leftPx = el.x * pxPerInch;
            const topPx = el.y * pxPerInch;
            const widthPx = el.width * pxPerInch;
            const heightPx = el.height * pxPerInch;
            const fontPx = ((el.fontSize || 10) * pxPerInch) / 72;

            return (
              <div
                key={`art-${slotIndex}-${el.id}`}
                style={{
                  left: `${leftPx}px`,
                  top: `${topPx}px`,
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  opacity: el.opacity ?? 1,
                  ...getElementLayerStyleCss(el),
                }}
                className="absolute pointer-events-none"
              >
                {renderElementVisualContent(el, fontPx, slotIndex)}
              </div>
            );
          })}
        </div>

        {/* LAYER 2: Unclipped Interactive Hit-Targets, Out-of-Bounds Outline & 8 Corner/Edge + Rotation Controllers */}
        <div className="absolute inset-0 overflow-visible pointer-events-none z-30">
          {slotMaster.elements.map((el) => {
            if (el.visible === false) return null;
            const isSelected = selectedElementId === el.id;
            const showActiveHandles = isSelected && isInteractiveSlot;

            const leftPx = el.x * pxPerInch;
            const topPx = el.y * pxPerInch;
            const widthPx = el.width * pxPerInch;
            const heightPx = el.height * pxPerInch;
            const fontPx = ((el.fontSize || 10) * pxPerInch) / 72;

            // Check if element extends beyond the unit boundary (accounting for rotation angle) so we can show a ghost preview outside the card
            const elRad = ((el.rotation || 0) * Math.PI) / 180;
            const elCos = Math.abs(Math.cos(elRad));
            const elSin = Math.abs(Math.sin(elRad));
            const elVisW = el.width * elCos + el.height * elSin;
            const elVisH = el.width * elSin + el.height * elCos;
            const elCx = el.x + el.width / 2;
            const elCy = el.y + el.height / 2;
            const isOutOfBounds =
              elCx - elVisW / 2 < -0.01 ||
              elCy - elVisH / 2 < -0.01 ||
              elCx + elVisW / 2 > unitW + 0.01 ||
              elCy + elVisH / 2 > unitH + 0.01;

            // Only render out-of-bounds interactive boxes on the active slot (or for in-bounds elements on other slots)
            if (!isInteractiveSlot && isOutOfBounds && !isSelected) {
              return null;
            }

            const resizeHandles: {
              mode: DragMode;
              posClass: string;
              cursor: string;
              label: string;
              isCorner: boolean;
            }[] = [
              {
                mode: 'resize-nw',
                posClass: '-top-2 -left-2',
                cursor: 'cursor-nwse-resize',
                label: 'Resize Top-Left Corner',
                isCorner: true,
              },
              {
                mode: 'resize-n',
                posClass: '-top-1.5 left-1/2 -translate-x-1/2',
                cursor: 'cursor-ns-resize',
                label: 'Resize Top Edge',
                isCorner: false,
              },
              {
                mode: 'resize-ne',
                posClass: '-top-2 -right-2',
                cursor: 'cursor-nesw-resize',
                label: 'Resize Top-Right Corner',
                isCorner: true,
              },
              {
                mode: 'resize-e',
                posClass: 'top-1/2 -right-1.5 -translate-y-1/2',
                cursor: 'cursor-ew-resize',
                label: 'Resize Right Edge',
                isCorner: false,
              },
              {
                mode: 'resize-se',
                posClass: '-bottom-2 -right-2',
                cursor: 'cursor-nwse-resize',
                label: 'Resize Bottom-Right Corner',
                isCorner: true,
              },
              {
                mode: 'resize-s',
                posClass: '-bottom-1.5 left-1/2 -translate-x-1/2',
                cursor: 'cursor-ns-resize',
                label: 'Resize Bottom Edge',
                isCorner: false,
              },
              {
                mode: 'resize-sw',
                posClass: '-bottom-2 -left-2',
                cursor: 'cursor-nesw-resize',
                label: 'Resize Bottom-Left Corner',
                isCorner: true,
              },
              {
                mode: 'resize-w',
                posClass: 'top-1/2 -left-1.5 -translate-y-1/2',
                cursor: 'cursor-ew-resize',
                label: 'Resize Left Edge',
                isCorner: false,
              },
            ];

            return (
              <div
                key={`ctrl-${slotIndex}-${el.id}`}
                onPointerDown={(e) =>
                  startElementInteraction(e, el, 'move', e.currentTarget)
                }
                style={{
                  left: `${leftPx}px`,
                  top: `${topPx}px`,
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                }}
                className={`absolute pointer-events-auto group ${
                  el.locked ? 'cursor-not-allowed' : 'cursor-move'
                } ${
                  showActiveHandles
                    ? 'ring-2 ring-red-600 z-50'
                    : isSelected
                    ? 'ring-1 ring-red-400/80 z-20'
                    : isOutOfBounds && isInteractiveSlot
                    ? 'ring-1 ring-dashed ring-amber-500/70 hover:ring-2 hover:ring-blue-500 z-20'
                    : 'hover:ring-1 hover:ring-blue-500/80 z-10'
                }`}
              >
                {/* Ghost preview when selected or hovered beyond the card/designer edge so you can see & grab oversized items */}
                {showActiveHandles && isOutOfBounds && (
                  <div className="w-full h-full opacity-35 pointer-events-none outline-1 outline-dashed outline-red-500">
                    {renderElementVisualContent(el, fontPx, slotIndex)}
                  </div>
                )}

                {/* Dashed Out-of-Bounds Wireframe Border so the full bounding box is visible outside the card */}
                {showActiveHandles && (
                  <div className="absolute inset-0 border border-dashed border-white/80 pointer-events-none" />
                )}

                {/* ALL 4 CORNERS + ALL 4 SIDES + ROTATION CONTROLLERS */}
                {showActiveHandles && !el.locked && (
                  <>
                    {/* Top Rotation Stem + Circular Grab Handle */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
                      <div
                        onPointerDown={(e) => {
                          const parentBox = e.currentTarget.parentElement?.parentElement || null;
                          startElementInteraction(e, el, 'rotate', parentBox);
                        }}
                        className="w-5 h-5 rounded-full bg-white border-2 border-red-600 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-red-50 hover:scale-110 transition"
                        title={`Drag to rotate (${el.rotation || 0}°) — Hold Shift to snap 15°`}
                      >
                        <RotateCw className="w-3 h-3 text-red-600" />
                      </div>
                      <div className="w-0.5 h-3 bg-red-600 pointer-events-none" />
                    </div>

                    {/* Secondary Bottom Rotation Handle (Accessible if top edge is off-screen!) */}
                    <div
                      onPointerDown={(e) => {
                        const parentBox = e.currentTarget.parentElement || null;
                        startElementInteraction(e, el, 'rotate', parentBox);
                      }}
                      className="absolute -bottom-7 left-1/2 -translate-x-1/2 w-4.5 h-4.5 rounded-full bg-white border-2 border-red-600 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-red-50 z-50"
                      title={`Drag to rotate (${el.rotation || 0}°) — Accessible from bottom`}
                    >
                      <RotateCw className="w-2.5 h-2.5 text-red-600" />
                    </div>

                    {/* All 8 Resize Handles (4 Corners: NW, NE, SE, SW + 4 Sides: N, E, S, W) */}
                    {resizeHandles.map((h) => (
                      <div
                        key={h.mode}
                        onPointerDown={(e) => {
                          const parentBox = e.currentTarget.parentElement || null;
                          startElementInteraction(e, el, h.mode, parentBox);
                        }}
                        className={`absolute ${h.posClass} ${h.cursor} ${
                          h.isCorner
                            ? 'w-3.5 h-3.5 bg-white border-2 border-red-600 rounded-xs shadow-md hover:scale-125'
                            : 'w-2.5 h-2.5 bg-red-600 border border-white rounded-full shadow-xs hover:scale-125'
                        } transition-transform z-50`}
                        title={h.label}
                      />
                    ))}

                    {/* Floating Quick-Control HUD Badge (Shows size, angle, +90° rotate, and 1-click "Fit to Card" if oversized) */}
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute -bottom-14 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] px-2 py-1 rounded-md shadow-lg flex items-center gap-2 whitespace-nowrap z-50 border border-slate-700"
                    >
                      <span className="font-mono text-slate-300">
                        {el.width.toFixed(2)}×{el.height.toFixed(2)}"
                      </span>
                      <span className="text-amber-300 font-bold">
                        {el.rotation || 0}°
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSelectedElement({
                            x: Number(((unitW - el.width) / 2).toFixed(3)),
                            y: Number(((unitH - el.height) / 2).toFixed(3)),
                          });
                        }}
                        className="px-1.5 py-0.5 rounded bg-pink-600 hover:bg-pink-500 text-white font-semibold cursor-pointer"
                        title="Snap element to exact Horizontal & Vertical Center"
                      >
                        ⊕ Center
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSelectedElement({
                            rotation: ((el.rotation || 0) + 45) % 360,
                          });
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer"
                        title="Rotate +45°"
                      >
                        +45°
                      </button>
                      {isOutOfBounds && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFitElementToUnit(el.id);
                          }}
                          className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
                          title="Scale & center this item back inside the card boundary"
                        >
                          Fit to Card
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* LAYER 3: MAGNETIC SMART ALIGNMENT GUIDES & AUTO-CENTER CROSSHAIR OVERLAY */}
          {isInteractiveSlot && activeSnapGuides.length > 0 && (
            <div className="absolute inset-0 pointer-events-none z-50 overflow-visible">
              {activeSnapGuides.map((g, gIdx) => {
                const isObjectGuide = g.kind === 'object';
                const isCenterGuide = g.kind === 'center';
                const lineColorClass = isObjectGuide
                  ? 'bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.8)]'
                  : isCenterGuide
                  ? 'bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.9)]'
                  : 'bg-fuchsia-500/90';
                const badgeColorClass = isObjectGuide
                  ? 'bg-cyan-600 text-white'
                  : isCenterGuide
                  ? 'bg-pink-600 text-white'
                  : 'bg-fuchsia-700 text-white';

                if (g.axis === 'x') {
                  return (
                    <div
                      key={`snap-x-${gIdx}`}
                      style={{ left: `${g.positionIn * pxPerInch}px` }}
                      className={`absolute -top-4 -bottom-4 w-[1.5px] -translate-x-1/2 ${lineColorClass}`}
                    >
                      <span
                        className={`absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap shadow-md ${badgeColorClass}`}
                      >
                        {g.label}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={`snap-y-${gIdx}`}
                    style={{ top: `${g.positionIn * pxPerInch}px` }}
                    className={`absolute -left-4 -right-4 h-[1.5px] -translate-y-1/2 ${lineColorClass}`}
                  >
                    <span
                      className={`absolute left-1.5 -top-4 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap shadow-md ${badgeColorClass}`}
                    >
                      {g.label}
                    </span>
                  </div>
                );
              })}

              {/* Dead-Center Bullseye Indicator when snapped to BOTH Center X and Center Y */}
              {activeSnapGuides.some(
                (g) => g.axis === 'x' && g.kind === 'center'
              ) &&
                activeSnapGuides.some(
                  (g) => g.axis === 'y' && g.kind === 'center'
                ) && (
                  <div
                    style={{
                      left: `${(unitW / 2) * pxPerInch}px`,
                      top: `${(unitH / 2) * pxPerInch}px`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-pink-500 bg-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.85)] flex items-center justify-center"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-600" />
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={() => {
        setDragState(null);
        setActiveSnapGuides([]);
      }}
      className="flex-1 flex flex-col overflow-hidden bg-[#eef0f3]"
    >
      {/* AI Notification Banner when user arrives from AI Scan & Edit Modal */}
      {aiBannerMessage && (
        <div className="bg-emerald-900 text-white px-4 py-2 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              <strong>AI Design Reconstruction Complete:</strong> {aiBannerMessage}
              {project.template.imposition &&
                ` • Automatically duplicated across all ${
                  project.template.imposition.cols *
                  project.template.imposition.rows
                } slots on ${project.template.name}!`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenMultiTemplateModal}
              className="bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer"
            >
              Duplicate Across Other Template Sizes →
            </button>
            {onDismissAiBanner && (
              <button
                onClick={onDismissAiBanner}
                className="text-white/70 hover:text-white px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* TOP MENU BAR (Matches Photo 1: Back, Undo, Redo, Print | File Home Insert Layout View AI Studio Help | Document Title | View Toggle & Proof) */}
      <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={onBackToDashboard}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 flex items-center gap-1 font-medium cursor-pointer"
            title="Back to Template Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 hover:bg-slate-100 disabled:opacity-35 rounded text-slate-700 cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 hover:bg-slate-100 disabled:opacity-35 rounded text-slate-700 cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPdf}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
            title="Print / Export Print-Ready PDF"
          >
            <Printer className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1.5" />

          {/* Interactive Ribbon Menu Tabs */}
          {(
            ['File', 'Home', 'Insert', 'Layout', 'View', 'AI Studio', 'Help'] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveMenuTab(tab)}
              className={`px-2.5 py-1 rounded-t font-semibold transition cursor-pointer flex items-center gap-1 border-b-2 ${
                activeMenuTab === tab
                  ? 'text-[#cc0000] border-[#cc0000] bg-red-50/70'
                  : 'text-slate-700 border-transparent hover:bg-slate-100'
              }`}
            >
              {tab === 'AI Studio' && (
                <Sparkles className="w-3.5 h-3.5 text-red-600" />
              )}
              {tab}
            </button>
          ))}
        </div>

        {/* Center Document Title (Clean & Uncluttered — Matches Photo 1: "Business Card - 10up Custom") */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={project.title}
            onChange={(e) =>
              onUpdateProject((p) => ({ ...p, title: e.target.value }))
            }
            className="font-bold text-slate-800 text-center bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-red-500 rounded px-2.5 py-0.5 text-xs outline-none min-w-44"
          />
          <span className="text-[11px] text-slate-400 font-medium">Custom</span>
        </div>

        {/* Right Streamlined Controls (Only Sheet/Card Toggle & Proof PDF — no duplicate button clutter!) */}
        <div className="flex items-center gap-2">
          {project.template.imposition && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => {
                  setCanvasViewMode('sheet');
                  setZoom(100);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  canvasViewMode === 'sheet'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full Sheet ({project.template.imposition.cols * project.template.imposition.rows}-Up)
              </button>
              <button
                onClick={() => {
                  setCanvasViewMode('unit');
                  setZoom(100);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  canvasViewMode === 'unit'
                    ? 'bg-white text-red-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single Card ({unitW}×{unitH}")
              </button>
            </div>
          )}

          <button
            onClick={handleOpenProofModal}
            className="flex items-center gap-1.5 bg-[#cc0000] hover:bg-red-700 text-white font-bold px-3 py-1 rounded-md text-xs shadow-2xs transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Proof & Print PDF
          </button>
        </div>
      </div>

      {/* Hidden Project JSON Input for File -> Open Project */}
      <input
        ref={projectJsonUploadRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && onImportProjectJson) onImportProjectJson(f);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* DYNAMIC RIBBON TOOLBAR (Switches cleanly between File, Home, Insert, Layout, View, AI Studio, and Help) */}
      <div className="bg-[#f8f9fa] border-b border-slate-300 px-3 py-1.5 flex items-center gap-4 overflow-x-auto shrink-0 text-xs min-h-16">
        {/* ==================== TAB 1: FILE ==================== */}
        {activeMenuTab === 'File' && (
          <>
            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={onBackToDashboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-red-600" />
                  New from Templates
                </button>
                {onSaveProjectJson && (
                  <button
                    onClick={onSaveProjectJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-700" />
                    Save Project (.json)
                  </button>
                )}
                {onImportProjectJson && (
                  <button
                    onClick={() => projectJsonUploadRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer shadow-2xs"
                  >
                    <FileDown className="w-3.5 h-3.5 text-slate-700 rotate-180" />
                    Open Saved Project (.json)
                  </button>
                )}
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Project File
              </span>
            </div>

            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-2">
                {onOpenFileLocker && (
                  <>
                    <button
                      onClick={() => onOpenFileLocker('locker')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-white cursor-pointer shadow-2xs"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-amber-300" />
                      File Locker (PDFs / Docs / Photos)
                    </button>
                    <button
                      onClick={() => onOpenFileLocker('photo-nup')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-white cursor-pointer shadow-2xs"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-amber-300" />
                      Photo Upper &amp; Posters
                    </button>
                  </>
                )}
                <button
                  onClick={onOpenQuickImportModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 font-bold text-red-700 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 rotate-180" />
                  Quick Import (PDF / Word .docx / Image)
                </button>
                <button
                  onClick={onOpenMultiTemplateModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-red-600" />
                  Duplicate Across Template Sizes
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                File Locker, Photo Upper &amp; Import
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenProofModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#cc0000] hover:bg-red-700 font-bold text-white cursor-pointer shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Proof Every Order & Export PDF
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 font-semibold text-white cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isExporting ? 'Exporting PDF...' : 'Direct Print PDF (300 DPI)'}
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Print Production
              </span>
            </div>
          </>
        )}

        {/* ==================== TAB 2: HOME (Default Typography & Arrange Ribbon) ==================== */}
        {activeMenuTab === 'Home' && (
          <>
            {/* CLIPBOARD GROUP */}
            <div className="flex flex-col items-center border-r border-slate-200 pr-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePaste}
                  disabled={!clipboardElement}
                  className="flex flex-col items-center px-2 py-1 rounded hover:bg-slate-200/70 disabled:opacity-40 cursor-pointer"
                  title="Paste"
                >
                  <Clipboard className="w-4 h-4 text-slate-700" />
                  <span className="text-[10px] mt-0.5">Paste</span>
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={handleCut}
                    disabled={!selectedElement}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200/70 disabled:opacity-40 text-[11px] cursor-pointer"
                  >
                    <Scissors className="w-3 h-3" /> Cut
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={!selectedElement}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200/70 disabled:opacity-40 text-[11px] cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Clipboard
              </span>
            </div>

            {/* FONT GROUP */}
            <div className="flex flex-col items-center border-r border-slate-200 pr-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedElement?.fontFamily || 'Inter'}
                    onChange={(e) =>
                      updateSelectedElement({ fontFamily: e.target.value })
                    }
                    className="border border-slate-300 rounded bg-white px-2 py-0.5 text-xs w-36 outline-none"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={5}
                    max={96}
                    value={selectedElement?.fontSize || 11}
                    onChange={(e) =>
                      updateSelectedElement({ fontSize: Number(e.target.value) })
                    }
                    className="border border-slate-300 rounded bg-white px-1.5 py-0.5 text-xs w-14 text-center outline-none"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        fontWeight:
                          selectedElement?.fontWeight === 'bold' ||
                          selectedElement?.fontWeight === '700' ||
                          selectedElement?.fontWeight === '800'
                            ? 'normal'
                            : 'bold',
                      })
                    }
                    className={`p-1 rounded hover:bg-slate-200 cursor-pointer ${
                      selectedElement?.fontWeight === 'bold' ||
                      selectedElement?.fontWeight === '700' ||
                      selectedElement?.fontWeight === '800'
                        ? 'bg-slate-200 text-red-600'
                        : ''
                    }`}
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        fontStyle:
                          selectedElement?.fontStyle === 'italic'
                            ? 'normal'
                            : 'italic',
                      })
                    }
                    className={`p-1 rounded hover:bg-slate-200 cursor-pointer ${
                      selectedElement?.fontStyle === 'italic'
                        ? 'bg-slate-200 text-red-600'
                        : ''
                    }`}
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        textDecoration:
                          selectedElement?.textDecoration === 'underline'
                            ? 'none'
                            : 'underline',
                      })
                    }
                    className={`p-1 rounded hover:bg-slate-200 cursor-pointer ${
                      selectedElement?.textDecoration === 'underline'
                        ? 'bg-slate-200 text-red-600'
                        : ''
                    }`}
                    title="Underline"
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        textDecoration:
                          selectedElement?.textDecoration === 'line-through'
                            ? 'none'
                            : 'line-through',
                      })
                    }
                    className={`p-1 rounded hover:bg-slate-200 cursor-pointer ${
                      selectedElement?.textDecoration === 'line-through'
                        ? 'bg-slate-200 text-red-600'
                        : ''
                    }`}
                    title="Strikethrough"
                  >
                    <Strikethrough className="w-3.5 h-3.5" />
                  </button>

                  {/* Text Color Picker */}
                  <label
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-slate-200 cursor-pointer"
                    title="Text / Fill Color"
                  >
                    <span
                      className="font-bold text-xs underline decoration-2"
                      style={{
                        textDecorationColor:
                          selectedElement?.color ||
                          selectedElement?.fill ||
                          '#cc0000',
                      }}
                    >
                      A
                    </span>
                    <input
                      type="color"
                      value={
                        selectedElement?.type === 'text'
                          ? selectedElement?.color || '#0f172a'
                          : selectedElement?.fill || '#cc0000'
                      }
                      onChange={(e) => {
                        if (selectedElement?.type === 'text') {
                          updateSelectedElement({ color: e.target.value });
                        } else {
                          updateSelectedElement({ fill: e.target.value });
                        }
                      }}
                      className="w-3.5 h-3.5 border-0 p-0 bg-transparent cursor-pointer"
                    />
                  </label>

                  {/* Grow / Shrink Font */}
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        fontSize: (selectedElement?.fontSize || 10) + 1,
                      })
                    }
                    className="px-1.5 py-0.5 rounded hover:bg-slate-200 text-[11px] font-bold cursor-pointer"
                    title="Increase Font Size"
                  >
                    A↑
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        fontSize: Math.max(
                          5,
                          (selectedElement?.fontSize || 10) - 1
                        ),
                      })
                    }
                    className="px-1.5 py-0.5 rounded hover:bg-slate-200 text-[11px] font-bold cursor-pointer"
                    title="Decrease Font Size"
                  >
                    A↓
                  </button>
                </div>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Font
              </span>
            </div>

            {/* CASE GROUP (AG, ag, Ag) */}
            <div className="flex flex-col items-center border-r border-slate-200 pr-3">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() =>
                    updateSelectedElement({ textTransform: 'uppercase' })
                  }
                  className="px-1.5 py-0.5 rounded hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                  title="UPPERCASE"
                >
                  AG
                </button>
                <button
                  onClick={() =>
                    updateSelectedElement({ textTransform: 'lowercase' })
                  }
                  className="px-1.5 py-0.5 rounded hover:bg-slate-200 text-[11px] font-medium text-slate-700 cursor-pointer"
                  title="lowercase"
                >
                  ag
                </button>
                <button
                  onClick={() =>
                    updateSelectedElement({ textTransform: 'capitalize' })
                  }
                  className="px-1.5 py-0.5 rounded hover:bg-slate-200 text-[11px] font-medium text-slate-700 cursor-pointer col-span-2"
                  title="Title Case / Normal"
                >
                  Ag
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Case
              </span>
            </div>

            {/* PARAGRAPH GROUP */}
            <div className="flex flex-col items-center border-r border-slate-200 pr-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateSelectedElement({ textAlign: 'left' })}
                  className={`p-1 rounded hover:bg-slate-200 cursor-pointer ${
                    selectedElement?.textAlign === 'left' ? 'bg-slate-200' : ''
                  }`}
                  title="Align Text Left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => updateSelectedElement({ textAlign: 'center' })}
                  className={`p-1 rounded hover:bg-slate-200 cursor-pointer ${
                    selectedElement?.textAlign === 'center'
                      ? 'bg-slate-200'
                      : ''
                  }`}
                  title="Align Text Center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => updateSelectedElement({ textAlign: 'right' })}
                  className={`p-1 rounded hover:bg-slate-200 cursor-pointer ${
                    selectedElement?.textAlign === 'right' ? 'bg-slate-200' : ''
                  }`}
                  title="Align Text Right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateSelectedElement({ textAlign: 'justify' })
                  }
                  className={`p-1 rounded hover:bg-slate-200 cursor-pointer ${
                    selectedElement?.textAlign === 'justify'
                      ? 'bg-slate-200'
                      : ''
                  }`}
                  title="Justify"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-2">
                Paragraph
              </span>
            </div>

            {/* STYLES GROUP */}
            <div className="flex flex-col items-center border-r border-slate-200 pr-3">
              <div className="flex flex-col gap-1">
                <select
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'heading')
                      updateSelectedElement({ fontSize: 13, fontWeight: '800' });
                    if (v === 'subheading')
                      updateSelectedElement({
                        fontSize: 9.5,
                        fontWeight: '600',
                      });
                    if (v === 'body')
                      updateSelectedElement({
                        fontSize: 7.5,
                        fontWeight: 'normal',
                      });
                  }}
                  className="border border-slate-300 rounded bg-white px-2 py-0.5 text-[11px]"
                >
                  <option value="body">Body - Normal</option>
                  <option value="heading">Heading - Bold</option>
                  <option value="subheading">Subheading</option>
                </select>
                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-slate-500">Heading</span>
                  <button
                    onClick={() => handleAddElement('text')}
                    className="text-red-600 font-semibold hover:underline cursor-pointer"
                  >
                    + New
                  </button>
                </div>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Styles
              </span>
            </div>

            {/* ALIGN GROUP (Matches Photo 1 with "Relative to Margin" checkbox) */}
            <div className="flex flex-col items-center border-r border-slate-200 pr-3">
              <div className="flex items-center gap-2">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => handleAlignElement('left')}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-[10px] cursor-pointer"
                    title="Snap Left"
                  >
                    ⇤
                  </button>
                  <button
                    onClick={() => handleAlignElement('center')}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-[10px] cursor-pointer"
                    title="Center Horizontally"
                  >
                    ⇹
                  </button>
                  <button
                    onClick={() => handleAlignElement('right')}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-[10px] cursor-pointer"
                    title="Snap Right"
                  >
                    ⇥
                  </button>
                  <button
                    onClick={() => handleAlignElement('top')}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-[10px] cursor-pointer"
                    title="Snap Top"
                  >
                    ⇡
                  </button>
                  <button
                    onClick={() => handleAlignElement('middle')}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-[10px] cursor-pointer"
                    title="Center Vertically"
                  >
                    ⇳
                  </button>
                  <button
                    onClick={() => handleAlignElement('bottom')}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-[10px] cursor-pointer"
                    title="Snap Bottom"
                  >
                    ⇣
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleAlignElement('center-both')}
                    disabled={!selectedElement}
                    className="px-2 py-0.5 bg-pink-50 hover:bg-pink-100 border border-pink-300 text-pink-700 font-bold rounded text-[10px] disabled:opacity-40 cursor-pointer"
                    title="Snap Selected Element to Exact Horizontal & Vertical Center"
                  >
                    ⊕ Center Both
                  </button>
                  <div className="flex items-center gap-2">
                    <label
                      className="flex items-center gap-1 text-[10px] text-pink-700 font-semibold cursor-pointer leading-tight"
                      title="Auto-snap elements to Card Center, Safe Margins, Edges & Other Objects while dragging (Hold Alt while dragging to temporarily bypass)"
                    >
                      <input
                        type="checkbox"
                        checked={smartSnapEnabled}
                        onChange={(e) => setSmartSnapEnabled(e.target.checked)}
                        className="rounded accent-pink-600"
                      />
                      <span>Smart Snap</span>
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer leading-tight">
                      <input
                        type="checkbox"
                        checked={project.relativeToMargin}
                        onChange={(e) =>
                          onUpdateProject((p) => ({
                            ...p,
                            relativeToMargin: e.target.checked,
                          }))
                        }
                        className="rounded text-red-600"
                      />
                      <span>Margin Rel.</span>
                    </label>
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Align & Smart Snap
              </span>
            </div>

            {/* ARRANGE & ROTATE GROUP */}
            <div className="flex flex-col items-center border-r border-slate-200 pr-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleLayerOrder('up')}
                  disabled={!selectedElement}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                  title="Bring Forward"
                >
                  <MoveUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleLayerOrder('down')}
                  disabled={!selectedElement}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                  title="Send Backward"
                >
                  <MoveDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateSelectedElement({
                      rotation: ((selectedElement?.rotation || 0) + 90) % 360,
                    })
                  }
                  disabled={!selectedElement}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40 text-[11px] cursor-pointer"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Rotate
                </button>
                <button
                  onClick={() =>
                    selectedElement && handleFitElementToUnit(selectedElement.id)
                  }
                  disabled={!selectedElement}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-[11px] font-semibold text-slate-700 cursor-pointer"
                  title="Fit & Center Selected Item Inside Card Bounds"
                >
                  <Minimize2 className="w-3 h-3 text-red-600" /> Fit to Card
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-2">
                Arrange
              </span>
            </div>

            {/* EDITING (Find / Replace...) */}
            <div className="flex flex-col items-center">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => setShowFindReplace(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-200 text-[11px] text-slate-700 cursor-pointer"
                >
                  <Search className="w-3 h-3" /> Find
                </button>
                <button
                  onClick={() => setShowFindReplace(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-200 text-[11px] text-slate-700 cursor-pointer"
                >
                  Replace...
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Editing
              </span>
            </div>
          </>
        )}

        {/* ==================== TAB 3: INSERT ==================== */}
        {activeMenuTab === 'Insert' && (
          <>
            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAddElement('text')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <TypeIcon className="w-3.5 h-3.5 text-red-600" />
                  + Add Text Box
                </button>
                <button
                  onClick={() => handleAddNumberingElement()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer shadow-2xs"
                  title="Insert Sequential Print Numbering (e.g. No. 0001, No. 0002, No. 0003...)"
                >
                  <Hash className="w-3.5 h-3.5" />
                  + Add Numbering
                </button>
                <button
                  onClick={() =>
                    handleAddNumberingElement({
                      asTicketStubPair: true,
                      verticalStub: true,
                    })
                  }
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 font-semibold cursor-pointer"
                  title="Insert Synchronized Raffle Ticket Stub + Main Ticket Dual Numbering Pair (Both show No. 0001 on Slot 1, No. 0002 on Slot 2, etc.)"
                >
                  <Hash className="w-3.5 h-3.5" />
                  + Stub &amp; Ticket Dual #
                </button>
                <button
                  onClick={handleInsertMailingAddressBlock}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-semibold cursor-pointer"
                  title="Insert Mail Merge Recipient Address Block ({{Name}}, {{Company}}, {{Address}}, {{CityStateZip}})"
                >
                  <Mail className="w-3.5 h-3.5" />
                  + Mail Merge Block
                </button>
                <button
                  onClick={() => setShowListManagerModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-2xs"
                  title="Open Contact & Variable Data List Manager (Upload CSV, Create New List from Scratch, Edit Columns & Rows, Insert {{Variables}})"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Manage Lists &amp; Variables
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Typography, Numbering &amp; Variable Data Lists
              </span>
            </div>

            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAddElement('rect')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 text-red-600" />
                  Rectangle
                </button>
                <button
                  onClick={() => handleAddElement('rounded-rect')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                >
                  <div className="w-3.5 h-3.5 border-2 border-red-600 rounded-sm" />
                  Rounded Badge
                </button>
                <button
                  onClick={() => handleAddElement('circle')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                >
                  <Circle className="w-3.5 h-3.5 text-amber-600" />
                  Circle
                </button>
                <button
                  onClick={() => handleAddElement('star')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                >
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  Star / Seal
                </button>
                <button
                  onClick={() => handleAddElement('line')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5 text-slate-600" />
                  Divider Line
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Shapes & Accents
              </span>
            </div>

            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-2">
                {onOpenFileLocker && (
                  <>
                    <button
                      onClick={() => onOpenFileLocker('locker')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold text-white cursor-pointer shadow-2xs"
                      title="Open File Locker Gallery (Insert saved images, PDFs, or documents)"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-amber-300" />
                      File Locker
                    </button>
                    <button
                      onClick={() => onOpenFileLocker('photo-nup')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-semibold text-white cursor-pointer shadow-2xs"
                      title="Open Photo Upper & Poster Gang Sheet (4×6, 5×7, 8×10, 11×14, 18×24, 24×36)"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-amber-300" />
                      Photo Upper
                    </button>
                  </>
                )}
                <button
                  onClick={() => imageUploadRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-red-600" />
                  Upload Image / Logo
                </button>
                <button
                  onClick={() => handleAddElement('qr')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-800" />
                  QR Code
                </button>
                <button
                  onClick={onOpenQuickImportModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 font-semibold text-red-700 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 rotate-180" />
                  Import PDF / Word Doc
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                File Locker, Photo Upper, Media &amp; QR
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleAddPage}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-red-600" />
                  Add Page
                </button>
                <button
                  onClick={() => handleDuplicatePage(activePageIndex)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer"
                  title="Duplicate Current Page"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-700" />
                  Duplicate Page
                </button>
                <button
                  onClick={() => handleDeletePage(activePageIndex)}
                  disabled={project.pages.length <= 1}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 font-semibold text-slate-800 cursor-pointer"
                  title="Delete Current Page"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  Delete Page
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Pages
              </span>
            </div>
          </>
        )}

        {/* ==================== TAB 4: LAYOUT ==================== */}
        {activeMenuTab === 'Layout' && (
          <>
            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSetOrientation('portrait')}
                  className={`px-3 py-1 rounded font-semibold border cursor-pointer ${
                    project.template.orientation === 'portrait'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                  title="Switch Sheet, Safe Margins & Imposition Grid to Portrait"
                >
                  Portrait
                </button>
                <button
                  onClick={() => handleSetOrientation('landscape')}
                  className={`px-3 py-1 rounded font-semibold border cursor-pointer ${
                    project.template.orientation === 'landscape'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                  title="Switch Sheet, Safe Margins & Imposition Grid to Landscape"
                >
                  Landscape
                </button>
                <button
                  onClick={() => handleRotateEntireLayout90('ccw')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded font-semibold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 cursor-pointer"
                  title="Rotate Entire Layout (Sheet, Guides & All Photos/Items) 90° Counter-Clockwise"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Rotate Layout 90° CCW
                </button>
                <button
                  onClick={() => handleRotateEntireLayout90('cw')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded font-semibold border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                  title="Rotate Entire Layout (Sheet, Guides & All Photos/Items) 90° Clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Rotate Layout 90° CW
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Orientation & Guide Rotation
              </span>
            </div>

            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                  Bleed:
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={0.5}
                    value={project.bleedIn}
                    onChange={(e) =>
                      onUpdateProject((p) => ({
                        ...p,
                        bleedIn: Number(e.target.value),
                      }))
                    }
                    className="w-14 border border-slate-300 rounded bg-white px-1.5 py-0.5 text-center font-semibold"
                  />
                  in
                </label>
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                  Margin X:
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={2}
                    value={project.marginXIn}
                    onChange={(e) =>
                      onUpdateProject((p) => ({
                        ...p,
                        marginXIn: Number(e.target.value),
                      }))
                    }
                    className="w-14 border border-slate-300 rounded bg-white px-1.5 py-0.5 text-center font-semibold"
                  />
                  in
                </label>
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                  Margin Y:
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={2}
                    value={project.marginYIn}
                    onChange={(e) =>
                      onUpdateProject((p) => ({
                        ...p,
                        marginYIn: Number(e.target.value),
                      }))
                    }
                    className="w-14 border border-slate-300 rounded bg-white px-1.5 py-0.5 text-center font-semibold"
                  />
                  in
                </label>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Bleed & Safe Margins
              </span>
            </div>

            {project.template.imposition && (
              <div className="flex flex-col items-center border-r border-slate-200 pr-4">
                <div className="flex items-center gap-1.5">
                  <label
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-700"
                    title="Outside Left/Right (and Top/Bottom when linked) white border. With Center Link ON, 0.25&quot; outside automatically gives 0.50&quot; center white space (0.25&quot; per item)!"
                  >
                    Outside:
                    <input
                      type="number"
                      step="0.0625"
                      min={0}
                      value={project.template.imposition.marginLeftIn}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        handleUpdateImposition({ marginLeftIn: val });
                      }}
                      className="w-14 border border-slate-300 rounded bg-white px-1.5 py-0.5 text-center font-semibold"
                    />
                  </label>
                  <label
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-700"
                    title="Total Center Horizontal White Space between items (2 × Outside Margin when Center Link is ON)"
                  >
                    Center H:
                    <input
                      type="number"
                      step="0.0625"
                      min={0}
                      value={project.template.imposition.gapXIn}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        handleUpdateImposition({ gapXIn: val });
                      }}
                      className="w-14 border border-slate-300 rounded bg-white px-1.5 py-0.5 text-center font-semibold"
                    />
                  </label>
                  <button
                    onClick={() =>
                      handleUpdateImposition({
                        linkSpacing:
                          project.template.imposition?.linkSpacing === false,
                      })
                    }
                    className={`p-1 rounded border cursor-pointer ${
                      project.template.imposition.linkSpacing !== false
                        ? 'bg-red-50 border-red-300 text-red-600'
                        : 'bg-white border-slate-300 text-slate-500'
                    }`}
                    title="Link H & V Spacing"
                  >
                    {project.template.imposition.linkSpacing !== false ? (
                      <Link2 className="w-3.5 h-3.5" />
                    ) : (
                      <Unlink2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <label
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-700"
                    title="Total Center Vertical White Space between items (2 × Outside Margin when Center Link is ON)"
                  >
                    Center V:
                    <input
                      type="number"
                      step="0.0625"
                      min={0}
                      value={project.template.imposition.gapYIn}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        handleUpdateImposition({ gapYIn: val });
                      }}
                      className="w-14 border border-slate-300 rounded bg-white px-1.5 py-0.5 text-center font-semibold"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateImposition({
                        autoCenterOnSheet: true,
                        autoFitToMargins: true,
                        linkSpacing: true,
                        marginLeftIn: 0.25,
                      })
                    }
                    className="px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[10px] font-bold cursor-pointer"
                    title="Set 1/4&quot; (0.25&quot;) Outside Margin &amp; 1/2&quot; (0.50&quot;) Center White Space (1/4&quot; from each item)"
                  >
                    1/4&quot; Out → 1/2&quot; Ctr
                  </button>
                  <label
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer"
                    title="When active, Center White Space = 2 × Outside Margin (e.g. 1/4&quot; outside L/R creates 1/2&quot; center white space so each cut item gets 1/4&quot; on all 4 sides)"
                  >
                    <input
                      type="checkbox"
                      checked={
                        project.template.imposition.autoCenterOnSheet !== false
                      }
                      onChange={(e) =>
                        handleUpdateImposition({
                          autoCenterOnSheet: e.target.checked,
                        })
                      }
                    />
                    Center Link (2×)
                  </label>
                </div>
                <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                  Multi-Up Spacing & Center Link (Center = 2× Outside)
                </span>
              </div>
            )}

            {/* BANK TABS QUICK SETUP IN LAYOUT RIBBON */}
            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-1.5">
                <select
                  value={
                    project.bankTabConfig?.enabled === false
                      ? 0
                      : project.bankTabConfig?.count ||
                        project.template.bankTabs ||
                        0
                  }
                  onChange={(e) =>
                    handleSetBankTabCount(Number(e.target.value))
                  }
                  className="border border-slate-300 rounded bg-white px-2 py-1 text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  <option value={0}>No Bank Tabs</option>
                  <option value={3}>3 Bank Tabs</option>
                  <option value={4}>4 Bank Tabs</option>
                  <option value={5}>5 Bank Tabs</option>
                  <option value={6}>6 Bank Tabs</option>
                  <option value={8}>8 Bank Tabs</option>
                  <option value={10}>10 Bank Tabs</option>
                </select>
                {(project.bankTabConfig?.enabled !== false &&
                  Boolean(
                    project.bankTabConfig?.count || project.template.bankTabs
                  )) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRightTab('properties');
                      setEditingCanvasTabIndex(0);
                    }}
                    className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                  >
                    ✎ Edit Tab Names
                  </button>
                )}
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Bank Tabs &amp; Divider Titles
              </span>
            </div>

            <div className="flex flex-col items-center">
              <button
                onClick={onOpenMultiTemplateModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-red-600" />
                Switch / Duplicate Template Size
              </button>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Product Template
              </span>
            </div>
          </>
        )}

        {/* ==================== TAB 5: VIEW ==================== */}
        {activeMenuTab === 'View' && (
          <>
            {project.template.imposition && (
              <div className="flex flex-col items-center border-r border-slate-200 pr-4">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setCanvasViewMode('sheet');
                      setZoom(100);
                    }}
                    className={`px-3 py-1 rounded font-semibold border cursor-pointer ${
                      canvasViewMode === 'sheet'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Full Sheet Grid View
                  </button>
                  <button
                    onClick={() => {
                      setCanvasViewMode('unit');
                      setZoom(100);
                    }}
                    className={`px-3 py-1 rounded font-semibold border cursor-pointer ${
                      canvasViewMode === 'unit'
                        ? 'bg-[#cc0000] text-white border-[#cc0000]'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Single Card / Unit View ({unitW}×{unitH}")
                  </button>
                </div>
                <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                  Workspace Mode
                </span>
              </div>
            )}

            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={project.showBleedGuide}
                    onChange={(e) =>
                      onUpdateProject((p) => ({
                        ...p,
                        showBleedGuide: e.target.checked,
                      }))
                    }
                    className="accent-red-600"
                  />
                  Red Bleed Guide
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={project.showMarginGuide}
                    onChange={(e) =>
                      onUpdateProject((p) => ({
                        ...p,
                        showMarginGuide: e.target.checked,
                      }))
                    }
                    className="accent-blue-600"
                  />
                  Blue Safe Margin Guide
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={project.showGridLines}
                    onChange={(e) =>
                      onUpdateProject((p) => ({
                        ...p,
                        showGridLines: e.target.checked,
                      }))
                    }
                    className="accent-emerald-600"
                  />
                  Green Cut Grid Lines
                </label>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Print Guides & Overlays
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {[50, 75, 100, 125, 150, 200].map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
                      zoom === z
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Zoom Level
              </span>
            </div>
          </>
        )}

        {/* ==================== TAB 6: AI STUDIO ==================== */}
        {activeMenuTab === 'AI Studio' && (
          <>
            <div className="flex flex-col items-center border-r border-slate-200 pr-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenAIDesignerModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Print Designer (From Scratch)
                </button>
                <button
                  onClick={onOpenAIScanModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold cursor-pointer shadow-2xs"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Scan & AI-Edit Business Card Photo
                </button>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                AI Generators & Photo Remix
              </span>
            </div>

            <div className="flex flex-col items-center flex-1 max-w-xl">
              <form
                onSubmit={handleRunInEditorAiPrompt}
                className="flex items-center gap-1.5 w-full"
              >
                <input
                  type="text"
                  value={aiQuickPrompt}
                  onChange={(e) => setAiQuickPrompt(e.target.value)}
                  placeholder='Ask AI to edit current design (e.g. "Change phone to 555-0199 and switch to Navy & Gold")...'
                  className="flex-1 border border-slate-300 rounded-lg bg-white px-3 py-1 text-xs outline-none focus:border-red-600"
                />
                <button
                  type="submit"
                  disabled={isAiUpdating || !aiQuickPrompt.trim()}
                  className="px-3 py-1 rounded-lg bg-[#cc0000] hover:bg-red-700 disabled:opacity-40 text-white font-bold cursor-pointer shrink-0"
                >
                  {isAiUpdating ? 'Applying...' : 'Apply AI Edit'}
                </button>
              </form>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                Live AI Canvas Assistant
              </span>
            </div>
          </>
        )}

        {/* ==================== TAB 7: HELP ==================== */}
        {activeMenuTab === 'Help' && (
          <div className="flex items-center gap-4 py-0.5 text-[11px] text-slate-700">
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <strong className="text-red-700">8-Corner & Side Scaling:</strong>{' '}
              Drag any of the 4 white corner handles or 4 red side handles on a selected item to resize from any direction.
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <strong className="text-red-700">Interactive Rotation:</strong>{' '}
              Drag the top or bottom <span className="font-mono">↻</span> handle to rotate freely (hold <kbd className="px-1 bg-slate-100 border rounded">Shift</kbd> for 15° steps).
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <strong className="text-red-700">Out-of-Bounds Recovery:</strong>{' '}
              Items extending past the card edge stay visible with a ghost outline & handles—or click <strong>Fit to Card</strong> to snap them back inside.
            </div>
          </div>
        )}
      </div>

      {/* MAIN WORKSPACE BODY (Left Pages/Tools + Center Rulers/Canvas + Right Inspector) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Pages / Masters + Vertical Tool Strip (Matches Photo 1) */}
        <aside className="flex bg-white border-r border-slate-300 shrink-0">
          {/* Pages / Masters Column */}
          <div className="w-40 border-r border-slate-200 flex flex-col p-2.5 select-none">
            <div className="flex bg-slate-100 p-0.5 rounded-md mb-2">
              <button
                onClick={() => setLeftTab('pages')}
                className={`flex-1 py-1 text-[11px] font-bold rounded transition cursor-pointer ${
                  leftTab === 'pages'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pages ({project.pages.length})
              </button>
              <button
                onClick={() => setLeftTab('masters')}
                className={`flex-1 py-1 text-[11px] font-bold rounded transition cursor-pointer ${
                  leftTab === 'masters'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masters
              </button>
            </div>

            {leftTab === 'pages' ? (
              <>
                {/* Quick Page Action Toolbar (Duplicate, Move Up/Down, Delete for Active Page) */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1 mb-2.5">
                  <button
                    type="button"
                    onClick={() => handleDuplicatePage(activePageIndex)}
                    className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title="Duplicate Selected Page"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={activePageIndex <= 0}
                    onClick={() =>
                      handleMovePage(activePageIndex, activePageIndex - 1)
                    }
                    className="p-1 rounded hover:bg-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer"
                    title="Move Selected Page Up"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={activePageIndex >= project.pages.length - 1}
                    onClick={() =>
                      handleMovePage(activePageIndex, activePageIndex + 1)
                    }
                    className="p-1 rounded hover:bg-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer"
                    title="Move Selected Page Down"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePage(activePageIndex)}
                    className="p-1 rounded hover:bg-red-100 text-red-600 cursor-pointer"
                    title={
                      project.pages.length > 1
                        ? 'Delete Selected Page'
                        : 'Clear / Reset Page'
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col items-center gap-3 pr-0.5">
                  {project.pages.map((pg, idx) => {
                    const isActive = idx === activePageIndex;
                    const master =
                      pg.slotOverrides?.[0] || project.masters[pg.masterId];
                    const isDragged = draggedPageIdx === idx;
                    const isDropAbove =
                      dragOverPageIdx === idx && dragOverPagePos === 'above';
                    const isDropBelow =
                      dragOverPageIdx === idx && dragOverPagePos === 'below';

                    return (
                      <div
                        key={pg.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedPageIdx(idx);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(idx));
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (draggedPageIdx === null || draggedPageIdx === idx)
                            return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const midY = rect.top + rect.height / 2;
                          setDragOverPageIdx(idx);
                          setDragOverPagePos(
                            e.clientY < midY ? 'above' : 'below'
                          );
                        }}
                        onDragLeave={() => {
                          if (dragOverPageIdx === idx) {
                            setDragOverPageIdx(null);
                            setDragOverPagePos(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (
                            draggedPageIdx !== null &&
                            draggedPageIdx !== idx
                          ) {
                            let targetIdx = idx;
                            if (
                              dragOverPagePos === 'below' &&
                              draggedPageIdx > idx
                            ) {
                              targetIdx = idx + 1;
                            } else if (
                              dragOverPagePos === 'above' &&
                              draggedPageIdx < idx
                            ) {
                              targetIdx = idx - 1;
                            }
                            handleMovePage(
                              draggedPageIdx,
                              Math.max(
                                0,
                                Math.min(project.pages.length - 1, targetIdx)
                              )
                            );
                          }
                          setDraggedPageIdx(null);
                          setDragOverPageIdx(null);
                          setDragOverPagePos(null);
                        }}
                        onDragEnd={() => {
                          setDraggedPageIdx(null);
                          setDragOverPageIdx(null);
                          setDragOverPagePos(null);
                        }}
                        onClick={() => {
                          setActivePageIndex(idx);
                          setSelectedElementId(null);
                        }}
                        className={`relative flex flex-col items-center group cursor-pointer w-full rounded-lg p-1 transition ${
                          isDragged ? 'opacity-40 scale-95' : ''
                        } ${isActive ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}
                      >
                        {/* Drop target indicator line (Above) */}
                        {isDropAbove && (
                          <div className="absolute -top-1.5 left-1 right-1 h-1 bg-[#cc0000] rounded-full shadow-xs z-20" />
                        )}

                        {/* Drop target indicator line (Below) */}
                        {isDropBelow && (
                          <div className="absolute -bottom-1.5 left-1 right-1 h-1 bg-[#cc0000] rounded-full shadow-xs z-20" />
                        )}

                        <div
                          style={{
                            backgroundColor:
                              master.backgroundColor || '#ffffff',
                          }}
                          className={`relative w-24 h-28 rounded border-2 shadow-2xs flex flex-col items-center justify-center p-1.5 transition ${
                            isActive
                              ? 'border-[#cc0000] ring-2 ring-red-500/20'
                              : 'border-slate-300 group-hover:border-slate-400'
                          }`}
                        >
                          {/* Top-Left Drag Handle Grip */}
                          <div
                            className="absolute top-1 left-1 text-slate-400 opacity-60 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
                            title="Drag to rearrange page order"
                          >
                            <GripVertical className="w-3 h-3" />
                          </div>

                          {/* Top-Right Hover / Active Mini Action Buttons (Up, Down, Duplicate, Delete) */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute top-1 right-1 flex items-center gap-0.5 bg-white/95 border border-slate-200 rounded px-0.5 py-0.5 shadow-2xs transition ${
                              isActive
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMovePage(idx, idx - 1)}
                                className="p-0.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                                title="Move Page Up"
                              >
                                <MoveUp className="w-2.5 h-2.5" />
                              </button>
                            )}
                            {idx < project.pages.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMovePage(idx, idx + 1)}
                                className="p-0.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                                title="Move Page Down"
                              >
                                <MoveDown className="w-2.5 h-2.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDuplicatePage(idx)}
                              className="p-0.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                              title="Duplicate Page"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePage(idx)}
                              className="p-0.5 rounded hover:bg-red-100 text-red-600 cursor-pointer"
                              title={
                                project.pages.length > 1
                                  ? 'Delete Page'
                                  : 'Reset Page'
                              }
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-2">
                            {master.elements.length === 0 &&
                            !master.backgroundImage
                              ? 'EMPTY'
                              : pg.side === 'front'
                              ? 'FRONT SHEET'
                              : 'BACK SHEET'}
                          </span>
                          <span className="text-[7px] text-slate-400 mt-1 text-center truncate w-full">
                            {pg.slotOverrides
                              ? pg.name
                              : master.elements.find(
                                  (e) => e.role === 'company'
                                )?.text || `${master.elements.length} layers`}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-red-600 mt-1">
                          {idx + 1}
                        </span>
                        <span className="text-[10px] text-slate-500 text-center truncate w-full px-1">
                          {pg.slotOverrides
                            ? pg.name
                            : pg.masterId === 'master-a'
                            ? 'Master A'
                            : 'Master B'}
                        </span>
                      </div>
                    );
                  })}

                  {/* + Add Page Card (Matches Photo 1) */}
                  <button
                    onClick={handleAddPage}
                    className="flex flex-col items-center cursor-pointer mt-1 group"
                  >
                    <div className="w-24 h-24 rounded border border-dashed border-slate-300 group-hover:border-red-500 bg-slate-50 flex items-center justify-center transition">
                      <Plus className="w-4 h-4 text-slate-500 group-hover:text-red-600" />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Add page
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col items-center gap-3">
                {(['master-a', 'master-b'] as const).map((mKey, idx) => {
                  const m = project.masters[mKey];
                  const isApplied = currentPage.masterId === mKey;
                  return (
                    <button
                      key={mKey}
                      onClick={() => {
                        const pageIdx = project.pages.findIndex(
                          (p) => p.masterId === mKey
                        );
                        if (pageIdx >= 0) setActivePageIndex(pageIdx);
                      }}
                      className="flex flex-col items-center cursor-pointer w-full"
                    >
                      <div
                        style={{ backgroundColor: m.backgroundColor }}
                        className={`w-24 h-14 rounded border-2 flex flex-col items-center justify-center p-1 ${
                          isApplied ? 'border-[#cc0000]' : 'border-slate-300'
                        }`}
                      >
                        <span className="text-[8px] font-bold text-slate-500">
                          {idx === 0 ? 'MASTER A (FRONT)' : 'MASTER B (BACK)'}
                        </span>
                        <span className="text-[8px] text-slate-400">
                          {m.elements.length} layers
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-700 mt-1">
                        {m.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vertical Tool Strip (Matches Photo 1: Select, T, Rect, RoundedRect, Circle, Line, Arrow, Star, Image, QR/Table, AI, Zoom, Hand) */}
          <div className="w-10 py-2 flex flex-col items-center gap-1.5 bg-white">
            <button
              onClick={() => setActiveTool('select')}
              className={`p-1.5 rounded border transition cursor-pointer ${
                activeTool === 'select'
                  ? 'border-red-600 text-red-600 bg-red-50'
                  : 'border-transparent text-slate-700 hover:bg-slate-100'
              }`}
              title="Select & Move Tool"
            >
              <MousePointer className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleAddElement('text')}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 font-serif font-bold text-sm cursor-pointer"
              title="Add Text Box (T)"
            >
              <TypeIcon className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleAddNumberingElement()}
              className="p-1.5 rounded text-red-600 bg-red-50/70 hover:bg-red-100 font-bold cursor-pointer"
              title="Add Sequential Print Numbering (No. 0001, No. 0002...)"
            >
              <Hash className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleAddElement('rect')}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Add Rectangle"
            >
              <Square className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleAddElement('rounded-rect')}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Add Rounded Rectangle / Badge"
            >
              <div className="w-3.5 h-3.5 border-2 border-current rounded-md" />
            </button>

            <button
              onClick={() => handleAddElement('circle')}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Add Circle / Ellipse"
            >
              <Circle className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleAddElement('line')}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Add Line / Divider"
            >
              <Minus className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleAddElement('arrow')}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Add Arrow"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleAddElement('star')}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Add Star / Seal"
            >
              <Star className="w-4 h-4" />
            </button>

            <input
              ref={imageUploadRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileUpload}
              className="hidden"
            />
            <button
              onClick={() => imageUploadRef.current?.click()}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Insert Image / Logo"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleAddElement('qr')}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Insert QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenAIScanModal}
              className="p-1.5 rounded text-red-600 bg-red-50 hover:bg-red-100 cursor-pointer"
              title="AI Business Card Photo Scanner & Remix"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            <button
              onClick={() => setZoom((z) => Math.min(240, z + 20))}
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={() =>
                setCanvasViewMode((v) => (v === 'sheet' ? 'unit' : 'sheet'))
              }
              className="p-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Toggle Single Card / Full Sheet View"
            >
              {canvasViewMode === 'sheet' ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </aside>

        {/* CENTER WORKSPACE: Rulers + Interactive Sheet/Unit Canvas + Legend & Zoom Bar */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#e5e7eb]">
          {/* Horizontal Top Ruler (Matches Photo 1) */}
          <div className="h-6 bg-[#f1f3f5] border-b border-slate-300 flex items-end pl-6 select-none overflow-hidden shrink-0">
            {Array.from({ length: 19 }).map((_, inch) => (
              <div
                key={inch}
                style={{ width: `${pxPerInch}px` }}
                className="shrink-0 border-l border-slate-400 h-3.5 relative flex items-start pl-1"
              >
                <span className="text-[9px] text-slate-500 leading-none">
                  {inch}
                </span>
                <div className="absolute bottom-0 left-1/4 h-1 w-px bg-slate-300" />
                <div className="absolute bottom-0 left-1/2 h-2 w-px bg-slate-400" />
                <div className="absolute bottom-0 left-3/4 h-1 w-px bg-slate-300" />
              </div>
            ))}
          </div>

          <div className="flex-1 flex overflow-auto relative">
            {/* Vertical Left Ruler */}
            <div className="w-6 bg-[#f1f3f5] border-r border-slate-300 flex flex-col select-none shrink-0">
              {Array.from({ length: 19 }).map((_, inch) => (
                <div
                  key={inch}
                  style={{ height: `${pxPerInch}px` }}
                  className="shrink-0 border-t border-slate-400 w-3.5 ml-auto relative"
                >
                  <span className="text-[9px] text-slate-500 absolute top-0.5 -left-2">
                    {inch}
                  </span>
                </div>
              ))}
            </div>

            {/* Scrollable Canvas Stage */}
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedElementId(null);
              }}
              className="flex-1 flex items-center justify-center p-10 min-w-max min-h-max relative"
            >
              {/* Full Sheet or Single Unit Container */}
              <div
                style={{
                  width: `${canvasWidthPx}px`,
                  height: `${canvasHeightPx}px`,
                }}
                className="bg-white shadow-xl relative border border-slate-400"
              >
                {/* Red Dashed Bleed Guide Line (Matches Photo 1 — z-40 so never occluded by slot backgrounds) */}
                {project.showBleedGuide && (
                  <div
                    style={{
                      inset: `-${project.bleedIn * pxPerInch}px`,
                    }}
                    className="absolute border border-dashed border-red-500 pointer-events-none z-40"
                  />
                )}

                {/* Blue Dashed Margin Guide Line (Matches Photo 1 — z-40 so never occluded by slot backgrounds) */}
                {project.showMarginGuide && (
                  <div
                    style={{
                      left: `${project.marginXIn * pxPerInch}px`,
                      right: `${project.marginXIn * pxPerInch}px`,
                      top: `${project.marginYIn * pxPerInch}px`,
                      bottom: `${project.marginYIn * pxPerInch}px`,
                    }}
                    className="absolute border border-dashed border-blue-500/80 pointer-events-none z-40"
                  />
                )}

                {/* CASE A: Full Sheet View with N-Up Imposition Grid (e.g. Business Card 10-up on 8.5x11") */}
                {canvasViewMode === 'sheet' && project.template.imposition ? (
                  <>
                    {/* Extended Green Imposition Grid Lines Across Canvas (z-40 so always crisp above slot backgrounds) */}
                    {project.showGridLines && (
                      <div className="absolute inset-0 pointer-events-none z-40">
                        {/* Vertical green cut & item-margin lines */}
                        {(() => {
                          const imp = project.template.imposition!;
                          const itemEdgePositions = new Set<number>();
                          const centerCutPositions = new Set<number>();
                          for (let c = 0; c < imp.cols; c++) {
                            const leftEdge =
                              imp.marginLeftIn + c * (imp.unitWidthIn + imp.gapXIn);
                            const rightEdge = leftEdge + imp.unitWidthIn;
                            itemEdgePositions.add(Number(leftEdge.toFixed(4)));
                            itemEdgePositions.add(Number(rightEdge.toFixed(4)));
                            if (c < imp.cols - 1 && imp.gapXIn > 0.001) {
                              const centerCut = rightEdge + imp.gapXIn / 2;
                              centerCutPositions.add(Number(centerCut.toFixed(4)));
                            }
                          }
                          return (
                            <>
                              {Array.from(itemEdgePositions).map((xIn, idx) => (
                                <div
                                  key={`v-edge-${idx}`}
                                  style={{ left: `${xIn * pxPerInch}px` }}
                                  className={
                                    imp.gapXIn > 0.001
                                      ? 'absolute -top-6 -bottom-6 w-0 border-l border-dashed border-emerald-500/80'
                                      : 'absolute -top-8 -bottom-8 w-px bg-emerald-600/90'
                                  }
                                />
                              ))}
                              {Array.from(centerCutPositions).map((xIn, idx) => (
                                <div
                                  key={`v-cut-${idx}`}
                                  style={{ left: `${xIn * pxPerInch}px` }}
                                  className="absolute -top-8 -bottom-8 w-px bg-emerald-600/95 shadow-[0_0_2px_rgba(5,150,105,0.6)]"
                                >
                                  <span className="absolute -top-6 -translate-x-1/2 bg-emerald-700 text-white text-[9px] font-bold px-1.5 py-0.2 rounded whitespace-nowrap shadow">
                                    ✂ Center ({imp.gapXIn}&quot; = {(imp.gapXIn / 2).toFixed(2)}&quot; + {(imp.gapXIn / 2).toFixed(2)}&quot;)
                                  </span>
                                </div>
                              ))}
                            </>
                          );
                        })()}

                        {/* Horizontal green cut & item-margin lines */}
                        {(() => {
                          const imp = project.template.imposition!;
                          const itemEdgePositions = new Set<number>();
                          const centerCutPositions = new Set<number>();
                          for (let r = 0; r < imp.rows; r++) {
                            const topEdge =
                              imp.marginTopIn + r * (imp.unitHeightIn + imp.gapYIn);
                            const botEdge = topEdge + imp.unitHeightIn;
                            itemEdgePositions.add(Number(topEdge.toFixed(4)));
                            itemEdgePositions.add(Number(botEdge.toFixed(4)));
                            if (r < imp.rows - 1 && imp.gapYIn > 0.001) {
                              const centerCut = botEdge + imp.gapYIn / 2;
                              centerCutPositions.add(Number(centerCut.toFixed(4)));
                            }
                          }
                          return (
                            <>
                              {Array.from(itemEdgePositions).map((yIn, idx) => (
                                <div
                                  key={`h-edge-${idx}`}
                                  style={{ top: `${yIn * pxPerInch}px` }}
                                  className={
                                    imp.gapYIn > 0.001
                                      ? 'absolute -left-6 -right-6 h-0 border-t border-dashed border-emerald-500/80'
                                      : 'absolute -left-8 -right-8 h-px bg-emerald-600/90'
                                  }
                                />
                              ))}
                              {Array.from(centerCutPositions).map((yIn, idx) => (
                                <div
                                  key={`h-cut-${idx}`}
                                  style={{ top: `${yIn * pxPerInch}px` }}
                                  className="absolute -left-8 -right-8 h-px bg-emerald-600/95 shadow-[0_0_2px_rgba(5,150,105,0.6)]"
                                >
                                  <span className="absolute -left-2 -translate-y-1/2 -translate-x-full bg-emerald-700 text-white text-[9px] font-bold px-1.5 py-0.2 rounded whitespace-nowrap shadow">
                                    ✂ {imp.gapYIn}&quot;
                                  </span>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Render all N-up slots (e.g. 4-up Postcards or 10-up Business Cards on 8.5x11") */}
                    {Array.from({
                      length:
                        project.template.imposition.cols *
                        project.template.imposition.rows,
                    }).map((_, slotIdx) => {
                      const imp = project.template.imposition!;
                      const col = slotIdx % imp.cols;
                      const row = Math.floor(slotIdx / imp.cols);
                      const slotXIn =
                        imp.marginLeftIn + col * (imp.unitWidthIn + imp.gapXIn);
                      const slotYIn =
                        imp.marginTopIn + row * (imp.unitHeightIn + imp.gapYIn);
                      const padXPx = (imp.innerPaddingXIn || 0) * pxPerInch;
                      const padYPx = (imp.innerPaddingYIn || 0) * pxPerInch;
                      const slotSafeXIn = Math.min(
                        project.marginXIn,
                        imp.unitWidthIn * 0.22
                      );
                      const slotSafeYIn = Math.min(
                        project.marginYIn,
                        imp.unitHeightIn * 0.22
                      );

                      return (
                        <div
                          key={slotIdx}
                          style={{
                            left: `${slotXIn * pxPerInch}px`,
                            top: `${slotYIn * pxPerInch}px`,
                            width: `${imp.unitWidthIn * pxPerInch}px`,
                            height: `${imp.unitHeightIn * pxPerInch}px`,
                          }}
                          className={`absolute overflow-visible ${
                            activeSlotIndex === slotIdx ? 'z-30' : 'z-10'
                          }`}
                        >
                          {renderMasterUnitInteractive(
                            slotIdx,
                            activeSlotIndex === slotIdx
                          )}

                          {/* Per-Slot Safe Margin Guide when Margin Guide is enabled */}
                          {project.showMarginGuide &&
                            slotSafeXIn > 0 &&
                            slotSafeYIn > 0 && (
                              <div
                                style={{
                                  left: `${slotSafeXIn * pxPerInch}px`,
                                  right: `${slotSafeXIn * pxPerInch}px`,
                                  top: `${slotSafeYIn * pxPerInch}px`,
                                  bottom: `${slotSafeYIn * pxPerInch}px`,
                                }}
                                className="absolute border border-dashed border-blue-400/55 pointer-events-none z-25"
                              />
                            )}

                          {/* Non-Bleed Inner Slot White Margin Frame (if innerPaddingXIn or innerPaddingYIn > 0) */}
                          {(padXPx > 0 || padYPx > 0) && (
                            <div className="absolute inset-0 pointer-events-none z-20">
                              {padXPx > 0 && (
                                <>
                                  <div
                                    style={{ width: `${padXPx}px` }}
                                    className="absolute left-0 top-0 bottom-0 bg-white border-r border-dashed border-sky-400/70"
                                  />
                                  <div
                                    style={{ width: `${padXPx}px` }}
                                    className="absolute right-0 top-0 bottom-0 bg-white border-l border-dashed border-sky-400/70"
                                  />
                                </>
                              )}
                              {padYPx > 0 && (
                                <>
                                  <div
                                    style={{ height: `${padYPx}px` }}
                                    className="absolute top-0 left-0 right-0 bg-white border-b border-dashed border-sky-400/70"
                                  />
                                  <div
                                    style={{ height: `${padYPx}px` }}
                                    className="absolute bottom-0 left-0 right-0 bg-white border-t border-dashed border-sky-400/70"
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  /* CASE B: Single Unit View OR Non-Imposed Full Sheet (e.g., 8.5x11 Flyer, 3 Bank Tabs, Business Card Single) */
                  <div className="w-full h-full relative">
                    {renderMasterUnitInteractive(0, true)}

                    {/* Interactive Bank Tabs Ear Strip (Right 0.5" Tab Extension on 9x11 Sheet) */}
                    {(() => {
                      const bankTabCount =
                        project.bankTabConfig?.enabled === false
                          ? 0
                          : project.bankTabConfig?.count ||
                            project.template.bankTabs ||
                            0;
                      if (!bankTabCount) return null;

                      const tabCfg =
                        project.bankTabConfig ||
                        createDefaultBankTabConfig(bankTabCount);
                      const tabExtIn = tabCfg.tabExtensionIn || 0.5;
                      const tabExtPx = tabExtIn * pxPerInch;
                      const shoulderIn = 0.25;
                      const notchGapIn = 0.06;
                      const usableHeightIn = Math.max(
                        1,
                        displayedHeightIn - shoulderIn * 2
                      );
                      const singleTabHeightIn =
                        (usableHeightIn -
                          notchGapIn * Math.max(0, bankTabCount - 1)) /
                        bankTabCount;
                      const isSingleTabMode =
                        tabCfg.displayMode === 'single-tab-per-page';
                      const activeTabForPage =
                        currentPage?.activeTabIndex !== undefined
                          ? currentPage.activeTabIndex
                          : activePageIndex % bankTabCount;
                      const fontPx = ((tabCfg.fontSizePt || 9.5) * pxPerInch) / 72;

                      return (
                        <div
                          style={{ width: `${tabExtPx}px` }}
                          className="absolute top-0 bottom-0 right-0 bg-slate-100/90 border-l border-dashed border-red-400 z-30 select-none"
                        >
                          {/* Top Callout Badge for the 0.5" Tab Bank Zone */}
                          <div className="absolute -top-5 right-0 whitespace-nowrap bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-2xs pointer-events-none">
                            {bankTabCount}-Tab Bank ({tabExtIn}&quot; Ear — Click
                            any tab to type name)
                          </div>

                          {Array.from({ length: bankTabCount }).map(
                            (_, tIdx) => {
                              const tabTopIn =
                                shoulderIn +
                                tIdx * (singleTabHeightIn + notchGapIn);
                              const tabTopPx = tabTopIn * pxPerInch;
                              const tabHeightPx = singleTabHeightIn * pxPerInch;
                              const isTabActiveOnThisPage =
                                !isSingleTabMode || tIdx === activeTabForPage;
                              const tabLabel =
                                tabCfg.labels[tIdx] !== undefined
                                  ? tabCfg.labels[tIdx]
                                  : `Tab ${tIdx + 1}`;
                              const tabFill =
                                tabCfg.colors?.[tIdx] || '#ffffff';
                              const tabTextCol =
                                tabCfg.textColors?.[tIdx] || '#0f172a';
                              const isEditingThisTab =
                                editingCanvasTabIndex === tIdx;

                              return (
                                <div
                                  key={tIdx}
                                  style={{
                                    top: `${tabTopPx}px`,
                                    height: `${tabHeightPx}px`,
                                    backgroundColor: isTabActiveOnThisPage
                                      ? tabFill
                                      : 'rgba(241,245,249,0.55)',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCanvasTabIndex(tIdx);
                                    setRightTab('properties');
                                  }}
                                  className={`group absolute left-0 right-0 rounded-r-lg border border-l-0 transition cursor-pointer flex items-center justify-center ${
                                    isEditingThisTab
                                      ? 'border-red-600 ring-2 ring-red-500/40 shadow-md z-40'
                                      : isTabActiveOnThisPage
                                      ? 'border-slate-400 hover:border-red-500 shadow-xs'
                                      : 'border-dashed border-slate-300 opacity-55 hover:opacity-90'
                                  }`}
                                  title={`Click to type name for Tab ${
                                    tIdx + 1
                                  } ("${tabLabel}")`}
                                >
                                  {/* Rotated Tab Title inside the 0.5" Tab Ear */}
                                  <span
                                    style={{
                                      fontSize: `${Math.max(8, fontPx)}px`,
                                      color: tabTextCol,
                                      maxWidth: `${Math.max(
                                        24,
                                        tabHeightPx - 10
                                      )}px`,
                                    }}
                                    className="font-bold rotate-90 whitespace-nowrap truncate pointer-events-none"
                                  >
                                    {tabLabel || `Tab ${tIdx + 1}`}
                                  </span>

                                  {/* Hover Edit Pencil Pill */}
                                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-16 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm pointer-events-none whitespace-nowrap">
                                    ✎ Tab {tIdx + 1}
                                  </span>

                                  {/* Inline Popover Editor when user clicks directly on this Tab Ear on Canvas */}
                                  {isEditingThisTab && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-full mr-2 top-1/2 -translate-y-1/2 w-56 bg-white border-2 border-red-600 rounded-xl shadow-xl p-2.5 z-50 flex flex-col gap-1.5"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700">
                                          Edit Tab #{tIdx + 1} Name
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingCanvasTabIndex(null)
                                          }
                                          className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                      <input
                                        type="text"
                                        autoFocus
                                        value={tabLabel}
                                        onChange={(e) =>
                                          handleUpdateSingleTabLabel(
                                            tIdx,
                                            e.target.value
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            // Advance to next tab on Enter!
                                            if (tIdx + 1 < bankTabCount) {
                                              setEditingCanvasTabIndex(
                                                tIdx + 1
                                              );
                                            } else {
                                              setEditingCanvasTabIndex(null);
                                            }
                                          } else if (e.key === 'Escape') {
                                            setEditingCanvasTabIndex(null);
                                          }
                                        }}
                                        placeholder={`Tab ${tIdx + 1} Title...`}
                                        className="w-full border border-slate-300 focus:border-red-600 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900 outline-none"
                                      />
                                      <div className="flex items-center justify-between pt-0.5">
                                        <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 cursor-pointer">
                                          <span>Tab Color:</span>
                                          <input
                                            type="color"
                                            value={tabFill}
                                            onChange={(e) =>
                                              handleUpdateSingleTabColor(
                                                tIdx,
                                                e.target.value
                                              )
                                            }
                                            className="w-4 h-4 rounded border border-slate-300 cursor-pointer"
                                          />
                                        </label>
                                        <div className="flex items-center gap-1">
                                          {tIdx + 1 < bankTabCount && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setEditingCanvasTabIndex(
                                                  tIdx + 1
                                                )
                                              }
                                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                                            >
                                              Next Tab →
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingCanvasTabIndex(null)
                                            }
                                            className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold cursor-pointer"
                                          >
                                            Done
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Dimension Callout Lines Around Sheet (Matches Photo 1: "8.5 in" at bottom, "11 in" at right) */}
                <div className="absolute -bottom-6 left-0 right-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-px bg-slate-400 relative flex items-center justify-center">
                    <div className="absolute left-0 h-2.5 w-px bg-slate-500" />
                    <span className="bg-[#e5e7eb] px-2 text-[10px] font-semibold text-slate-600">
                      {displayedWidthIn} in
                    </span>
                    <div className="absolute right-0 h-2.5 w-px bg-slate-500" />
                  </div>
                </div>

                <div className="absolute top-0 bottom-0 -right-8 flex items-center justify-center pointer-events-none">
                  <div className="h-full w-px bg-slate-400 relative flex items-center justify-center">
                    <div className="absolute top-0 w-2.5 h-px bg-slate-500" />
                    <span className="bg-[#e5e7eb] py-1 text-[10px] font-semibold text-slate-600 whitespace-nowrap">
                      {displayedHeightIn} in
                    </span>
                    <div className="absolute bottom-0 w-2.5 h-px bg-slate-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-Right Floating Legend Box (Matches Photo 1: Bleed 0 in, Margin 0.2 x 0.38 in) */}
          <div className="absolute bottom-10 right-4 bg-white/95 backdrop-blur-xs border border-slate-300 rounded-md px-3 py-2 shadow-sm text-[11px] text-slate-600 flex flex-col gap-1 pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="w-4 border-b border-dashed border-red-500" />
              <span>Bleed {project.bleedIn} in</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 border-b border-dashed border-blue-600" />
              <span>
                Margin {project.marginXIn} × {project.marginYIn} in
              </span>
            </div>
            {project.template.imposition && (
              <div className="flex items-center gap-2">
                <span className="w-4 border-b border-emerald-600" />
                <span>
                  {project.template.imposition.cols}×
                  {project.template.imposition.rows} Cut Grid ({unitW}×{unitH}")
                </span>
              </div>
            )}
          </div>

          {/* Bottom Status & Zoom Bar (Matches Photo 1) */}
          <div className="h-7 bg-white border-t border-slate-300 px-3 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
            <div className="flex items-center gap-4">
              <span>
                Page {activePageIndex + 1} of {project.pages.length} (
                {currentPage.side === 'front' ? 'Front Side' : 'Back Side'})
              </span>
              <span className="text-slate-400">|</span>
              <span>
                {selectedElement
                  ? `Selected: ${selectedElement.name} (${selectedElement.width} × ${selectedElement.height} in)`
                  : 'Select tool - ready (Click any card element to edit all slots)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSmartSnapEnabled((s) => !s)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                  smartSnapEnabled
                    ? 'bg-pink-50 border-pink-300 text-pink-700'
                    : 'bg-slate-100 border-slate-300 text-slate-500'
                }`}
                title="Toggle Magnetic Smart Guides & Auto-Center Snapping (Hold Alt while dragging to bypass)"
              >
                {smartSnapEnabled ? '✦ Smart Snap: ON' : 'Smart Snap: OFF'}
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setZoom((z) => Math.max(40, z - 15))}
                className="hover:text-slate-900 cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={40}
                max={240}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-24 accent-[#cc0000]"
              />
              <button
                onClick={() => setZoom((z) => Math.min(240, z + 15))}
                className="hover:text-slate-900 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-right font-semibold">{zoom}%</span>
            </div>
          </div>
        </div>

        {/* RIGHT INSPECTOR PANEL (Matches Photo 1: Properties | Layers + AI Studio Tab) */}
        <aside className="w-76 bg-white border-l border-slate-300 flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 px-3 pt-2.5 gap-4">
            <button
              onClick={() => setRightTab('properties')}
              className={`pb-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                rightTab === 'properties'
                  ? 'border-[#cc0000] text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Properties
            </button>
            <button
              onClick={() => setRightTab('layers')}
              className={`pb-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                rightTab === 'layers'
                  ? 'border-[#cc0000] text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Layers ({activeMaster.elements.length})
            </button>
            <button
              onClick={() => setRightTab('ai')}
              className={`pb-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1 ${
                rightTab === 'ai'
                  ? 'border-[#cc0000] text-[#cc0000]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-red-600" />
              AI Edit
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 text-xs">
            {rightTab === 'properties' && (
              <>
                {/* SELECTED ELEMENT INSPECTOR (When a layer is clicked) */}
                {selectedElement && (
                  <div className="bg-red-50/50 border border-red-200 rounded-xl p-3.5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-700">
                        Selected Layer: {selectedElement.name}
                      </span>
                      <button
                        onClick={handleDeleteSelected}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100 cursor-pointer"
                        title="Delete Element"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {selectedElement.text !== undefined && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Text Content (Updates All Slots Live)
                          </label>
                          <label
                            className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-white border border-red-200 px-1.5 py-0.5 rounded cursor-pointer"
                            title="Turn this text box into a live Sequential Print Number (or include {{NUM}} anywhere in the text)"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(
                                selectedElement.isSequentialNumber ||
                                  selectedElement.text?.includes('{{NUM}}')
                              )}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (checked) {
                                  handleUpdateNumbering({ enabled: true });
                                  updateSelectedElement({
                                    isSequentialNumber: true,
                                    text:
                                      selectedElement.text &&
                                      selectedElement.text.includes('{{NUM}}')
                                        ? selectedElement.text
                                        : '{{NUM}}',
                                  });
                                } else {
                                  updateSelectedElement({
                                    isSequentialNumber: false,
                                    text:
                                      selectedElement.text === '{{NUM}}'
                                        ? 'No. 0001'
                                        : selectedElement.text,
                                  });
                                }
                              }}
                              className="accent-red-600"
                            />
                            <span># Auto-Number</span>
                          </label>
                        </div>
                        <textarea
                          rows={2}
                          value={selectedElement.text}
                          onChange={(e) =>
                            updateSelectedElement({ text: e.target.value })
                          }
                          className="w-full border border-slate-300 rounded-lg bg-white px-2.5 py-1.5 text-xs outline-none focus:border-red-600"
                        />
                        {(selectedElement.isSequentialNumber ||
                          selectedElement.text?.includes('{{NUM}}')) && (
                          <div className="mt-1.5 bg-white border border-red-200 rounded-lg p-2 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[10px] text-slate-600">
                              <span>
                                Slot 1:{' '}
                                <strong className="text-red-700 font-mono">
                                  {resolveElementDisplayText(
                                    selectedElement,
                                    project,
                                    activePageIndex,
                                    0
                                  )}
                                </strong>
                              </span>
                              {project.template.imposition &&
                                project.template.imposition.cols *
                                  project.template.imposition.rows >
                                  1 && (
                                  <span>
                                    Slot 2:{' '}
                                    <strong className="text-red-700 font-mono">
                                      {resolveElementDisplayText(
                                        selectedElement,
                                        project,
                                        activePageIndex,
                                        1
                                      )}
                                    </strong>
                                  </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDuplicateLayer(selectedElement.id)
                                }
                                className="flex-1 py-1 px-2 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-[10px] cursor-pointer"
                                title="Duplicate this numbering box for a matching Raffle Ticket Stub on the same card"
                              >
                                + Dup for Ticket Stub
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedElement({
                                    rotation:
                                      selectedElement.rotation === 270
                                        ? 0
                                        : 270,
                                  })
                                }
                                className="py-1 px-2 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold text-[10px] cursor-pointer"
                                title="Toggle Vertical 270° Stub Orientation vs Horizontal 0°"
                              >
                                {selectedElement.rotation === 270
                                  ? 'Horiz 0°'
                                  : 'Vert Stub 270°'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedElement.type === 'qr' && (
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          QR Code Destination URL
                        </label>
                        <input
                          type="text"
                          value={selectedElement.qrValue || ''}
                          onChange={(e) =>
                            updateSelectedElement({ qrValue: e.target.value })
                          }
                          className="w-full border border-slate-300 rounded-lg bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block">
                          X Pos (in)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          value={selectedElement.x}
                          onChange={(e) =>
                            updateSelectedElement({ x: Number(e.target.value) })
                          }
                          className="w-full border border-slate-300 rounded bg-white px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">
                          Y Pos (in)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          value={selectedElement.y}
                          onChange={(e) =>
                            updateSelectedElement({ y: Number(e.target.value) })
                          }
                          className="w-full border border-slate-300 rounded bg-white px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">
                          Width (in)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          value={selectedElement.width}
                          onChange={(e) =>
                            updateSelectedElement({
                              width: Number(e.target.value),
                            })
                          }
                          className="w-full border border-slate-300 rounded bg-white px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">
                          Height (in)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          value={selectedElement.height}
                          onChange={(e) =>
                            updateSelectedElement({
                              height: Number(e.target.value),
                            })
                          }
                          className="w-full border border-slate-300 rounded bg-white px-2 py-1"
                        />
                      </div>
                    </div>

                    {/* Rotation Angle Controls (0-360° slider + quick angle buttons) */}
                    <div className="pt-1 border-t border-red-200/70">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-semibold text-slate-600 flex items-center gap-1">
                          <RotateCw className="w-3 h-3 text-red-600" />
                          Rotation Angle
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={360}
                            value={selectedElement.rotation || 0}
                            onChange={(e) =>
                              updateSelectedElement({
                                rotation:
                                  ((Number(e.target.value) % 360) + 360) % 360,
                              })
                            }
                            className="w-14 border border-slate-300 rounded bg-white px-1.5 py-0.5 text-right font-semibold text-[11px]"
                          />
                          <span className="text-[10px] text-slate-500">°</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={selectedElement.rotation || 0}
                        onChange={(e) =>
                          updateSelectedElement({
                            rotation: Number(e.target.value),
                          })
                        }
                        className="w-full accent-[#cc0000] mb-1.5"
                      />
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { label: '-45°', delta: -45 },
                          { label: '0° Reset', abs: 0 },
                          { label: '+45°', delta: 45 },
                          { label: '+90°', delta: 90 },
                        ].map((btn) => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() =>
                              updateSelectedElement({
                                rotation:
                                  btn.abs !== undefined
                                    ? btn.abs
                                    : (((selectedElement.rotation || 0) +
                                        (btn.delta || 0)) %
                                        360 +
                                        360) %
                                      360,
                              })
                            }
                            className="py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-700 cursor-pointer"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 1-Click Rescue Button if an element was scaled huge or dragged past the edge */}
                    <button
                      type="button"
                      onClick={() => handleFitElementToUnit(selectedElement.id)}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Scale and center this item cleanly inside the card/page boundaries"
                    >
                      <Minimize2 className="w-3.5 h-3.5 text-amber-300" />
                      Fit & Center Inside Card Bounds
                    </button>
                  </div>
                )}

                {/* PRODUCT SECTION (Matches Photo 1 + Save Setup as Home Template) */}
                <div className="border-b border-slate-200 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Product &amp; Template Preset
                    </h4>
                    {onSaveCurrentAsTemplate && (
                      <button
                        type="button"
                        onClick={() => {
                          const imp = project.template.imposition;
                          setCustomTemplateNameInput(
                            imp
                              ? `${imp.cols * imp.rows}-Up (${imp.cols}×${imp.rows}) ${
                                  imp.marginLeftIn > 0
                                    ? `${imp.marginLeftIn}" Out`
                                    : 'Custom'
                                }`
                              : `${project.template.name} Custom Setup`
                          );
                          setShowSaveTemplateForm(true);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold cursor-pointer shadow-2xs"
                        title="Save current Properties setup (Multi-Up, margins, numbering, mail merge & layout) to the Home Page"
                      >
                        <BookmarkCheck className="w-3 h-3" />
                        Save as Template
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-700 font-medium">
                      {project.template.name}
                    </span>
                    <button
                      onClick={onOpenMultiTemplateModal}
                      className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                    >
                      Duplicate Across Sizes
                    </button>
                  </div>
                  <button
                    onClick={onOpenMultiTemplateModal}
                    className="text-[#cc0000] hover:underline text-xs font-medium cursor-pointer"
                  >
                    Choose or adapt to another template size...
                  </button>
                </div>

                {/* PAGE SIZE SECTION (Matches Photo 1: Width 8.5 in, Height 11 in, Custom) */}
                <div className="border-b border-slate-200 pb-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Page Size
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Width
                      </label>
                      <div className="flex items-center border border-slate-300 rounded bg-slate-50 px-2 py-1.5">
                        <input
                          type="number"
                          step="0.25"
                          value={project.template.sheetWidthIn}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 8.5;
                            onUpdateProject((p) => ({
                              ...p,
                              template: { ...p.template, sheetWidthIn: val },
                            }));
                          }}
                          className="w-full bg-transparent outline-none font-semibold"
                        />
                        <span className="text-slate-400 text-[11px]">in</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Height
                      </label>
                      <div className="flex items-center border border-slate-300 rounded bg-slate-50 px-2 py-1.5">
                        <input
                          type="number"
                          step="0.25"
                          value={project.template.sheetHeightIn}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 11;
                            onUpdateProject((p) => ({
                              ...p,
                              template: { ...p.template, sheetHeightIn: val },
                            }));
                          }}
                          className="w-full bg-transparent outline-none font-semibold"
                        />
                        <span className="text-slate-400 text-[11px]">in</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Switch Template Dropdown */}
                  <select
                    value={project.template.id}
                    onChange={(e) => {
                      const found = PRINT_TEMPLATES.find(
                        (t) => t.id === e.target.value
                      );
                      if (found) onSwitchTemplateWithAdaptation(found);
                    }}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium text-slate-700"
                  >
                    {PRINT_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subtitle})
                      </option>
                    ))}
                  </select>
                </div>

                {/* ORIENTATION SECTION (Matches Photo 1: Portrait | Landscape + Rotate Guides & Grid 90°) */}
                <div className="border-b border-slate-200 pb-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Orientation & Guide Rotation
                  </h4>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      onClick={() => handleSetOrientation('portrait')}
                      className={`py-2 rounded font-semibold border transition cursor-pointer ${
                        project.template.orientation === 'portrait'
                          ? 'bg-[#1e293b] text-white border-[#1e293b]'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      onClick={() => handleSetOrientation('landscape')}
                      className={`py-2 rounded font-semibold border transition cursor-pointer ${
                        project.template.orientation === 'landscape'
                          ? 'bg-[#1e293b] text-white border-[#1e293b]'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    <button
                      type="button"
                      onClick={() => handleRotateEntireLayout90('ccw')}
                      className="py-1.5 px-2 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                      title="Rotate Sheet, Guides & All Items 90° Counter-Clockwise"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Rotate Layout 90° CCW
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRotateEntireLayout90('cw')}
                      className="py-1.5 px-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                      title="Rotate Sheet, Guides & All Items 90° Clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Rotate Layout 90° CW
                    </button>
                  </div>
                  {project.template.imposition && (
                    <button
                      type="button"
                      onClick={handleRotateGuidesAndGrid}
                      className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                      title="Swap Margin X / Y and rotate Multi-Up Imposition Cut Grid & Slots 90° on the current sheet"
                    >
                      <RotateCw className="w-3 h-3" />
                      Rotate N-Up Cut Grid Only (Keep Sheet W×H)
                    </button>
                  )}
                </div>

                {/* BANK TABS & TAB NAMES (3-Tab / 5-Tab / Multi-Tab Divider Titles & Color Coding) */}
                <div className="border-b border-slate-200 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-red-600" />
                      Bank Tabs &amp; Tab Names
                    </h4>
                    <select
                      value={
                        project.bankTabConfig?.enabled === false
                          ? 0
                          : project.bankTabConfig?.count ||
                            project.template.bankTabs ||
                            0
                      }
                      onChange={(e) =>
                        handleSetBankTabCount(Number(e.target.value))
                      }
                      className="border border-slate-300 rounded bg-white px-2 py-0.5 text-[11px] font-bold text-slate-800 cursor-pointer"
                    >
                      <option value={0}>No Tabs (Off)</option>
                      <option value={3}>3 Bank Tabs</option>
                      <option value={4}>4 Bank Tabs</option>
                      <option value={5}>5 Bank Tabs</option>
                      <option value={6}>6 Bank Tabs</option>
                      <option value={8}>8 Bank Tabs</option>
                      <option value={10}>10 Bank Tabs</option>
                      <option value={12}>12 Bank Tabs</option>
                    </select>
                  </div>

                  {(() => {
                    const activeTabCount =
                      project.bankTabConfig?.enabled === false
                        ? 0
                        : project.bankTabConfig?.count ||
                          project.template.bankTabs ||
                          0;

                    if (activeTabCount === 0) {
                      return (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSetBankTabCount(3)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-red-50 border border-slate-300 text-[10px] font-bold text-slate-700 cursor-pointer"
                          >
                            + Enable 3 Bank Tabs
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetBankTabCount(5)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-red-50 border border-slate-300 text-[10px] font-bold text-slate-700 cursor-pointer"
                          >
                            + Enable 5 Bank Tabs
                          </button>
                        </div>
                      );
                    }

                    const tabCfg =
                      project.bankTabConfig ||
                      createDefaultBankTabConfig(activeTabCount);

                    return (
                      <div className="flex flex-col gap-2.5 bg-red-50/40 p-3 rounded-xl border border-red-200/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-700">
                            Type Name for Each Tab ({activeTabCount} Tabs):
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAutoColorCodeTabs(false)}
                              className="px-1.5 py-0.5 rounded bg-white hover:bg-amber-50 border border-slate-300 text-[9px] font-bold text-slate-700 cursor-pointer"
                              title="Assign color-coded pastel fills to each tab ear"
                            >
                              🎨 Color Tabs
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAutoColorCodeTabs(true)}
                              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[9px] font-semibold text-slate-600 cursor-pointer"
                              title="Reset all tab ears to white"
                            >
                              White
                            </button>
                          </div>
                        </div>

                        {/* Individual Tab Name Inputs + Color Swatches */}
                        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                          {Array.from({ length: activeTabCount }).map(
                            (_, tIdx) => {
                              const labelVal =
                                tabCfg.labels[tIdx] !== undefined
                                  ? tabCfg.labels[tIdx]
                                  : `Tab ${tIdx + 1}`;
                              const fillCol =
                                tabCfg.colors?.[tIdx] || '#ffffff';
                              const isFocusedOnCanvas =
                                editingCanvasTabIndex === tIdx;

                              return (
                                <div
                                  key={tIdx}
                                  className={`flex items-center gap-1.5 p-1 rounded-lg border transition ${
                                    isFocusedOnCanvas
                                      ? 'bg-red-50 border-red-400'
                                      : 'bg-white border-slate-200'
                                  }`}
                                >
                                  <span className="w-11 text-[10px] font-extrabold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-1 text-center shrink-0">
                                    Tab {tIdx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={labelVal}
                                    onFocus={() =>
                                      setEditingCanvasTabIndex(tIdx)
                                    }
                                    onBlur={() =>
                                      setEditingCanvasTabIndex(null)
                                    }
                                    onChange={(e) =>
                                      handleUpdateSingleTabLabel(
                                        tIdx,
                                        e.target.value
                                      )
                                    }
                                    placeholder={`Enter Tab ${tIdx + 1} name...`}
                                    className="flex-1 border border-slate-300 focus:border-red-600 rounded bg-slate-50 focus:bg-white px-2 py-1 text-[11px] font-semibold text-slate-900 outline-none"
                                  />
                                  <input
                                    type="color"
                                    value={fillCol}
                                    onChange={(e) =>
                                      handleUpdateSingleTabColor(
                                        tIdx,
                                        e.target.value
                                      )
                                    }
                                    title={`Tab ${tIdx + 1} Ear Fill Color`}
                                    className="w-6 h-6 rounded border border-slate-300 cursor-pointer shrink-0"
                                  />
                                </div>
                              );
                            }
                          )}
                        </div>

                        {/* Tab Font Size & Display / Collation Mode */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-red-200/60">
                          <div>
                            <label className="text-[10px] text-slate-600 font-semibold block mb-0.5">
                              Tab Font Size (pt)
                            </label>
                            <input
                              type="number"
                              min={6}
                              max={18}
                              step={0.5}
                              value={tabCfg.fontSizePt || 9.5}
                              onChange={(e) =>
                                handleUpdateBankTabConfig({
                                  fontSizePt: Math.max(
                                    6,
                                    Math.min(18, Number(e.target.value) || 9.5)
                                  ),
                                })
                              }
                              className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-semibold text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-600 font-semibold block mb-0.5">
                              Tab Ear Mode
                            </label>
                            <select
                              value={tabCfg.displayMode || 'all-tabs'}
                              onChange={(e) =>
                                handleUpdateBankTabConfig({
                                  displayMode: e.target.value as
                                    | 'all-tabs'
                                    | 'single-tab-per-page',
                                })
                              }
                              className="w-full border border-slate-300 rounded bg-white px-1.5 py-1 font-semibold text-[10px] text-slate-800"
                            >
                              <option value="all-tabs">
                                Show All {activeTabCount} Tabs
                              </option>
                              <option value="single-tab-per-page">
                                1 Active Tab / Page
                              </option>
                            </select>
                          </div>
                        </div>

                        {/* 1-Click Build Collated Divider Pages */}
                        <button
                          type="button"
                          onClick={handleBuildTabDividerPages}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-[#cc0000] hover:bg-red-700 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                          title="Generate 1 page per tab in the Left Pages Panel so Page 1 prints Tab 1, Page 2 prints Tab 2, etc."
                        >
                          <Layers className="w-3.5 h-3.5" />
                          Build 1 Page Per Tab ({activeTabCount}-Page Divider
                          Set)
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* MULTI-UP IMPOSITION, CENTER LINK & H/V SPACING SECTION */}
                <div className="border-b border-slate-200 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                      Multi-Up Centering & H/V Spacing
                    </h4>
                    {!project.template.imposition ? (
                      <button
                        onClick={() =>
                          handleUpdateImposition({
                            cols: 2,
                            rows: 2,
                            unitWidthIn: Number(
                              (project.template.sheetWidthIn / 2).toFixed(3)
                            ),
                            unitHeightIn: Number(
                              (project.template.sheetHeightIn / 2).toFixed(3)
                            ),
                            marginLeftIn: 0,
                            marginTopIn: 0,
                            gapXIn: 0,
                            gapYIn: 0,
                            autoCenterOnSheet: true,
                            linkSpacing: true,
                          })
                        }
                        className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded cursor-pointer"
                      >
                        + Enable 4-Up / N-Up
                      </button>
                    ) : (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                        {project.template.imposition.cols}×
                        {project.template.imposition.rows} (
                        {project.template.imposition.cols *
                          project.template.imposition.rows}
                        -Up)
                      </span>
                    )}
                  </div>

                  {project.template.imposition &&
                    (() => {
                      const imp = project.template.imposition!;
                      const isCenterLinked = imp.autoCenterOnSheet !== false;
                      const isSpacingLinked = imp.linkSpacing !== false;
                      const isInnerLinked = imp.linkInnerPadding !== false;
                      const isAutoFit = Boolean(imp.autoFitToMargins);

                      const totalGridW =
                        imp.cols * imp.unitWidthIn +
                        (imp.cols - 1) * imp.gapXIn;
                      const totalGridH =
                        imp.rows * imp.unitHeightIn +
                        (imp.rows - 1) * imp.gapYIn;
                      const rightWhiteIn = Number(
                        (
                          project.template.sheetWidthIn -
                          imp.marginLeftIn -
                          totalGridW
                        ).toFixed(3)
                      );
                      const bottomWhiteIn = Number(
                        (
                          project.template.sheetHeightIn -
                          imp.marginTopIn -
                          totalGridH
                        ).toFixed(3)
                      );

                      return (
                        <div className="flex flex-col gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                          {/* Quick Presets for 4-Up / N-Up Non-Bleed vs Full-Bleed */}
                          <div>
                            <span className="text-[10px] font-semibold text-slate-500 block mb-1">
                              Quick Multi-Up White Margin Presets (Center = 2× Outside):
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateImposition({
                                    autoFitToMargins: true,
                                    autoCenterOnSheet: true,
                                    linkSpacing: true,
                                    marginLeftIn: 0.25,
                                    innerPaddingXIn: 0,
                                    innerPaddingYIn: 0,
                                  })
                                }
                                className="text-[10px] bg-white hover:bg-red-50 border border-slate-300 rounded px-2 py-1.5 font-semibold text-slate-700 text-left cursor-pointer"
                              >
                                1/4&quot; Outside → 1/2&quot; Center (0.25&quot;/item)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateImposition({
                                    autoFitToMargins: true,
                                    autoCenterOnSheet: true,
                                    linkSpacing: true,
                                    marginLeftIn: 0.1875,
                                    innerPaddingXIn: 0,
                                    innerPaddingYIn: 0,
                                  })
                                }
                                className="text-[10px] bg-white hover:bg-red-50 border border-slate-300 rounded px-2 py-1.5 font-semibold text-slate-700 text-left cursor-pointer"
                              >
                                3/16&quot; Outside → 3/8&quot; Center (0.188&quot;/item)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateImposition({
                                    autoFitToMargins: true,
                                    autoCenterOnSheet: true,
                                    linkSpacing: true,
                                    marginLeftIn: 0.375,
                                    innerPaddingXIn: 0,
                                    innerPaddingYIn: 0,
                                  })
                                }
                                className="text-[10px] bg-white hover:bg-red-50 border border-slate-300 rounded px-2 py-1.5 font-semibold text-slate-700 text-left cursor-pointer"
                              >
                                3/8&quot; Outside → 3/4&quot; Center (0.375&quot;/item)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateImposition({
                                    autoFitToMargins: true,
                                    autoCenterOnSheet: true,
                                    linkSpacing: true,
                                    marginLeftIn: 0,
                                    marginTopIn: 0,
                                    gapXIn: 0,
                                    gapYIn: 0,
                                    innerPaddingXIn: 0,
                                    innerPaddingYIn: 0,
                                  })
                                }
                                className="text-[10px] bg-white hover:bg-red-50 border border-slate-300 rounded px-2 py-1.5 font-semibold text-slate-700 text-left cursor-pointer"
                              >
                                Full-Bleed Zero-White Reset (0&quot;)
                              </button>
                            </div>
                          </div>

                          {/* Columns & Rows */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-500 block">
                                Columns (Across)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={8}
                                value={imp.cols}
                                onChange={(e) =>
                                  handleUpdateImposition({
                                    cols: Math.max(1, Number(e.target.value)),
                                  })
                                }
                                className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-semibold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 block">
                                Rows (Down)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={imp.rows}
                                onChange={(e) =>
                                  handleUpdateImposition({
                                    rows: Math.max(1, Number(e.target.value)),
                                  })
                                }
                                className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-semibold"
                              />
                            </div>
                          </div>

                          {/* Horizontal & Vertical Center Spacing (Gutter) + Link Button */}
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-slate-800">
                                Center White Space (2× Outside when Linked)
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateImposition({
                                    linkSpacing: !isSpacingLinked,
                                  })
                                }
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                  isSpacingLinked
                                    ? 'bg-red-50 border-red-400 text-red-700'
                                    : 'bg-slate-100 border-slate-300 text-slate-600'
                                }`}
                                title="Link Horizontal and Vertical Spacing together"
                              >
                                {isSpacingLinked ? (
                                  <>
                                    <Link2 className="w-3 h-3" /> Linked
                                  </>
                                ) : (
                                  <>
                                    <Unlink2 className="w-3 h-3" /> Unlinked
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-500 block">
                                  Center H White (in)
                                </label>
                                <input
                                  type="number"
                                  step="0.0625"
                                  min={0}
                                  max={3}
                                  value={imp.gapXIn}
                                  onChange={(e) =>
                                    handleUpdateImposition({
                                      gapXIn: Math.max(0, Number(e.target.value)),
                                    })
                                  }
                                  className="w-full border border-slate-300 rounded bg-slate-50 px-2 py-1 font-semibold"
                                />
                                {imp.cols > 1 && imp.gapXIn > 0 && (
                                  <span className="text-[9px] text-emerald-700 font-semibold block mt-0.5">
                                    = {(imp.gapXIn / 2).toFixed(3)}&quot; L + {(imp.gapXIn / 2).toFixed(3)}&quot; R of cut
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block">
                                  Center V White (in)
                                </label>
                                <input
                                  type="number"
                                  step="0.0625"
                                  min={0}
                                  max={3}
                                  value={imp.gapYIn}
                                  onChange={(e) =>
                                    handleUpdateImposition({
                                      gapYIn: Math.max(0, Number(e.target.value)),
                                    })
                                  }
                                  className="w-full border border-slate-300 rounded bg-slate-50 px-2 py-1 font-semibold"
                                />
                                {imp.rows > 1 && imp.gapYIn > 0 && (
                                  <span className="text-[9px] text-emerald-700 font-semibold block mt-0.5">
                                    = {(imp.gapYIn / 2).toFixed(3)}&quot; T + {(imp.gapYIn / 2).toFixed(3)}&quot; B of cut
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Center Link & Outer White Space (Left/Right & Top/Bottom) */}
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col gap-2">
                            <label className="flex items-center gap-2 font-bold text-[11px] text-slate-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isCenterLinked}
                                onChange={(e) =>
                                  handleUpdateImposition({
                                    autoCenterOnSheet: e.target.checked,
                                  })
                                }
                                className="rounded text-red-600"
                              />
                              <span>
                                Center Link (Center White = 2× Outside Margin)
                              </span>
                            </label>

                            <label className="flex items-center gap-2 font-medium text-[11px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isAutoFit}
                                onChange={(e) =>
                                  handleUpdateImposition({
                                    autoFitToMargins: e.target.checked,
                                  })
                                }
                                className="rounded text-red-600"
                              />
                              <span>
                                Auto-Fit Item Printable Area to Sheet & Margins
                              </span>
                            </label>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="text-[10px] text-slate-500 block">
                                  {isCenterLinked
                                    ? 'Outside L & R Margin (in)'
                                    : 'Outside Left Margin (in)'}
                                </label>
                                <input
                                  type="number"
                                  step="0.0625"
                                  min={0}
                                  max={4}
                                  value={imp.marginLeftIn}
                                  onChange={(e) =>
                                    handleUpdateImposition({
                                      marginLeftIn: Math.max(
                                        0,
                                        Number(e.target.value)
                                      ),
                                    })
                                  }
                                  className="w-full border border-slate-300 rounded bg-slate-50 px-2 py-1 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block">
                                  {isCenterLinked
                                    ? 'Outside T & B Margin (in)'
                                    : 'Outside Top Margin (in)'}
                                </label>
                                <input
                                  type="number"
                                  step="0.0625"
                                  min={0}
                                  max={4}
                                  value={imp.marginTopIn}
                                  onChange={(e) =>
                                    handleUpdateImposition({
                                      marginTopIn: Math.max(
                                        0,
                                        Number(e.target.value)
                                      ),
                                    })
                                  }
                                  className="w-full border border-slate-300 rounded bg-slate-50 px-2 py-1 font-semibold"
                                />
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-700 bg-emerald-50/80 px-2.5 py-1.5 rounded border border-emerald-200 flex flex-col gap-1">
                              <div className="flex justify-between">
                                <span>
                                  Outside L/R: <strong>{imp.marginLeftIn}&quot;</strong> /{' '}
                                  <strong>{rightWhiteIn}&quot;</strong>
                                </span>
                                <span>
                                  Center H: <strong>{imp.gapXIn}&quot;</strong>
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>
                                  Outside T/B: <strong>{imp.marginTopIn}&quot;</strong> /{' '}
                                  <strong>{bottomWhiteIn}&quot;</strong>
                                </span>
                                <span>
                                  Center V: <strong>{imp.gapYIn}&quot;</strong>
                                </span>
                              </div>
                              <div className="text-[9px] text-emerald-800 border-t border-emerald-200/70 pt-1 font-medium">
                                Printable Item Box: <strong>{imp.unitWidthIn}&quot; × {imp.unitHeightIn}&quot;</strong>{' '}
                                (Cut Piece: <strong>{(project.template.sheetWidthIn / imp.cols).toFixed(2)}&quot; × {(project.template.sheetHeightIn / imp.rows).toFixed(2)}&quot;</strong>)
                              </div>
                            </div>
                          </div>

                          {/* Non-Bleed Inner Slot White Border (Padding inside each cut slot) */}
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-slate-800">
                                Non-Bleed Inner Slot White Border
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateImposition({
                                    linkInnerPadding: !isInnerLinked,
                                  })
                                }
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                  isInnerLinked
                                    ? 'bg-sky-50 border-sky-400 text-sky-700'
                                    : 'bg-slate-100 border-slate-300 text-slate-600'
                                }`}
                              >
                                {isInnerLinked ? (
                                  <>
                                    <Link2 className="w-3 h-3" /> Linked
                                  </>
                                ) : (
                                  <>
                                    <Unlink2 className="w-3 h-3" /> Unlinked
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-500 block">
                                  Inner L/R White (in)
                                </label>
                                <input
                                  type="number"
                                  step="0.05"
                                  min={0}
                                  max={1.5}
                                  value={imp.innerPaddingXIn || 0}
                                  onChange={(e) =>
                                    handleUpdateImposition({
                                      innerPaddingXIn: Math.max(
                                        0,
                                        Number(e.target.value)
                                      ),
                                    })
                                  }
                                  className="w-full border border-slate-300 rounded bg-slate-50 px-2 py-1 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block">
                                  Inner T/B White (in)
                                </label>
                                <input
                                  type="number"
                                  step="0.05"
                                  min={0}
                                  max={1.5}
                                  value={imp.innerPaddingYIn || 0}
                                  onChange={(e) =>
                                    handleUpdateImposition({
                                      innerPaddingYIn: Math.max(
                                        0,
                                        Number(e.target.value)
                                      ),
                                    })
                                  }
                                  className="w-full border border-slate-300 rounded bg-slate-50 px-2 py-1 font-semibold"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                </div>

                {/* SEQUENTIAL PRINT NUMBERING (Tickets / Invoices / Receipt Books / Multi-Up Crash Numbering) */}
                <div className="border-b border-slate-200 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-red-600" />
                      Sequential Print Numbering
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleAddNumberingElement()}
                      className="text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded cursor-pointer"
                    >
                      + Add Numbering
                    </button>
                  </div>

                  {(() => {
                    const numCfg: NumberingConfig = project.numbering || {
                      enabled: true,
                      startNumber: 1,
                      step: 1,
                      padDigits: 4,
                      prefix: 'No. ',
                      suffix: '',
                      orderMode: 'across-then-down',
                      totalSheets: Math.max(
                        1,
                        project.pages.filter((p) => p.side === 'front').length
                      ),
                    };
                    const slotsPerSheet = project.template.imposition
                      ? Math.max(
                          1,
                          project.template.imposition.cols *
                            project.template.imposition.rows
                        )
                      : 1;
                    const frontPageCount = Math.max(
                      1,
                      project.pages.filter((p) => p.side === 'front').length
                    );
                    const effectiveSheets = Math.max(
                      numCfg.totalSheets || 1,
                      frontPageCount
                    );
                    const totalNumberedItems =
                      numCfg.orderMode === 'same-per-sheet'
                        ? effectiveSheets
                        : effectiveSheets * slotsPerSheet;

                    const firstSample = formatSequentialNumber(project, 0, 0);
                    const lastSheetIdx = Math.max(0, effectiveSheets - 1);
                    const lastSlotIdx = Math.max(0, slotsPerSheet - 1);
                    const lastSample = formatSequentialNumber(
                      project,
                      lastSheetIdx,
                      lastSlotIdx
                    );

                    const numberingLayerCount = activeMaster.elements.filter(
                      (e) =>
                        e.isSequentialNumber ||
                        e.text?.includes('{{NUM}}') ||
                        e.text?.includes('{{NUMBER}}')
                    ).length;

                    return (
                      <div className="flex flex-col gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {/* Quick Add Buttons (Single Number vs Dual Stub + Ticket) */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddNumberingElement()}
                            className="text-[10px] bg-white hover:bg-red-50 border border-slate-300 rounded px-2 py-1.5 font-semibold text-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Hash className="w-3 h-3 text-red-600" />+ Single
                            Number Box
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAddNumberingElement({
                                asTicketStubPair: true,
                                verticalStub: true,
                              })
                            }
                            className="text-[10px] bg-white hover:bg-red-50 border border-slate-300 rounded px-2 py-1.5 font-semibold text-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                            title="Adds 2 synchronized numbering boxes on each card (Stub + Main Ticket)"
                          >
                            <Hash className="w-3 h-3 text-red-600" />+ Stub &amp;
                            Ticket Pair
                          </button>
                        </div>

                        {/* Start Number, Step, Zero-Pad Digits */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 block">
                              Start #
                            </label>
                            <input
                              type="number"
                              value={numCfg.startNumber}
                              onChange={(e) =>
                                handleUpdateNumbering({
                                  startNumber: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-semibold font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block">
                              Step (+/-)
                            </label>
                            <input
                              type="number"
                              value={numCfg.step}
                              onChange={(e) =>
                                handleUpdateNumbering({
                                  step: Number(e.target.value) || 1,
                                })
                              }
                              className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-semibold font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block">
                              Digits (Pad)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={numCfg.padDigits}
                              onChange={(e) =>
                                handleUpdateNumbering({
                                  padDigits: Math.max(
                                    0,
                                    Math.min(10, Number(e.target.value) || 0)
                                  ),
                                })
                              }
                              className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-semibold font-mono"
                            />
                          </div>
                        </div>

                        {/* Prefix & Suffix + Quick Prefix Presets */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 block">
                              Prefix (e.g. No. / #)
                            </label>
                            <input
                              type="text"
                              value={numCfg.prefix}
                              onChange={(e) =>
                                handleUpdateNumbering({
                                  prefix: e.target.value,
                                })
                              }
                              placeholder="No. "
                              className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block">
                              Suffix (Optional)
                            </label>
                            <input
                              type="text"
                              value={numCfg.suffix}
                              onChange={(e) =>
                                handleUpdateNumbering({
                                  suffix: e.target.value,
                                })
                              }
                              placeholder=""
                              className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          {[
                            { label: 'No. 0001', prefix: 'No. ', pad: 4 },
                            { label: '#0001', prefix: '#', pad: 4 },
                            { label: '00001', prefix: '', pad: 5 },
                            { label: 'INV-1001', prefix: 'INV-', pad: 4, start: 1001 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                handleUpdateNumbering({
                                  prefix: preset.prefix,
                                  padDigits: preset.pad,
                                  ...(preset.start !== undefined
                                    ? { startNumber: preset.start }
                                    : {}),
                                })
                              }
                              className="px-2 py-0.5 rounded bg-white hover:bg-red-50 border border-slate-300 text-[9px] font-mono font-bold text-slate-700 cursor-pointer"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {/* Numbering Order Mode (Across Sheet vs Cut & Stack vs NCR Same-Per-Sheet) */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                            Multi-Up &amp; Multi-Sheet Sequence Order
                          </label>
                          <select
                            value={numCfg.orderMode}
                            onChange={(e) =>
                              handleUpdateNumbering({
                                orderMode: e.target.value as NumberingOrderMode,
                              })
                            }
                            className="w-full border border-slate-300 rounded bg-white px-2 py-1.5 text-[11px] font-medium text-slate-800"
                          >
                            <option value="across-then-down">
                              Sequential Across Sheet (Sheet 1: 1..
                              {slotsPerSheet}, Sheet 2: {slotsPerSheet + 1}..
                              {slotsPerSheet * 2})
                            </option>
                            <option value="cut-and-stack">
                              Cut &amp; Stack (Guillotine Stack Order — Pile 1
                              is 1..N)
                            </option>
                            <option value="same-per-sheet">
                              Same Number per Sheet (NCR / Duplicate Copy Slots)
                            </option>
                          </select>
                        </div>

                        {/* Total Sheets / Batch Run Calculator */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-700">
                              Total Numbered Sheets in Run
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={500}
                                value={numCfg.totalSheets || 1}
                                onChange={(e) =>
                                  handleUpdateNumbering({
                                    totalSheets: Math.max(
                                      1,
                                      Number(e.target.value) || 1
                                    ),
                                  })
                                }
                                className="w-16 border border-slate-300 rounded bg-slate-50 px-2 py-0.5 text-center font-bold"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handlePopulateNumberedSheets(
                                    numCfg.totalSheets || 1
                                  )
                                }
                                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-[10px] cursor-pointer"
                                title="Create all numbered sheets in the Left Pages Panel so you can preview each sheet"
                              >
                                Build Pages
                              </button>
                            </div>
                          </div>

                          <div className="text-[10px] bg-red-50/70 border border-red-200/80 rounded px-2 py-1.5 text-slate-700 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between">
                              <span>
                                Run Total:{' '}
                                <strong>
                                  {effectiveSheets} sheet
                                  {effectiveSheets > 1 ? 's' : ''} ×{' '}
                                  {slotsPerSheet}-Up = {totalNumberedItems}{' '}
                                  items
                                </strong>
                              </span>
                            </div>
                            <div className="font-mono text-[10px] text-red-700 font-bold">
                              Range: {firstSample} → {lastSample}
                            </div>
                            <div className="text-[9px] text-slate-500">
                              {numberingLayerCount > 0
                                ? `${numberingLayerCount} active numbering box${
                                    numberingLayerCount > 1 ? 'es' : ''
                                  } on this Master`
                                : 'Click "+ Single Number Box" above to place a number on the design'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* VARIABLE DATA LISTS & MAIL MERGE (Manage Contact/Variable Lists, Upload CSV as List, Create New List from Scratch & Insert {{Variables}}) */}
                <div className="border-b border-slate-200 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" />
                      Variable Data &amp; Lists
                    </h4>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(project.mailMerge?.enabled)}
                        onChange={(e) =>
                          handleUpdateMailMerge({ enabled: e.target.checked })
                        }
                        className="accent-indigo-600"
                      />
                      <span>Enable Variables</span>
                    </label>
                  </div>

                  {(() => {
                    const mm: MailMergeConfig =
                      project.mailMerge || DEFAULT_SAMPLE_MAIL_MERGE;
                    const slotsPerSheet = project.template.imposition
                      ? Math.max(
                          1,
                          project.template.imposition.cols *
                            project.template.imposition.rows
                        )
                      : 1;
                    const sheetsNeeded = Math.max(
                      1,
                      Math.ceil(mm.records.length / slotsPerSheet)
                    );
                    const previewIdx = Math.max(
                      0,
                      Math.min(
                        Math.max(0, mm.records.length - 1),
                        mm.previewRecordIndex || 0
                      )
                    );
                    const activePreviewRecord = mm.records[previewIdx];
                    const firstFieldVal = activePreviewRecord
                      ? activePreviewRecord[mm.fields[0]] || ''
                      : '';

                    return (
                      <div className="flex flex-col gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {/* Hidden CSV file input */}
                        <input
                          ref={csvUploadRef}
                          type="file"
                          accept=".csv,.tsv,.txt"
                          onChange={handleCsvFileUpload}
                          className="hidden"
                        />

                        {/* Active Saved List Selector + Open Full List Manager Button */}
                        <div className="bg-white p-2 rounded-lg border border-indigo-200 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800">
                              Active Contact / Variable List
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowListManagerModal(true)}
                              className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Open full Spreadsheet & List Manager to create lists, edit columns/rows, and manage CSV files"
                            >
                              <Layers className="w-3 h-3" />
                              Manage Lists
                            </button>
                          </div>

                          <select
                            value={
                              mm.activeListId ||
                              savedVariableLists[0]?.id ||
                              'list-vip-contacts'
                            }
                            onChange={(e) =>
                              handleSelectVariableList(e.target.value)
                            }
                            className="w-full border border-slate-300 rounded bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-800 cursor-pointer"
                          >
                            {savedVariableLists.map((lst) => (
                              <option key={lst.id} value={lst.id}>
                                {lst.name} ({lst.records.length} rows •{' '}
                                {lst.fields.length} vars)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Upload CSV as List / + New List from Scratch / Paste List / Export CSV */}
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => csvUploadRef.current?.click()}
                            className="py-1.5 px-1.5 rounded bg-white hover:bg-indigo-50 border border-slate-300 text-[10px] font-semibold text-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                            title="Upload a .CSV or .TSV file and import it as a new Saved List"
                          >
                            <Upload className="w-3 h-3 text-indigo-600" />
                            Upload CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateListForm((prev) => !prev);
                              setShowPasteCsvModal(false);
                            }}
                            className="py-1.5 px-1.5 rounded bg-white hover:bg-indigo-50 border border-slate-300 text-[10px] font-bold text-indigo-700 flex items-center justify-center gap-1 cursor-pointer"
                            title="Create a brand-new Contact or Variable List from scratch"
                          >
                            <Plus className="w-3 h-3 text-indigo-600" />
                            New List
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPasteCsvModal((prev) => !prev);
                              setShowCreateListForm(false);
                            }}
                            className="py-1.5 px-1.5 rounded bg-white hover:bg-indigo-50 border border-slate-300 text-[10px] font-semibold text-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                            title="Paste rows copied from Excel, Google Sheets, or CSV as a new Saved List"
                          >
                            <Clipboard className="w-3 h-3 text-indigo-600" />
                            Paste List
                          </button>
                        </div>

                        {/* Inline Create New List From Scratch Form */}
                        {showCreateListForm && (
                          <form
                            onSubmit={handleCreateVariableListFromScratch}
                            className="bg-white p-2.5 rounded-lg border-2 border-indigo-400 flex flex-col gap-2 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-indigo-800 uppercase">
                                + Create New List from Scratch
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowCreateListForm(false)}
                                className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">
                                List Name
                              </label>
                              <input
                                type="text"
                                autoFocus
                                value={newListNameInput}
                                onChange={(e) =>
                                  setNewListNameInput(e.target.value)
                                }
                                placeholder="e.g. Summer Yard Signs, Store Tags, VIP Contacts..."
                                className="w-full border border-slate-300 rounded px-2 py-1 text-[11px] font-semibold"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[10px] font-semibold text-slate-600">
                                  Variable Columns (comma-separated)
                                </label>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap mb-1">
                                {[
                                  {
                                    label: 'Blank Custom',
                                    cols: 'Field1, Field2, Field3',
                                    cat: 'custom' as VariableListCategory,
                                  },
                                  {
                                    label: 'Contacts',
                                    cols: 'Name, Company, Address, CityStateZip, Phone',
                                    cat: 'contacts' as VariableListCategory,
                                  },
                                  {
                                    label: 'Badges',
                                    cols: 'FullName, Role, Department, BadgeID',
                                    cat: 'badges' as VariableListCategory,
                                  },
                                  {
                                    label: 'Price Tags',
                                    cols: 'ItemName, SKU, Price, SalePrice, Notes',
                                    cat: 'products' as VariableListCategory,
                                  },
                                ].map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => {
                                      setNewListColumnsInput(preset.cols);
                                      setNewListCategoryInput(preset.cat);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[9px] font-bold cursor-pointer"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                              <input
                                type="text"
                                value={newListColumnsInput}
                                onChange={(e) =>
                                  setNewListColumnsInput(e.target.value)
                                }
                                placeholder="Title, Subtitle, Price, Phone..."
                                className="w-full border border-slate-300 rounded px-2 py-1 text-[10px] font-mono bg-slate-50"
                              />
                            </div>
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setShowCreateListForm(false)}
                                className="px-2 py-1 rounded border border-slate-300 text-[10px] font-semibold text-slate-600 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Create &amp; Open List
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Inline Paste from Excel / CSV Box */}
                        {showPasteCsvModal && (
                          <div className="bg-white p-2.5 rounded-lg border border-indigo-200 flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-indigo-800">
                              Import Pasted CSV / Excel Rows as a Saved List:
                            </span>
                            <input
                              type="text"
                              value={pasteListNameInput}
                              onChange={(e) =>
                                setPasteListNameInput(e.target.value)
                              }
                              placeholder="List Name (e.g. Q4 Client Roster)..."
                              className="w-full border border-slate-300 rounded px-2 py-1 text-[11px] font-semibold"
                            />
                            <textarea
                              rows={4}
                              value={pasteCsvText}
                              onChange={(e) => setPasteCsvText(e.target.value)}
                              placeholder={
                                'Name, Company, Address, CityStateZip\nJordan Vance, Apex LLC, 742 Evergreen Ter, Columbus OH 43215'
                              }
                              className="w-full border border-slate-300 rounded p-1.5 text-[10px] font-mono bg-slate-50"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setShowPasteCsvModal(false)}
                                className="px-2 py-1 rounded border border-slate-300 text-[10px] font-semibold text-slate-600 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleImportCsvAsNewSavedList(
                                    pasteCsvText,
                                    pasteListNameInput ||
                                      `Pasted List ${
                                        savedVariableLists.length + 1
                                      }`
                                  );
                                  setShowPasteCsvModal(false);
                                  setPasteCsvText('');
                                  setPasteListNameInput('');
                                }}
                                className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Save as List &amp; Activate
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Live Record Preview Stepper (`◀ Record 1 of N ▶`) */}
                        {mm.records.length > 0 && (
                          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 block">
                                Canvas Preview Row ({previewIdx + 1} of{' '}
                                {mm.records.length})
                              </span>
                              <span className="text-[10px] font-bold text-slate-800 truncate block">
                                {firstFieldVal || `Record #${previewIdx + 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateMailMerge({
                                    previewRecordIndex:
                                      (previewIdx - 1 + mm.records.length) %
                                      mm.records.length,
                                  })
                                }
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold text-[10px] cursor-pointer"
                                title="Preview Previous Row on Canvas"
                              >
                                ◀
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateMailMerge({
                                    previewRecordIndex:
                                      (previewIdx + 1) % mm.records.length,
                                  })
                                }
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold text-[10px] cursor-pointer"
                                title="Preview Next Row on Canvas"
                              >
                                ▶
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Insert Variable Field Pills (`+ {{Name}}`, `+ {{Price}}`, etc.) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-slate-600">
                              Click to Insert Variable into Design:
                            </span>
                            <button
                              type="button"
                              onClick={handleInsertMailingAddressBlock}
                              className="text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-0.5 rounded cursor-pointer"
                              title="Insert a multi-line block containing the top fields from this list"
                            >
                              + Multi-Field Block
                            </button>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {mm.fields.map((field) => (
                              <button
                                key={field}
                                type="button"
                                onClick={() => handleInsertMergeField(field)}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-[10px] cursor-pointer"
                                title={`Insert {{${field}}} into selected text box or as a new variable layer`}
                              >
                                + {`{{${field}}}`}
                              </button>
                            ))}
                          </div>

                          {/* Add custom variable column */}
                          <div className="flex items-center gap-1 mt-1.5">
                            <input
                              type="text"
                              value={newMergeFieldName}
                              onChange={(e) =>
                                setNewMergeFieldName(e.target.value)
                              }
                              placeholder="Add variable column (e.g. Price, SKU, Phone)..."
                              className="flex-1 border border-slate-300 rounded bg-white px-2 py-0.5 text-[10px]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const clean = newMergeFieldName
                                  .trim()
                                  .replace(/[^a-zA-Z0-9_ -]/g, '');
                                if (!clean || mm.fields.includes(clean)) return;
                                handleUpdateMailMerge({
                                  enabled: true,
                                  fields: [...mm.fields, clean],
                                  records: mm.records.map((r, idx) => ({
                                    ...r,
                                    [clean]: `${clean} ${idx + 1}`,
                                  })),
                                });
                                setNewMergeFieldName('');
                              }}
                              className="px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-semibold cursor-pointer"
                            >
                              + Column
                            </button>
                          </div>
                        </div>

                        {/* Interactive Records Table + Open Spreadsheet Modal Button */}
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <div className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-700">
                              Rows ({mm.records.length} items → {sheetsNeeded}{' '}
                              sheet{sheetsNeeded > 1 ? 's' : ''})
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const newRow: Record<string, string> = {};
                                  mm.fields.forEach((f) => {
                                    newRow[f] = `${f} ${mm.records.length + 1}`;
                                  });
                                  handleUpdateMailMerge({
                                    enabled: true,
                                    records: [...mm.records, newRow],
                                  });
                                }}
                                className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-[9px] cursor-pointer"
                              >
                                + Add Row
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handlePopulateNumberedSheets(sheetsNeeded)
                                }
                                className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-[9px] cursor-pointer"
                                title="Create all sheets needed for these rows in the Left Pages Panel"
                              >
                                Build {sheetsNeeded} Sheet
                                {sheetsNeeded > 1 ? 's' : ''}
                              </button>
                            </div>
                          </div>

                          <div className="max-h-36 overflow-auto divide-y divide-slate-100">
                            {mm.records.map((rec, rIdx) => (
                              <div
                                key={rIdx}
                                className={`p-1.5 flex items-center gap-1 text-[10px] hover:bg-slate-50 ${
                                  rIdx === previewIdx ? 'bg-indigo-50/40' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateMailMerge({
                                      previewRecordIndex: rIdx,
                                    })
                                  }
                                  className={`w-5 text-[9px] font-bold shrink-0 cursor-pointer ${
                                    rIdx === previewIdx
                                      ? 'text-indigo-700 underline'
                                      : 'text-slate-400 hover:text-indigo-600'
                                  }`}
                                  title="Click to preview this row on the canvas"
                                >
                                  #{rIdx + 1}
                                </button>
                                <div className="flex-1 grid grid-cols-2 gap-1">
                                  {mm.fields.slice(0, 4).map((f) => (
                                    <input
                                      key={f}
                                      type="text"
                                      value={rec[f] || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const nextRecs = mm.records.map(
                                          (item, idx) =>
                                            idx === rIdx
                                              ? { ...item, [f]: val }
                                              : item
                                        );
                                        handleUpdateMailMerge({
                                          enabled: true,
                                          records: nextRecs,
                                        });
                                      }}
                                      placeholder={f}
                                      title={f}
                                      className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] bg-white truncate"
                                    />
                                  ))}
                                </div>
                                {mm.records.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateMailMerge({
                                        records: mm.records.filter(
                                          (_, idx) => idx !== rIdx
                                        ),
                                      })
                                    }
                                    className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                                    title="Remove Row"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="px-2.5 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setShowListManagerModal(true)}
                              className="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer"
                            >
                              Open Full Table Editor ({mm.fields.length}{' '}
                              columns) →
                            </button>
                            <button
                              type="button"
                              onClick={handleExportActiveListToCsv}
                              className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-0.5 cursor-pointer"
                              title="Download this list as a .CSV file"
                            >
                              <Download className="w-3 h-3" /> .CSV
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* MASTER PAGE APPLIED (Matches Photo 1) */}
                <div className="border-b border-slate-200 pb-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Master Page Applied
                  </h4>
                  <select
                    value={currentPage.masterId}
                    onChange={(e) => {
                      const val = e.target.value as 'master-a' | 'master-b';
                      onUpdateProject((prev) => ({
                        ...prev,
                        pages: prev.pages.map((pg, idx) =>
                          idx === activePageIndex ? { ...pg, masterId: val } : pg
                        ),
                      }));
                    }}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium text-slate-700 mb-2"
                  >
                    <option value="master-a">Master A (Front Design)</option>
                    <option value="master-b">Master B (Back Design)</option>
                  </select>

                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentPage.ignoreMaster}
                      onChange={(e) =>
                        onUpdateProject((prev) => ({
                          ...prev,
                          pages: prev.pages.map((pg, idx) =>
                            idx === activePageIndex
                              ? { ...pg, ignoreMaster: e.target.checked }
                              : pg
                          ),
                        }))
                      }
                      className="rounded text-red-600"
                    />
                    <span>Ignore master on this page</span>
                  </label>
                </div>

                {/* BLEED & MARGINS (Matches Photo 1) */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Bleed & Margins
                  </h4>
                  <div className="mb-3">
                    <label className="text-[11px] text-slate-500 block mb-1">
                      Bleed (in)
                    </label>
                    <input
                      type="number"
                      step="0.0625"
                      min={0}
                      max={0.5}
                      value={project.bleedIn}
                      onChange={(e) =>
                        onUpdateProject((p) => ({
                          ...p,
                          bleedIn: Number(e.target.value),
                        }))
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Margin X (in)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={project.marginXIn}
                        onChange={(e) =>
                          onUpdateProject((p) => ({
                            ...p,
                            marginXIn: Number(e.target.value),
                          }))
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1 bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Margin Y (in)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={project.marginYIn}
                        onChange={(e) =>
                          onUpdateProject((p) => ({
                            ...p,
                            marginYIn: Number(e.target.value),
                          }))
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1 bg-slate-50"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={project.showCropMarks}
                      onChange={(e) =>
                        onUpdateProject((p) => ({
                          ...p,
                          showCropMarks: e.target.checked,
                        }))
                      }
                      className="rounded text-red-600"
                    />
                    <span>Include Crop / Trim Marks on PDF</span>
                  </label>
                </div>

                {/* SAVE CURRENT PROPERTIES SETUP AS A REUSABLE HOME PAGE TEMPLATE */}
                {onSaveCurrentAsTemplate && (
                  <div className="pt-3 border-t border-slate-200">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-3.5 shadow-sm flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-300 uppercase tracking-wider">
                          <BookmarkCheck className="w-4 h-4 text-amber-300" />
                          Save Setup as Home Template
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        Save your current Sheet Size, Orientation, Multi-Up
                        Spacing ({project.template.imposition ? `${project.template.imposition.cols}×${project.template.imposition.rows}` : '1-Up'}),
                        Margins, Numbering &amp; Mail Merge setup so you can
                        launch it anytime from the Home Page!
                      </p>

                      {savedTemplateNotice && (
                        <div className="bg-emerald-900/90 border border-emerald-400/50 text-emerald-100 rounded-lg px-2.5 py-2 text-[10px] flex items-center justify-between gap-2">
                          <span className="font-semibold">
                            ✓ {savedTemplateNotice}
                          </span>
                          <button
                            type="button"
                            onClick={onBackToDashboard}
                            className="bg-white text-emerald-950 font-bold px-2 py-0.5 rounded text-[9px] shrink-0 cursor-pointer"
                          >
                            View on Home →
                          </button>
                        </div>
                      )}

                      {!showSaveTemplateForm ? (
                        <button
                          type="button"
                          onClick={() => {
                            const imp = project.template.imposition;
                            setCustomTemplateNameInput(
                              imp
                                ? `${imp.cols * imp.rows}-Up (${imp.cols}×${imp.rows}) ${
                                    imp.marginLeftIn > 0
                                      ? `${imp.marginLeftIn}" Out`
                                      : 'Custom'
                                  }`
                                : `${project.template.name} Custom Setup`
                            );
                            setShowSaveTemplateForm(true);
                          }}
                          className="w-full py-2 px-3 rounded-lg bg-[#cc0000] hover:bg-red-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          Save Setup as Template
                        </button>
                      ) : (
                        <form
                          onSubmit={handleSaveCurrentSetupAsTemplate}
                          className="flex flex-col gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-white/15"
                        >
                          <div>
                            <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                              Template Name (Shown on Home Page)
                            </label>
                            <input
                              type="text"
                              value={customTemplateNameInput}
                              onChange={(e) =>
                                setCustomTemplateNameInput(e.target.value)
                              }
                              placeholder="e.g. 4-Up 1/4 in Non-Bleed Postcard"
                              className="w-full rounded bg-white text-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                              autoFocus
                            />
                          </div>

                          <label className="flex items-center gap-2 text-[10px] text-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={saveTemplateIncludeDesign}
                              onChange={(e) =>
                                setSaveTemplateIncludeDesign(e.target.checked)
                              }
                              className="rounded accent-amber-400"
                            />
                            <span>
                              Also save current canvas layers &amp; layout
                            </span>
                          </label>

                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowSaveTemplateForm(false)}
                              className="px-2.5 py-1 rounded border border-white/25 text-slate-300 hover:text-white text-[10px] font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[10px] cursor-pointer"
                            >
                              Save to Home Page
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {rightTab === 'layers' && (
              <div className="flex flex-col gap-2.5 select-none">
                {/* PHOTOSHOP-STYLE TOP INTERACTION BAR: Blend Mode + Opacity % */}
                <div className="bg-slate-900 text-white rounded-xl p-2.5 flex flex-col gap-2 shadow-xs border border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    {/* Blend Mode Dropdown (Normal, Multiply, Screen, Overlay, etc.) */}
                    <div className="flex-1">
                      <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                        Blend Mode
                      </label>
                      <select
                        disabled={!selectedElement}
                        value={selectedElement?.blendMode || 'normal'}
                        onChange={(e) =>
                          updateSelectedElement({
                            blendMode: e.target.value as LayerBlendMode,
                          })
                        }
                        className="w-full bg-slate-800 border border-slate-700 hover:border-slate-500 disabled:opacity-45 text-white rounded px-2 py-1 text-[11px] font-semibold outline-none cursor-pointer"
                      >
                        {LAYER_BLEND_MODES.map((bm) => (
                          <option key={bm.value} value={bm.value}>
                            {bm.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Opacity 0-100% Control */}
                    <div className="w-24">
                      <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                        Opacity
                      </label>
                      <div className="flex items-center bg-slate-800 border border-slate-700 rounded px-1.5 py-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          disabled={!selectedElement}
                          value={Math.round(
                            (selectedElement?.opacity ?? 1) * 100
                          )}
                          onChange={(e) => {
                            const pct = Math.max(
                              0,
                              Math.min(100, Number(e.target.value) || 0)
                            );
                            updateSelectedElement({
                              opacity: Number((pct / 100).toFixed(2)),
                            });
                          }}
                          className="w-full bg-transparent text-white font-bold text-[11px] text-right outline-none disabled:opacity-45"
                        />
                        <span className="text-[10px] text-slate-400 ml-0.5">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Opacity Scrub Slider */}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    disabled={!selectedElement}
                    value={Math.round((selectedElement?.opacity ?? 1) * 100)}
                    onChange={(e) =>
                      updateSelectedElement({
                        opacity: Number(
                          (Number(e.target.value) / 100).toFixed(2)
                        ),
                      })
                    }
                    className="w-full accent-[#cc0000] h-1.5 cursor-pointer disabled:opacity-40"
                  />

                  {/* Photoshop Lock & Layer Action Row (Lock, fx Styles, Front/Back, Duplicate, Delete) */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!selectedElement}
                        onClick={() =>
                          selectedElement &&
                          updateSelectedElement({
                            locked: !selectedElement.locked,
                          })
                        }
                        className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border transition cursor-pointer disabled:opacity-40 ${
                          selectedElement?.locked
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="Lock / Unlock Selected Layer"
                      >
                        {selectedElement?.locked ? (
                          <Lock className="w-3 h-3" />
                        ) : (
                          <Unlock className="w-3 h-3" />
                        )}
                        Lock
                      </button>

                      <button
                        type="button"
                        disabled={!selectedElement}
                        onClick={() => setShowLayerFxPanel((v) => !v)}
                        className={`px-2 py-1 rounded text-[10px] font-serif italic font-black flex items-center gap-1 border transition cursor-pointer disabled:opacity-40 ${
                          showLayerFxPanel ||
                          selectedElement?.effects?.dropShadow ||
                          selectedElement?.effects?.outerGlow ||
                          selectedElement?.effects?.fxStroke
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
                        }`}
                        title="Photoshop-Style Layer Effects & Blending Options (fx)"
                      >
                        fx
                        <span className="not-italic font-sans font-semibold text-[10px]">
                          Style
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!selectedElement}
                        onClick={() => handleLayerOrder('front')}
                        className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold disabled:opacity-40 cursor-pointer"
                        title="Bring to Front (Top of Stack)"
                      >
                        ⤒ Top
                      </button>
                      <button
                        type="button"
                        disabled={!selectedElement}
                        onClick={() => handleLayerOrder('back')}
                        className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold disabled:opacity-40 cursor-pointer"
                        title="Send to Back (Bottom of Stack)"
                      >
                        ⤓ Back
                      </button>
                      <button
                        type="button"
                        disabled={!selectedElement}
                        onClick={() => handleDuplicateLayer()}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer"
                        title="Duplicate Selected Layer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={!selectedElement}
                        onClick={handleDeleteSelected}
                        className="p-1 rounded bg-slate-800 hover:bg-red-600 text-slate-200 disabled:opacity-40 cursor-pointer"
                        title="Delete Selected Layer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* COLLAPSIBLE PHOTOSHOP-STYLE "fx" LAYER STYLES & FILTER PANEL */}
                {showLayerFxPanel && selectedElement && (
                  <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 flex flex-col gap-2.5 text-[11px] shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-serif italic font-black text-[10px]">
                          fx
                        </span>
                        Layer Style: {selectedElement.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowLayerFxPanel(false)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* 1. Drop Shadow */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-1.5">
                      <label className="flex items-center justify-between font-bold text-slate-700 cursor-pointer">
                        <span className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={Boolean(
                              selectedElement.effects?.dropShadow
                            )}
                            onChange={(e) =>
                              updateSelectedElementEffects({
                                dropShadow: e.target.checked,
                              })
                            }
                            className="accent-red-600"
                          />
                          Drop Shadow
                        </span>
                        <input
                          type="color"
                          value={
                            selectedElement.effects?.shadowColor?.startsWith(
                              '#'
                            )
                              ? selectedElement.effects.shadowColor
                              : '#0f172a'
                          }
                          onChange={(e) =>
                            updateSelectedElementEffects({
                              dropShadow: true,
                              shadowColor: e.target.value,
                            })
                          }
                          className="w-5 h-5 rounded border border-slate-300 cursor-pointer"
                        />
                      </label>
                      {selectedElement.effects?.dropShadow && (
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <div>
                            <span className="text-[9px] text-slate-400 block">
                              Offset X
                            </span>
                            <input
                              type="number"
                              value={selectedElement.effects?.shadowOffsetX ?? 2}
                              onChange={(e) =>
                                updateSelectedElementEffects({
                                  shadowOffsetX: Number(e.target.value),
                                })
                              }
                              className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-[10px]"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block">
                              Offset Y
                            </span>
                            <input
                              type="number"
                              value={selectedElement.effects?.shadowOffsetY ?? 2}
                              onChange={(e) =>
                                updateSelectedElementEffects({
                                  shadowOffsetY: Number(e.target.value),
                                })
                              }
                              className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-[10px]"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block">
                              Blur (pt)
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={40}
                              value={selectedElement.effects?.shadowBlur ?? 6}
                              onChange={(e) =>
                                updateSelectedElementEffects({
                                  shadowBlur: Number(e.target.value),
                                })
                              }
                              className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-[10px]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Outer Glow */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-1.5">
                      <label className="flex items-center justify-between font-bold text-slate-700 cursor-pointer">
                        <span className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedElement.effects?.outerGlow)}
                            onChange={(e) =>
                              updateSelectedElementEffects({
                                outerGlow: e.target.checked,
                              })
                            }
                            className="accent-red-600"
                          />
                          Outer Glow
                        </span>
                        <input
                          type="color"
                          value={selectedElement.effects?.glowColor || '#f59e0b'}
                          onChange={(e) =>
                            updateSelectedElementEffects({
                              outerGlow: true,
                              glowColor: e.target.value,
                            })
                          }
                          className="w-5 h-5 rounded border border-slate-300 cursor-pointer"
                        />
                      </label>
                      {selectedElement.effects?.outerGlow && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] text-slate-500">
                            Spread / Blur:
                          </span>
                          <input
                            type="range"
                            min={2}
                            max={36}
                            value={selectedElement.effects?.glowBlur ?? 10}
                            onChange={(e) =>
                              updateSelectedElementEffects({
                                glowBlur: Number(e.target.value),
                              })
                            }
                            className="flex-1 accent-amber-500"
                          />
                          <span className="text-[10px] font-bold">
                            {selectedElement.effects?.glowBlur ?? 10}pt
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 3. Stroke Outline (fx) */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-1.5">
                      <label className="flex items-center justify-between font-bold text-slate-700 cursor-pointer">
                        <span className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedElement.effects?.fxStroke)}
                            onChange={(e) =>
                              updateSelectedElementEffects({
                                fxStroke: e.target.checked,
                              })
                            }
                            className="accent-red-600"
                          />
                          Stroke Outline (fx)
                        </span>
                        <input
                          type="color"
                          value={
                            selectedElement.effects?.fxStrokeColor || '#cc0000'
                          }
                          onChange={(e) =>
                            updateSelectedElementEffects({
                              fxStroke: true,
                              fxStrokeColor: e.target.value,
                            })
                          }
                          className="w-5 h-5 rounded border border-slate-300 cursor-pointer"
                        />
                      </label>
                      {selectedElement.effects?.fxStroke && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] text-slate-500">
                            Width:
                          </span>
                          <input
                            type="range"
                            min={0.5}
                            max={12}
                            step={0.5}
                            value={selectedElement.effects?.fxStrokeWidth ?? 1.5}
                            onChange={(e) =>
                              updateSelectedElementEffects({
                                fxStrokeWidth: Number(e.target.value),
                              })
                            }
                            className="flex-1 accent-red-600"
                          />
                          <span className="text-[10px] font-bold">
                            {selectedElement.effects?.fxStrokeWidth ?? 1.5}pt
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 4. Layer Tone Adjustments (Brightness, Contrast, Saturation) */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">
                          Tone & Filter Adjustments
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedElementEffects({
                              brightness: 100,
                              contrast: 100,
                              saturate: 100,
                              blurPx: 0,
                            })
                          }
                          className="text-[10px] text-red-600 hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[9px] text-slate-500 block">
                            Brightness ({selectedElement.effects?.brightness ?? 100}%)
                          </span>
                          <input
                            type="range"
                            min={30}
                            max={180}
                            value={selectedElement.effects?.brightness ?? 100}
                            onChange={(e) =>
                              updateSelectedElementEffects({
                                brightness: Number(e.target.value),
                              })
                            }
                            className="w-full accent-red-600"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block">
                            Contrast ({selectedElement.effects?.contrast ?? 100}%)
                          </span>
                          <input
                            type="range"
                            min={30}
                            max={200}
                            value={selectedElement.effects?.contrast ?? 100}
                            onChange={(e) =>
                              updateSelectedElementEffects({
                                contrast: Number(e.target.value),
                              })
                            }
                            className="w-full accent-red-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* DRAG-TO-REORDER HINT */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>Drag ⋮⋮ to reorder stack (Top = Front)</span>
                  <span>Double-click name to rename</span>
                </div>

                {/* PHOTOSHOP-STYLE DRAGGABLE LAYER STACK */}
                <div className="flex flex-col gap-1">
                  {activeMaster.elements
                    .slice()
                    .reverse()
                    .map((el) => {
                      const isSel = el.id === selectedElementId;
                      const isDragged = draggedLayerId === el.id;
                      const isDropTarget =
                        dragOverLayerId === el.id && draggedLayerId !== el.id;
                      const hasFx = Boolean(
                        el.effects?.dropShadow ||
                          el.effects?.outerGlow ||
                          el.effects?.fxStroke ||
                          (el.effects?.brightness !== undefined &&
                            el.effects.brightness !== 100) ||
                          (el.effects?.contrast !== undefined &&
                            el.effects.contrast !== 100)
                      );
                      const blendLabel =
                        el.blendMode && el.blendMode !== 'normal'
                          ? el.blendMode.toUpperCase()
                          : null;

                      return (
                        <div
                          key={el.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedLayerId(el.id);
                            setSelectedElementId(el.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', el.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (draggedLayerId === el.id) return;
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            const midY = rect.top + rect.height / 2;
                            const pos =
                              e.clientY < midY ? 'above' : 'below';
                            setDragOverLayerId(el.id);
                            setDragOverPosition(pos);
                          }}
                          onDragLeave={() => {
                            if (dragOverLayerId === el.id) {
                              setDragOverLayerId(null);
                              setDragOverPosition(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const srcId =
                              draggedLayerId ||
                              e.dataTransfer.getData('text/plain');
                            if (srcId && srcId !== el.id && dragOverPosition) {
                              handleReorderLayersByDrag(
                                srcId,
                                el.id,
                                dragOverPosition
                              );
                            }
                            setDraggedLayerId(null);
                            setDragOverLayerId(null);
                            setDragOverPosition(null);
                          }}
                          onDragEnd={() => {
                            setDraggedLayerId(null);
                            setDragOverLayerId(null);
                            setDragOverPosition(null);
                          }}
                          onClick={() => setSelectedElementId(el.id)}
                          className={`relative p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition ${
                            isSel
                              ? 'bg-red-50/90 border-red-500 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          } ${isDragged ? 'opacity-45 scale-[0.98]' : ''} ${
                            isDropTarget && dragOverPosition === 'above'
                              ? 'border-t-4 border-t-[#cc0000]'
                              : ''
                          } ${
                            isDropTarget && dragOverPosition === 'below'
                              ? 'border-b-4 border-b-[#cc0000]'
                              : ''
                          }`}
                        >
                          {/* Visibility Eye (Photoshop Left Column) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateActiveMaster((m) => ({
                                ...m,
                                elements: m.elements.map((item) =>
                                  item.id === el.id
                                    ? {
                                        ...item,
                                        visible:
                                          item.visible === false ? true : false,
                                      }
                                    : item
                                ),
                              }));
                            }}
                            className="p-1 rounded hover:bg-slate-200/80 text-slate-600 shrink-0 cursor-pointer"
                            title={
                              el.visible === false ? 'Show Layer' : 'Hide Layer'
                            }
                          >
                            {el.visible === false ? (
                              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-slate-700" />
                            )}
                          </button>

                          {/* Drag Handle (⋮⋮) */}
                          <div
                            className="text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing shrink-0"
                            title="Drag to reorder layer"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>

                          {/* Photoshop-Style Mini Layer Thumbnail */}
                          <div className="w-7 h-7 rounded border border-slate-300 bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                            {el.type === 'image' && el.imageUrl ? (
                              <img
                                src={el.imageUrl}
                                alt={el.name}
                                className="w-full h-full object-cover"
                              />
                            ) : el.type === 'text' ? (
                              <span
                                style={{ color: el.color || '#0f172a' }}
                                className="font-serif font-black text-xs"
                              >
                                T
                              </span>
                            ) : el.type === 'qr' ? (
                              <QrCode className="w-4 h-4 text-slate-800" />
                            ) : (
                              <div
                                style={{
                                  backgroundColor:
                                    el.fill || el.stroke || '#cc0000',
                                }}
                                className={`w-4 h-4 ${
                                  el.type === 'circle'
                                    ? 'rounded-full'
                                    : 'rounded-xs'
                                }`}
                              />
                            )}
                          </div>

                          {/* Layer Name (Double-Click to Rename) + Blend/Opacity/fx Badges */}
                          <div
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingLayerNameId(el.id);
                            }}
                            className="flex-1 min-w-0"
                          >
                            {editingLayerNameId === el.id ? (
                              <input
                                type="text"
                                autoFocus
                                value={el.name}
                                onChange={(e) =>
                                  updateActiveMaster((m) => ({
                                    ...m,
                                    elements: m.elements.map((item) =>
                                      item.id === el.id
                                        ? { ...item, name: e.target.value }
                                        : item
                                    ),
                                  }))
                                }
                                onBlur={() => setEditingLayerNameId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Escape') {
                                    setEditingLayerNameId(null);
                                  }
                                }}
                                className="w-full border border-red-500 rounded bg-white px-1.5 py-0.5 text-[11px] font-bold outline-none"
                              />
                            ) : (
                              <div className="flex items-center gap-1">
                                <span
                                  className={`truncate text-[11px] ${
                                    isSel
                                      ? 'font-bold text-slate-900'
                                      : 'font-medium text-slate-800'
                                  }`}
                                >
                                  {el.name}
                                </span>
                                {blendLabel && (
                                  <span className="px-1 py-0.2 rounded bg-purple-100 text-purple-800 text-[8px] font-extrabold shrink-0">
                                    {blendLabel}
                                  </span>
                                )}
                                {Math.round((el.opacity ?? 1) * 100) < 100 && (
                                  <span className="px-1 py-0.2 rounded bg-slate-200 text-slate-700 text-[8px] font-bold shrink-0">
                                    {Math.round((el.opacity ?? 1) * 100)}%
                                  </span>
                                )}
                              </div>
                            )}

                            {el.text && (
                              <div className="text-[10px] text-slate-500 truncate">
                                &ldquo;{el.text}&rdquo;
                              </div>
                            )}
                          </div>

                          {/* Right Controls: fx Badge, Step Up/Down, Lock */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedElementId(el.id);
                                setShowLayerFxPanel((v) =>
                                  selectedElementId === el.id ? !v : true
                                );
                              }}
                              className={`px-1 py-0.5 rounded font-serif italic font-black text-[10px] cursor-pointer ${
                                hasFx
                                  ? 'bg-slate-900 text-amber-300'
                                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                              }`}
                              title="Layer Style & Effects (fx)"
                            >
                              fx
                            </button>

                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLayerOrder('up', el.id);
                                }}
                                className="px-1 text-[9px] leading-none text-slate-400 hover:text-slate-900 cursor-pointer"
                                title="Move Layer Forward"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLayerOrder('down', el.id);
                                }}
                                className="px-1 text-[9px] leading-none text-slate-400 hover:text-slate-900 cursor-pointer"
                                title="Move Layer Backward"
                              >
                                ▼
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateActiveMaster((m) => ({
                                  ...m,
                                  elements: m.elements.map((item) =>
                                    item.id === el.id
                                      ? { ...item, locked: !item.locked }
                                      : item
                                  ),
                                }));
                              }}
                              className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                              title={el.locked ? 'Unlock Layer' : 'Lock Layer'}
                            >
                              {el.locked ? (
                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* PHOTOSHOP-STYLE PINNED "BACKGROUND" LAYER AT BOTTOM OF STACK */}
                <div className="mt-1 pt-2 border-t border-slate-200">
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <div
                        style={{
                          backgroundColor:
                            activeMaster.backgroundColor || '#ffffff',
                        }}
                        className="w-6 h-6 rounded border border-slate-300 shadow-2xs"
                      />
                      <div>
                        <div className="text-[11px] font-bold text-slate-700 italic">
                          Background Surface
                        </div>
                        <div className="text-[9px] text-slate-500">
                          Base Card / Sheet Color
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {activeMaster.backgroundImage && (
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveMaster((m) => ({
                              ...m,
                              backgroundImage: undefined,
                            }))
                          }
                          className="px-1.5 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 text-[9px] font-bold cursor-pointer"
                          title="Remove AI Background Artwork"
                        >
                          Clear Art
                        </button>
                      )}
                      <input
                        type="color"
                        value={activeMaster.backgroundColor || '#ffffff'}
                        onChange={(e) =>
                          updateActiveMaster((m) => ({
                            ...m,
                            backgroundColor: e.target.value,
                          }))
                        }
                        className="w-7 h-6 rounded border border-slate-300 cursor-pointer"
                        title="Change Card Background Color"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {rightTab === 'ai' && (
              <div className="flex flex-col gap-4">
                <div className="p-3 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-xs">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    AI Print Designer (From Scratch)
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Describe what you want designed and generate either the full AI visual design OR editable text boxes, shapes & layout!
                  </p>
                  <button
                    onClick={onOpenAIDesignerModal}
                    className="mt-2.5 w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold py-2 rounded-lg shadow-xs transition cursor-pointer"
                  >
                    Open AI Print Designer →
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                  <div className="font-bold text-red-900 flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4 text-red-600" />
                    Upload & Edit Existing Card Photo
                  </div>
                  <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
                    Upload a picture of a physical business card, flatten perspective, and tell AI how to modify it.
                  </p>
                  <button
                    onClick={onOpenAIScanModal}
                    className="mt-2.5 w-full bg-[#cc0000] hover:bg-red-700 text-white font-bold py-2 rounded-lg shadow-xs transition cursor-pointer"
                  >
                    Open AI Photo Scanner →
                  </button>
                </div>

                <form
                  onSubmit={handleRunInEditorAiPrompt}
                  className="flex flex-col gap-2"
                >
                  <label className="font-bold text-slate-800">
                    Ask AI to Modify Current Design
                  </label>
                  <textarea
                    rows={3}
                    value={aiQuickPrompt}
                    onChange={(e) => setAiQuickPrompt(e.target.value)}
                    placeholder="e.g., Change phone to (555) 019-2834, switch to emerald green theme, or make text larger..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:border-red-600 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isAiUpdating}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg transition cursor-pointer"
                  >
                    {isAiUpdating ? 'Applying AI Changes...' : 'Apply AI Edit to Canvas ✨'}
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Switch to Crimson Red theme',
                    'Switch to Navy & Gold theme',
                    'Dark charcoal background',
                    'Clean white background',
                    'Make all text larger',
                    'Center all text layers',
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => setAiQuickPrompt(chip)}
                      className="text-[10px] bg-slate-100 hover:bg-red-50 text-slate-700 border border-slate-200 px-2 py-1 rounded-full cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {aiChatHistory.length > 0 && (
                  <div className="border-t border-slate-200 pt-3 flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                      Recent AI Edits
                    </span>
                    {aiChatHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px]"
                      >
                        <div className="font-semibold text-slate-800">
                          "{item.prompt}"
                        </div>
                        <div className="text-emerald-700 mt-0.5">
                          ✓ {item.summary}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* FIND & REPLACE MODAL */}
      {showFindReplace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={handleFindAndReplace}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden text-xs"
          >
            <div className="bg-[#cc0000] text-white px-4 py-3 font-bold flex items-center justify-between">
              <span>Find & Replace Text Across Card</span>
              <button
                type="button"
                onClick={() => setShowFindReplace(false)}
                className="cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Find text:
                </label>
                <input
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="e.g. 555-234-5678"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Replace with:
                </label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="e.g. 555-867-5309"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFindReplace(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-[#cc0000] text-white font-bold cursor-pointer"
                >
                  Replace All
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* PRINT PERFECT GUARANTEE / PROOF EVERY ORDER MODAL (Inspired by the monitor sticker in Photo 1 & 2!) */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#cc0000] text-white px-6 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-sm">
                    Print Perfect Guarantee — Pre-Flight Order Proof
                  </h3>
                  <p className="text-[11px] text-red-100">
                    1. Proof every order • 2. Compare at production • Actual Size & Imposition Verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProofModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex flex-col items-center gap-4">
              {proofPreviewUrl && (
                <img
                  src={proofPreviewUrl}
                  alt="Sheet proof"
                  className="max-h-[52vh] object-contain bg-white shadow-lg border border-slate-300"
                />
              )}
              <div className="grid grid-cols-3 gap-3 w-full text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Sheet Dimensions
                  </span>
                  <span className="font-bold text-slate-800">
                    {project.template.sheetWidthIn} ×{' '}
                    {project.template.sheetHeightIn} in ({project.template.name})
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Imposition Layout
                  </span>
                  <span className="font-bold text-emerald-700">
                    {project.template.imposition
                      ? `${
                          project.template.imposition.cols *
                          project.template.imposition.rows
                        }-Up Duplicated (${unitW}×${unitH}")`
                      : `Single Unit (${unitW}×${unitH}")`}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    2-Sided & Crop Marks
                  </span>
                  <span className="font-bold text-slate-800">
                    Front + Back •{' '}
                    {project.showCropMarks ? 'Crop Marks ON' : 'Crop Marks OFF'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setShowProofModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Back to Editing
              </button>
              <div className="flex items-center gap-2.5">
                {proofPreviewUrl && (
                  <a
                    href={proofPreviewUrl}
                    download={`${project.title.replace(/\s+/g, '_')}_Proof.png`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Download PNG Proof
                  </a>
                )}
                <button
                  onClick={handleExportPdf}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 bg-[#cc0000] hover:bg-red-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isExporting
                    ? 'Generating PDF...'
                    : 'Export Print-Ready PDF (Front & Back)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CONTACT & VARIABLE DATA LIST MANAGER MODAL ==================== */}
      {showListManagerModal &&
        (() => {
          const mm: MailMergeConfig =
            project.mailMerge || DEFAULT_SAMPLE_MAIL_MERGE;
          const activeListId =
            mm.activeListId || savedVariableLists[0]?.id || 'list-vip-contacts';
          const filteredRecordsWithIndex = mm.records
            .map((rec, originalIdx) => ({ rec, originalIdx }))
            .filter(({ rec }) => {
              if (!listSearchQuery.trim()) return true;
              const q = listSearchQuery.toLowerCase();
              return Object.values(rec).some((v) =>
                String(v || '')
                  .toLowerCase()
                  .includes(q)
              );
            });

          return (
            <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[86vh] flex flex-col overflow-hidden">
                {/* Modal Top Header */}
                <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
                      <Layers className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                        Contact &amp; Variable Data List Manager
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[10px] font-bold">
                          Mail Merge &amp; Dynamic Variable Inserting
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-300">
                        Upload CSV files as reusable lists, create new lists
                        from scratch, customize columns/rows &amp; click any{' '}
                        <code className="text-amber-300 font-mono">
                          {`{{Variable}}`}
                        </code>{' '}
                        to insert it onto your design
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowListManagerModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Body: Left Sidebar (Saved Lists Library) + Right Main Area (Spreadsheet Editor) */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  {/* LEFT SIDEBAR: SAVED LISTS LIBRARY & CREATE / IMPORT */}
                  <div className="w-72 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
                    <div className="p-3 border-b border-slate-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                          Saved Lists ({savedVariableLists.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateListForm((v) => !v);
                            setShowPasteCsvModal(false);
                          }}
                          className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3 h-3" /> New List
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => csvUploadRef.current?.click()}
                          className="py-1.5 px-2 rounded-lg bg-white hover:bg-indigo-50 border border-slate-300 text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3 h-3 text-indigo-600" />
                          Upload CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasteCsvModal((v) => !v);
                            setShowCreateListForm(false);
                          }}
                          className="py-1.5 px-2 rounded-lg bg-white hover:bg-indigo-50 border border-slate-300 text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Clipboard className="w-3 h-3 text-indigo-600" />
                          Paste Rows
                        </button>
                      </div>

                      {/* Create New List Form inside Sidebar */}
                      {showCreateListForm && (
                        <form
                          onSubmit={handleCreateVariableListFromScratch}
                          className="bg-white p-2.5 rounded-xl border-2 border-indigo-500 flex flex-col gap-2 shadow-sm"
                        >
                          <span className="text-[10px] font-extrabold text-indigo-800 uppercase">
                            Create List from Scratch
                          </span>
                          <input
                            type="text"
                            autoFocus
                            value={newListNameInput}
                            onChange={(e) =>
                              setNewListNameInput(e.target.value)
                            }
                            placeholder="List Name (e.g. Store Price Tags)..."
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                          />
                          <div className="flex items-center gap-1 flex-wrap">
                            {[
                              {
                                label: 'Blank Custom',
                                cols: 'Field1, Field2, Field3',
                                cat: 'custom' as VariableListCategory,
                              },
                              {
                                label: 'Contacts',
                                cols: 'Name, Company, Address, CityStateZip, Phone',
                                cat: 'contacts' as VariableListCategory,
                              },
                              {
                                label: 'Badges',
                                cols: 'FullName, Role, Department, BadgeID',
                                cat: 'badges' as VariableListCategory,
                              },
                              {
                                label: 'Products',
                                cols: 'ItemName, SKU, Price, SalePrice, Notes',
                                cat: 'products' as VariableListCategory,
                              },
                            ].map((p) => (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() => {
                                  setNewListColumnsInput(p.cols);
                                  setNewListCategoryInput(p.cat);
                                }}
                                className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[9px] font-bold cursor-pointer"
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={newListColumnsInput}
                            onChange={(e) =>
                              setNewListColumnsInput(e.target.value)
                            }
                            placeholder="Columns: Title, Price, SKU..."
                            className="w-full border border-slate-300 rounded px-2 py-1 text-[10px] font-mono bg-slate-50"
                          />
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setShowCreateListForm(false)}
                              className="px-2 py-1 rounded border border-slate-300 text-[10px] font-semibold text-slate-600 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Create List
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Paste CSV Form inside Sidebar */}
                      {showPasteCsvModal && (
                        <div className="bg-white p-2.5 rounded-xl border-2 border-indigo-500 flex flex-col gap-2 shadow-sm">
                          <span className="text-[10px] font-extrabold text-indigo-800 uppercase">
                            Paste Excel / CSV as New List
                          </span>
                          <input
                            type="text"
                            value={pasteListNameInput}
                            onChange={(e) =>
                              setPasteListNameInput(e.target.value)
                            }
                            placeholder="List Name..."
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                          />
                          <textarea
                            rows={3}
                            value={pasteCsvText}
                            onChange={(e) => setPasteCsvText(e.target.value)}
                            placeholder="Header1, Header2&#10;Value1, Value2"
                            className="w-full border border-slate-300 rounded p-1.5 text-[10px] font-mono bg-slate-50"
                          />
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setShowPasteCsvModal(false)}
                              className="px-2 py-1 rounded border border-slate-300 text-[10px] font-semibold text-slate-600 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleImportCsvAsNewSavedList(
                                  pasteCsvText,
                                  pasteListNameInput ||
                                    `Pasted List ${
                                      savedVariableLists.length + 1
                                    }`
                                );
                                setShowPasteCsvModal(false);
                                setPasteCsvText('');
                                setPasteListNameInput('');
                              }}
                              className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Import List
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Saved Lists Scrollable Directory */}
                    <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
                      {savedVariableLists.map((lst) => {
                        const isSelected = lst.id === activeListId;
                        return (
                          <div
                            key={lst.id}
                            onClick={() => handleSelectVariableList(lst.id)}
                            className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col gap-1 ${
                              isSelected
                                ? 'bg-indigo-50/90 border-indigo-500 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-xs truncate ${
                                  isSelected
                                    ? 'font-extrabold text-indigo-950'
                                    : 'font-bold text-slate-800'
                                }`}
                              >
                                {lst.name}
                              </span>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateVariableList(lst.id);
                                  }}
                                  className="p-1 rounded hover:bg-slate-200/70 text-slate-500 cursor-pointer"
                                  title="Duplicate List"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                {savedVariableLists.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteVariableList(lst.id);
                                    }}
                                    className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 cursor-pointer"
                                    title="Delete List"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>
                                <strong>{lst.records.length}</strong> rows •{' '}
                                <strong>{lst.fields.length}</strong> vars
                              </span>
                              {lst.sourceFileName && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold truncate max-w-28">
                                  CSV
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 flex-wrap pt-0.5">
                              {lst.fields.slice(0, 4).map((f) => (
                                <span
                                  key={f}
                                  className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[9px]"
                                >
                                  {`{{${f}}}`}
                                </span>
                              ))}
                              {lst.fields.length > 4 && (
                                <span className="text-[9px] text-slate-400">
                                  +{lst.fields.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* RIGHT MAIN AREA: ACTIVE LIST SPREADSHEET EDITOR & VARIABLE INSERTING */}
                  <div className="flex-1 flex flex-col min-w-0 bg-white">
                    {/* Top Action & List Title Bar */}
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap bg-slate-50/50">
                      <div className="flex items-center gap-2 flex-1 min-w-52">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">
                          List Name:
                        </span>
                        <input
                          type="text"
                          value={
                            mm.activeListName ||
                            savedVariableLists.find(
                              (l) => l.id === activeListId
                            )?.name ||
                            'Active Variable List'
                          }
                          onChange={(e) =>
                            handleUpdateMailMerge({
                              activeListName: e.target.value,
                            })
                          }
                          className="border border-slate-300 focus:border-indigo-600 rounded-lg bg-white px-3 py-1.5 text-sm font-extrabold text-slate-900 outline-none flex-1 max-w-xs"
                        />
                        <span className="text-xs text-slate-500 font-medium">
                          ({mm.records.length} rows × {mm.fields.length}{' '}
                          columns)
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Search Rows */}
                        <div className="flex items-center border border-slate-300 rounded-lg bg-white px-2.5 py-1">
                          <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                          <input
                            type="text"
                            value={listSearchQuery}
                            onChange={(e) =>
                              setListSearchQuery(e.target.value)
                            }
                            placeholder="Filter rows..."
                            className="text-xs outline-none w-32"
                          />
                        </div>

                        {/* Add Column inline */}
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newMergeFieldName}
                            onChange={(e) =>
                              setNewMergeFieldName(e.target.value)
                            }
                            placeholder="New column name..."
                            className="border border-slate-300 rounded-lg bg-white px-2.5 py-1 text-xs w-36 outline-none focus:border-indigo-600"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const clean = newMergeFieldName
                                .trim()
                                .replace(/[^a-zA-Z0-9_ -]/g, '');
                              if (!clean || mm.fields.includes(clean)) return;
                              handleUpdateMailMerge({
                                enabled: true,
                                fields: [...mm.fields, clean],
                                records: mm.records.map((r, idx) => ({
                                  ...r,
                                  [clean]: `${clean} ${idx + 1}`,
                                })),
                              });
                              setNewMergeFieldName('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                          >
                            + Add Column
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const newRow: Record<string, string> = {};
                            mm.fields.forEach((f) => {
                              newRow[f] = `${f} ${mm.records.length + 1}`;
                            });
                            handleUpdateMailMerge({
                              enabled: true,
                              records: [...mm.records, newRow],
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Row
                        </button>

                        <button
                          type="button"
                          onClick={handleExportActiveListToCsv}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Export this list as a .CSV file"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          Export .CSV
                        </button>
                      </div>
                    </div>

                    {/* Quick Variable Insertion Strip */}
                    <div className="px-4 py-2.5 bg-indigo-50/70 border-b border-indigo-200/80 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-extrabold text-indigo-900 mr-1">
                          Click to Insert Variable into Selected Text Box (or
                          New Layer):
                        </span>
                        {mm.fields.map((field) => (
                          <button
                            key={field}
                            type="button"
                            onClick={() => handleInsertMergeField(field)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-600 hover:text-white border border-indigo-300 text-indigo-800 font-mono font-bold text-xs transition cursor-pointer shadow-2xs"
                          >
                            + {`{{${field}}}`}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleInsertMailingAddressBlock}
                        className="px-3 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold cursor-pointer shrink-0"
                      >
                        + Insert Multi-Field Block
                      </button>
                    </div>

                    {/* Editable Spreadsheet Grid */}
                    <div className="flex-1 overflow-auto p-4">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-300">
                            <th className="w-16 px-2 py-2 text-left text-[10px] font-extrabold uppercase text-slate-500 border-r border-slate-200">
                              Row
                            </th>
                            {mm.fields.map((field) => (
                              <th
                                key={field}
                                className="px-2.5 py-2 text-left border-r border-slate-200 min-w-40"
                              >
                                {renamingColumnOldName === field ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      autoFocus
                                      value={renamingColumnNewName}
                                      onChange={(e) =>
                                        setRenamingColumnNewName(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleRenameColumnInActiveList(
                                            field,
                                            renamingColumnNewName
                                          );
                                        } else if (e.key === 'Escape') {
                                          setRenamingColumnOldName(null);
                                        }
                                      }}
                                      onBlur={() =>
                                        handleRenameColumnInActiveList(
                                          field,
                                          renamingColumnNewName
                                        )
                                      }
                                      className="border border-indigo-600 rounded bg-white px-1.5 py-0.5 text-xs font-mono font-bold w-full outline-none"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRenamingColumnOldName(field);
                                        setRenamingColumnNewName(field);
                                      }}
                                      className="font-mono font-extrabold text-indigo-800 hover:underline text-left truncate cursor-pointer"
                                      title="Click to rename this variable column"
                                    >
                                      {`{{${field}}}`} ✎
                                    </button>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleInsertMergeField(field)
                                        }
                                        className="px-1.5 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[9px] font-bold cursor-pointer"
                                        title={`Insert {{${field}}} onto canvas`}
                                      >
                                        + Insert
                                      </button>
                                      {mm.fields.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteColumnFromActiveList(
                                              field
                                            )
                                          }
                                          className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                                          title={`Delete column "${field}"`}
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </th>
                            ))}
                            <th className="w-20 px-2 py-2 text-center text-[10px] font-extrabold uppercase text-slate-500">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredRecordsWithIndex.map(
                            ({ rec, originalIdx }) => {
                              const isPreviewed =
                                (mm.previewRecordIndex || 0) === originalIdx;
                              return (
                                <tr
                                  key={originalIdx}
                                  className={
                                    isPreviewed
                                      ? 'bg-indigo-50/50'
                                      : 'hover:bg-slate-50'
                                  }
                                >
                                  <td className="px-2 py-1.5 border-r border-slate-200">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateMailMerge({
                                          previewRecordIndex: originalIdx,
                                        })
                                      }
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                        isPreviewed
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-slate-100 text-slate-600 hover:bg-indigo-100'
                                      }`}
                                      title="Click to preview this row live on the canvas"
                                    >
                                      #{originalIdx + 1}
                                    </button>
                                  </td>
                                  {mm.fields.map((field) => (
                                    <td
                                      key={field}
                                      className="p-1 border-r border-slate-200"
                                    >
                                      <input
                                        type="text"
                                        value={rec[field] || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const nextRecs = mm.records.map(
                                            (item, idx) =>
                                              idx === originalIdx
                                                ? { ...item, [field]: val }
                                                : item
                                          );
                                          handleUpdateMailMerge({
                                            enabled: true,
                                            records: nextRecs,
                                          });
                                        }}
                                        placeholder={field}
                                        className="w-full px-2 py-1 rounded border border-transparent focus:border-indigo-500 focus:bg-white bg-transparent outline-none text-xs text-slate-800"
                                      />
                                    </td>
                                  ))}
                                  <td className="px-2 py-1.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const dupRow = { ...rec };
                                          const nextRecs = [...mm.records];
                                          nextRecs.splice(
                                            originalIdx + 1,
                                            0,
                                            dupRow
                                          );
                                          handleUpdateMailMerge({
                                            enabled: true,
                                            records: nextRecs,
                                          });
                                        }}
                                        className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                                        title="Duplicate Row"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      {mm.records.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleUpdateMailMerge({
                                              records: mm.records.filter(
                                                (_, idx) =>
                                                  idx !== originalIdx
                                              ),
                                            })
                                          }
                                          className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 cursor-pointer"
                                          title="Delete Row"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-600">
                        All changes to{' '}
                        <strong className="text-slate-900">
                          {mm.activeListName || 'this list'}
                        </strong>{' '}
                        are automatically saved to your Lists Library &amp;
                        synced to your canvas variables.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowListManagerModal(false)}
                          className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer shadow-xs"
                        >
                          Done &amp; Return to Canvas
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};
