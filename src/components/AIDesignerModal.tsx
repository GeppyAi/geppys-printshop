import React, { useEffect, useState } from 'react';
import {
  Check,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  Sparkles,
  Type as TypeIcon,
  Wand2,
  X,
} from 'lucide-react';
import { MasterDesign, PrintTemplate } from '../types/printstudio';
import { PRINT_TEMPLATES, getDesignUnitSize } from '../data/templates';
import {
  AIDesignerBuildMode,
  AIDesignerConcept,
  generateDesignFromScratchWithAI,
} from '../services/geminiService';

interface AIDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplate: PrintTemplate;
  onApplyToStudio: (params: {
    frontMaster: MasterDesign;
    backMaster?: MasterDesign;
    selectedTemplate: PrintTemplate;
    aiSummary: string;
  }) => void;
}

type PrintReferenceCategory = 'for-sale' | 'warning' | 'roadside' | 'cards';

interface ReferenceIdea {
  category: PrintReferenceCategory;
  label: string;
  badge: string;
  prompt: string;
  theme: string;
  suggestedTemplateId?: string;
}

const PROMPT_IDEAS: ReferenceIdea[] = [
  // ==================== 1. FOR SALE SIGNS ====================
  {
    category: 'for-sale',
    label: 'House For Sale By Owner',
    badge: '18×24" Sign',
    prompt:
      'For Sale By Owner Sign — "4 BED • 3 BATH • 2,850 SQ FT", "MOVE-IN READY • SHOWN BY APPOINTMENT", Asking $449,000, phone (555) 839-4400.',
    theme: 'for-sale-red',
    suggestedTemplateId: 'sign-18x24',
  },
  {
    category: 'for-sale',
    label: 'Vehicle / Truck For Sale',
    badge: 'Window Sign',
    prompt:
      'Vehicle For Sale Sign — "2021 FORD F-150 LARIAT 4X4", "CLEAN TITLE • 42K MILES • ONE OWNER", Asking $34,900 OBO, Call/Text (555) 290-8811.',
    theme: 'for-sale-red',
    suggestedTemplateId: 'doc-11x17',
  },
  {
    category: 'for-sale',
    label: 'Open House Directional (➔)',
    badge: '24×18" Yard Sign',
    prompt:
      'Open House Sign — "SUNDAY 1:00 PM – 4:00 PM", "REFRESHMENTS SERVED • TOUR TODAY", phone (555) 839-4400.',
    theme: 'for-sale-red',
    suggestedTemplateId: 'yard-sign-24x18',
  },
  {
    category: 'for-sale',
    label: 'Huge Yard / Garage Sale (➔)',
    badge: '24×18" Yard Sign',
    prompt:
      'Huge Yard Sale Sign — "SAT & SUN • 8:00 AM – 3:00 PM", "FURNITURE • TOOLS • ELECTRONICS • CLOTHES", phone (555) 412-9000.',
    theme: 'safety-yellow',
    suggestedTemplateId: 'yard-sign-24x18',
  },
  {
    category: 'for-sale',
    label: 'Commercial / Land For Sale',
    badge: '18×24" Sign',
    prompt:
      'Prime Property For Sale Sign — "5.2 ACRES ZONED COMMERCIAL", "HIGHWAY FRONTAGE • OWNER FINANCING AVAILABLE", phone (555) 839-4400.',
    theme: 'for-sale-red',
    suggestedTemplateId: 'sign-18x24',
  },

  // ==================== 2. WARNING & SAFETY SIGNS ====================
  {
    category: 'warning',
    label: 'Private Property / No Trespassing',
    badge: 'OSHA / Security',
    prompt:
      'Warning Sign — "PRIVATE PROPERTY — NO TRESPASSING", "PREMISES MONITORED BY 24-HOUR AUDIO & HD VIDEO SURVEILLANCE".',
    theme: 'osha-danger',
    suggestedTemplateId: 'sign-18x24',
  },
  {
    category: 'warning',
    label: 'Danger: High Voltage / Keep Out',
    badge: 'OSHA Danger',
    prompt:
      'OSHA Danger Sign — "HIGH VOLTAGE — KEEP OUT", "AUTHORIZED PERSONNEL ONLY • LOCKOUT/TAGOUT REQUIRED".',
    theme: 'osha-danger',
    suggestedTemplateId: 'sign-18x24',
  },
  {
    category: 'warning',
    label: 'Caution: Hard Hat & PPE Area',
    badge: 'ANSI Caution',
    prompt:
      'OSHA Caution Construction Sign — "CONSTRUCTION ZONE — HARD HAT & PPE REQUIRED", "SAFETY GLASSES & HIGH-VIS VEST MANDATORY BEYOND THIS POINT".',
    theme: 'safety-yellow',
    suggestedTemplateId: 'sign-18x24',
  },
  {
    category: 'warning',
    label: 'No Parking / Fire Lane Tow Zone',
    badge: 'Regulatory',
    prompt:
      'No Parking Regulatory Sign — "FIRE LANE — TOW-AWAY ZONE", "UNAUTHORIZED VEHICLES WILL BE TOWED AT VEHICLE OWNER EXPENSE".',
    theme: 'osha-danger',
    suggestedTemplateId: 'sign-18x24',
  },
  {
    category: 'warning',
    label: 'Beware of Dog / Gate Warning',
    badge: 'Perimeter Sign',
    prompt:
      'Warning Sign — "BEWARE OF DOG — DO NOT ENTER GATE", "KEEP GATE CLOSED AT ALL TIMES • CALL BEFORE ENTERING (555) 901-3344".',
    theme: 'safety-yellow',
    suggestedTemplateId: 'doc-12x18',
  },

  // ==================== 3. ROADSIDE & CONTRACTOR YARD SIGNS ====================
  {
    category: 'roadside',
    label: 'Roofing & Siding Yard Sign',
    badge: '35-MPH Speed Read',
    prompt:
      'Roadside Contractor Yard Sign — "ROOFING & SIDING", "STORM DAMAGE • REPAIRS • FREE INSPECTIONS", phone (555) 901-3344.',
    theme: 'roadside-neon',
    suggestedTemplateId: 'yard-sign-24x18',
  },
  {
    category: 'roadside',
    label: 'Pressure Washing Roadside Sign',
    badge: '24×18" Coroplast',
    prompt:
      'Roadside Yard Sign — "PRESSURE WASHING", "DRIVEWAYS • SIDING • DECKS • ROOFS • FREE ESTIMATES", phone (555) 742-8899.',
    theme: 'roadside-neon',
    suggestedTemplateId: 'yard-sign-24x18',
  },
  {
    category: 'roadside',
    label: 'We Buy Houses Cash Bandit Sign',
    badge: 'High-Vis Yellow',
    prompt:
      'Roadside Yard Sign — "WE BUY HOUSES CASH", "ANY CONDITION • CLOSE IN 7 DAYS • NO COMMISSIONS", phone (555) 310-9900.',
    theme: 'safety-yellow',
    suggestedTemplateId: 'yard-sign-24x18',
  },
  {
    category: 'roadside',
    label: 'Now Open / Directional Arrow (➔)',
    badge: 'Directional',
    prompt:
      'Roadside Directional Sign — "NOW OPEN!", "GRAND OPENING SPECIALS • TURN RIGHT AHEAD ➔", phone (555) 618-9022.',
    theme: 'for-sale-red',
    suggestedTemplateId: 'yard-sign-24x18',
  },
  {
    category: 'roadside',
    label: 'Junk Removal & Hauling Sign',
    badge: '24×18" Yard Sign',
    prompt:
      'Roadside Yard Sign — "JUNK REMOVAL", "SAME-DAY HAULING • WE LOAD IT ALL • FREE QUOTES", phone (555) 440-1212.',
    theme: 'roadside-neon',
    suggestedTemplateId: 'yard-sign-24x18',
  },

  // ==================== 4. BUSINESS CARDS & STATIONERY ====================
  {
    category: 'cards',
    label: 'Luxury Real Estate Card',
    badge: '10-Up Card',
    prompt:
      'Design a luxury real estate business card for "Elena Vance" at "Vance & Co. Luxury Realty", Senior Property Broker, phone (555) 839-4400, black & gold prestige style with a QR code.',
    theme: 'midnight-gold',
    suggestedTemplateId: 'bcard-10up',
  },
  {
    category: 'cards',
    label: 'Contractor & Remodeling Card',
    badge: '10-Up Card',
    prompt:
      'Design a bold contractor business card for "Ryan Callahan" at "Titan Builders & Contracting", General Contractor, phone (555) 901-3344, crimson red and gold accents with "Free Estimates • Licensed & Insured".',
    theme: 'crimson-gold',
    suggestedTemplateId: 'bcard-10up',
  },
  {
    category: 'cards',
    label: 'Lawn & Landscape Pro Card',
    badge: '10-Up Card',
    prompt:
      'Design a fresh landscaping business card for "Marcus Cole" at "Evergreen Landscape & Turf", Owner, phone (555) 742-8899, emerald green & cream palette with QR code.',
    theme: 'emerald-cream',
    suggestedTemplateId: 'bcard-10up',
  },
  {
    category: 'cards',
    label: 'Boutique Salon & MedSpa',
    badge: '10-Up Card',
    prompt:
      'Design an elegant beauty salon & medspa card for "Chloe Laurent" at "Lumière Salon & MedSpa", Master Stylist, phone (555) 294-7711, rose gold & blush palette.',
    theme: 'rose-blush',
    suggestedTemplateId: 'bcard-10up',
  },
];

export const AIDesignerModal: React.FC<AIDesignerModalProps> = ({
  isOpen,
  onClose,
  currentTemplate,
  onApplyToStudio,
}) => {
  const [activeRefCategory, setActiveRefCategory] =
    useState<PrintReferenceCategory>('for-sale');
  const [description, setDescription] = useState<string>(
    PROMPT_IDEAS[0].prompt
  );
  const [buildMode, setBuildMode] =
    useState<AIDesignerBuildMode>('hybrid-studio');
  const [includeEditableTextOnFullGraphic, setIncludeEditableTextOnFullGraphic] =
    useState<boolean>(false);
  const [colorTheme, setColorTheme] = useState<string>('auto');
  const [targetTemplateId, setTargetTemplateId] = useState<string>(
    currentTemplate.id || 'sign-18x24'
  );

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [concepts, setConcepts] = useState<AIDesignerConcept[]>([]);
  const [selectedConceptIdx, setSelectedConceptIdx] = useState<number>(0);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  useEffect(() => {
    setTargetTemplateId(currentTemplate.id);
  }, [currentTemplate.id]);

  // Automatically generate initial 3 concepts when modal opens
  useEffect(() => {
    if (isOpen && concepts.length === 0) {
      handleGenerateConcepts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const targetTemplate =
    PRINT_TEMPLATES.find((t) => t.id === targetTemplateId) || currentTemplate;
  const { widthIn: unitW, heightIn: unitH } = getDesignUnitSize(targetTemplate);

  const handleGenerateConcepts = async (
    overrideDesc?: string,
    overrideTheme?: string,
    overrideTemplateId?: string
  ) => {
    setIsGenerating(true);
    try {
      const tplId = overrideTemplateId || targetTemplateId;
      const tpl =
        PRINT_TEMPLATES.find((t) => t.id === tplId) || targetTemplate;
      const { widthIn: w, heightIn: h } = getDesignUnitSize(tpl);

      const results = await generateDesignFromScratchWithAI({
        description: overrideDesc ?? description,
        buildMode,
        colorTheme: overrideTheme ?? colorTheme,
        unitWidthIn: w,
        unitHeightIn: h,
        includeEditableTextOnFullGraphic,
      });
      setConcepts(results);
      setSelectedConceptIdx(0);
    } finally {
      setIsGenerating(false);
    }
  };

  const activeConcept = concepts[selectedConceptIdx];

  const handleSendConceptToStudio = () => {
    if (!activeConcept) return;
    onApplyToStudio({
      frontMaster: activeConcept.frontMaster,
      backMaster: activeConcept.backMaster,
      selectedTemplate: targetTemplate,
      aiSummary: activeConcept.summary,
    });
    onClose();
  };

  const filteredIdeas = PROMPT_IDEAS.filter(
    (idea) => idea.category === activeRefCategory
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="bg-gradient-to-r from-[#cc0000] via-red-700 to-slate-900 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Wand2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                AI Print & Signage Designer — For Sale, Warning, Roadside Signs & Cards
                <span className="text-[11px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-extrabold">
                  Full Design OR Editable Studio Layers
                </span>
              </h2>
              <p className="text-xs text-red-100">
                Choose a Commercial Signage or Print Reference below, or describe any For Sale Sign, OSHA Warning Sign, Roadside Yard Sign, or Business Card
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
          {/* LEFT COLUMN: Signage Reference Browser + Prompt + Build Mode + Palette (5 cols) */}
          <div className="lg:col-span-5 p-5 flex flex-col justify-between gap-4 bg-slate-50/70">
            <div className="flex flex-col gap-3.5">
              {/* Step 1: Print & Signage Reference Library + Prompt */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  1 • Commercial Print & Signage Reference Templates
                </span>

                {/* Category Tabs: For Sale | Warning & Safety | Roadside & Yard | Business Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-1.5 bg-slate-200/80 p-1 rounded-lg">
                  {(
                    [
                      { id: 'for-sale', label: '🪧 For Sale' },
                      { id: 'warning', label: '⚠️ Warning' },
                      { id: 'roadside', label: '🛣️ Roadside' },
                      { id: 'cards', label: '💼 Cards' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveRefCategory(cat.id)}
                      className={`py-1.5 px-2 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                        activeRefCategory === cat.id
                          ? 'bg-[#cc0000] text-white shadow-2xs'
                          : 'text-slate-700 hover:bg-white/60'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Clickable Reference Cards for Selected Category */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {filteredIdeas.map((idea) => (
                    <button
                      key={idea.label}
                      type="button"
                      onClick={() => {
                        setDescription(idea.prompt);
                        setColorTheme(idea.theme);
                        if (idea.suggestedTemplateId) {
                          setTargetTemplateId(idea.suggestedTemplateId);
                        }
                        handleGenerateConcepts(
                          idea.prompt,
                          idea.theme,
                          idea.suggestedTemplateId
                        );
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                        description === idea.prompt
                          ? 'bg-red-50 border-red-600 text-red-800 font-bold'
                          : 'bg-white hover:bg-red-50/60 border-slate-200 text-slate-700 font-medium'
                      }`}
                    >
                      <span>{idea.label}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-semibold">
                        {idea.badge}
                      </span>
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='Describe your sign or print piece (e.g., "For Sale By Owner — 4 Bed 3 Bath, (555) 839-4400", "OSHA Warning: High Voltage Keep Out", or "Roadside Yard Sign: Pressure Washing (555) 742-8899")...'
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white focus:border-red-600 focus:ring-2 focus:ring-red-500/20 p-2.5 text-xs text-slate-800 leading-relaxed outline-none shadow-2xs"
                />
              </div>

              {/* Step 2: How should AI build it? */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  2 • Choose How AI Generates Your Design
                </span>
                <div className="grid grid-cols-1 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setBuildMode('hybrid-studio')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                      buildMode === 'hybrid-studio'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs text-slate-900">
                        Hybrid: AI Signage Backdrop + Editable Text Boxes & Layout (Recommended)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Generates custom hazard stripes / signage framing AND editable text boxes, banners, directional arrows, and phone blocks.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBuildMode('layout-layers')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                      buildMode === 'layout-layers'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <TypeIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs text-slate-900">
                        Editable Text Boxes, Shapes & Vector Layout Only
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        100% crisp vector banners, frames, directional arrows, and editable text boxes on a solid background.
                      </p>
                    </div>
                  </button>

                  <div
                    onClick={() => setBuildMode('full-graphic')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-2 ${
                      buildMode === 'full-graphic'
                        ? 'bg-red-50 border-red-600 ring-1 ring-red-600'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs text-slate-900">
                          Full AI Generated Visual Design
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          Generates a complete full-bleed visual design graphic for the entire sign/card.
                        </p>
                      </div>
                    </div>
                    {buildMode === 'full-graphic' && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 text-[11px] font-medium text-slate-700 bg-white/80 px-2.5 py-1.5 rounded-lg border border-red-200 ml-6 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={includeEditableTextOnFullGraphic}
                          onChange={(e) =>
                            setIncludeEditableTextOnFullGraphic(e.target.checked)
                          }
                          className="rounded text-red-600"
                        />
                        <span>
                          Also include editable text boxes on top instead of baking text flat
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3: Color Palette & Target Template */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
                    <Palette className="w-3 h-3" /> Signage / Print Palette
                  </label>
                  <select
                    value={colorTheme}
                    onChange={(e) => setColorTheme(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none"
                  >
                    <option value="auto">✨ Auto-Match Sign / Print Type</option>
                    <option value="for-sale-red">🪧 For Sale Red, Navy & White</option>
                    <option value="osha-danger">⚠️ OSHA Danger Red, Black & White</option>
                    <option value="safety-yellow">⚠️ Safety Yellow & Black Hazard</option>
                    <option value="roadside-neon">🛣️ Roadside Navy, Yellow & Red</option>
                    <option value="crimson-gold">Crimson Red & Gold</option>
                    <option value="midnight-gold">Midnight Black & Gold</option>
                    <option value="navy-amber">Royal Navy & Amber</option>
                    <option value="emerald-cream">Emerald & Warm Cream</option>
                    <option value="rose-blush">Rose Gold & Burgundy</option>
                    <option value="monochrome">Minimal Monochrome</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Sign / Sheet Size
                  </label>
                  <select
                    value={targetTemplateId}
                    onChange={(e) => setTargetTemplateId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none"
                  >
                    {PRINT_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subtitle})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => handleGenerateConcepts()}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm transition cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Designing 3 Custom Print & Signage Concepts...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Generate / Refresh 3 AI Sign & Print Concepts
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Interactive Preview of the 3 Generated Concepts (7 cols) */}
          <div className="lg:col-span-7 p-5 flex flex-col justify-between bg-white">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                    3 • Pick a Generated Design Concept
                  </span>
                  <h3 className="text-sm font-bold text-slate-800">
                    Click any concept below to preview its Front & Back layout
                  </h3>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
                  <button
                    onClick={() => setPreviewSide('front')}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      previewSide === 'front'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Front (Master A)
                  </button>
                  <button
                    onClick={() => setPreviewSide('back')}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      previewSide === 'back'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Back (Master B)
                  </button>
                </div>
              </div>

              {/* 3 Concept Selector Cards */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {concepts.map((c, idx) => {
                  const isSel = idx === selectedConceptIdx;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConceptIdx(idx)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        isSel
                          ? 'bg-red-50/70 border-red-600 ring-2 ring-red-500/20'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {c.title}
                        </span>
                        {isSel && (
                          <Check className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        {c.styleSubtitle}
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        {c.palette.map((hex, i) => (
                          <span
                            key={i}
                            style={{ backgroundColor: hex }}
                            className="w-3.5 h-3.5 rounded-full border border-slate-300"
                          />
                        ))}
                        <span className="text-[10px] text-slate-500 ml-auto font-medium">
                          {c.frontMaster.elements.length} layers
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Large Live Canvas Preview of Active Concept */}
              {activeConcept && (
                <div className="bg-slate-100 rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center relative min-h-[290px]">
                  {(() => {
                    const m =
                      previewSide === 'front'
                        ? activeConcept.frontMaster
                        : activeConcept.backMaster;
                    // Scale preview to fit nicely inside modal (~420px wide for 3.5x2)
                    const previewPxPerIn = Math.min(
                      440 / unitW,
                      250 / unitH
                    );
                    const wPx = unitW * previewPxPerIn;
                    const hPx = unitH * previewPxPerIn;

                    return (
                      <div
                        style={{
                          width: `${wPx}px`,
                          height: `${hPx}px`,
                          backgroundColor: m.backgroundColor,
                          backgroundImage: m.backgroundImage
                            ? `url(${m.backgroundImage})`
                            : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                        className="relative shadow-xl border border-slate-300 overflow-hidden select-none"
                      >
                        {m.elements.map((el) => {
                          const left = el.x * previewPxPerIn;
                          const top = el.y * previewPxPerIn;
                          const width = el.width * previewPxPerIn;
                          const height = el.height * previewPxPerIn;
                          const fontPx =
                            ((el.fontSize || 10) * previewPxPerIn) / 72;

                          return (
                            <div
                              key={el.id}
                              style={{
                                left: `${left}px`,
                                top: `${top}px`,
                                width: `${width}px`,
                                height: `${height}px`,
                              }}
                              className="absolute border border-dashed border-transparent hover:border-blue-400/60"
                            >
                              {(el.type === 'rect' ||
                                el.type === 'rounded-rect') && (
                                <div
                                  style={{
                                    backgroundColor: el.fill || 'transparent',
                                    borderColor: el.stroke || 'transparent',
                                    borderWidth: el.strokeWidth
                                      ? `${
                                          (el.strokeWidth * previewPxPerIn) / 72
                                        }px`
                                      : 0,
                                    borderStyle: el.strokeWidth
                                      ? 'solid'
                                      : 'none',
                                    borderRadius:
                                      el.type === 'rounded-rect'
                                        ? `${
                                            ((el.borderRadius || 6) *
                                              previewPxPerIn) /
                                            72
                                          }px`
                                        : 0,
                                    color: el.color || '#ffffff',
                                    fontFamily: el.fontFamily || 'Inter',
                                    fontSize: `${fontPx}px`,
                                    fontWeight: el.fontWeight || 'bold',
                                  }}
                                  className="w-full h-full flex items-center justify-center"
                                >
                                  {el.text}
                                </div>
                              )}

                              {el.type === 'line' && (
                                <div className="w-full h-full flex items-center">
                                  <div
                                    style={{
                                      backgroundColor:
                                        el.stroke || el.fill || '#cbd5e1',
                                      height: '1px',
                                    }}
                                    className="w-full"
                                  />
                                </div>
                              )}

                              {el.type === 'qr' && (
                                <div
                                  style={{
                                    borderColor: el.fill || '#0f172a',
                                  }}
                                  className="w-full h-full bg-white p-0.5 border grid grid-cols-5 gap-0.5"
                                >
                                  {Array.from({ length: 25 }).map((_, qi) => (
                                    <div
                                      key={qi}
                                      style={{
                                        backgroundColor: [
                                          0, 1, 3, 4, 5, 6, 8, 9, 12, 15, 16,
                                          18, 20, 21, 23, 24,
                                        ].includes(qi)
                                          ? el.fill || '#0f172a'
                                          : 'transparent',
                                      }}
                                    />
                                  ))}
                                </div>
                              )}

                              {el.type === 'text' && (
                                <div
                                  style={{
                                    fontFamily: el.fontFamily || 'Inter',
                                    fontSize: `${fontPx}px`,
                                    fontWeight: el.fontWeight || 'normal',
                                    textAlign: el.textAlign || 'left',
                                    color: el.color || '#0f172a',
                                    lineHeight: 1.2,
                                    letterSpacing: el.letterSpacing
                                      ? `${
                                          (el.letterSpacing * previewPxPerIn) /
                                          72
                                        }px`
                                      : undefined,
                                  }}
                                  className="w-full h-full whitespace-pre-wrap"
                                >
                                  {el.text}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800">
                      {activeConcept.title}
                    </span>
                    <span>•</span>
                    <span>
                      {activeConcept.frontMaster.elements.length} editable text boxes & shape layers
                    </span>
                    {targetTemplate.imposition && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">
                          Auto-duplicates across{' '}
                          {targetTemplate.imposition.cols *
                            targetTemplate.imposition.rows}{' '}
                          slots on {targetTemplate.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Every text box, font, shape, and QR code can be moved, resized, or edited in PrintStudio.
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendConceptToStudio}
                  className="flex items-center gap-2 bg-[#cc0000] hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-md transition cursor-pointer"
                >
                  <Wand2 className="w-4 h-4" />
                  Open Concept in PrintStudio Editor →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
