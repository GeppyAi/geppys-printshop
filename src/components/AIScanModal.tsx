import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Crop,
  Image as ImageIcon,
  Layers,
  Loader2,
  Sparkles,
  Sun,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  CornerPoint,
  MasterDesign,
  PrintTemplate,
} from '../types/printstudio';
import {
  PRINT_TEMPLATES,
  getDesignUnitSize,
} from '../data/templates';
import {
  processCardPhoto,
  SAMPLE_BUSINESS_CARD_PHOTOS,
  SamplePhotoPreset,
} from '../utils/imageProcessing';
import {
  analyzeAndEditCardWithGemini,
  GenerationMode,
  getStoredApiKey,
} from '../services/geminiService';

interface AIScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplate: PrintTemplate;
  onApplyToStudio: (params: {
    frontMaster: MasterDesign;
    backMaster?: MasterDesign;
    selectedTemplate: PrintTemplate;
    aiSummary: string;
  }) => void;
  onOpenApiKeySettings: () => void;
}

export const AIScanModal: React.FC<AIScanModalProps> = ({
  isOpen,
  onClose,
  currentTemplate,
  onApplyToStudio,
  onOpenApiKeySettings,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<SamplePhotoPreset | undefined>(
    SAMPLE_BUSINESS_CARD_PHOTOS[0]
  );
  const [rawImageSrc, setRawImageSrc] = useState<string>('');
  const [cleanedImageSrc, setCleanedImageSrc] = useState<string>('');
  const [corners, setCorners] = useState<
    [CornerPoint, CornerPoint, CornerPoint, CornerPoint]
  >(SAMPLE_BUSINESS_CARD_PHOTOS[0].defaultCorners);
  const [enhanceLighting, setEnhanceLighting] = useState<boolean>(true);
  const [contrastBoost, setContrastBoost] = useState<number>(22);
  const [draggingCornerIdx, setDraggingCornerIdx] = useState<number | null>(null);

  const [prompt, setPrompt] = useState<string>(
    SAMPLE_BUSINESS_CARD_PHOTOS[0].suggestedPrompt
  );
  const [mode, setMode] = useState<GenerationMode>('hybrid');
  const [targetTemplateId, setTargetTemplateId] = useState<string>(
    currentTemplate.id || 'bcard-10up'
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<'original' | 'flattened'>('original');

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize first sample photo on mount
  useEffect(() => {
    if (isOpen && !rawImageSrc) {
      const sample = SAMPLE_BUSINESS_CARD_PHOTOS[0];
      const url = sample.generateDataUrl();
      setRawImageSrc(url);
      setCorners(sample.defaultCorners);
      setPrompt(sample.suggestedPrompt);
    }
  }, [isOpen, rawImageSrc]);

  useEffect(() => {
    setTargetTemplateId(currentTemplate.id);
  }, [currentTemplate.id]);

  // Run perspective warp + lighting enhancement whenever rawImageSrc, corners, or lighting settings change
  useEffect(() => {
    if (!rawImageSrc) return;
    let cancelled = false;
    processCardPhoto(rawImageSrc, {
      corners,
      enhanceLighting,
      contrastBoost,
      brightnessBoost: 10,
    })
      .then((res) => {
        if (!cancelled) setCleanedImageSrc(res);
      })
      .catch(() => {
        if (!cancelled) setCleanedImageSrc(rawImageSrc);
      });
    return () => {
      cancelled = true;
    };
  }, [rawImageSrc, corners, enhanceLighting, contrastBoost]);

  if (!isOpen) return null;

  const handleSelectSample = (sample: SamplePhotoPreset) => {
    setSelectedPreset(sample);
    const dataUrl = sample.generateDataUrl();
    setRawImageSrc(dataUrl);
    setCorners(sample.defaultCorners);
    setPrompt(sample.suggestedPrompt);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedPreset(undefined);
        setRawImageSrc(reader.result);
        setCorners([
          { x: 0.05, y: 0.05 },
          { x: 0.95, y: 0.05 },
          { x: 0.95, y: 0.95 },
          { x: 0.05, y: 0.95 },
        ]);
        setPrompt(
          'Reconstruct this business card into editable layers, keep the layout clean, and update the contact details.'
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingCornerIdx === null || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const nx = Math.min(0.98, Math.max(0.02, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(0.98, Math.max(0.02, (e.clientY - rect.top) / rect.height));
    setCorners((prev) => {
      const next = [...prev] as [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
      next[draggingCornerIdx] = { x: Number(nx.toFixed(3)), y: Number(ny.toFixed(3)) };
      return next;
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const targetTemplate =
        PRINT_TEMPLATES.find((t) => t.id === targetTemplateId) || currentTemplate;
      const { widthIn, heightIn } = getDesignUnitSize(targetTemplate);

      const result = await analyzeAndEditCardWithGemini({
        cleanedImageDataUrl: cleanedImageSrc || rawImageSrc,
        userPrompt: prompt,
        mode,
        unitWidthIn: widthIn,
        unitHeightIn: heightIn,
        presetHint: selectedPreset,
      });

      const frontMaster: MasterDesign = {
        id: 'master-a',
        name: 'Master A (Front)',
        backgroundColor: result.frontDesign.backgroundColor,
        backgroundImage: result.frontDesign.backgroundImage,
        elements: result.frontDesign.elements.map((el, idx) => ({
          ...el,
          id: `ai-front-${Date.now()}-${idx}`,
        })),
      };

      const backMaster: MasterDesign | undefined = result.backDesign
        ? {
            id: 'master-b',
            name: 'Master B (Back)',
            backgroundColor: result.backDesign.backgroundColor,
            backgroundImage: result.backDesign.backgroundImage,
            elements: result.backDesign.elements.map((el, idx) => ({
              ...el,
              id: `ai-back-${Date.now()}-${idx}`,
            })),
          }
        : undefined;

      onApplyToStudio({
        frontMaster,
        backMaster,
        selectedTemplate: targetTemplate,
        aiSummary: result.summary,
      });
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  const hasApiKey = Boolean(getStoredApiKey());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="bg-[#cc0000] text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                AI Business Card Scan, Edit & Imposition Studio
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  Hybrid Vision + Layer Reconstruction
                </span>
              </h2>
              <p className="text-xs text-red-100">
                Upload a photo of any business card or document, flatten perspective, type how you want it changed, and open in the full design studio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenApiKeySettings}
              className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 border border-white/20"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  hasApiKey ? 'bg-emerald-400' : 'bg-amber-300'
                }`}
              />
              {hasApiKey ? 'Gemini API Connected' : 'Smart Local + Gemini Key Setup'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* LEFT COLUMN: Upload + Perspective & Lighting Cleanup (7 cols) */}
          <div className="lg:col-span-7 p-5 flex flex-col gap-4 bg-slate-50/70">
            {/* Step 1 Header + Upload Button */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  Step 1 • Source Card Photo & Scan Cleanup
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  Upload a Card Picture or Try a Realistic Sample Photo
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Business Card Photo
                </button>
              </div>
            </div>

            {/* Sample Card Presets Bar */}
            <div className="grid grid-cols-3 gap-2">
              {SAMPLE_BUSINESS_CARD_PHOTOS.map((sample) => {
                const active = selectedPreset?.id === sample.id;
                return (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                      active
                        ? 'bg-red-50 border-red-500 ring-1 ring-red-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-800 truncate flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span className="truncate">{sample.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {sample.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Interactive Perspective Crop / Flattened Preview Toggle */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setPreviewTab('original')}
                    className={`text-xs font-semibold px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                      previewTab === 'original'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Crop className="w-3.5 h-3.5 text-red-600" />
                    1. Perspective Crop Handles
                  </button>
                  <button
                    onClick={() => setPreviewTab('flattened')}
                    className={`text-xs font-semibold px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                      previewTab === 'flattened'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    2. Flattened & Cleaned Scan
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enhanceLighting}
                      onChange={(e) => setEnhanceLighting(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500"
                    />
                    Auto-Clean Shadows & Contrast
                  </label>
                  {enhanceLighting && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span>Boost:</span>
                      <input
                        type="range"
                        min={0}
                        max={55}
                        value={contrastBoost}
                        onChange={(e) => setContrastBoost(Number(e.target.value))}
                        className="w-16 accent-red-600"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Image Viewport */}
              {previewTab === 'original' ? (
                <div
                  ref={imageContainerRef}
                  onPointerMove={handlePointerMove}
                  onPointerUp={() => setDraggingCornerIdx(null)}
                  onPointerLeave={() => setDraggingCornerIdx(null)}
                  className="relative w-full h-64 bg-slate-900 rounded-lg overflow-hidden select-none flex items-center justify-center"
                >
                  {rawImageSrc && (
                    <img
                      src={rawImageSrc}
                      alt="Uploaded card"
                      className="w-full h-full object-fill pointer-events-none"
                    />
                  )}
                  {/* SVG Polygon Overlay for 4-corner perspective selection */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <polygon
                      points={corners
                        .map((c) => `${c.x * 100},${c.y * 100}`)
                        .join(' ')}
                      fill="rgba(220, 38, 38, 0.14)"
                      stroke="#ef4444"
                      strokeWidth="0.7"
                      strokeDasharray="2,1.5"
                    />
                  </svg>

                  {/* 4 Draggable Corner Handles */}
                  {corners.map((pt, idx) => {
                    const labels = ['TL', 'TR', 'BR', 'BL'];
                    return (
                      <div
                        key={idx}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setDraggingCornerIdx(idx);
                        }}
                        style={{
                          left: `${pt.x * 100}%`,
                          top: `${pt.y * 100}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-red-600 border-2 border-white shadow-md text-[9px] font-bold text-white flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition"
                        title={`Drag ${labels[idx]} corner to align card edges`}
                      >
                        {labels[idx]}
                      </div>
                    );
                  })}
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[11px] px-2.5 py-1 rounded-md">
                    Drag the 4 red corners (TL, TR, BR, BL) to flatten tilted camera photos
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-64 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center p-3 border border-dashed border-slate-300">
                  {cleanedImageSrc && (
                    <img
                      src={cleanedImageSrc}
                      alt="Flattened scan"
                      className="max-h-full max-w-full object-contain rounded shadow-md border border-slate-200"
                    />
                  )}
                  <div className="absolute bottom-2 right-2 bg-emerald-700 text-white text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1 shadow">
                    <Check className="w-3.5 h-3.5" />
                    Perspective Flattened & Lighting Normalized
                  </div>
                </div>
              )}

              {/* Mini Side-by-Side Comparison Strip */}
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Live Flattened Thumbnail:</span>
                  {cleanedImageSrc && (
                    <img
                      src={cleanedImageSrc}
                      alt="Mini flattened"
                      className="h-9 w-16 object-cover rounded border border-slate-300"
                    />
                  )}
                </div>
                <button
                  onClick={() =>
                    setPreviewTab(previewTab === 'original' ? 'flattened' : 'original')
                  }
                  className="text-red-600 hover:text-red-700 font-semibold underline cursor-pointer"
                >
                  {previewTab === 'original'
                    ? 'Inspect Full Flattened Scan →'
                    : '← Adjust Corner Handles'}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Prompt Instructions + Mode + Target Template Size (5 cols) */}
          <div className="lg:col-span-5 p-5 flex flex-col justify-between gap-4 bg-white">
            <div className="flex flex-col gap-4">
              {/* Step 2: How would you like it changed? */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  Step 2 • Describe Your Changes
                </span>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">
                  Type how you would like the business card changed
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ask AI to update names, phone numbers, titles, addresses, colors, backgrounds, or layout style.
                </p>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="e.g., Change the name to Sarah Jenkins, update phone to (555) 867-5309, change title to VP of Operations, switch the color scheme to crimson red & gold, and add a QR code..."
                  className="mt-2 w-full rounded-lg border border-slate-300 focus:border-red-600 focus:ring-2 focus:ring-red-500/20 p-3 text-xs text-slate-800 leading-relaxed outline-none"
                />

                {/* Quick Prompt Suggestion Chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    'Change phone to (555) 999-8800 & add QR code',
                    'Switch to Crimson Red & Gold theme',
                    'Clean white background with navy header',
                    'Dark charcoal executive theme with gold text',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() =>
                        setPrompt((prev) =>
                          prev ? `${prev.replace(/\.$/, '')}. ${chip}.` : chip
                        )
                      }
                      className="text-[11px] bg-slate-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full transition cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Reconstruction Mode */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  Step 3 • AI Reconstruction Mode
                </span>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('hybrid')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      mode === 'hybrid'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Sparkles className="w-3.5 h-3.5 text-red-600" />
                      Hybrid (Best)
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Editable text/shape layers + AI background & cropped logo
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('layers')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      mode === 'layers'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      Clean Layers
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      100% vector & text layers on crisp solid background
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('image')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      mode === 'image'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      Photo + Overlay
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Keep flattened card scan + overlay edited layers
                    </p>
                  </button>
                </div>
              </div>

              {/* Step 4: Target PrintStudio Template Size */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  Step 4 • Target PrintStudio Template & Duplication
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Automatically scales and duplicates your card across 10-up sheets, 24-up press sheets, flyers, booklets, or envelopes:
                </p>
                <select
                  value={targetTemplateId}
                  onChange={(e) => setTargetTemplateId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-red-600 outline-none"
                >
                  {PRINT_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.subtitle})
                      {tpl.imposition
                        ? ` — Auto ${tpl.imposition.cols * tpl.imposition.rows}-Up Duplication`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit / Take to Design Studio Button */}
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
                disabled={isGenerating}
                onClick={handleGenerate}
                className="flex-1 flex items-center justify-center gap-2 bg-[#cc0000] hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-md transition cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing Photo & Reconstructing Layers...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Apply Changes & Open in Design Studio →
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
