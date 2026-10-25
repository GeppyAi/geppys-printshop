import React, { useState } from 'react';
import {
  BookmarkCheck,
  BookOpen,
  Camera,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { PrintTemplate } from '../types/printstudio';
import { PRINT_TEMPLATES } from '../data/templates';

interface TemplateDashboardProps {
  onSelectTemplate: (template: PrintTemplate, loadSampleDesign: boolean) => void;
  onOpenAIScanModal: (defaultTemplate?: PrintTemplate) => void;
  onOpenAIDesignerModal: (defaultTemplate?: PrintTemplate) => void;
  onOpenQuickImportModal: () => void;
  onOpenFileLocker?: (tab?: 'locker' | 'photo-nup') => void;
  onCreateCustomTemplate: (customTemplate: PrintTemplate) => void;
  onImportProjectJson: (file: File) => void;
  savedCustomTemplates?: PrintTemplate[];
  onDeleteSavedTemplate?: (templateId: string) => void;
}

export const TemplateDashboard: React.FC<TemplateDashboardProps> = ({
  onSelectTemplate,
  onOpenAIScanModal,
  onOpenAIDesignerModal,
  onOpenQuickImportModal,
  onOpenFileLocker,
  onCreateCustomTemplate,
  onImportProjectJson,
  savedCustomTemplates = [],
  onDeleteSavedTemplate,
}) => {
  const [sidebarTab, setSidebarTab] = useState<'templates' | 'quick-import'>(
    'templates'
  );
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);

  // Custom project modal state
  const [customName, setCustomName] = useState('Custom Print Sheet');
  const [customWidth, setCustomWidth] = useState(8.5);
  const [customHeight, setCustomHeight] = useState(11);
  const [customIsMultiUp, setCustomIsMultiUp] = useState(true);
  const [customCols, setCustomCols] = useState(2);
  const [customRows, setCustomRows] = useState(5);
  const [customUnitW, setCustomUnitW] = useState(3.5);
  const [customUnitH, setCustomUnitH] = useState(2.0);

  const topTemplates = PRINT_TEMPLATES.filter(
    (t) => t.category === 'standard' || t.category === 'booklet'
  ).filter((t) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'booklet') return t.category === 'booklet';
    if (activeFilter === 'standard') return t.category === 'standard';
    return false;
  });

  const otherTemplates = PRINT_TEMPLATES.filter(
    (t) => t.category === 'other'
  ).filter((t) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'bcard') return t.id.includes('bcard') || t.id.includes('postcard') || t.id.includes('invite');
    if (activeFilter === 'tabs') return t.id.includes('tabs') || t.id.includes('envelope');
    return true;
  });

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const marginLeft = Math.max(
      0,
      Number(((customWidth - customCols * customUnitW) / 2).toFixed(3))
    );
    const marginTop = Math.max(
      0,
      Number(((customHeight - customRows * customUnitH) / 2).toFixed(3))
    );

    const newTpl: PrintTemplate = {
      id: `custom-${Date.now()}`,
      name: customName || 'Custom Project',
      subtitle: `${customWidth} × ${customHeight}"`,
      category: 'other',
      sheetWidthIn: customWidth,
      sheetHeightIn: customHeight,
      orientation: customWidth > customHeight ? 'landscape' : 'portrait',
      defaultBleedIn: 0,
      defaultMarginXIn: 0.25,
      defaultMarginYIn: 0.25,
      imposition: customIsMultiUp
        ? {
            cols: customCols,
            rows: customRows,
            unitWidthIn: customUnitW,
            unitHeightIn: customUnitH,
            marginLeftIn: marginLeft,
            marginTopIn: marginTop,
            gapXIn: 0,
            gapYIn: 0,
          }
        : undefined,
    };
    setShowCustomModal(false);
    onCreateCustomTemplate(newTpl);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f4f5f7]">
      {/* Left Sidebar (Matches Photo 2: Templates | Quick Import + Filters) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="flex border-b border-slate-200 px-4 pt-3 gap-5">
          <button
            onClick={() => setSidebarTab('templates')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              sidebarTab === 'templates'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setSidebarTab('quick-import')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1 ${
              sidebarTab === 'quick-import'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-red-600" />
            Quick Import
          </button>
        </div>

        {sidebarTab === 'templates' ? (
          <div className="p-4 flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-2">Filters</h3>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                <span className="font-medium">Copy & Print Products</span>
                <span className="text-[10px] bg-red-50 text-red-700 font-semibold px-1.5 py-0.5 rounded">
                  AI Enabled
                </span>
              </div>

              <div className="flex flex-col gap-1 mt-2">
                {[
                  {
                    id: 'all',
                    label: `All Print Templates (${
                      PRINT_TEMPLATES.length + savedCustomTemplates.length
                    })`,
                  },
                  {
                    id: 'saved',
                    label: `★ My Saved Templates (${savedCustomTemplates.length})`,
                  },
                  { id: 'bcard', label: 'Business Cards & Multi-Up' },
                  { id: 'standard', label: 'Standard Sheet Sizes' },
                  { id: 'booklet', label: 'Saddle-Stitch Booklets' },
                  { id: 'tabs', label: 'Bank Tabs & Envelopes' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                      activeFilter === f.id
                        ? 'bg-red-50 text-red-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Scan & AI Designer Promo Cards inside Left Sidebar */}
            <div className="mt-1 p-3.5 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-amber-300" />
                AI Print Designer (From Scratch)
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Describe what you want designed and let AI build the full graphic OR editable text boxes, shapes & layout!
              </p>
              <button
                onClick={() => onOpenAIDesignerModal(PRINT_TEMPLATES[8])}
                className="mt-2.5 w-full bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold py-2 px-3 rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Launch AI Designer
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white shadow-md">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Camera className="w-4 h-4 text-amber-300" />
                AI Business Card Photo Remix
              </div>
              <p className="text-[11px] text-red-100 mt-1 leading-relaxed">
                Have a photo of an existing card? Upload it, type the edits you want, and open in PrintStudio!
              </p>
              <button
                onClick={() => onOpenAIScanModal(PRINT_TEMPLATES[8])}
                className="mt-2.5 w-full bg-white text-red-700 hover:bg-red-50 text-xs font-bold py-2 px-3 rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Scan & Edit Card Photo
              </button>
            </div>

            {onOpenFileLocker && (
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-md border border-indigo-400/20">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <LayoutGrid className="w-4 h-4 text-amber-300" />
                  File Locker &amp; Photo Upper
                </div>
                <p className="text-[11px] text-indigo-100 mt-1 leading-relaxed">
                  Store PDFs, docs &amp; photos. Auto-gang 4×6, 5×7, 8×10, 11×14 &amp; posters onto 18×24 or 24×36 sheets!
                </p>
                <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                  <button
                    onClick={() => onOpenFileLocker('locker')}
                    className="bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer border border-white/20"
                  >
                    <FolderOpen className="w-3 h-3 text-amber-300" />
                    File Locker
                  </button>
                  <button
                    onClick={() => onOpenFileLocker('photo-nup')}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold py-1.5 px-2 rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3 h-3" />
                    Photo Upper
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-800">
              Quick Import — PDF, Word & Design Files
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Import a PDF, Word (.docx), SVG, or image file to impose as a foldable Booklet, 10-Up / 4-Up Multi-Up Sheet, or standard print job.
            </p>
            <button
              onClick={onOpenQuickImportModal}
              className="w-full py-5 px-3 border-2 border-dashed border-red-400 bg-red-50/70 hover:bg-red-50 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer"
            >
              <Upload className="w-6 h-6 text-red-600" />
              <span className="text-xs font-bold text-red-700">
                Import PDF / Word Doc / Design File
              </span>
              <span className="text-[10px] text-slate-500">
                Set up as Booklet, Multi-Up (10-Up/4-Up), or Full Sheet
              </span>
            </button>

            <button
              onClick={() => onOpenAIScanModal(PRINT_TEMPLATES[8])}
              className="w-full py-4 px-3 border border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer"
            >
              <Camera className="w-5 h-5 text-slate-700" />
              <span className="text-xs font-bold text-slate-800">
                Upload Card Photo for AI Changes
              </span>
              <span className="text-[10px] text-slate-500">
                JPG, PNG, WebP • Auto-flattens & extracts layers
              </span>
            </button>

            <label className="w-full py-2.5 px-3 border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 transition cursor-pointer">
              <FolderOpen className="w-4 h-4 text-slate-500" />
              Open Saved Project (.json)
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportProjectJson(file);
                }}
                className="hidden"
              />
            </label>
          </div>
        )}
      </aside>

      {/* Main Template Gallery Area (Matches Photo 2) */}
      <main className="flex-1 overflow-y-auto p-7">
        {/* Top Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              Start new document
            </h1>
            <p className="text-xs text-slate-500">
              Choose a standard print sheet, booklet, or multi-up business card template — or scan & edit an existing card with AI
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenFileLocker && (
              <>
                <button
                  onClick={() => onOpenFileLocker('locker')}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-sm transition cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-300" />
                  File Locker (PDFs / Docs / Photos)
                </button>
                <button
                  onClick={() => onOpenFileLocker('photo-nup')}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-sm transition cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
                  Photo Upper (4×6, 5×7, 8×10, 11×14, 18×24, 24×36)
                </button>
              </>
            )}

            <button
              onClick={() => onOpenAIDesignerModal(PRINT_TEMPLATES[8])}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-extrabold px-4 py-2 rounded-full shadow-sm transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Designer (Describe & Create)
            </button>

            <button
              onClick={() => onOpenAIScanModal(PRINT_TEMPLATES[8])}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold px-4 py-2 rounded-full shadow-sm transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              AI Scan & Edit Card Photo
            </button>

            <button
              onClick={onOpenQuickImportModal}
              className="flex items-center gap-1.5 bg-[#cc0000] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Quick Import (PDF / Word / Booklet)
            </button>

            <button
              onClick={() => setShowCustomModal(true)}
              className="flex items-center gap-1.5 bg-[#cc0000] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Custom Project
            </button>

            <button
              onClick={onOpenQuickImportModal}
              className="flex items-center gap-1.5 bg-[#cc0000] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Create Booklet
            </button>

            <label className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3.5 py-2 rounded-full shadow-2xs transition cursor-pointer">
              <FolderOpen className="w-3.5 h-3.5" />
              Open
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportProjectJson(file);
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* MY SAVED SHOP TEMPLATES (Saved from Studio Properties Panel) */}
        {(savedCustomTemplates.length > 0 || activeFilter === 'saved') && (
          <div className="mb-9">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-red-600" />
                <h2 className="text-base font-bold text-slate-800">
                  My Saved Templates (Saved from Properties)
                </h2>
                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                  {savedCustomTemplates.length} Saved
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Includes saved Multi-Up spacing, margins, numbering &amp; mail
                merge setups
              </span>
            </div>

            {savedCustomTemplates.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                No custom templates saved yet. Open any project in the Studio,
                configure your Multi-Up spacing, margins, numbering, or mail
                merge in the right <strong>Properties</strong> panel, and click{' '}
                <strong>&quot;Save Setup as Template&quot;</strong>!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {savedCustomTemplates.map((tpl) => {
                  const hasSavedDesign =
                    (tpl.savedSetup?.masters?.['master-a']?.elements?.length ||
                      0) > 0;
                  const hasNumbering = Boolean(
                    tpl.savedSetup?.numbering?.enabled
                  );
                  const hasMailMerge = Boolean(
                    tpl.savedSetup?.mailMerge?.enabled &&
                      (tpl.savedSetup?.mailMerge?.records?.length || 0) > 0
                  );

                  return (
                    <div
                      key={tpl.id}
                      className="bg-white rounded-lg border-2 border-red-500/80 shadow-sm hover:shadow-md transition p-3.5 flex flex-col justify-between relative"
                    >
                      {/* Schematic Preview Box */}
                      <div className="h-32 bg-[#f1f3f5] rounded-md flex items-center justify-center relative p-4 mb-3">
                        <span className="absolute top-2 left-2 bg-[#cc0000] text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                          <BookmarkCheck className="w-2.5 h-2.5" />
                          {tpl.badge || 'SAVED PRESET'}
                        </span>

                        {onDeleteSavedTemplate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSavedTemplate(tpl.id);
                            }}
                            className="absolute top-2 right-2 p-1 rounded bg-white/90 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 cursor-pointer"
                            title="Delete Saved Template"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}

                        <div
                          style={{
                            aspectRatio: `${tpl.sheetWidthIn} / ${tpl.sheetHeightIn}`,
                          }}
                          className={`${
                            tpl.sheetWidthIn > tpl.sheetHeightIn
                              ? 'w-24'
                              : 'h-20'
                          } bg-white border border-red-500 shadow-2xs flex items-center justify-center p-1`}
                        >
                          {tpl.imposition && (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${tpl.imposition.cols}, minmax(0, 1fr))`,
                                gridTemplateRows: `repeat(${tpl.imposition.rows}, minmax(0, 1fr))`,
                                gap:
                                  tpl.imposition.gapXIn > 0 ||
                                  tpl.imposition.gapYIn > 0
                                    ? '2px'
                                    : '0px',
                              }}
                              className="w-full h-full border border-emerald-500/60 divide-x divide-y divide-emerald-500/40"
                            >
                              {Array.from({
                                length:
                                  tpl.imposition.cols * tpl.imposition.rows,
                              }).map((_, i) => (
                                <div
                                  key={i}
                                  className="bg-emerald-50/40 border border-emerald-500/30"
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Feature chips at bottom of preview */}
                        <div className="absolute bottom-1.5 left-2 right-2 flex items-center gap-1 flex-wrap">
                          {tpl.imposition && (
                            <span className="text-[8px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                              {tpl.imposition.cols}×{tpl.imposition.rows} (
                              {tpl.imposition.cols * tpl.imposition.rows}-Up)
                            </span>
                          )}
                          {hasNumbering && (
                            <span className="text-[8px] font-bold bg-red-100 text-red-800 px-1.5 py-0.2 rounded">
                              # Numbered
                            </span>
                          )}
                          {hasMailMerge && (
                            <span className="text-[8px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">
                              ✉ Mail Merge
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {tpl.name}
                        </div>
                        <div className="text-[10px] text-slate-500 mb-2.5 line-clamp-2">
                          {tpl.subtitle}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => onSelectTemplate(tpl, false)}
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[11px] font-semibold py-1.5 rounded transition cursor-pointer"
                            title="Open saved Properties setup (sheet, margins, multi-up spacing, numbering) with a blank canvas"
                          >
                            Blank Setup
                          </button>
                          <button
                            onClick={() => onSelectTemplate(tpl, true)}
                            className="bg-[#cc0000] hover:bg-red-700 text-white text-[11px] font-semibold py-1.5 rounded transition cursor-pointer"
                            title={
                              hasSavedDesign
                                ? 'Open saved Properties setup WITH saved design layers'
                                : 'Open saved template'
                            }
                          >
                            {hasSavedDesign ? 'Open Saved' : 'Open'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Top Row: Start new document cards */}
        {topTemplates.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-9">
            {topTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white rounded-lg border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition p-3.5 flex flex-col justify-between"
              >
                {/* Gray preview box with red outline icon */}
                <div className="h-32 bg-[#f1f3f5] rounded-md flex items-center justify-center relative p-4 mb-3">
                  {tpl.badge && (
                    <span className="absolute top-2 left-2 bg-[#cc0000] text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <BookOpen className="w-2.5 h-2.5" />
                      {tpl.badge}
                    </span>
                  )}

                  {tpl.isBooklet ? (
                    <div className="w-24 h-16 bg-white border border-red-500 flex">
                      <div className="flex-1 border-r border-dashed border-red-400" />
                      <div className="flex-1" />
                    </div>
                  ) : (
                    <div
                      style={{
                        aspectRatio: `${tpl.sheetWidthIn} / ${tpl.sheetHeightIn}`,
                      }}
                      className="h-20 bg-white border border-red-500 shadow-2xs"
                    />
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-800 mb-2.5">
                    {tpl.name}
                  </div>
                  <button
                    onClick={() => onSelectTemplate(tpl, false)}
                    className="w-full bg-[#cc0000] hover:bg-red-700 text-white text-xs font-semibold py-1.5 rounded transition cursor-pointer"
                  >
                    Create
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Section: Other templates (3 Bank Tabs, 5 Bank Tabs, Business Card - 10up, Business Card - Single, Envelope Printing, etc.) */}
        <h2 className="text-base font-bold text-slate-800 mb-4">
          Other templates
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {otherTemplates.map((tpl) => {
            const isBCard = tpl.id.includes('bcard');
            return (
              <div
                key={tpl.id}
                className={`bg-white rounded-lg border transition p-3.5 flex flex-col justify-between ${
                  tpl.id === 'bcard-10up'
                    ? 'border-red-400 ring-1 ring-red-400/40 shadow-sm'
                    : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {/* Schematic Preview Box */}
                <div className="h-32 bg-[#f1f3f5] rounded-md flex items-center justify-center relative p-4 mb-3">
                  {isBCard && (
                    <button
                      onClick={() => onOpenAIScanModal(tpl)}
                      className="absolute top-2 right-2 bg-amber-400/90 hover:bg-amber-400 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="Upload & edit a card photo directly into this template"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      AI Scan
                    </button>
                  )}

                  {tpl.bankTabs ? (
                    <div className="h-20 w-16 bg-white border border-red-500 relative flex">
                      <div className="flex-1" />
                      <div className="w-2 flex flex-col justify-between py-0.5 -mr-2">
                        {Array.from({ length: tpl.bankTabs }).map((_, idx) => (
                          <div
                            key={idx}
                            className="flex-1 my-0.5 bg-white border border-l-0 border-red-500 rounded-r-xs"
                          />
                        ))}
                      </div>
                    </div>
                  ) : tpl.sheetWidthIn > tpl.sheetHeightIn ? (
                    <div className="w-24 h-14 bg-white border border-red-500 shadow-2xs" />
                  ) : (
                    <div className="h-20 w-16 bg-white border border-red-500 shadow-2xs flex items-center justify-center">
                      {tpl.imposition && (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${tpl.imposition.cols}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${tpl.imposition.rows}, minmax(0, 1fr))`,
                          }}
                          className="w-12 h-16 border border-emerald-500/50 divide-x divide-y divide-emerald-500/40"
                        >
                          {Array.from({
                            length: tpl.imposition.cols * tpl.imposition.rows,
                          }).map((_, i) => (
                            <div key={i} className="bg-emerald-50/30" />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {tpl.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mb-3">
                    {tpl.subtitle}
                  </div>

                  {/* Matches Photo 2: "Custom" (white outline) + "Open" (red button) */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onSelectTemplate(tpl, false)}
                      className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold py-1.5 rounded transition cursor-pointer"
                      title="Open blank custom canvas with grid guides"
                    >
                      Custom
                    </button>
                    <button
                      onClick={() => onSelectTemplate(tpl, true)}
                      className="bg-[#cc0000] hover:bg-red-700 text-white text-xs font-semibold py-1.5 rounded transition cursor-pointer"
                      title="Open with starter editable business card design"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Custom Project Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateCustom}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
          >
            <div className="bg-[#cc0000] text-white px-5 py-3.5 font-bold text-sm flex items-center justify-between">
              <span>Create Custom Print Project</span>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Project / Template Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Sheet Width (in)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Sheet Height (in)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 font-semibold text-slate-800 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customIsMultiUp}
                  onChange={(e) => setCustomIsMultiUp(e.target.checked)}
                  className="rounded text-red-600"
                />
                Enable Multi-Up Grid Duplication (Master A → N-Up Slots)
              </label>

              {customIsMultiUp && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <label className="text-slate-600 block mb-1">Columns</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={customCols}
                      onChange={(e) => setCustomCols(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded bg-white px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">Rows</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={customRows}
                      onChange={(e) => setCustomRows(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded bg-white px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">
                      Card Width (in)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      value={customUnitW}
                      onChange={(e) => setCustomUnitW(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded bg-white px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">
                      Card Height (in)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      value={customUnitH}
                      onChange={(e) => setCustomUnitH(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded bg-white px-2.5 py-1.5"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#cc0000] text-white font-bold cursor-pointer"
                >
                  Create Project
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
