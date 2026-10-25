import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Grid,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  Sparkles,
  Unlink2,
  Upload,
  X,
} from 'lucide-react';
import { PrintProject, PrintTemplate } from '../types/printstudio';
import { PRINT_TEMPLATES } from '../data/templates';
import {
  ImportedDocumentBundle,
  ImpositionMode,
  PageScalingMode,
  buildImposedProjectFromImport,
  generateSampleImportBundle,
  importFilesToBundle,
} from '../utils/documentImporter';

interface QuickImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplate: PrintTemplate;
  onApplyImportedProject: (project: PrintProject, summary: string) => void;
}

export const QuickImportModal: React.FC<QuickImportModalProps> = ({
  isOpen,
  onClose,
  currentTemplate,
  onApplyImportedProject,
}) => {
  const [bundle, setBundle] = useState<ImportedDocumentBundle | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [impositionMode, setImpositionMode] =
    useState<ImpositionMode>('booklet-saddle');
  const [targetTemplateId, setTargetTemplateId] =
    useState<string>('booklet-5.5x8.5');
  const [scalingMode, setScalingMode] = useState<PageScalingMode>('fit');
  const [includeEditableTextOverlay, setIncludeEditableTextOverlay] =
    useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string>('booklet-4page');

  // Non-Bleed White Margin, Center Link & H/V Spacing state during Quick Import
  const [centerLink, setCenterLink] = useState<boolean>(true);
  const [linkHVSpacing, setLinkHVSpacing] = useState<boolean>(true);
  const [gapXIn, setGapXIn] = useState<number>(0);
  const [gapYIn, setGapYIn] = useState<number>(0);
  const [outerWhiteXIn, setOuterWhiteXIn] = useState<number>(0);
  const [outerWhiteYIn, setOuterWhiteYIn] = useState<number>(0);
  const [autoFitNonBleed, setAutoFitNonBleed] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load default 4-page booklet sample on initial open
  useEffect(() => {
    if (isOpen && !bundle) {
      handleSelectSamplePreset('booklet-4page');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectSamplePreset = (
    preset: 'booklet-4page' | 'bcard-2sided' | 'flyer-2up'
  ) => {
    setActivePresetId(preset);
    const sample = generateSampleImportBundle(preset);
    setBundle(sample);

    if (preset === 'booklet-4page') {
      setImpositionMode('booklet-saddle');
      setTargetTemplateId('booklet-5.5x8.5');
    } else if (preset === 'bcard-2sided') {
      setImpositionMode('repeat-multi-up');
      setTargetTemplateId('bcard-10up');
    } else {
      setImpositionMode('repeat-multi-up');
      setTargetTemplateId('postcard-4up');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsLoadingFile(true);
    setActivePresetId('');
    try {
      const imported = await importFilesToBundle(files);
      setBundle(imported);

      // Auto-recommend imposition mode based on page count and aspect ratio
      if (imported.pages.length >= 3) {
        setImpositionMode('booklet-saddle');
        setTargetTemplateId('booklet-5.5x8.5');
      } else {
        const p0 = imported.pages[0];
        const ratio = p0 ? p0.widthPx / Math.max(1, p0.heightPx) : 1;
        if (ratio > 1.35) {
          setImpositionMode('repeat-multi-up');
          setTargetTemplateId('bcard-10up');
        } else {
          setImpositionMode('repeat-multi-up');
          setTargetTemplateId('postcard-4up');
        }
      }
    } catch (err) {
      console.error('Failed to import document:', err);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const baseTargetTemplate =
    PRINT_TEMPLATES.find((t) => t.id === targetTemplateId) || currentTemplate;

  // Compute customized template with user's Center Link, H/V Spacing, and Non-Bleed Outer White Margins
  const targetTemplate: PrintTemplate = React.useMemo(() => {
    if (!baseTargetTemplate.imposition) return baseTargetTemplate;
    const imp = { ...baseTargetTemplate.imposition };
    imp.gapXIn = gapXIn;
    imp.gapYIn = gapYIn;
    imp.autoCenterOnSheet = centerLink;
    imp.linkSpacing = linkHVSpacing;
    imp.autoFitToMargins = autoFitNonBleed;

    const sheetW = baseTargetTemplate.sheetWidthIn;
    const sheetH = baseTargetTemplate.sheetHeightIn;

    if (autoFitNonBleed) {
      imp.marginLeftIn = outerWhiteXIn;
      imp.marginTopIn = outerWhiteYIn;
      const availW = sheetW - 2 * outerWhiteXIn - (imp.cols - 1) * gapXIn;
      const availH = sheetH - 2 * outerWhiteYIn - (imp.rows - 1) * gapYIn;
      imp.unitWidthIn = Number(
        Math.max(0.5, availW / Math.max(1, imp.cols)).toFixed(3)
      );
      imp.unitHeightIn = Number(
        Math.max(0.5, availH / Math.max(1, imp.rows)).toFixed(3)
      );
    } else if (centerLink) {
      const totalGridW = imp.cols * imp.unitWidthIn + (imp.cols - 1) * gapXIn;
      const totalGridH = imp.rows * imp.unitHeightIn + (imp.rows - 1) * gapYIn;
      imp.marginLeftIn = Number(
        Math.max(0, (sheetW - totalGridW) / 2).toFixed(3)
      );
      imp.marginTopIn = Number(
        Math.max(0, (sheetH - totalGridH) / 2).toFixed(3)
      );
    } else {
      imp.marginLeftIn = outerWhiteXIn;
      imp.marginTopIn = outerWhiteYIn;
    }

    return {
      ...baseTargetTemplate,
      imposition: imp,
    };
  }, [
    baseTargetTemplate,
    gapXIn,
    gapYIn,
    centerLink,
    linkHVSpacing,
    autoFitNonBleed,
    outerWhiteXIn,
    outerWhiteYIn,
  ]);

  const handleConfirmImport = () => {
    if (!bundle) return;
    const imposedProject = buildImposedProjectFromImport({
      bundle,
      targetTemplate,
      impositionMode,
      scalingMode,
      includeEditableTextOverlay,
    });

    const modeLabels: Record<ImpositionMode, string> = {
      'booklet-saddle': 'Saddle-Stitch Booklet Printer Spreads',
      'booklet-reader': 'Booklet Reader Spreads (2-Up)',
      'repeat-multi-up': 'Step-and-Repeat Multi-Up Imposition',
      'sequential-multi-up': 'Sequential Multi-Up Collation',
      'single-per-sheet': '1 Page Per Full Sheet',
    };

    onApplyImportedProject(
      imposedProject,
      `Imported "${bundle.fileName}" (${bundle.pages.length} page${
        bundle.pages.length === 1 ? '' : 's'
      }) as ${modeLabels[impositionMode]} on ${targetTemplate.name}.`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-[#cc0000] text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FolderOpen className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                Quick Import — PDF, Word Doc & Design File Imposition Studio
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                  Booklet • Multi-Up • Step & Repeat
                </span>
              </h2>
              <p className="text-xs text-red-100">
                Import any PDF, Word (.docx), SVG, or Image file and automatically set it up as a foldable Booklet, 10-Up / 4-Up Multi-Up Sheet, or Standard Print Job
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* LEFT COLUMN: File Upload + Sample Documents + Imported Page Thumbnails (6 cols) */}
          <div className="lg:col-span-6 p-5 flex flex-col gap-4 bg-slate-50/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  Step 1 • Select Document or Design File
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  Upload PDF, Word (.docx), SVG, or Image Files
                </h3>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md,.rtf,.svg,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-[#cc0000] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Browse PDF / Word / Design File
              </button>
            </div>

            {/* 1-Click Sample Multi-Page PDF / Doc Presets */}
            <div>
              <span className="text-[10px] font-semibold text-slate-500 block mb-1.5">
                Or test immediately with a built-in multi-page sample file:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectSamplePreset('booklet-4page')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    activePresetId === 'booklet-4page'
                      ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <BookOpen className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="truncate">4-Page Gala PDF</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Booklet Program (4 Pages)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSamplePreset('bcard-2sided')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    activePresetId === 'bcard-2sided'
                      ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Copy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">2-Sided Card PDF</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Front & Back → 10-Up Sheet
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSamplePreset('flyer-2up')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    activePresetId === 'flyer-2up'
                      ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Promo Flyer (.docx)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Word Flyer → 4-Up / 2-Up
                  </p>
                </button>
              </div>
            </div>

            {/* Imported Pages Gallery */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-bold text-slate-800">
                    {bundle ? bundle.fileName : 'No file loaded'}
                  </span>
                  {bundle && (
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded uppercase">
                      {bundle.fileType} • {bundle.pages.length} Page
                      {bundle.pages.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>

              {isLoadingFile ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                  <span className="text-xs font-medium">
                    Rendering document pages at print resolution...
                  </span>
                </div>
              ) : bundle ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto max-h-72 p-1">
                  {bundle.pages.map((pg) => (
                    <div
                      key={pg.pageNumber}
                      className="bg-slate-50 rounded-lg border border-slate-200 p-2 flex flex-col items-center"
                    >
                      <div className="h-28 w-full flex items-center justify-center bg-white border border-slate-200 rounded overflow-hidden p-1">
                        <img
                          src={pg.dataUrl}
                          alt={pg.title}
                          className="max-h-full max-w-full object-contain shadow-2xs"
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 mt-1.5 truncate w-full text-center">
                        Page {pg.pageNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate w-full text-center">
                        {pg.title}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Imposition Spread Diagram Preview */}
              {bundle && (
                <div className="bg-slate-900 text-white rounded-lg p-3 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold block">
                      Live Imposition Mapping Preview
                    </span>
                    {impositionMode === 'booklet-saddle' && (
                      <span className="text-[11px] text-slate-200">
                        Sheet 1 Front: <strong>[Page 4 (Back Cover) | Page 1 (Front Cover)]</strong> • Sheet 1 Back: <strong>[Page 2 | Page 3]</strong>
                      </span>
                    )}
                    {impositionMode === 'booklet-reader' && (
                      <span className="text-[11px] text-slate-200">
                        Spread 1: <strong>[Page 1 | Page 2]</strong> • Spread 2: <strong>[Page 3 | Page 4]</strong>
                      </span>
                    )}
                    {impositionMode === 'repeat-multi-up' && (
                      <span className="text-[11px] text-slate-200">
                        Page 1 duplicated across all{' '}
                        <strong>
                          {targetTemplate.imposition
                            ? targetTemplate.imposition.cols *
                              targetTemplate.imposition.rows
                            : 1}{' '}
                          Front slots
                        </strong>
                        {bundle.pages.length >= 2
                          ? ' • Page 2 duplicated across all Back slots'
                          : ''}
                      </span>
                    )}
                    {impositionMode === 'sequential-multi-up' && (
                      <span className="text-[11px] text-slate-200">
                        Pages 1..{bundle.pages.length} placed sequentially across slots on {targetTemplate.name}
                      </span>
                    )}
                    {impositionMode === 'single-per-sheet' && (
                      <span className="text-[11px] text-slate-200">
                        {bundle.pages.length} full sheet page(s) on {targetTemplate.name}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Imposition Setup (Booklet / Multi-Up / Single) + Target Template + Scaling (6 cols) */}
          <div className="lg:col-span-6 p-5 flex flex-col justify-between gap-4 bg-white">
            <div className="flex flex-col gap-4">
              {/* Step 2: Choose Imposition / Layout Method */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  Step 2 • Choose How to Set Up & Impose This File
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setImpositionMode('booklet-saddle');
                      if (!targetTemplate.isBooklet) {
                        setTargetTemplateId('booklet-5.5x8.5');
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      impositionMode === 'booklet-saddle'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <BookOpen className="w-4 h-4 text-red-600" />
                      Saddle-Stitch Booklet (Fold & Staple)
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Automatically pairs pages into printer spreads ([N | 1], [2 | N-1]) for folding in half.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImpositionMode('repeat-multi-up');
                      if (!targetTemplate.imposition || targetTemplate.isBooklet) {
                        setTargetTemplateId('bcard-10up');
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      impositionMode === 'repeat-multi-up'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Copy className="w-4 h-4 text-emerald-600" />
                      Multiple-Up Step & Repeat (10-Up / 4-Up)
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Duplicates Page 1 across all Front slots (10-up cards, 4-up postcards, 24-up press) & Page 2 on Back!
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImpositionMode('booklet-reader');
                      if (!targetTemplate.isBooklet) {
                        setTargetTemplateId('booklet-5.5x8.5');
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      impositionMode === 'booklet-reader'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Layers className="w-4 h-4 text-blue-600" />
                      2-Up Reader Spreads (Sequential)
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Places pages side-by-side in reading order ([Page 1 | Page 2], [Page 3 | Page 4]).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImpositionMode('sequential-multi-up');
                      if (!targetTemplate.imposition) {
                        setTargetTemplateId('postcard-4up');
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      impositionMode === 'sequential-multi-up'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Grid className="w-4 h-4 text-purple-600" />
                      Sequential Multi-Up Collation
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Places Page 1 in Slot 1, Page 2 in Slot 2, Page 3 in Slot 3 across the sheet grid.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImpositionMode('single-per-sheet');
                      setTargetTemplateId('doc-8.5x11');
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer sm:col-span-2 ${
                      impositionMode === 'single-per-sheet'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <ImageIcon className="w-4 h-4 text-slate-700" />
                      Standard 1-Per-Sheet Document (8.5×11", 11×17", Bank Tabs, Envelopes)
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Places each imported page onto its own individual full-size sheet in PrintStudio.
                    </p>
                  </button>
                </div>
              </div>

              {/* Step 3: Target PrintStudio Template Size */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  Step 3 • Target Sheet / Template Size
                </span>
                <select
                  value={targetTemplateId}
                  onChange={(e) => setTargetTemplateId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-600"
                >
                  {PRINT_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.subtitle})
                      {tpl.imposition
                        ? ` — ${tpl.imposition.cols}×${tpl.imposition.rows} Grid (${tpl.imposition.unitWidthIn}×${tpl.imposition.unitHeightIn}")`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4: Page Scaling & Editable Text Overlay */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 block mb-1">
                    Page Scaling / Fit
                  </span>
                  <select
                    value={scalingMode}
                    onChange={(e) =>
                      setScalingMode(e.target.value as PageScalingMode)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="fit">Fit to Trim (Preserve Aspect Ratio)</option>
                    <option value="fill">Stretch / Fill Full Slot</option>
                    <option value="margin">Fit Inside Safe Margins</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="w-full flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeEditableTextOverlay}
                      onChange={(e) =>
                        setIncludeEditableTextOverlay(e.target.checked)
                      }
                      className="rounded text-red-600"
                    />
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      Extract Editable Text Boxes on Top
                    </span>
                  </label>
                </div>
              </div>

              {/* Step 5: Non-Bleed White Space, Center Link & H/V Spacing (for 4-Up / N-Up items) */}
              {targetTemplate.imposition && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                      Step 5 • Non-Bleed White Margins, Center Link & H/V Spacing
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoFitNonBleed(true);
                        setCenterLink(true);
                        setOuterWhiteXIn(0.25);
                        setOuterWhiteYIn(0.25);
                        setGapXIn(0.25);
                        setGapYIn(0.25);
                      }}
                      className="text-[10px] bg-white hover:bg-red-50 text-red-700 border border-red-300 font-bold px-2 py-0.5 rounded cursor-pointer"
                    >
                      Apply 0.25&quot; Non-Bleed 4-Up Preset
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={centerLink}
                        onChange={(e) => setCenterLink(e.target.checked)}
                        className="rounded text-red-600"
                      />
                      <span>Center Link (Equal L/R & T/B White)</span>
                    </label>

                    <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoFitNonBleed}
                        onChange={(e) => setAutoFitNonBleed(e.target.checked)}
                        className="rounded text-red-600"
                      />
                      <span>Auto-Shrink Item to Fit White Margins</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setLinkHVSpacing((v) => !v)}
                      className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                        linkHVSpacing
                          ? 'bg-red-50 border-red-400 text-red-700'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      {linkHVSpacing ? (
                        <>
                          <Link2 className="w-3 h-3" /> H/V Spacing Linked
                        </>
                      ) : (
                        <>
                          <Unlink2 className="w-3 h-3" /> H/V Unlinked
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 block">
                        Horiz Spacing (in)
                      </label>
                      <input
                        type="number"
                        step="0.0625"
                        min={0}
                        max={2}
                        value={gapXIn}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setGapXIn(val);
                          if (linkHVSpacing) setGapYIn(val);
                        }}
                        className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">
                        Vert Spacing (in)
                      </label>
                      <input
                        type="number"
                        step="0.0625"
                        min={0}
                        max={2}
                        value={gapYIn}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setGapYIn(val);
                          if (linkHVSpacing) setGapXIn(val);
                        }}
                        className="w-full border border-slate-300 rounded bg-white px-2 py-1 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">
                        L/R White (in)
                      </label>
                      <input
                        type="number"
                        step="0.0625"
                        min={0}
                        max={3}
                        disabled={centerLink && !autoFitNonBleed}
                        value={
                          centerLink && !autoFitNonBleed
                            ? targetTemplate.imposition.marginLeftIn
                            : outerWhiteXIn
                        }
                        onChange={(e) =>
                          setOuterWhiteXIn(Math.max(0, Number(e.target.value)))
                        }
                        className="w-full border border-slate-300 rounded bg-white disabled:opacity-60 px-2 py-1 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">
                        T/B White (in)
                      </label>
                      <input
                        type="number"
                        step="0.0625"
                        min={0}
                        max={3}
                        disabled={centerLink && !autoFitNonBleed}
                        value={
                          centerLink && !autoFitNonBleed
                            ? targetTemplate.imposition.marginTopIn
                            : outerWhiteYIn
                        }
                        onChange={(e) =>
                          setOuterWhiteYIn(Math.max(0, Number(e.target.value)))
                        }
                        className="w-full border border-slate-300 rounded bg-white disabled:opacity-60 px-2 py-1 font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Bar */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bundle || isLoadingFile}
                onClick={handleConfirmImport}
                className="flex-1 flex items-center justify-center gap-2 bg-[#cc0000] hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-md transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Open Imposed Document in PrintStudio →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
