import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { MasterDesign, PrintProject, PrintTemplate } from '../types/printstudio';
import {
  PRINT_TEMPLATES,
  adaptDesignToTemplate,
  getDesignUnitSize,
} from '../data/templates';
import { exportPrintReadyPdf } from '../utils/pdfExporter';

interface MultiTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: PrintProject;
  onSwitchTemplateWithAdaptation: (targetTemplate: PrintTemplate) => void;
}

export const MultiTemplateModal: React.FC<MultiTemplateModalProps> = ({
  isOpen,
  onClose,
  project,
  onSwitchTemplateWithAdaptation,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    'bcard-10up',
    'bcard-single',
    'doc-8.5x11',
    'envelope-printing',
    'postcard-4up',
    'bcard-24up-12x18',
  ]);
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  if (!isOpen) return null;

  const { widthIn: curUnitW, heightIn: curUnitH } = getDesignUnitSize(
    project.template
  );
  const currentMaster: MasterDesign = project.masters['master-a'];

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchExport = async () => {
    setIsExportingBatch(true);
    try {
      for (const id of selectedIds) {
        const tpl = PRINT_TEMPLATES.find((t) => t.id === id);
        if (!tpl) continue;
        const adaptedFront = adaptDesignToTemplate(
          project.masters['master-a'],
          curUnitW,
          curUnitH,
          tpl
        );
        const adaptedBack = adaptDesignToTemplate(
          project.masters['master-b'],
          curUnitW,
          curUnitH,
          tpl
        );
        const tempProj: PrintProject = {
          ...project,
          title: `${project.title.replace(/\s+Custom$/, '')}_${tpl.id}`,
          template: tpl,
          masters: {
            'master-a': adaptedFront,
            'master-b': adaptedBack,
          },
        };
        await exportPrintReadyPdf(tempProj, true);
      }
    } finally {
      setIsExportingBatch(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#cc0000] text-white px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Copy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                Duplicate & Auto-Adapt Design Across Template Sizes
              </h2>
              <p className="text-xs text-red-100">
                Your Master A & Master B design is automatically scaled, reflowed, and imposed across every PrintStudio template size
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

        {/* Grid of all template sizes with live mini-preview of adapted layout */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {PRINT_TEMPLATES.map((tpl) => {
            const isCurrent = tpl.id === project.template.id;
            const isSelected = selectedIds.includes(tpl.id);
            const { widthIn: unitW, heightIn: unitH } = getDesignUnitSize(tpl);
            const slotsCount = tpl.imposition
              ? tpl.imposition.cols * tpl.imposition.rows
              : 1;

            return (
              <div
                key={tpl.id}
                className={`bg-white rounded-xl border p-4 flex flex-col justify-between transition shadow-xs ${
                  isCurrent
                    ? 'border-red-600 ring-2 ring-red-500/20'
                    : isSelected
                    ? 'border-slate-400'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900">
                          {tpl.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{tpl.subtitle}</p>
                    </div>
                    <button
                      onClick={() => toggleSelection(tpl.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition cursor-pointer ${
                        isSelected
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                      title="Select for batch export"
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Schematic Preview of Sheet + Duplicated Design */}
                  <div className="my-3 h-36 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center p-3 relative overflow-hidden">
                    <div
                      style={{
                        aspectRatio: `${tpl.sheetWidthIn} / ${tpl.sheetHeightIn}`,
                      }}
                      className="max-h-full max-w-full bg-white shadow-sm border border-slate-300 relative flex items-center justify-center overflow-hidden p-1"
                    >
                      {tpl.imposition ? (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${tpl.imposition.cols}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${tpl.imposition.rows}, minmax(0, 1fr))`,
                            gap: '1px',
                          }}
                          className="w-full h-full bg-emerald-500/30 p-0.5"
                        >
                          {Array.from({ length: slotsCount }).map((_, idx) => (
                            <div
                              key={idx}
                              style={{
                                backgroundColor: currentMaster.backgroundColor,
                              }}
                              className="w-full h-full border border-emerald-600/40 flex flex-col justify-between p-0.5 overflow-hidden"
                            >
                              <div className="h-1 w-full bg-red-600/80 rounded-xs" />
                              <div className="text-[5px] font-bold text-slate-800 truncate leading-none">
                                {currentMaster.elements.find(
                                  (e) => e.role === 'company' || e.role === 'name'
                                )?.text || 'CARD'}
                              </div>
                              <div className="h-0.5 w-2/3 bg-slate-400/60" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            backgroundColor: currentMaster.backgroundColor,
                          }}
                          className="w-full h-full border border-dashed border-red-400 flex flex-col justify-between p-2"
                        >
                          <div className="h-2 w-full bg-red-600/85 rounded-xs" />
                          <div className="text-[8px] font-bold text-slate-800 truncate">
                            {currentMaster.elements.find(
                              (e) => e.role === 'company'
                            )?.text || 'ADAPTED DESIGN'}
                          </div>
                          <div className="text-[7px] text-slate-600 truncate">
                            {currentMaster.elements.find((e) => e.role === 'name')
                              ?.text || ''}
                          </div>
                          <div className="h-1 w-3/4 bg-slate-300 rounded-xs" />
                        </div>
                      )}
                    </div>

                    <span className="absolute bottom-1.5 right-1.5 bg-slate-900/75 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                      {slotsCount > 1
                        ? `${slotsCount}-Up (${unitW}×${unitH}")`
                        : `${unitW} × ${unitH}"`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSwitchTemplateWithAdaptation(tpl);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-red-600 text-white text-xs font-semibold py-2 rounded-lg transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open & Adapt in Editor
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Layers className="w-4 h-4 text-red-600" />
            <span>
              <strong>{selectedIds.length}</strong> template sizes selected for multi-size duplication
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Close
            </button>
            <button
              disabled={selectedIds.length === 0 || isExportingBatch}
              onClick={handleBatchExport}
              className="flex items-center gap-1.5 bg-[#cc0000] hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition cursor-pointer"
            >
              {isExportingBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating Print PDFs...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Batch Export Selected Sizes ({selectedIds.length} PDFs)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
