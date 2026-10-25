import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Grid,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  LockerFileItem,
  PackedPhotoPlacement,
  PackedPhotoSheet,
  PhotoNUpOrderItem,
  PhotoPlacementOverride,
  PrintProject,
} from '../types/printstudio';
import {
  PHOTO_OUTPUT_SHEET_PRESETS,
  PHOTO_PRINT_SIZE_PRESETS,
  buildProjectFromPackedPhotos,
  exportPackedPhotosToPdf,
  ingestUploadedFileToLocker,
  loadLockerFiles,
  packPhotoOrdersOntoSheets,
  saveLockerFilesList,
} from '../utils/fileLockerAndPhotoNUp';

interface FileLockerAndPhotoNUpModalProps {
  isOpen: boolean;
  initialTab?: 'locker' | 'photo-nup';
  onClose: () => void;
  onOpenGeneratedProject: (project: PrintProject) => void;
  onInsertImageIntoCurrentCanvas?: (imageUrl: string, name: string) => void;
}

export const FileLockerAndPhotoNUpModal: React.FC<
  FileLockerAndPhotoNUpModalProps
> = ({
  isOpen,
  initialTab = 'locker',
  onClose,
  onOpenGeneratedProject,
  onInsertImageIntoCurrentCanvas,
}) => {
  const [activeTab, setActiveTab] = useState<'locker' | 'photo-nup'>(
    initialTab
  );
  const [lockerFiles, setLockerFiles] = useState<LockerFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [lockerFilter, setLockerFilter] = useState<
    'all' | 'image' | 'pdf' | 'document'
  >('all');
  const [lockerSearch, setLockerSearch] = useState<string>('');
  const [selectedLockerIds, setSelectedLockerIds] = useState<string[]>([]);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingFileName, setRenamingFileName] = useState<string>('');
  const [previewingLockerItem, setPreviewingLockerItem] =
    useState<LockerFileItem | null>(null);

  // ==================== PHOTO UPPER STATE ====================
  const [outputPresetId, setOutputPresetId] = useState<string>('out-18x24');
  const [outputWidthIn, setOutputWidthIn] = useState<number>(18);
  const [outputHeightIn, setOutputHeightIn] = useState<number>(24);
  const [sheetMarginIn, setSheetMarginIn] = useState<number>(0.25);
  const [photoGapIn, setPhotoGapIn] = useState<number>(0.125);
  const [includeCropMarks, setIncludeCropMarks] = useState<boolean>(true);
  const [activePreviewSheetIdx, setActivePreviewSheetIdx] = useState<number>(0);
  const [isBuildingProject, setIsBuildingProject] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const [photoOrders, setPhotoOrders] = useState<PhotoNUpOrderItem[]>([]);

  // Interactive Photo Upper arrangement state (select, rotate, drag & auto-fit around)
  const [placementOverrides, setPlacementOverrides] = useState<
    Record<string, PhotoPlacementOverride>
  >({});
  const [selectedPlacementKey, setSelectedPlacementKey] = useState<
    string | null
  >(null);
  const [autoFitAroundMode, setAutoFitAroundMode] = useState<boolean>(true);
  const [dragPhotoState, setDragPhotoState] = useState<{
    placementKey: string;
    sheetIdx: number;
    startClientX: number;
    startClientY: number;
    startXIn: number;
    startYIn: number;
    widthIn: number;
    heightIn: number;
    rotated: boolean;
    scale: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadLockerFiles().then((loaded) => {
        setLockerFiles(loaded);
        // Seed initial Photo Upper queue with starter photos if empty
        setPhotoOrders((prev) => {
          if (prev.length > 0) return prev;
          const imgs = loaded.filter((f) => f.fileType === 'image');
          if (imgs.length === 0) return prev;
          const first = imgs[0];
          const second = imgs[1] || imgs[0];
          const third = imgs[2] || imgs[0];
          return [
            {
              id: `ord-init-1`,
              lockerFileId: first.id,
              fileName: first.name,
              imageUrl: first.dataUrl || first.thumbnailUrl,
              quantity: 1,
              sizePresetId: 'photo-8x10',
              widthIn: 8,
              heightIn: 10,
              fitMode: 'cover',
              allowRotate: true,
            },
            {
              id: `ord-init-2`,
              lockerFileId: second.id,
              fileName: second.name,
              imageUrl: second.dataUrl || second.thumbnailUrl,
              quantity: 2,
              sizePresetId: 'photo-5x7',
              widthIn: 5,
              heightIn: 7,
              fitMode: 'cover',
              allowRotate: true,
            },
            {
              id: `ord-init-3`,
              lockerFileId: third.id,
              fileName: third.name,
              imageUrl: third.dataUrl || third.thumbnailUrl,
              quantity: 4,
              sizePresetId: 'photo-4x6',
              widthIn: 4,
              heightIn: 6,
              fitMode: 'cover',
              allowRotate: true,
            },
          ];
        });
      });
    }
  }, [isOpen, initialTab]);

  // Baseline Auto-Pack (without manual overrides) so user can compare their manual arrangement against automatic fit
  const baselinePackedSheets: PackedPhotoSheet[] = useMemo(() => {
    return packPhotoOrdersOntoSheets({
      orders: photoOrders,
      sheetWidthIn: outputWidthIn,
      sheetHeightIn: outputHeightIn,
      marginIn: sheetMarginIn,
      gapIn: photoGapIn,
      overrides: {},
    });
  }, [
    photoOrders,
    outputWidthIn,
    outputHeightIn,
    sheetMarginIn,
    photoGapIn,
  ]);

  // Compute live packed sheets (including any user-dragged / rotated photo overrides, auto-fitting others around them!)
  const packedSheets: PackedPhotoSheet[] = useMemo(() => {
    return packPhotoOrdersOntoSheets({
      orders: photoOrders,
      sheetWidthIn: outputWidthIn,
      sheetHeightIn: outputHeightIn,
      marginIn: sheetMarginIn,
      gapIn: photoGapIn,
      overrides: placementOverrides,
    });
  }, [
    photoOrders,
    outputWidthIn,
    outputHeightIn,
    sheetMarginIn,
    photoGapIn,
    placementOverrides,
  ]);

  const totalRequestedPhotos = useMemo(
    () => photoOrders.reduce((acc, o) => acc + Math.max(0, o.quantity), 0),
    [photoOrders]
  );

  if (!isOpen) return null;

  const syncLockerList = (next: LockerFileItem[]) => {
    setLockerFiles(next);
    saveLockerFilesList(next).catch(() => {});
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsLoadingFiles(true);
    try {
      const newlyIngested: LockerFileItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const item = await ingestUploadedFileToLocker(files[i]);
        newlyIngested.push(item);
      }
      const nextList = [...newlyIngested, ...lockerFiles];
      syncLockerList(nextList);

      // If user is currently in the Auto Photo N-Upper tab, automatically add newly uploaded images/PDFs to the queue!
      if (activeTab === 'photo-nup') {
        const newOrders: PhotoNUpOrderItem[] = newlyIngested
          .filter((f) => f.fileType === 'image' || f.fileType === 'pdf')
          .map((f, idx) => ({
            id: `ord-up-${Date.now()}-${idx}`,
            lockerFileId: f.id,
            fileName: f.name,
            imageUrl: f.dataUrl || f.thumbnailUrl,
            quantity: 2,
            sizePresetId: 'photo-4x6',
            widthIn: 4,
            heightIn: 6,
            fitMode: 'cover',
            allowRotate: true,
          }));
        if (newOrders.length > 0) {
          setPhotoOrders((prev) => [...prev, ...newOrders]);
        }
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleDeleteLockerFile = (id: string) => {
    const next = lockerFiles.filter((f) => f.id !== id);
    syncLockerList(next);
    setSelectedLockerIds((prev) => prev.filter((sid) => sid !== id));
    if (previewingLockerItem?.id === id) {
      setPreviewingLockerItem(null);
    }
  };

  const handleRenameLockerFile = (id: string, newName: string) => {
    setRenamingFileId(null);
    if (!newName.trim()) return;
    const next = lockerFiles.map((f) =>
      f.id === id ? { ...f, name: newName.trim() } : f
    );
    syncLockerList(next);
  };

  const handleAddLockerFileToPhotoNUp = (
    file: LockerFileItem,
    sizePresetId: string = 'photo-4x6',
    qty: number = 2
  ) => {
    const preset =
      PHOTO_PRINT_SIZE_PRESETS.find((p) => p.id === sizePresetId) ||
      PHOTO_PRINT_SIZE_PRESETS[1];
    const newOrder: PhotoNUpOrderItem = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lockerFileId: file.id,
      fileName: file.name,
      imageUrl: file.dataUrl || file.thumbnailUrl,
      quantity: qty,
      sizePresetId: preset.id,
      widthIn: preset.widthIn,
      heightIn: preset.heightIn,
      fitMode: 'cover',
      allowRotate: true,
    };
    setPhotoOrders((prev) => [...prev, newOrder]);
  };

  const handleSendSelectedToPhotoNUp = () => {
    const chosen = lockerFiles.filter((f) => selectedLockerIds.includes(f.id));
    if (chosen.length === 0) {
      setActiveTab('photo-nup');
      return;
    }
    const addedOrders: PhotoNUpOrderItem[] = chosen.map((file, idx) => ({
      id: `ord-sel-${Date.now()}-${idx}`,
      lockerFileId: file.id,
      fileName: file.name,
      imageUrl: file.dataUrl || file.thumbnailUrl,
      quantity: 2,
      sizePresetId: 'photo-4x6',
      widthIn: 4,
      heightIn: 6,
      fitMode: 'cover',
      allowRotate: true,
    }));
    setPhotoOrders((prev) => [...prev, ...addedOrders]);
    setSelectedLockerIds([]);
    setActiveTab('photo-nup');
  };

  const handleUpdateOrder = (
    orderId: string,
    patch: Partial<PhotoNUpOrderItem>
  ) => {
    setPhotoOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o))
    );
  };

  const handleSelectOrderSizePreset = (orderId: string, presetId: string) => {
    const found = PHOTO_PRINT_SIZE_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    if (found.id === 'photo-custom') {
      handleUpdateOrder(orderId, { sizePresetId: 'photo-custom' });
    } else {
      handleUpdateOrder(orderId, {
        sizePresetId: found.id,
        widthIn: found.widthIn,
        heightIn: found.heightIn,
      });
    }
  };

  /**
   * Calculates how many copies of a given photo size fit on 1 output sheet and sets that order's quantity
   */
  const handleMaxFillOneSheetForOrder = (order: PhotoNUpOrderItem) => {
    const usableW = Math.max(1, outputWidthIn - sheetMarginIn * 2);
    const usableH = Math.max(1, outputHeightIn - sheetMarginIn * 2);
    const colsA = Math.floor(
      (usableW + photoGapIn) / (order.widthIn + photoGapIn)
    );
    const rowsA = Math.floor(
      (usableH + photoGapIn) / (order.heightIn + photoGapIn)
    );
    const countA = Math.max(0, colsA * rowsA);

    const colsB = Math.floor(
      (usableW + photoGapIn) / (order.heightIn + photoGapIn)
    );
    const rowsB = Math.floor(
      (usableH + photoGapIn) / (order.widthIn + photoGapIn)
    );
    const countB = order.allowRotate ? Math.max(0, colsB * rowsB) : 0;

    const bestFitCount = Math.max(1, countA, countB);
    handleUpdateOrder(order.id, { quantity: bestFitCount });
  };

  /**
   * Creates a classic Portrait Package (1× 8×10" + 2× 5×7" + 4× 4×6") for a given photo
   */
  const handleAddPortraitPackageForPhoto = (
    fileName: string,
    imageUrl: string,
    lockerFileId: string
  ) => {
    const now = Date.now();
    const pkg: PhotoNUpOrderItem[] = [
      {
        id: `ord-pkg-8x10-${now}`,
        lockerFileId,
        fileName,
        imageUrl,
        quantity: 1,
        sizePresetId: 'photo-8x10',
        widthIn: 8,
        heightIn: 10,
        fitMode: 'cover',
        allowRotate: true,
      },
      {
        id: `ord-pkg-5x7-${now}`,
        lockerFileId,
        fileName,
        imageUrl,
        quantity: 2,
        sizePresetId: 'photo-5x7',
        widthIn: 5,
        heightIn: 7,
        fitMode: 'cover',
        allowRotate: true,
      },
      {
        id: `ord-pkg-4x6-${now}`,
        lockerFileId,
        fileName,
        imageUrl,
        quantity: 4,
        sizePresetId: 'photo-4x6',
        widthIn: 4,
        heightIn: 6,
        fitMode: 'cover',
        allowRotate: true,
      },
    ];
    setPhotoOrders(pkg);
  };

  const handleOpenInStudio = async () => {
    if (packedSheets.length === 0) return;
    setIsBuildingProject(true);
    try {
      const proj = await buildProjectFromPackedPhotos({
        sheets: packedSheets,
        marginIn: sheetMarginIn,
        includeCropMarks,
      });
      onOpenGeneratedProject(proj);
      onClose();
    } finally {
      setIsBuildingProject(false);
    }
  };

  const handleDirectExportPdf = async () => {
    if (packedSheets.length === 0) return;
    setIsExportingPdf(true);
    try {
      await exportPackedPhotosToPdf({
        sheets: packedSheets,
        includeCropMarks,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const filteredLockerFiles = lockerFiles.filter((f) => {
    if (lockerFilter !== 'all' && f.fileType !== lockerFilter) return false;
    if (lockerSearch.trim()) {
      const q = lockerSearch.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        (f.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const safeSheetIdx = Math.min(
    Math.max(0, activePreviewSheetIdx),
    Math.max(0, packedSheets.length - 1)
  );
  const currentPreviewSheet = packedSheets[safeSheetIdx] || packedSheets[0];

  const selectedPlacement: PackedPhotoPlacement | undefined =
    selectedPlacementKey && currentPreviewSheet
      ? currentPreviewSheet.placements.find(
          (p) =>
            (p.placementKey || `${p.orderId}::${p.copyIndex}`) ===
            selectedPlacementKey
        )
      : undefined;

  const overrideCount = Object.keys(placementOverrides).length;

  /**
   * Rotates a specific placed photo 90° (`widthIn` ↔ `heightIn`) and either keeps it anchored
   * at its current position (so other photos auto-fit around it) or lets it auto-pack rotated!
   */
  const handleRotatePlacement = (
    pl: PackedPhotoPlacement,
    anchorPosition: boolean = true
  ) => {
    const key = pl.placementKey || `${pl.orderId}::${pl.copyIndex}`;
    const nextRot = !pl.rotated;
    const newW = nextRot ? pl.requestedHeightIn : pl.requestedWidthIn;
    const newH = nextRot ? pl.requestedWidthIn : pl.requestedHeightIn;

    const clampedX = Math.max(
      sheetMarginIn,
      Math.min(outputWidthIn - sheetMarginIn - newW, pl.xIn)
    );
    const clampedY = Math.max(
      sheetMarginIn,
      Math.min(outputHeightIn - sheetMarginIn - newH, pl.yIn)
    );

    setPlacementOverrides((prev) => {
      const next: Record<string, PhotoPlacementOverride> = { ...prev };
      if (anchorPosition) {
        // If autoFitAroundMode is ON, unpin any OTHER pinned photos' coordinates that would collide with this rotated photo so they reflow around it!
        if (autoFitAroundMode) {
          for (const k of Object.keys(next)) {
            if (k === key) continue;
            next[k] = {
              ...next[k],
              xIn: undefined,
              yIn: undefined,
            };
          }
        }
        next[key] = {
          placementKey: key,
          sheetIndex: safeSheetIdx,
          xIn: Number(clampedX.toFixed(3)),
          yIn: Number(clampedY.toFixed(3)),
          rotated: nextRot,
        };
      } else {
        // Only force 90° rotation and let the auto-packer find the tightest spot on the sheet
        next[key] = {
          placementKey: key,
          sheetIndex: safeSheetIdx,
          xIn: undefined,
          yIn: undefined,
          rotated: nextRot,
        };
      }
      return next;
    });
    setSelectedPlacementKey(key);
  };

  /**
   * Rotates the entire Photo Upper sheet layout 90° (swapping Output Width <-> Output Height)
   * AND rotates all photo placements 90° together so every photo rotates the same way with the layout!
   */
  const handleRotateEntirePhotoUpperLayout90 = (
    direction: 'cw' | 'ccw' = 'cw'
  ) => {
    const oldW = outputWidthIn;
    const oldH = outputHeightIn;
    const nextOverrides: Record<string, PhotoPlacementOverride> = {};

    for (const sh of packedSheets) {
      for (const pl of sh.placements) {
        const k = pl.placementKey || `${pl.orderId}::${pl.copyIndex}`;
        const nextRot = !pl.rotated;
        const rotX =
          direction === 'cw'
            ? oldH - (pl.yIn + pl.heightIn)
            : pl.yIn;
        const rotY =
          direction === 'cw'
            ? pl.xIn
            : oldW - (pl.xIn + pl.widthIn);

        nextOverrides[k] = {
          placementKey: k,
          sheetIndex: sh.sheetIndex,
          xIn: Number(Math.max(0, rotX).toFixed(4)),
          yIn: Number(Math.max(0, rotY).toFixed(4)),
          rotated: nextRot,
        };
      }
    }

    setOutputWidthIn(oldH);
    setOutputHeightIn(oldW);
    setPlacementOverrides(nextOverrides);
  };

  /**
   * Rotates all photos 90° in unison on the current sheet size while keeping them auto-fitted cleanly
   */
  const handleRotateAllPhotos90InPlace = () => {
    const allPlacements = packedSheets.flatMap((s) => s.placements);
    if (allPlacements.length === 0) return;
    // Toggle uniform rotation based on the first photo's current rotation so all photos rotate the exact same way
    const targetRot = !allPlacements[0].rotated;
    const nextOverrides: Record<string, PhotoPlacementOverride> = {};
    for (const pl of allPlacements) {
      const k = pl.placementKey || `${pl.orderId}::${pl.copyIndex}`;
      nextOverrides[k] = {
        placementKey: k,
        rotated: targetRot,
      };
    }
    setAutoFitAroundMode(true);
    setPlacementOverrides(nextOverrides);
  };

  /**
   * Snaps the selected photo to a specific sheet anchor (Top-Left, Top-Right, Center, Bottom-Left, Bottom-Right)
   * and automatically fits all other photos around it!
   */
  const handleSnapPlacementToAnchor = (
    pl: PackedPhotoPlacement,
    anchor: 'tl' | 'tr' | 'center' | 'bl' | 'br'
  ) => {
    const key = pl.placementKey || `${pl.orderId}::${pl.copyIndex}`;
    const minX = sheetMarginIn;
    const minY = sheetMarginIn;
    const maxX = Math.max(minX, outputWidthIn - sheetMarginIn - pl.widthIn);
    const maxY = Math.max(minY, outputHeightIn - sheetMarginIn - pl.heightIn);
    const midX = Number(((outputWidthIn - pl.widthIn) / 2).toFixed(3));
    const midY = Number(((outputHeightIn - pl.heightIn) / 2).toFixed(3));

    let targetX = minX;
    let targetY = minY;
    if (anchor === 'tr') {
      targetX = maxX;
      targetY = minY;
    } else if (anchor === 'center') {
      targetX = midX;
      targetY = midY;
    } else if (anchor === 'bl') {
      targetX = minX;
      targetY = maxY;
    } else if (anchor === 'br') {
      targetX = maxX;
      targetY = maxY;
    }

    setPlacementOverrides((prev) => {
      const next: Record<string, PhotoPlacementOverride> = { ...prev };
      if (autoFitAroundMode) {
        for (const k of Object.keys(next)) {
          if (k === key) continue;
          next[k] = {
            ...next[k],
            xIn: undefined,
            yIn: undefined,
          };
        }
      }
      next[key] = {
        placementKey: key,
        sheetIndex: safeSheetIdx,
        xIn: Number(targetX.toFixed(3)),
        yIn: Number(targetY.toFixed(3)),
        rotated: pl.rotated,
      };
      return next;
    });
    setSelectedPlacementKey(key);
  };

  /**
   * Handles dragging a photo on the live sheet preview, snapping to margins/neighbors
   * and live-reflowing other photos around it!
   */
  const handlePreviewPointerMove = (e: React.PointerEvent) => {
    if (!dragPhotoState || !currentPreviewSheet) return;
    const dxIn = (e.clientX - dragPhotoState.startClientX) / dragPhotoState.scale;
    const dyIn = (e.clientY - dragPhotoState.startClientY) / dragPhotoState.scale;

    let nextX = dragPhotoState.startXIn + dxIn;
    let nextY = dragPhotoState.startYIn + dyIn;

    const w = dragPhotoState.widthIn;
    const h = dragPhotoState.heightIn;

    // Clamp inside physical sheet bounds
    const minX = 0;
    const minY = 0;
    const maxX = Math.max(0, outputWidthIn - w);
    const maxY = Math.max(0, outputHeightIn - h);
    nextX = Math.max(minX, Math.min(maxX, nextX));
    nextY = Math.max(minY, Math.min(maxY, nextY));

    // Magnetic snapping to sheet margins, sheet center, and other photos (unless Alt key held)
    if (!e.altKey) {
      const snapThresh = 0.28;
      const xCandidates = [
        sheetMarginIn,
        Math.max(0, outputWidthIn - sheetMarginIn - w),
        (outputWidthIn - w) / 2,
      ];
      const yCandidates = [
        sheetMarginIn,
        Math.max(0, outputHeightIn - sheetMarginIn - h),
        (outputHeightIn - h) / 2,
      ];

      for (const other of currentPreviewSheet.placements) {
        const oKey = other.placementKey || `${other.orderId}::${other.copyIndex}`;
        if (oKey === dragPhotoState.placementKey) continue;
        xCandidates.push(
          other.xIn,
          other.xIn + other.widthIn + photoGapIn,
          other.xIn - w - photoGapIn
        );
        yCandidates.push(
          other.yIn,
          other.yIn + other.heightIn + photoGapIn,
          other.yIn - h - photoGapIn
        );
      }

      for (const xc of xCandidates) {
        if (Math.abs(nextX - xc) <= snapThresh) {
          nextX = xc;
          break;
        }
      }
      for (const yc of yCandidates) {
        if (Math.abs(nextY - yc) <= snapThresh) {
          nextY = yc;
          break;
        }
      }
    }

    const key = dragPhotoState.placementKey;
    setPlacementOverrides((prev) => {
      const next: Record<string, PhotoPlacementOverride> = { ...prev };
      if (autoFitAroundMode) {
        // Unpin other photos' coordinates so they dynamically auto-fit around the photo being dragged!
        for (const k of Object.keys(next)) {
          if (k === key) continue;
          next[k] = {
            ...next[k],
            xIn: undefined,
            yIn: undefined,
          };
        }
      }
      next[key] = {
        placementKey: key,
        sheetIndex: dragPhotoState.sheetIdx,
        xIn: Number(nextX.toFixed(3)),
        yIn: Number(nextY.toFixed(3)),
        rotated: dragPhotoState.rotated,
      };
      return next;
    });
  };

  /**
   * Toggle between Auto-Fit Others Around Moved Photo vs Manual Free Arrange (Pin All)
   */
  const handleToggleAutoFitMode = (enableAutoFit: boolean) => {
    setAutoFitAroundMode(enableAutoFit);
    if (!enableAutoFit && currentPreviewSheet) {
      // Pin all current placements on the sheet at their current coordinates so user can freely drag/test overlaps manually
      const pinnedAll: Record<string, PhotoPlacementOverride> = {
        ...placementOverrides,
      };
      for (const pl of currentPreviewSheet.placements) {
        const k = pl.placementKey || `${pl.orderId}::${pl.copyIndex}`;
        pinnedAll[k] = {
          placementKey: k,
          sheetIndex: safeSheetIdx,
          xIn: pl.xIn,
          yIn: pl.yIn,
          rotated: pl.rotated,
        };
      }
      setPlacementOverrides(pinnedAll);
    } else if (enableAutoFit) {
      // Keep only the currently selected photo's position pinned (if any) and let all other photos auto-fit around it!
      setPlacementOverrides((prev) => {
        const next: Record<string, PhotoPlacementOverride> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (k === selectedPlacementKey) {
            next[k] = v;
          } else if (v.rotated !== undefined) {
            next[k] = { placementKey: k, rotated: v.rotated };
          }
        }
        return next;
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      onPointerMove={handlePreviewPointerMove}
      onPointerUp={() => setDragPhotoState(null)}
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 select-none"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[1380px] h-[92vh] flex flex-col overflow-hidden">
        {/* Hidden Multi-File Upload Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.docx,.doc,.csv,.tsv,.txt,.json"
          onChange={(e) => {
            handleUploadFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* ==================== TOP MODAL HEADER & MODE TABS ==================== */}
        <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#cc0000] flex items-center justify-center shadow-sm">
                <FolderOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                  File Locker &amp; Photo Upper Studio
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                    4×6 • 5×7 • 8×10 • 11×14 • 18×24 • 24×36 Gang Sheets
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Store images, PDFs &amp; documents in your Locker — or pick
                  any output poster/sheet size, select images, and drag/rotate
                  photos in the Photo Upper!
                </p>
              </div>
            </div>

            {/* Mode Switcher Pills */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 ml-3">
              <button
                type="button"
                onClick={() => setActiveTab('locker')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'locker'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                File Locker Gallery ({lockerFiles.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('photo-nup')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'photo-nup'
                    ? 'bg-[#cc0000] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                Photo Upper ({totalRequestedPhotos} Prints)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              {isLoadingFiles
                ? 'Uploading...'
                : '+ Upload Images, PDFs or Docs'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ==================== TAB 1: FILE LOCKER GALLERY (IMAGES, PDFs & DOCUMENTS) ==================== */}
        {activeTab === 'locker' && (
          <div className="flex-1 flex min-h-0 overflow-hidden bg-slate-50">
            {/* Left Filter & Upload Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between shrink-0">
              <div className="flex flex-col gap-4">
                {/* Drag & Drop Upload Box */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleUploadFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-red-300 hover:border-red-500 bg-red-50/40 hover:bg-red-50/80 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center gap-1.5"
                >
                  <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">
                    Drop Files into Locker
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Upload JPG, PNG, SVG, multi-page PDFs, Word (.docx) or CSVs
                  </span>
                </div>

                {/* Category Filters */}
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                    File Categories
                  </span>
                  <div className="flex flex-col gap-1">
                    {[
                      {
                        id: 'all',
                        label: 'All Locker Files',
                        count: lockerFiles.length,
                      },
                      {
                        id: 'image',
                        label: 'Images & Photos',
                        count: lockerFiles.filter((f) => f.fileType === 'image')
                          .length,
                      },
                      {
                        id: 'pdf',
                        label: 'PDF Documents',
                        count: lockerFiles.filter((f) => f.fileType === 'pdf')
                          .length,
                      },
                      {
                        id: 'document',
                        label: 'Word / CSV / Other Docs',
                        count: lockerFiles.filter(
                          (f) => f.fileType === 'document'
                        ).length,
                      },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setLockerFilter(
                            cat.id as 'all' | 'image' | 'pdf' | 'document'
                          )
                        }
                        className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                          lockerFilter === cat.id
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            lockerFilter === cat.id
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {cat.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick CTA to Photo Upper */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-3.5 flex flex-col gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Photo Upper
                </span>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Select multiple photos in your Locker and gang-print{' '}
                  <strong>4×6, 5×7, 8×10, 11×14</strong> or posters onto{' '}
                  <strong>18×24</strong> or <strong>24×36</strong> sheets!
                </p>
                <button
                  type="button"
                  onClick={handleSendSelectedToPhotoNUp}
                  className="w-full py-2 px-3 rounded-lg bg-[#cc0000] hover:bg-red-600 text-white text-xs font-extrabold cursor-pointer shadow-xs"
                >
                  {selectedLockerIds.length > 0
                    ? `Send ${selectedLockerIds.length} Selected to Photo Upper →`
                    : 'Open Photo Upper →'}
                </button>
              </div>
            </div>

            {/* Main Gallery Grid Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Search & Selection Action Bar */}
              <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
                <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50 px-3 py-1.5 w-80">
                  <Search className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    value={lockerSearch}
                    onChange={(e) => setLockerSearch(e.target.value)}
                    placeholder="Search images, PDFs, or documents..."
                    className="bg-transparent text-xs outline-none w-full font-medium"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {selectedLockerIds.length > 0 && (
                    <>
                      <span className="text-xs font-bold text-slate-700">
                        {selectedLockerIds.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={handleSendSelectedToPhotoNUp}
                        className="px-3.5 py-1.5 rounded-lg bg-[#cc0000] hover:bg-red-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Grid className="w-3.5 h-3.5" />
                        Send Selected to Photo Upper →
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLockerIds([])}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Files Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {filteredLockerFiles.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                    <p className="text-sm font-bold text-slate-700 mb-1">
                      No matching files in your File Locker
                    </p>
                    <p className="text-xs text-slate-500 mb-4">
                      Click &quot;+ Upload Images, PDFs or Docs&quot; to add
                      files to your persistent gallery.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg bg-[#cc0000] text-white text-xs font-bold cursor-pointer"
                    >
                      + Upload Files Now
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredLockerFiles.map((item) => {
                      const isSel = selectedLockerIds.includes(item.id);
                      const isImg = item.fileType === 'image';
                      const isPdf = item.fileType === 'pdf';

                      return (
                        <div
                          key={item.id}
                          className={`group bg-white rounded-xl border-2 transition overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-md ${
                            isSel
                              ? 'border-[#cc0000] ring-2 ring-red-500/20'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Thumbnail Area */}
                          <div
                            onClick={() => setPreviewingLockerItem(item)}
                            className="relative h-40 bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                          >
                            <img
                              src={item.thumbnailUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                            />

                            {/* Select Checkbox (Top-Left) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLockerIds((prev) =>
                                  prev.includes(item.id)
                                    ? prev.filter((id) => id !== item.id)
                                    : [...prev, item.id]
                                );
                              }}
                              className={`absolute top-2 left-2 w-6 h-6 rounded-md border flex items-center justify-center transition cursor-pointer ${
                                isSel
                                  ? 'bg-[#cc0000] border-[#cc0000] text-white'
                                  : 'bg-white/90 border-slate-300 text-transparent hover:border-slate-500'
                              }`}
                              title="Select for batch Photo N-Upper"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>

                            {/* Type Badge (Top-Right) */}
                            <span
                              className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase shadow-2xs ${
                                isImg
                                  ? 'bg-emerald-600 text-white'
                                  : isPdf
                                  ? 'bg-red-600 text-white'
                                  : 'bg-slate-800 text-white'
                              }`}
                            >
                              {isImg
                                ? 'IMAGE'
                                : isPdf
                                ? `PDF${
                                    item.pageCount && item.pageCount > 1
                                      ? ` (${item.pageCount}p)`
                                      : ''
                                  }`
                                : 'DOC'}
                            </span>
                          </div>

                          {/* Card Info & Actions */}
                          <div className="p-3 flex flex-col gap-2">
                            <div>
                              {renamingFileId === item.id ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={renamingFileName}
                                  onChange={(e) =>
                                    setRenamingFileName(e.target.value)
                                  }
                                  onBlur={() =>
                                    handleRenameLockerFile(
                                      item.id,
                                      renamingFileName
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRenameLockerFile(
                                        item.id,
                                        renamingFileName
                                      );
                                    } else if (e.key === 'Escape') {
                                      setRenamingFileId(null);
                                    }
                                  }}
                                  className="w-full border border-red-500 rounded px-1.5 py-0.5 text-xs font-bold outline-none"
                                />
                              ) : (
                                <div
                                  onDoubleClick={() => {
                                    setRenamingFileId(item.id);
                                    setRenamingFileName(item.name);
                                  }}
                                  className="text-xs font-bold text-slate-800 truncate"
                                  title={`${item.name} (Double-click to rename)`}
                                >
                                  {item.name}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                                <span>{formatBytes(item.sizeBytes)}</span>
                                {item.widthPx && item.heightPx && (
                                  <span>
                                    {item.widthPx}×{item.heightPx}px
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-1 pt-1 border-t border-slate-100">
                              {(isImg || isPdf) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddLockerFileToPhotoNUp(
                                      item,
                                      'photo-4x6',
                                      2
                                    );
                                    setActiveTab('photo-nup');
                                  }}
                                  className="w-full py-1.5 px-2 rounded-lg bg-red-50 hover:bg-red-600 text-red-700 hover:text-white font-bold text-[10px] flex items-center justify-center gap-1 transition cursor-pointer"
                                >
                                  <Grid className="w-3 h-3" />+ Send to Photo
                                  Upper
                                </button>
                              )}

                              <div className="flex items-center gap-1">
                                {onInsertImageIntoCurrentCanvas &&
                                  (isImg || isPdf) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onInsertImageIntoCurrentCanvas(
                                          item.dataUrl || item.thumbnailUrl,
                                          item.name
                                        );
                                        onClose();
                                      }}
                                      className="flex-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[10px] cursor-pointer"
                                      title="Place directly onto your open Studio canvas"
                                    >
                                      + Canvas
                                    </button>
                                  )}
                                <a
                                  href={item.dataUrl || item.thumbnailUrl}
                                  download={item.name}
                                  className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
                                  title="Download File"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLockerFile(item.id)}
                                  className="p-1 rounded border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                                  title="Delete from File Locker"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Optional Lightbox Preview Drawer when clicking a File Locker item */}
            {previewingLockerItem && (
              <div className="w-80 bg-white border-l border-slate-200 p-4 flex flex-col justify-between shrink-0">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-extrabold text-slate-800 truncate pr-2">
                      {previewingLockerItem.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewingLockerItem(null)}
                      className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="h-56 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden p-2">
                    <img
                      src={previewingLockerItem.thumbnailUrl}
                      alt={previewingLockerItem.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>

                  <div className="text-xs text-slate-600 flex flex-col gap-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Type:</span>
                      <strong className="uppercase">
                        {previewingLockerItem.fileType}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">File Size:</span>
                      <strong>
                        {formatBytes(previewingLockerItem.sizeBytes)}
                      </strong>
                    </div>
                    {previewingLockerItem.widthPx &&
                      previewingLockerItem.heightPx && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Dimensions:</span>
                          <strong>
                            {previewingLockerItem.widthPx} ×{' '}
                            {previewingLockerItem.heightPx} px
                          </strong>
                        </div>
                      )}
                  </div>

                  {previewingLockerItem.rawTextContent && (
                    <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[10px] max-h-40 overflow-auto whitespace-pre-wrap">
                      {previewingLockerItem.rawTextContent.slice(0, 600)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-3 border-t border-slate-200">
                  {(previewingLockerItem.fileType === 'image' ||
                    previewingLockerItem.fileType === 'pdf') && (
                    <button
                      type="button"
                      onClick={() => {
                        handleAddLockerFileToPhotoNUp(
                          previewingLockerItem,
                          'photo-4x6',
                          2
                        );
                        setActiveTab('photo-nup');
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-[#cc0000] hover:bg-red-700 text-white text-xs font-extrabold cursor-pointer"
                    >
                      + Gang-Print in Auto Photo N-Upper
                    </button>
                  )}
                  {onInsertImageIntoCurrentCanvas &&
                    (previewingLockerItem.fileType === 'image' ||
                      previewingLockerItem.fileType === 'pdf') && (
                      <button
                        type="button"
                        onClick={() => {
                          onInsertImageIntoCurrentCanvas(
                            previewingLockerItem.dataUrl ||
                              previewingLockerItem.thumbnailUrl,
                            previewingLockerItem.name
                          );
                          onClose();
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                      >
                        Insert onto Current Studio Canvas
                      </button>
                    )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: AUTO PHOTO N-UPPER & POSTER GANG SHEET ==================== */}
        {activeTab === 'photo-nup' && (
          <div className="flex-1 flex min-h-0 overflow-hidden bg-slate-100">
            {/* LEFT & CENTER CONFIGURATION COLUMN (Output Sheet Size + Locker Photo Picker + Individual Photo Quantities & Sizes) */}
            <div className="w-[640px] bg-white border-r border-slate-200 flex flex-col min-h-0 shrink-0">
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                {/* STEP 1: SELECT OUTPUT SHEET / POSTER SIZE (e.g. 8.5×11, 12×18, 18×24, 24×36) */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 block">
                        Step 1 • Output Sheet / Roll Size
                      </span>
                      <h3 className="text-xs font-extrabold text-slate-900">
                        Select Output Size (Standard Sheets, 18×24, 24×36
                        Posters, or Custom)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRotateEntirePhotoUpperLayout90('cw')}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      title="Rotate Output Sheet & All Photos 90° Together (Portrait ↔ Landscape)"
                    >
                      <RotateCw className="w-3 h-3 text-red-600" />
                      Rotate Layout ({outputWidthIn}×{outputHeightIn}&quot; →{' '}
                      {outputHeightIn}×{outputWidthIn}&quot;)
                    </button>
                  </div>

                  {/* Quick Output Size Buttons */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {PHOTO_OUTPUT_SHEET_PRESETS.filter(
                      (p) => p.id !== 'out-custom'
                    ).map((preset) => {
                      const isSelected =
                        outputPresetId === preset.id &&
                        ((outputWidthIn === preset.widthIn &&
                          outputHeightIn === preset.heightIn) ||
                          (outputWidthIn === preset.heightIn &&
                            outputHeightIn === preset.widthIn));
                      const isPoster = preset.category === 'poster-sheet';
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setOutputPresetId(preset.id);
                            setOutputWidthIn(preset.widthIn);
                            setOutputHeightIn(preset.heightIn);
                            setActivePreviewSheetIdx(0);
                          }}
                          className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : isPoster
                              ? 'bg-amber-50/60 hover:bg-amber-100/70 border-amber-300 text-slate-900'
                              : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                          }`}
                        >
                          <span className="text-xs font-extrabold block">
                            {preset.label}
                          </span>
                          <span
                            className={`text-[9px] truncate block ${
                              isSelected ? 'text-amber-300' : 'text-slate-500'
                            }`}
                          >
                            {preset.subtitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Output W x H + Outer Margin + Photo Cut Gutter + Crop Marks */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200/80">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Output Width (in)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={4}
                        max={72}
                        value={outputWidthIn}
                        onChange={(e) => {
                          setOutputPresetId('out-custom');
                          setOutputWidthIn(
                            Math.max(2, Number(e.target.value) || 18)
                          );
                        }}
                        className="w-full border border-slate-300 rounded-lg bg-white px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Output Height (in)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={4}
                        max={120}
                        value={outputHeightIn}
                        onChange={(e) => {
                          setOutputPresetId('out-custom');
                          setOutputHeightIn(
                            Math.max(2, Number(e.target.value) || 24)
                          );
                        }}
                        className="w-full border border-slate-300 rounded-lg bg-white px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Sheet Margin (in)
                      </label>
                      <select
                        value={sheetMarginIn}
                        onChange={(e) =>
                          setSheetMarginIn(Number(e.target.value))
                        }
                        className="w-full border border-slate-300 rounded-lg bg-white px-2 py-1 text-xs font-bold"
                      >
                        <option value={0}>0&quot; (Full Bleed)</option>
                        <option value={0.125}>1/8&quot; (0.125&quot;)</option>
                        <option value={0.25}>1/4&quot; (0.25&quot;)</option>
                        <option value={0.5}>1/2&quot; (0.50&quot;)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                        Cut Gap Between (in)
                      </label>
                      <select
                        value={photoGapIn}
                        onChange={(e) => setPhotoGapIn(Number(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg bg-white px-2 py-1 text-xs font-bold"
                      >
                        <option value={0}>0&quot; (Butt Cut)</option>
                        <option value={0.0625}>1/16&quot; (0.063&quot;)</option>
                        <option value={0.125}>1/8&quot; (0.125&quot;)</option>
                        <option value={0.25}>1/4&quot; (0.25&quot;)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* STEP 2: CLICK ANY IMAGE FROM YOUR FILE LOCKER TO ADD TO PHOTO N-UPPER QUEUE */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 block">
                        Step 2 • Pick Images from File Locker
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Click any image below to add it to your print list (click
                        multiple times for multiple sizes!)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Upload className="w-3 h-3 text-amber-400" />+ Upload
                      Photos
                    </button>
                  </div>

                  {/* Horizontal Scrollable Locker Strip */}
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                    {lockerFiles
                      .filter(
                        (f) => f.fileType === 'image' || f.fileType === 'pdf'
                      )
                      .map((file) => {
                        const countInQueue = photoOrders
                          .filter((o) => o.lockerFileId === file.id)
                          .reduce((acc, o) => acc + o.quantity, 0);

                        return (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() =>
                              handleAddLockerFileToPhotoNUp(
                                file,
                                'photo-4x6',
                                2
                              )
                            }
                            className="group relative w-24 shrink-0 bg-white rounded-lg border border-slate-300 hover:border-red-600 p-1.5 flex flex-col items-center gap-1 transition cursor-pointer shadow-2xs"
                            title={`Click to add "${file.name}" to the Photo N-Upper list`}
                          >
                            <div className="w-full h-16 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                              <img
                                src={file.thumbnailUrl}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-[9px] font-bold text-slate-700 truncate w-full text-center">
                              {file.name}
                            </span>
                            {countInQueue > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-[#cc0000] text-white text-[9px] font-extrabold shadow-xs">
                                {countInQueue}×
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* STEP 3: SELECTED IMAGES — SET QUANTITY (AMOUNT) & INDIVIDUAL SIZE FOR EACH IMAGE */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 block">
                        Step 3 • Configure Each Photo&apos;s Print Size &amp;
                        Quantity
                      </span>
                      <h3 className="text-xs font-extrabold text-slate-900">
                        Selected Photos Queue ({photoOrders.length} size entries
                        • {totalRequestedPhotos} total prints)
                      </h3>
                    </div>
                    {photoOrders.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const first = photoOrders[0];
                            if (first) {
                              handleAddPortraitPackageForPhoto(
                                first.fileName,
                                first.imageUrl,
                                first.lockerFileId
                              );
                            }
                          }}
                          className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold cursor-pointer"
                          title="Set up 1× 8×10 + 2× 5×7 + 4× 4×6 package for the first photo"
                        >
                          ★ 8×10 + 5×7 + 4×6 Package
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoOrders([])}
                          className="px-2 py-1 rounded border border-slate-300 hover:bg-red-50 text-slate-600 hover:text-red-600 text-[10px] font-semibold cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    )}
                  </div>

                  {photoOrders.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
                      <ImageIcon className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">
                        No photos in your N-Up queue yet
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Click any photo in Step 2 above (or upload a new photo)
                        to choose its print size and quantity!
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {photoOrders.map((ord, idx) => (
                        <div
                          key={ord.id}
                          className="bg-white rounded-xl border border-slate-300 p-3 shadow-2xs flex flex-col gap-2.5"
                        >
                          <div className="flex items-start gap-3">
                            {/* Photo Thumbnail */}
                            <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                              <img
                                src={ord.imageUrl}
                                alt={ord.fileName}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Photo Name, Size Selector & Quantity Controls */}
                            <div className="flex-1 min-w-0 flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-extrabold shrink-0">
                                    #{idx + 1}
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-800 truncate">
                                    {ord.fileName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const dup: PhotoNUpOrderItem = {
                                        ...ord,
                                        id: `ord-dup-${Date.now()}-${Math.random()
                                          .toString(36)
                                          .slice(2, 5)}`,
                                        sizePresetId:
                                          ord.sizePresetId === 'photo-8x10'
                                            ? 'photo-4x6'
                                            : 'photo-8x10',
                                        widthIn:
                                          ord.sizePresetId === 'photo-8x10'
                                            ? 4
                                            : 8,
                                        heightIn:
                                          ord.sizePresetId === 'photo-8x10'
                                            ? 6
                                            : 10,
                                        quantity: 2,
                                      };
                                      const copy = [...photoOrders];
                                      copy.splice(idx + 1, 0, dup);
                                      setPhotoOrders(copy);
                                    }}
                                    className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    title="Add another entry of this same photo so you can print it in a second size on the same sheet!"
                                  >
                                    <Copy className="w-3 h-3" />+ Another Size
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPhotoOrders((prev) =>
                                        prev.filter((item) => item.id !== ord.id)
                                      )
                                    }
                                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                                    title="Remove from queue"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Quick Standard Photo & Poster Size Pills (`4×6`, `5×7`, `8×10`, `11×14`, `12×18`, `16×20`, `18×24`, `24×36`) */}
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-500 mr-1">
                                  Size:
                                </span>
                                {PHOTO_PRINT_SIZE_PRESETS.filter(
                                  (p) => p.id !== 'photo-custom'
                                ).map((preset) => {
                                  const isSelected =
                                    ord.sizePresetId === preset.id;
                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      onClick={() =>
                                        handleSelectOrderSizePreset(
                                          ord.id,
                                          preset.id
                                        )
                                      }
                                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold border transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#cc0000] text-white border-[#cc0000]'
                                          : preset.category === 'poster'
                                          ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-950'
                                          : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                                      }`}
                                      title={preset.subtitle}
                                    >
                                      {preset.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Bottom Row: Custom W×H Inputs + Amount/Quantity Stepper + Max Fill Sheet */}
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 flex-wrap">
                                {/* Exact W × H (in) inputs */}
                                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                                  <span>W×H:</span>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min={1}
                                    max={60}
                                    value={ord.widthIn}
                                    onChange={(e) =>
                                      handleUpdateOrder(ord.id, {
                                        sizePresetId: 'photo-custom',
                                        widthIn: Math.max(
                                          0.5,
                                          Number(e.target.value) || 4
                                        ),
                                      })
                                    }
                                    className="w-12 border border-slate-300 rounded px-1.5 py-0.5 text-center font-bold text-slate-900"
                                  />
                                  <span>×</span>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min={1}
                                    max={60}
                                    value={ord.heightIn}
                                    onChange={(e) =>
                                      handleUpdateOrder(ord.id, {
                                        sizePresetId: 'photo-custom',
                                        heightIn: Math.max(
                                          0.5,
                                          Number(e.target.value) || 6
                                        ),
                                      })
                                    }
                                    className="w-12 border border-slate-300 rounded px-1.5 py-0.5 text-center font-bold text-slate-900"
                                  />
                                  <span>in</span>

                                  <select
                                    value={ord.fitMode}
                                    onChange={(e) =>
                                      handleUpdateOrder(ord.id, {
                                        fitMode: e.target.value as
                                          | 'cover'
                                          | 'contain',
                                      })
                                    }
                                    className="ml-1 border border-slate-300 rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-700"
                                  >
                                    <option value="cover">Fill (Crop)</option>
                                    <option value="contain">
                                      Fit All (No Crop)
                                    </option>
                                  </select>
                                </div>

                                {/* Quantity / Amount Stepper */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold text-slate-700">
                                    Qty:
                                  </span>
                                  <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateOrder(ord.id, {
                                          quantity: Math.max(
                                            1,
                                            ord.quantity - 1
                                          ),
                                        })
                                      }
                                      className="px-2 py-0.5 hover:bg-slate-200 font-extrabold text-xs cursor-pointer"
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      max={200}
                                      value={ord.quantity}
                                      onChange={(e) =>
                                        handleUpdateOrder(ord.id, {
                                          quantity: Math.max(
                                            1,
                                            Number(e.target.value) || 1
                                          ),
                                        })
                                      }
                                      className="w-11 text-center font-extrabold text-xs bg-white py-0.5 outline-none border-x border-slate-300"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateOrder(ord.id, {
                                          quantity: ord.quantity + 1,
                                        })
                                      }
                                      className="px-2 py-0.5 hover:bg-slate-200 font-extrabold text-xs cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMaxFillOneSheetForOrder(ord)
                                    }
                                    className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-extrabold cursor-pointer"
                                    title={`Set quantity to fill 1 full ${outputWidthIn}×${outputHeightIn}" sheet with this photo size`}
                                  >
                                    Max Fill Sheet
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT INTERACTIVE PHOTO UPPER PREVIEW, DRAG/ROTATE ARRANGEMENT & EXPORT COLUMN */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-100">
              {/* Preview Top Bar */}
              <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-extrabold text-slate-900">
                    Photo Upper Preview ({outputWidthIn} × {outputHeightIn}
                    &quot;)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                    {packedSheets.length} Sheet
                    {packedSheets.length > 1 ? 's' : ''} •{' '}
                    {totalRequestedPhotos} Prints •{' '}
                    {currentPreviewSheet?.utilizationPct || 0}% Used
                  </span>

                  {/* Live Fit Proof Comparison Badge when user manually moves or rotates photos */}
                  {overrideCount > 0 && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        packedSheets.length < baselinePackedSheets.length
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : packedSheets.length === baselinePackedSheets.length
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                          : 'bg-amber-100 text-amber-900 border-amber-400'
                      }`}
                    >
                      {packedSheets.length < baselinePackedSheets.length
                        ? `★ Saved ${
                            baselinePackedSheets.length - packedSheets.length
                          } Sheet vs Default Auto-Fit!`
                        : packedSheets.length === baselinePackedSheets.length
                        ? `✓ Fits on ${packedSheets.length} Sheet${
                            packedSheets.length > 1 ? 's' : ''
                          } (Matches Best Auto-Fit)`
                        : `⚠ Uses ${packedSheets.length} Sheets (Auto-Fit used ${baselinePackedSheets.length})`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Arrangement Mode Pill: Auto-Fit Around vs Free Manual Arrange */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleToggleAutoFitMode(true)}
                      className={`px-2 py-1 rounded-md font-extrabold transition cursor-pointer ${
                        autoFitAroundMode
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="When you drag or rotate a photo, all other photos automatically reflow and fit into the open spaces around it!"
                    >
                      Auto-Fit Others Around
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAutoFitMode(false)}
                      className={`px-2 py-1 rounded-md font-extrabold transition cursor-pointer ${
                        !autoFitAroundMode
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Lock all photos where they are so you can manually drag & test positioning without other photos moving"
                    >
                      Free Move (Manual)
                    </button>
                  </div>

                  {/* Rotate Entire Layout 90° or Rotate All Photos 90° Together */}
                  <button
                    type="button"
                    onClick={() => handleRotateEntirePhotoUpperLayout90('cw')}
                    className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                    title="Rotate the entire sheet layout and all photos 90° together"
                  >
                    <RotateCw className="w-3 h-3 text-red-600" />
                    Rotate Layout 90°
                  </button>

                  <button
                    type="button"
                    onClick={handleRotateAllPhotos90InPlace}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                    title="Rotate all photos 90° in unison so every photo shares the same orientation"
                  >
                    <RotateCw className="w-3 h-3 text-indigo-600" />
                    Rotate All Photos 90°
                  </button>

                  {overrideCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlacementOverrides({});
                        setAutoFitAroundMode(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                      title="Clear manual moves/rotations and restore default automatic fit"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Auto-Fit
                    </button>
                  )}

                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCropMarks}
                      onChange={(e) => setIncludeCropMarks(e.target.checked)}
                      className="accent-[#cc0000]"
                    />
                    <span>Cut Marks</span>
                  </label>

                  {packedSheets.length > 1 && (
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-300">
                      <button
                        type="button"
                        onClick={() =>
                          setActivePreviewSheetIdx((prev) =>
                            Math.max(0, prev - 1)
                          )
                        }
                        disabled={safeSheetIdx === 0}
                        className="px-2 py-0.5 rounded bg-white disabled:opacity-40 text-xs font-bold cursor-pointer"
                      >
                        ◀
                      </button>
                      <span className="text-xs font-extrabold px-2">
                        Sheet {safeSheetIdx + 1} of {packedSheets.length}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setActivePreviewSheetIdx((prev) =>
                            Math.min(packedSheets.length - 1, prev + 1)
                          )
                        }
                        disabled={safeSheetIdx >= packedSheets.length - 1}
                        className="px-2 py-0.5 rounded bg-white disabled:opacity-40 text-xs font-bold cursor-pointer"
                      >
                        ▶
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Selected Photo Arrangement Toolbar (or Instruction Banner if none selected) */}
              <div className="px-5 py-2 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs">
                {selectedPlacement ? (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold shrink-0">
                        Selected Photo
                      </span>
                      <span className="font-extrabold truncate max-w-44">
                        {selectedPlacement.fileName} (#{selectedPlacement.copyIndex})
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-amber-300 font-bold">
                        {selectedPlacement.widthIn}×{selectedPlacement.heightIn}&quot;
                        {selectedPlacement.rotated ? ' (Rotated 90°)' : ''}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        X: {selectedPlacement.xIn.toFixed(2)}&quot;, Y:{' '}
                        {selectedPlacement.yIn.toFixed(2)}&quot;
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          handleRotatePlacement(selectedPlacement, true)
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#cc0000] hover:bg-red-600 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shadow-xs"
                        title="Rotate this photo 90° at its current position and auto-fit other photos around it!"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        Rotate 90° (Fit Around)
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleRotatePlacement(selectedPlacement, false)
                        }
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Rotate this photo 90° and let Photo Upper find the tightest spot on the sheet"
                      >
                        <RotateCw className="w-3 h-3" />
                        Rotate 90° (Auto-Spot)
                      </button>

                      <div className="h-4 w-px bg-slate-700 mx-0.5" />

                      <span className="text-[10px] text-slate-400 font-bold">
                        Snap &amp; Fit Around:
                      </span>
                      {(
                        [
                          { id: 'tl', label: '↖ Top-L' },
                          { id: 'tr', label: '↗ Top-R' },
                          { id: 'center', label: '⊕ Center' },
                          { id: 'bl', label: '↙ Bot-L' },
                          { id: 'br', label: '↘ Bot-R' },
                        ] as const
                      ).map((anc) => (
                        <button
                          key={anc.id}
                          type="button"
                          onClick={() =>
                            handleSnapPlacementToAnchor(
                              selectedPlacement,
                              anc.id
                            )
                          }
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer"
                          title={`Move selected photo to ${anc.label} and auto-fit all other photos around it`}
                        >
                          {anc.label}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setSelectedPlacementKey(null)}
                        className="ml-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-bold cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 text-[11px] text-slate-300">
                      <Move className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>Interactive Photo Upper:</strong> Click any photo
                        on the sheet below to select it, <strong>drag it</strong>{' '}
                        anywhere on the sheet, or <strong>double-click / click Rotate 90°</strong>{' '}
                        — other photos automatically fit around your move so you
                        can test and prove the best fit!
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Scaled Sheet Canvas Preview */}
              <div
                onClick={() => setSelectedPlacementKey(null)}
                className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center"
              >
                {currentPreviewSheet &&
                  (() => {
                    const maxPreviewPx = 520;
                    const scale = Math.min(
                      maxPreviewPx / currentPreviewSheet.sheetWidthIn,
                      maxPreviewPx / currentPreviewSheet.sheetHeightIn
                    );
                    const sheetWPx = Math.round(
                      currentPreviewSheet.sheetWidthIn * scale
                    );
                    const sheetHPx = Math.round(
                      currentPreviewSheet.sheetHeightIn * scale
                    );
                    const marginPx = sheetMarginIn * scale;

                    return (
                      <div className="relative flex flex-col items-center">
                        {/* Top Dimension Callout */}
                        <div className="mb-2 text-xs font-extrabold text-slate-600 flex items-center gap-2">
                          <span>
                            Output Sheet: {currentPreviewSheet.sheetWidthIn}
                            &quot; W × {currentPreviewSheet.sheetHeightIn}&quot;
                            H
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-red-600">
                            {currentPreviewSheet.placements.length} Photo
                            {currentPreviewSheet.placements.length !== 1
                              ? 's'
                              : ''}{' '}
                            on Sheet {safeSheetIdx + 1}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-indigo-700 font-bold">
                            Drag any photo to rearrange • Double-click to Rotate 90°
                          </span>
                        </div>

                        {/* Physical White Sheet Box */}
                        <div
                          style={{
                            width: `${sheetWPx}px`,
                            height: `${sheetHPx}px`,
                          }}
                          className="relative bg-white shadow-2xl border-2 border-slate-400 overflow-visible"
                        >
                          {/* Safe Sheet Margin Dashed Guide */}
                          {sheetMarginIn > 0 && (
                            <div
                              style={{
                                left: `${marginPx}px`,
                                top: `${marginPx}px`,
                                right: `${marginPx}px`,
                                bottom: `${marginPx}px`,
                              }}
                              className="absolute border border-dashed border-sky-400/70 pointer-events-none z-20"
                            />
                          )}

                          {/* Packed Photo Placements (Interactive: Click to Select, Drag to Move, Double-Click or Button to Rotate 90°) */}
                          {currentPreviewSheet.placements.map((pl, pIdx) => {
                            const key =
                              pl.placementKey ||
                              `${pl.orderId}::${pl.copyIndex}`;
                            const isSelected = selectedPlacementKey === key;
                            const isDraggingThis =
                              dragPhotoState?.placementKey === key;

                            const leftPx = pl.xIn * scale;
                            const topPx = pl.yIn * scale;
                            const wPx = pl.widthIn * scale;
                            const hPx = pl.heightIn * scale;

                            // Check if this placement overlaps any other placement on the same sheet (useful in Free Move mode!)
                            const hasOverlap = currentPreviewSheet.placements.some(
                              (other, oIdx) => {
                                if (oIdx === pIdx) return false;
                                const eps = 0.02;
                                return !(
                                  pl.xIn + pl.widthIn <= other.xIn + eps ||
                                  other.xIn + other.widthIn <= pl.xIn + eps ||
                                  pl.yIn + pl.heightIn <= other.yIn + eps ||
                                  other.yIn + other.heightIn <= pl.yIn + eps
                                );
                              }
                            );

                            return (
                              <div
                                key={`${key}-${pIdx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPlacementKey(key);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleRotatePlacement(pl, true);
                                }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedPlacementKey(key);
                                  setDragPhotoState({
                                    placementKey: key,
                                    sheetIdx: safeSheetIdx,
                                    startClientX: e.clientX,
                                    startClientY: e.clientY,
                                    startXIn: pl.xIn,
                                    startYIn: pl.yIn,
                                    widthIn: pl.widthIn,
                                    heightIn: pl.heightIn,
                                    rotated: pl.rotated,
                                    scale,
                                  });
                                }}
                                style={{
                                  left: `${leftPx}px`,
                                  top: `${topPx}px`,
                                  width: `${wPx}px`,
                                  height: `${hPx}px`,
                                }}
                                className={`absolute bg-slate-100 group cursor-grab active:cursor-grabbing transition-shadow ${
                                  hasOverlap
                                    ? 'ring-2 ring-red-600 z-40 shadow-xl'
                                    : isSelected
                                    ? 'ring-3 ring-amber-400 z-30 shadow-2xl'
                                    : 'hover:ring-2 hover:ring-indigo-500 z-10'
                                } ${isDraggingThis ? 'opacity-95 scale-[1.01]' : ''}`}
                                title={`${pl.fileName} (${pl.widthIn}×${pl.heightIn}") — Drag to move, Double-click to Rotate 90°`}
                              >
                                <div className="w-full h-full overflow-hidden relative">
                                  {pl.rotated ? (
                                    <div
                                      style={{
                                        width: `${hPx}px`,
                                        height: `${wPx}px`,
                                        left: '50%',
                                        top: '50%',
                                        transform:
                                          'translate(-50%, -50%) rotate(90deg)',
                                      }}
                                      className="absolute pointer-events-none"
                                    >
                                      <img
                                        src={pl.imageUrl}
                                        alt={pl.fileName}
                                        draggable={false}
                                        className={`w-full h-full pointer-events-none ${
                                          pl.fitMode === 'contain'
                                            ? 'object-contain bg-white'
                                            : 'object-cover'
                                        }`}
                                      />
                                    </div>
                                  ) : (
                                    <img
                                      src={pl.imageUrl}
                                      alt={pl.fileName}
                                      draggable={false}
                                      className={`w-full h-full pointer-events-none ${
                                        pl.fitMode === 'contain'
                                          ? 'object-contain bg-white'
                                          : 'object-cover'
                                      }`}
                                    />
                                  )}

                                  {/* Cut Line Border */}
                                  {includeCropMarks && (
                                    <div className="absolute inset-0 border border-dashed border-red-500/80 pointer-events-none" />
                                  )}

                                  {/* Overlap Warning Overlay in Manual Mode */}
                                  {hasOverlap && (
                                    <div className="absolute inset-0 bg-red-600/25 flex items-center justify-center pointer-events-none">
                                      <span className="bg-red-700 text-white px-2 py-0.5 rounded text-[9px] font-extrabold shadow">
                                        Overlap!
                                      </span>
                                    </div>
                                  )}

                                  {/* Top-Left Quick Rotate 90° Button on Hover or When Selected */}
                                  <div
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className={`absolute top-1 left-1 flex items-center gap-1 transition-opacity ${
                                      isSelected
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover:opacity-100'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRotatePlacement(pl, true);
                                      }}
                                      className="bg-slate-900/90 hover:bg-[#cc0000] text-white px-1.5 py-0.5 rounded text-[9px] font-extrabold shadow flex items-center gap-0.5 cursor-pointer"
                                      title="Rotate this photo 90° and auto-fit others around it"
                                    >
                                      <RotateCw className="w-2.5 h-2.5 text-amber-300" />
                                      Rotate 90°
                                    </button>
                                  </div>

                                  {/* Size Callout Pill inside each packed photo */}
                                  <div className="absolute bottom-1 right-1 bg-slate-900/85 text-white px-1.5 py-0.5 rounded text-[9px] font-extrabold shadow-xs pointer-events-none flex items-center gap-1">
                                    <span>
                                      {pl.widthIn}×{pl.heightIn}&quot;
                                    </span>
                                    {pl.rotated && (
                                      <span className="text-amber-300">↻90°</span>
                                    )}
                                    {pl.isPinned && (
                                      <span className="text-sky-300" title="Manually positioned/rotated">
                                        📌
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
              </div>

              {/* Bottom Action Footer */}
              <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-600">
                  Ready to print{' '}
                  <strong className="text-slate-900">
                    {totalRequestedPhotos} photo
                    {totalRequestedPhotos !== 1 ? 's' : ''}
                  </strong>{' '}
                  across{' '}
                  <strong className="text-slate-900">
                    {packedSheets.length} sheet
                    {packedSheets.length !== 1 ? 's' : ''}
                  </strong>{' '}
                  ({outputWidthIn} × {outputHeightIn}&quot;).
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isBuildingProject || totalRequestedPhotos === 0}
                    onClick={handleOpenInStudio}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Layers className="w-4 h-4 text-amber-300" />
                    {isBuildingProject
                      ? 'Building Editable Pages...'
                      : `Open ${packedSheets.length} Sheet${
                          packedSheets.length > 1 ? 's' : ''
                        } in Studio Editor`}
                  </button>

                  <button
                    type="button"
                    disabled={isExportingPdf || totalRequestedPhotos === 0}
                    onClick={handleDirectExportPdf}
                    className="px-5 py-2.5 rounded-xl bg-[#cc0000] hover:bg-red-700 disabled:opacity-45 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    {isExportingPdf
                      ? 'Generating High-Res PDF...'
                      : `Export Print-Ready PDF (${outputWidthIn}×${outputHeightIn}")`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
