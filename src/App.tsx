import React, { useState } from 'react';
import {
  Check,
  Copy,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  Save,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  CanvasElement,
  MasterDesign,
  PrintProject,
  PrintTemplate,
} from './types/printstudio';
import {
  PRINT_TEMPLATES,
  adaptDesignToTemplate,
  createDefaultBankTabConfig,
  createInitialProject,
  getDesignUnitSize,
  loadSavedCustomTemplates,
  saveCustomTemplatesToStorage,
} from './data/templates';
import { TemplateDashboard } from './components/TemplateDashboard';
import { StudioEditor } from './components/StudioEditor';
import { AIScanModal } from './components/AIScanModal';
import { AIDesignerModal } from './components/AIDesignerModal';
import { QuickImportModal } from './components/QuickImportModal';
import { MultiTemplateModal } from './components/MultiTemplateModal';
import { FileLockerAndPhotoNUpModal } from './components/FileLockerAndPhotoNUpModal';
import { getStoredApiKey, setStoredApiKey } from './services/geminiService';

export function App() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [project, setProject] = useState<PrintProject>(() =>
    createInitialProject(PRINT_TEMPLATES[8], false)
  );
  const [history, setHistory] = useState<PrintProject[]>([]);
  const [redoStack, setRedoStack] = useState<PrintProject[]>([]);

  const [isAIScanOpen, setIsAIScanOpen] = useState<boolean>(false);
  const [isAIDesignerOpen, setIsAIDesignerOpen] = useState<boolean>(false);
  const [isQuickImportOpen, setIsQuickImportOpen] = useState<boolean>(false);
  const [isMultiTemplateOpen, setIsMultiTemplateOpen] = useState<boolean>(false);
  const [isFileLockerOpen, setIsFileLockerOpen] = useState<boolean>(false);
  const [fileLockerInitialTab, setFileLockerInitialTab] = useState<
    'locker' | 'photo-nup'
  >('locker');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getStoredApiKey());
  const [aiBannerMessage, setAiBannerMessage] = useState<string | null>(null);
  const [savedCustomTemplates, setSavedCustomTemplates] = useState<
    PrintTemplate[]
  >(() => loadSavedCustomTemplates());

  const handleSaveCustomTemplate = (newTpl: PrintTemplate) => {
    setSavedCustomTemplates((prev) => {
      const updated = [newTpl, ...prev.filter((t) => t.id !== newTpl.id)];
      saveCustomTemplatesToStorage(updated);
      return updated;
    });
  };

  const handleDeleteCustomTemplate = (templateId: string) => {
    setSavedCustomTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== templateId);
      saveCustomTemplatesToStorage(updated);
      return updated;
    });
  };

  const handleUpdateProject = (updater: (prev: PrintProject) => PrintProject) => {
    setProject((prev) => {
      const next = updater(prev);
      setHistory((h) => [...h.slice(-24), prev]);
      setRedoStack([]);
      return next;
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRedoStack((r) => [project, ...r]);
    setProject(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((r) => r.slice(1));
    setHistory((h) => [...h, project]);
    setProject(next);
  };

  const handleSelectTemplateFromDashboard = (
    tpl: PrintTemplate,
    loadStarterDesign: boolean
  ) => {
    // If this is a user-saved template from Properties, restore its exact saved setup (and optionally its saved design)!
    if (tpl.isCustomSaved && tpl.savedSetup) {
      const nextProj = createInitialProject(tpl, !loadStarterDesign);
      setProject(nextProj);
      setHistory([]);
      setRedoStack([]);
      setView('editor');
      return;
    }

    // If we already have a custom/AI design in memory and user clicks "Open", adapt it to the new template size!
    const hasExistingLayers = project.masters['master-a'].elements.length > 0;
    if (loadStarterDesign && hasExistingLayers) {
      handleSwitchTemplateWithAdaptation(tpl);
    } else {
      const nextProj = createInitialProject(tpl, !loadStarterDesign);
      setProject(nextProj);
      setHistory([]);
      setRedoStack([]);
    }
    setView('editor');
  };

  const handleSwitchTemplateWithAdaptation = (targetTemplate: PrintTemplate) => {
    const { widthIn: curW, heightIn: curH } = getDesignUnitSize(project.template);
    const adaptedFront = adaptDesignToTemplate(
      project.masters['master-a'],
      curW,
      curH,
      targetTemplate
    );
    const adaptedBack = adaptDesignToTemplate(
      project.masters['master-b'],
      curW,
      curH,
      targetTemplate
    );

    handleUpdateProject((prev) => ({
      ...prev,
      title: `${targetTemplate.name}  Custom`,
      template: targetTemplate,
      bleedIn: targetTemplate.defaultBleedIn,
      marginXIn: targetTemplate.defaultMarginXIn,
      marginYIn: targetTemplate.defaultMarginYIn,
      bankTabConfig: targetTemplate.savedSetup?.bankTabConfig
        ? JSON.parse(JSON.stringify(targetTemplate.savedSetup.bankTabConfig))
        : targetTemplate.bankTabs
        ? createDefaultBankTabConfig(targetTemplate.bankTabs)
        : prev.bankTabConfig
        ? { ...prev.bankTabConfig, enabled: false }
        : undefined,
      masters: {
        'master-a': adaptedFront,
        'master-b': adaptedBack,
      },
    }));
    setView('editor');
  };

  const handleApplyAIResultToStudio = (params: {
    frontMaster: MasterDesign;
    backMaster?: MasterDesign;
    selectedTemplate: PrintTemplate;
    aiSummary: string;
  }) => {
    const { frontMaster, backMaster, selectedTemplate, aiSummary } = params;
    const nextProj = createInitialProject(selectedTemplate, false);
    nextProj.masters['master-a'] = frontMaster;
    if (backMaster) {
      nextProj.masters['master-b'] = backMaster;
    }
    setHistory((h) => [...h.slice(-24), project]);
    setProject(nextProj);
    setAiBannerMessage(aiSummary);
    setView('editor');
  };

  const handleSaveProjectJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}.printstudio.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProjectJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PrintProject;
        if (parsed && parsed.template && parsed.masters) {
          setProject(parsed);
          setView('editor');
        }
      } catch (e) {
        console.error('Invalid project JSON', e);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredApiKey(apiKeyInput);
    setIsApiKeyModalOpen(false);
  };

  const hasApiKey = Boolean(getStoredApiKey());

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none">
      {/* TOP RED BRAND BAR (Matches Photo 1 & 2: "[Π] Geppy's PrintStudio v1.0.1") */}
      <header className="h-11 bg-[#cc0000] text-white px-4 flex items-center justify-between shadow-sm shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center gap-2 hover:opacity-90 transition cursor-pointer"
          >
            {/* Official Geppy Stamp Asset */}
            <img 
              src="/geppystampwhite.png" 
              alt="Geppy Logo" 
              className="w-8 h-8 object-contain"
            />
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold text-sm tracking-tight">
                Geppy&apos;s
              </span>
              <span className="font-semibold text-sm">PrintStudio</span>
              <span className="text-[10px] text-red-200 font-medium ml-0.5">
                v1.0.1
              </span>
            </div>
          </button>

          <div className="h-4 w-px bg-white/25 mx-1" />

          {/* View Switcher Pill */}
          <div className="flex items-center bg-black/20 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setView('dashboard')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                view === 'dashboard'
                  ? 'bg-white text-[#cc0000] shadow-2xs'
                  : 'text-red-100 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Templates
            </button>
            <button
              onClick={() => setView('editor')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                view === 'editor'
                  ? 'bg-white text-[#cc0000] shadow-2xs'
                  : 'text-red-100 hover:text-white'
              }`}
            >
              Design Studio ({project.template.name})
            </button>
          </div>
        </div>

        {/* Right Header Actions — Streamlined to avoid toolbar clutter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFileLockerInitialTab('locker');
              setIsFileLockerOpen(true);
            }}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold px-2.5 py-1.5 rounded-md transition border border-white/25 cursor-pointer"
            title="Open File Locker Gallery (Images, PDFs, Documents & Projects)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-300" />
            File Locker
          </button>

          <button
            onClick={() => {
              setFileLockerInitialTab('photo-nup');
              setIsFileLockerOpen(true);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold px-2.5 py-1.5 rounded-md shadow-xs transition border border-indigo-300/40 cursor-pointer"
            title="Open Photo Upper & Poster Gang Sheet (4×6, 5×7, 8×10, 11×14, 18×24, 24×36)"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
            Photo Upper
          </button>

          {view === 'dashboard' && (
            <>
              <button
                onClick={() => setIsAIDesignerOpen(true)}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-extrabold px-3 py-1.5 rounded-md shadow-xs transition cursor-pointer border border-white/15"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Designer
              </button>

              <button
                onClick={() => setIsAIScanOpen(true)}
                className="flex items-center gap-1.5 bg-amber-300 hover:bg-amber-200 text-slate-950 text-xs font-extrabold px-3 py-1.5 rounded-md shadow-xs transition cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5 text-red-700" />
                Scan & Edit Card Photo
              </button>

              <button
                onClick={() => setIsQuickImportOpen(true)}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-md transition border border-white/20 cursor-pointer"
                title="Import PDF, Word Doc, or Design File for Booklet / Multi-Up Setup"
              >
                <Upload className="w-3.5 h-3.5 text-amber-300" />
                Quick Import (PDF / Doc)
              </button>
            </>
          )}

          <button
            onClick={handleSaveProjectJson}
            className="flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-2.5 py-1.5 rounded-md transition cursor-pointer"
            title="Save project file (.json)"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>

          <button
            onClick={() => {
              setApiKeyInput(getStoredApiKey());
              setIsApiKeyModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-black/25 hover:bg-black/35 text-white text-xs font-medium px-2.5 py-1.5 rounded-md transition cursor-pointer"
            title="Configure Google Gemini API Key"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">
              {hasApiKey ? 'Gemini Key Active' : 'Gemini API Key'}
            </span>
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      {view === 'dashboard' ? (
        <TemplateDashboard
          onSelectTemplate={handleSelectTemplateFromDashboard}
          onOpenAIScanModal={(tpl) => {
            if (tpl) {
              handleSwitchTemplateWithAdaptation(tpl);
            }
            setIsAIScanOpen(true);
          }}
          onOpenAIDesignerModal={(tpl) => {
            if (tpl) {
              handleSwitchTemplateWithAdaptation(tpl);
            }
            setIsAIDesignerOpen(true);
          }}
          onOpenQuickImportModal={() => setIsQuickImportOpen(true)}
          onOpenFileLocker={(tab = 'locker') => {
            setFileLockerInitialTab(tab);
            setIsFileLockerOpen(true);
          }}
          onCreateCustomTemplate={(customTpl) => {
            handleSaveCustomTemplate({ ...customTpl, isCustomSaved: true });
            handleSwitchTemplateWithAdaptation(customTpl);
          }}
          onImportProjectJson={handleImportProjectJson}
          savedCustomTemplates={savedCustomTemplates}
          onDeleteSavedTemplate={handleDeleteCustomTemplate}
        />
      ) : (
        <StudioEditor
          project={project}
          onUpdateProject={handleUpdateProject}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={history.length > 0}
          canRedo={redoStack.length > 0}
          onBackToDashboard={() => setView('dashboard')}
          onOpenAIScanModal={() => setIsAIScanOpen(true)}
          onOpenAIDesignerModal={() => setIsAIDesignerOpen(true)}
          onOpenQuickImportModal={() => setIsQuickImportOpen(true)}
          onOpenMultiTemplateModal={() => setIsMultiTemplateOpen(true)}
          onOpenFileLocker={(tab = 'locker') => {
            setFileLockerInitialTab(tab);
            setIsFileLockerOpen(true);
          }}
          onSwitchTemplateWithAdaptation={handleSwitchTemplateWithAdaptation}
          onSaveProjectJson={handleSaveProjectJson}
          onImportProjectJson={handleImportProjectJson}
          onSaveCurrentAsTemplate={handleSaveCustomTemplate}
          aiBannerMessage={aiBannerMessage}
          onDismissAiBanner={() => setAiBannerMessage(null)}
        />
      )}

      {/* FILE LOCKER GALLERY & AUTO PHOTO N-UPPER / POSTER GANG-SHEET STUDIO MODAL */}
      <FileLockerAndPhotoNUpModal
        isOpen={isFileLockerOpen}
        onClose={() => setIsFileLockerOpen(false)}
        initialTab={fileLockerInitialTab}
        onOpenGeneratedProject={(generatedProj: PrintProject) => {
          setHistory((h) => [...h.slice(-24), project]);
          setProject(generatedProj);
          setAiBannerMessage(
            `Opened "${generatedProj.title}" (${generatedProj.pages.length} print-ready sheet${
              generatedProj.pages.length > 1 ? 's' : ''
            }) in Studio Editor`
          );
          setView('editor');
        }}
        onInsertImageIntoCurrentCanvas={(imageUrl: string, name: string) => {
          const { widthIn: unitW, heightIn: unitH } = getDesignUnitSize(
            project.template
          );
          const targetW = Number(Math.min(unitW * 0.55, 6).toFixed(3));
          const targetH = Number(Math.min(unitH * 0.55, 6).toFixed(3));
          const newImgEl: CanvasElement = {
            id: `locker-img-${Date.now()}`,
            type: 'image',
            role: 'logo',
            name: name.slice(0, 28),
            x: Number(Math.max(0.05, (unitW - targetW) / 2).toFixed(3)),
            y: Number(Math.max(0.05, (unitH - targetH) / 2).toFixed(3)),
            width: targetW,
            height: targetH,
            rotation: 0,
            opacity: 1,
            imageUrl,
          };
          handleUpdateProject((prev) => ({
            ...prev,
            masters: {
              ...prev.masters,
              'master-a': {
                ...prev.masters['master-a'],
                elements: [...prev.masters['master-a'].elements, newImgEl],
              },
            },
          }));
          setView('editor');
        }}
      />

      {/* QUICK IMPORT PDF / WORD / DESIGN FILE MODAL */}
      <QuickImportModal
        isOpen={isQuickImportOpen}
        onClose={() => setIsQuickImportOpen(false)}
        currentTemplate={project.template}
        onApplyImportedProject={(importedProj, summary) => {
          setHistory((h) => [...h.slice(-24), project]);
          setProject(importedProj);
          setAiBannerMessage(summary);
          setView('editor');
        }}
      />

      {/* AI DESIGNER FROM SCRATCH MODAL */}
      <AIDesignerModal
        isOpen={isAIDesignerOpen}
        onClose={() => setIsAIDesignerOpen(false)}
        currentTemplate={project.template}
        onApplyToStudio={handleApplyAIResultToStudio}
      />

      {/* AI SCAN, PERSPECTIVE CLEANUP & EDIT MODAL */}
      <AIScanModal
        isOpen={isAIScanOpen}
        onClose={() => setIsAIScanOpen(false)}
        currentTemplate={project.template}
        onApplyToStudio={handleApplyAIResultToStudio}
        onOpenApiKeySettings={() => {
          setApiKeyInput(getStoredApiKey());
          setIsApiKeyModalOpen(true);
        }}
      />

      {/* DUPLICATE ACROSS ALL TEMPLATE SIZES MODAL */}
      <MultiTemplateModal
        isOpen={isMultiTemplateOpen}
        onClose={() => setIsMultiTemplateOpen(false)}
        project={project}
        onSwitchTemplateWithAdaptation={handleSwitchTemplateWithAdaptation}
      />

      {/* GEMINI API KEY SETTINGS MODAL */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4">
          <form
            onSubmit={handleSaveApiKey}
            className="bg-slate-900/60 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-md overflow-hidden"
          >
            <div className="bg-[#cc0000] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-amber-300" />
                Google Gemini API Configuration
              </div>
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3 text-xs text-slate-300">
              <p className="leading-relaxed">
                Enter your <strong>Google Gemini API Key</strong> to enable live multimodal vision reconstruction (<code className="bg-white/10 px-1 rounded text-amber-300">gemini-2.5-flash</code>) for any uploaded business card photo.
              </p>
              <p className="text-[11px] bg-amber-400/10 border border-amber-400/30 text-amber-200 p-2.5 rounded-lg">
                <strong>Note:</strong> Even without an API key, Geppy&apos;s PrintStudio includes a built-in smart prompt parser &amp; perspective scanner so you can test the entire workflow immediately!
              </p>
              <div>
                <label className="font-bold text-white block mb-1">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-red-600 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInput('');
                    setStoredApiKey('');
                    setIsApiKeyModalOpen(false);
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-700 font-semibold text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Clear Key
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#cc0000] hover:bg-red-700 text-white font-bold cursor-pointer shadow-lg shadow-red-900/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save API Key
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
export default App;
