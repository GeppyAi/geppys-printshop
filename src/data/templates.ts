import {
  BankTabConfig,
  CanvasElement,
  MailMergeConfig,
  MasterDesign,
  PrintProject,
  PrintTemplate,
  VariableDataList,
} from '../types/printstudio';

export const DEFAULT_TAB_ACCENT_PALETTE = [
  '#fee2e2', // Soft Red
  '#fef3c7', // Soft Amber
  '#dcfce7', // Soft Emerald
  '#dbeafe', // Soft Blue
  '#f3e8ff', // Soft Purple
  '#fce7f3', // Soft Pink
  '#ccfbf1', // Soft Teal
  '#ffedd5', // Soft Orange
  '#e0e7ff', // Soft Indigo
  '#f1f5f9', // Soft Slate
];

export function createDefaultBankTabConfig(count: number = 3): BankTabConfig {
  const safeCount = Math.max(1, Math.min(15, count || 3));
  const defaultNames3 = [
    'Section 1: Overview',
    'Section 2: Details',
    'Section 3: Appendix',
  ];
  const defaultNames5 = [
    'Tab 1: Introduction',
    'Tab 2: Specifications',
    'Tab 3: Pricing & Schedule',
    'Tab 4: Terms & Conditions',
    'Tab 5: Appendix & Contacts',
  ];
  const labels = Array.from({ length: safeCount }, (_, i) => {
    if (safeCount === 3 && defaultNames3[i]) return defaultNames3[i];
    if (safeCount === 5 && defaultNames5[i]) return defaultNames5[i];
    return `Tab ${i + 1}`;
  });
  const colors = Array.from({ length: safeCount }, () => '#ffffff');
  const textColors = Array.from({ length: safeCount }, () => '#0f172a');
  return {
    enabled: true,
    count: safeCount,
    labels,
    colors,
    textColors,
    fontSizePt: 9.5,
    tabExtensionIn: 0.5,
    displayMode: 'all-tabs',
  };
}

export const CUSTOM_TEMPLATES_STORAGE_KEY = 'geppys_custom_templates_v1';

export function loadSavedCustomTemplates(): PrintTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplatesToStorage(templates: PrintTemplate[]): void {
  try {
    localStorage.setItem(
      CUSTOM_TEMPLATES_STORAGE_KEY,
      JSON.stringify(templates)
    );
  } catch (e) {
    console.error('Failed to save custom templates to localStorage', e);
  }
}

export const DEFAULT_SAMPLE_MAIL_MERGE: MailMergeConfig = {
  enabled: true,
  activeListId: 'list-vip-contacts',
  activeListName: 'VIP Mailing & Contacts',
  previewRecordIndex: 0,
  fields: ['Name', 'Title', 'Company', 'Address', 'CityStateZip', 'Code'],
  records: [
    {
      Name: 'Jordan Vance',
      Title: 'VIP Member',
      Company: 'Apex Builders LLC',
      Address: '742 Evergreen Terrace',
      CityStateZip: 'Columbus, OH 43215',
      Code: 'VIP-101',
    },
    {
      Name: 'Elena Rostova',
      Title: 'Executive Director',
      Company: 'Northstar Logistics',
      Address: '1280 Market Street, Suite 400',
      CityStateZip: 'Cleveland, OH 44113',
      Code: 'VIP-102',
    },
    {
      Name: 'Marcus Sterling',
      Title: 'Operations Lead',
      Company: 'Sterling Mechanical',
      Address: '455 Industrial Pkwy',
      CityStateZip: 'Cincinnati, OH 45202',
      Code: 'VIP-103',
    },
    {
      Name: 'Hannah Reyes',
      Title: 'Creative Partner',
      Company: 'Reyes Design Co.',
      Address: '890 Oakwood Ave',
      CityStateZip: 'Dayton, OH 45402',
      Code: 'VIP-104',
    },
  ],
};

export const VARIABLE_LISTS_STORAGE_KEY = 'geppys_variable_lists_v1';

export const DEFAULT_VARIABLE_LISTS: VariableDataList[] = [
  {
    id: 'list-vip-contacts',
    name: 'VIP Mailing & Contacts',
    category: 'contacts',
    description:
      'Mailing addresses, recipient names, companies & VIP codes for postcards, letters & envelopes',
    fields: ['Name', 'Title', 'Company', 'Address', 'CityStateZip', 'Code'],
    records: DEFAULT_SAMPLE_MAIL_MERGE.records,
    updatedAt: '2026-10-23T12:00:00Z',
  },
  {
    id: 'list-event-badges',
    name: 'Event Badges & Staff Passes',
    category: 'badges',
    description:
      'Attendee names, job roles, departments & badge IDs for event lanyards and name tags',
    fields: ['FullName', 'Role', 'Department', 'AccessLevel', 'BadgeID'],
    records: [
      {
        FullName: 'Alex Geppy',
        Role: 'Keynote Speaker',
        Department: 'Print Leadership',
        AccessLevel: 'ALL-ACCESS VIP',
        BadgeID: 'BDG-1001',
      },
      {
        FullName: 'Samantha Chen',
        Role: 'Press & Media Lead',
        Department: 'Editorial',
        AccessLevel: 'PRESS PASS',
        BadgeID: 'BDG-1002',
      },
      {
        FullName: 'Devon Brooks',
        Role: 'Production Engineer',
        Department: 'Prepress & Finishing',
        AccessLevel: 'STAFF CREW',
        BadgeID: 'BDG-1003',
      },
      {
        FullName: 'Maria Alvarez',
        Role: 'Exhibitor Partner',
        Department: 'Packaging Solutions',
        AccessLevel: 'EXHIBITOR',
        BadgeID: 'BDG-1004',
      },
    ],
    updatedAt: '2026-10-23T12:00:00Z',
  },
  {
    id: 'list-product-tags',
    name: 'Product & Retail Price Tags',
    category: 'products',
    description:
      'Product names, SKUs, prices & descriptions for shelf talkers, signs, menus & retail labels',
    fields: ['ItemName', 'SKU', 'Price', 'SalePrice', 'Category', 'Notes'],
    records: [
      {
        ItemName: '24×18 Coroplast Yard Sign',
        SKU: 'SIGN-2418',
        Price: '$24.99',
        SalePrice: '$18.50',
        Category: 'Outdoor Signage',
        Notes: 'Includes H-Stake & UV Ink',
      },
      {
        ItemName: '100lb Gloss Tri-Fold Brochure',
        SKU: 'BRO-8511',
        Price: '$149.00',
        SalePrice: '$119.00',
        Category: 'Marketing Collateral',
        Notes: 'Pack of 500 Full-Bleed',
      },
      {
        ItemName: '16pt Silk Matte Business Cards',
        SKU: 'BC-1000',
        Price: '$65.00',
        SalePrice: '$49.00',
        Category: 'Business Stationery',
        Notes: '1,000 Cards • 2-Sided',
      },
      {
        ItemName: 'Carbonless 2-Part Invoice Book',
        SKU: 'NCR-2PT',
        Price: '$89.00',
        SalePrice: '$74.00',
        Category: 'Forms & Numbering',
        Notes: 'Sequential Crash Numbered',
      },
    ],
    updatedAt: '2026-10-23T12:00:00Z',
  },
  {
    id: 'list-seating-cards',
    name: 'Banquet Seating & Place Cards',
    category: 'events',
    description:
      'Guest names, table numbers & meal selections for wedding/gala place cards and invitations',
    fields: ['GuestName', 'TableNumber', 'Seat', 'MealChoice', 'Group'],
    records: [
      {
        GuestName: 'Dr. & Mrs. Harrison',
        TableNumber: 'Table 1',
        Seat: 'Seats A1–A2',
        MealChoice: 'Filet Mignon',
        Group: 'Head Table',
      },
      {
        GuestName: 'Claire & Liam Vance',
        TableNumber: 'Table 2',
        Seat: 'Seats B3–B4',
        MealChoice: 'Herb Roasted Salmon',
        Group: 'VIP Guests',
      },
      {
        GuestName: 'Noah Sterling',
        TableNumber: 'Table 3',
        Seat: 'Seat C1',
        MealChoice: 'Wild Mushroom Risotto',
        Group: 'Sponsors',
      },
      {
        GuestName: 'Sophia & Ethan Brooks',
        TableNumber: 'Table 4',
        Seat: 'Seats D1–D2',
        MealChoice: 'Filet Mignon',
        Group: 'Friends & Family',
      },
    ],
    updatedAt: '2026-10-23T12:00:00Z',
  },
];

export function loadSavedVariableLists(): VariableDataList[] {
  try {
    const raw = localStorage.getItem(VARIABLE_LISTS_STORAGE_KEY);
    if (!raw) return DEFAULT_VARIABLE_LISTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_VARIABLE_LISTS;
  } catch {
    return DEFAULT_VARIABLE_LISTS;
  }
}

export function saveVariableListsToStorage(lists: VariableDataList[]): void {
  try {
    localStorage.setItem(VARIABLE_LISTS_STORAGE_KEY, JSON.stringify(lists));
  } catch (e) {
    console.error('Failed to save variable data lists to localStorage', e);
  }
}

export function exportVariableListToCsvString(
  fields: string[],
  records: Record<string, string>[]
): string {
  const escapeCsvCell = (val: string): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = fields.map(escapeCsvCell).join(',');
  const rowLines = records.map((rec) =>
    fields.map((f) => escapeCsvCell(rec[f] ?? '')).join(',')
  );
  return [headerLine, ...rowLines].join('\r\n');
}

export const PRINT_TEMPLATES: PrintTemplate[] = [
  // Top Row: "Start new document" (from Photo 2)
  {
    id: 'doc-8.5x11',
    name: '8.5 × 11"',
    subtitle: '8.5 × 11"',
    category: 'standard',
    sheetWidthIn: 8.5,
    sheetHeightIn: 11,
    orientation: 'portrait',
    defaultBleedIn: 0,
    defaultMarginXIn: 0.5,
    defaultMarginYIn: 0.5,
  },
  {
    id: 'doc-8.5x14',
    name: '8.5 × 14"',
    subtitle: '8.5 × 14"',
    category: 'standard',
    sheetWidthIn: 8.5,
    sheetHeightIn: 14,
    orientation: 'portrait',
    defaultBleedIn: 0,
    defaultMarginXIn: 0.5,
    defaultMarginYIn: 0.5,
  },
  {
    id: 'doc-11x17',
    name: '11 × 17"',
    subtitle: '11 × 17"',
    category: 'standard',
    sheetWidthIn: 11,
    sheetHeightIn: 17,
    orientation: 'portrait',
    defaultBleedIn: 0,
    defaultMarginXIn: 0.5,
    defaultMarginYIn: 0.5,
  },
  {
    id: 'doc-12x18',
    name: '12 × 18"',
    subtitle: '12 × 18"',
    category: 'standard',
    sheetWidthIn: 12,
    sheetHeightIn: 18,
    orientation: 'portrait',
    defaultBleedIn: 0.125,
    defaultMarginXIn: 0.5,
    defaultMarginYIn: 0.5,
  },
  {
    id: 'booklet-5.5x8.5',
    name: 'Booklet – 5.5 × 8.5"',
    subtitle: '8.5 × 11" Sheet (Folded)',
    category: 'booklet',
    sheetWidthIn: 11,
    sheetHeightIn: 8.5,
    orientation: 'landscape',
    isBooklet: true,
    badge: 'Booklet',
    imposition: {
      cols: 2,
      rows: 1,
      unitWidthIn: 5.5,
      unitHeightIn: 8.5,
      marginLeftIn: 0,
      marginTopIn: 0,
      gapXIn: 0,
      gapYIn: 0,
    },
    defaultBleedIn: 0,
    defaultMarginXIn: 0.375,
    defaultMarginYIn: 0.375,
  },
  {
    id: 'booklet-8.5x11',
    name: 'Booklet – 8.5 × 11"',
    subtitle: '17 × 11" Sheet (Folded)',
    category: 'booklet',
    sheetWidthIn: 17,
    sheetHeightIn: 11,
    orientation: 'landscape',
    isBooklet: true,
    badge: 'Booklet',
    imposition: {
      cols: 2,
      rows: 1,
      unitWidthIn: 8.5,
      unitHeightIn: 11,
      marginLeftIn: 0,
      marginTopIn: 0,
      gapXIn: 0,
      gapYIn: 0,
    },
    defaultBleedIn: 0,
    defaultMarginXIn: 0.5,
    defaultMarginYIn: 0.5,
  },

  // Bottom Row: "Other templates" (from Photo 2)
  {
    id: 'tabs-3bank',
    name: '3 Bank Tabs',
    subtitle: '9 × 11"',
    category: 'other',
    sheetWidthIn: 9,
    sheetHeightIn: 11,
    orientation: 'portrait',
    bankTabs: 3,
    defaultBleedIn: 0,
    defaultMarginXIn: 0.5,
    defaultMarginYIn: 0.5,
  },
  {
    id: 'tabs-5bank',
    name: '5 Bank Tabs',
    subtitle: '9 × 11"',
    category: 'other',
    sheetWidthIn: 9,
    sheetHeightIn: 11,
    orientation: 'portrait',
    bankTabs: 5,
    defaultBleedIn: 0,
    defaultMarginXIn: 0.5,
    defaultMarginYIn: 0.5,
  },
  {
    id: 'bcard-10up',
    name: 'Business Card - 10up',
    subtitle: '8.5 × 11"',
    category: 'other',
    sheetWidthIn: 8.5,
    sheetHeightIn: 11,
    orientation: 'portrait',
    imposition: {
      cols: 2,
      rows: 5,
      unitWidthIn: 3.5,
      unitHeightIn: 2.0,
      marginLeftIn: 0.75,
      marginTopIn: 0.5,
      gapXIn: 0,
      gapYIn: 0,
    },
    defaultBleedIn: 0,
    defaultMarginXIn: 0.2,
    defaultMarginYIn: 0.38,
  },
  {
    id: 'bcard-single',
    name: 'Business Card - Single',
    subtitle: '3.5 × 2"',
    category: 'other',
    sheetWidthIn: 3.5,
    sheetHeightIn: 2.0,
    orientation: 'landscape',
    defaultBleedIn: 0.125,
    defaultMarginXIn: 0.15,
    defaultMarginYIn: 0.15,
  },
  {
    id: 'envelope-printing',
    name: 'Envelope Printing',
    subtitle: '7.25 × 5.25"',
    category: 'other',
    sheetWidthIn: 7.25,
    sheetHeightIn: 5.25,
    orientation: 'landscape',
    defaultBleedIn: 0,
    defaultMarginXIn: 0.35,
    defaultMarginYIn: 0.35,
  },
  {
    id: 'postcard-4up',
    name: 'Postcard / Invite - 4up',
    subtitle: '8.5 × 11" (4.25 × 5.5" each)',
    category: 'other',
    sheetWidthIn: 8.5,
    sheetHeightIn: 11,
    orientation: 'portrait',
    imposition: {
      cols: 2,
      rows: 2,
      unitWidthIn: 4.25,
      unitHeightIn: 5.5,
      marginLeftIn: 0,
      marginTopIn: 0,
      gapXIn: 0,
      gapYIn: 0,
    },
    defaultBleedIn: 0,
    defaultMarginXIn: 0.25,
    defaultMarginYIn: 0.25,
  },
  {
    id: 'invite-5x7',
    name: 'Invite / Postcard - Single',
    subtitle: '5 × 7"',
    category: 'other',
    sheetWidthIn: 5,
    sheetHeightIn: 7,
    orientation: 'portrait',
    defaultBleedIn: 0.125,
    defaultMarginXIn: 0.25,
    defaultMarginYIn: 0.25,
  },
  {
    id: 'bcard-24up-12x18',
    name: 'Business Card - 24up Press',
    subtitle: '12 × 18" (3 × 8 Grid)',
    category: 'other',
    sheetWidthIn: 12,
    sheetHeightIn: 18,
    orientation: 'portrait',
    imposition: {
      cols: 3,
      rows: 8,
      unitWidthIn: 3.5,
      unitHeightIn: 2.0,
      marginLeftIn: 0.75,
      marginTopIn: 1.0,
      gapXIn: 0,
      gapYIn: 0,
    },
    defaultBleedIn: 0.125,
    defaultMarginXIn: 0.25,
    defaultMarginYIn: 0.25,
  },
  {
    id: 'yard-sign-24x18',
    name: 'Roadside / Yard Sign',
    subtitle: '24 × 18" Landscape',
    category: 'other',
    sheetWidthIn: 24,
    sheetHeightIn: 18,
    orientation: 'landscape',
    badge: 'Signage',
    defaultBleedIn: 0.125,
    defaultMarginXIn: 0.75,
    defaultMarginYIn: 0.75,
  },
  {
    id: 'sign-18x24',
    name: 'Warning / For Sale Sign',
    subtitle: '18 × 24" Portrait',
    category: 'other',
    sheetWidthIn: 18,
    sheetHeightIn: 24,
    orientation: 'portrait',
    badge: 'Signage',
    defaultBleedIn: 0.125,
    defaultMarginXIn: 0.75,
    defaultMarginYIn: 0.75,
  },
];

export function getDesignUnitSize(template: PrintTemplate): {
  widthIn: number;
  heightIn: number;
} {
  if (template.imposition) {
    return {
      widthIn: template.imposition.unitWidthIn,
      heightIn: template.imposition.unitHeightIn,
    };
  }
  return {
    widthIn: template.sheetWidthIn,
    heightIn: template.sheetHeightIn,
  };
}

/**
 * Smartly adapts a MasterDesign from a source unit size (e.g., 3.5 x 2" Business Card)
 * to ANY target template's unit size (e.g., 8.5x11 Flyer, 7.25x5.25 Envelope, 5x7 Invite, 9x11 Bank Tabs, Booklet, etc.)
 * while preserving semantic hierarchy, font legibility, and proportional layout.
 */
export function adaptDesignToTemplate(
  sourceMaster: MasterDesign,
  sourceWidthIn: number,
  sourceHeightIn: number,
  targetTemplate: PrintTemplate
): MasterDesign {
  const { widthIn: targetW, heightIn: targetH } = getDesignUnitSize(targetTemplate);

  // If the dimensions are practically identical (e.g. Business Card Single 3.5x2 <-> Business Card 10up 3.5x2 unit), keep exact layout!
  if (
    Math.abs(sourceWidthIn - targetW) < 0.05 &&
    Math.abs(sourceHeightIn - targetH) < 0.05
  ) {
    return {
      ...sourceMaster,
      elements: sourceMaster.elements.map((el) => ({ ...el })),
    };
  }

  // Special layout adaptation for Envelope Printing (return address in top-left corner or branded header)
  const scaleX = targetW / sourceWidthIn;
  const scaleY = targetH / sourceHeightIn;
  const fontScale = Math.sqrt(scaleX * scaleY);

  const adaptedElements: CanvasElement[] = sourceMaster.elements.map((el) => {
    const newEl: CanvasElement = {
      ...el,
      x: Number((el.x * scaleX).toFixed(3)),
      y: Number((el.y * scaleY).toFixed(3)),
      width: Number((el.width * scaleX).toFixed(3)),
      height: Number((el.height * scaleY).toFixed(3)),
    };

    if (el.fontSize) {
      newEl.fontSize = Math.max(7, Math.round(el.fontSize * fontScale));
    }
    if (el.strokeWidth) {
      newEl.strokeWidth = Math.max(0.5, Number((el.strokeWidth * fontScale).toFixed(1)));
    }
    if (el.borderRadius) {
      newEl.borderRadius = Math.round(el.borderRadius * fontScale);
    }

    // Keep circles circular when aspect ratio changes significantly
    if (el.type === 'circle' || el.type === 'qr' || el.type === 'star') {
      const avgSize = Math.min(newEl.width, newEl.height);
      newEl.width = Number(avgSize.toFixed(3));
      newEl.height = Number(avgSize.toFixed(3));
    }

    return newEl;
  });

  return {
    ...sourceMaster,
    elements: adaptedElements,
  };
}

/**
 * Rotates an entire MasterDesign layout 90° Clockwise ('cw') or Counter-Clockwise ('ccw')
 * from (sourceWidthIn × sourceHeightIn) onto (targetWidthIn × targetHeightIn).
 * Every element's center position rotates 90° together around the layout AND its rotation angle
 * increments by +90° (CW) or +270° (CCW), preserving exact physical dimensions and aspect ratios
 * without stretching or distorting boxes/photos!
 */
export function rotateMasterDesign90(
  sourceMaster: MasterDesign,
  sourceWidthIn: number,
  sourceHeightIn: number,
  targetWidthIn: number,
  targetHeightIn: number,
  direction: 'cw' | 'ccw' = 'cw'
): MasterDesign {
  const safeSrcW = Math.max(0.1, sourceWidthIn);
  const safeSrcH = Math.max(0.1, sourceHeightIn);
  const rotCanvasW = safeSrcH;
  const rotCanvasH = safeSrcW;

  const scaleX = targetWidthIn / rotCanvasW;
  const scaleY = targetHeightIn / rotCanvasH;
  // Use uniform scale for element dimensions so photos/shapes never stretch aspect ratio
  const uniformScale =
    Math.abs(scaleX - 1) < 0.01 && Math.abs(scaleY - 1) < 0.01
      ? 1
      : Math.min(scaleX, scaleY);

  const angleDelta = direction === 'cw' ? 90 : 270;

  const rotatedElements: CanvasElement[] = sourceMaster.elements.map((el) => {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;

    // Rotate center 90° around the canvas
    const rotCx = direction === 'cw' ? safeSrcH - cy : cy;
    const rotCy = direction === 'cw' ? cx : safeSrcW - cx;

    const finalCx = rotCx * scaleX;
    const finalCy = rotCy * scaleY;
    const nextW = Number((el.width * uniformScale).toFixed(4));
    const nextH = Number((el.height * uniformScale).toFixed(4));
    const nextX = Number((finalCx - nextW / 2).toFixed(4));
    const nextY = Number((finalCy - nextH / 2).toFixed(4));
    const nextRotation = (((el.rotation || 0) + angleDelta) % 360 + 360) % 360;

    const newEl: CanvasElement = {
      ...el,
      x: nextX,
      y: nextY,
      width: nextW,
      height: nextH,
      rotation: nextRotation,
    };

    if (el.fontSize && Math.abs(uniformScale - 1) > 0.01) {
      newEl.fontSize = Math.max(6, Math.round(el.fontSize * uniformScale));
    }

    return newEl;
  });

  return {
    ...sourceMaster,
    elements: rotatedElements,
  };
}

export function createStarterBusinessCardMaster(): MasterDesign {
  return {
    id: 'master-a',
    name: 'Master A (Front)',
    backgroundColor: '#ffffff',
    elements: [
      {
        id: 'el-accent-top',
        type: 'rect',
        role: 'accent',
        name: 'Left Crimson Bar',
        x: 0,
        y: 0,
        width: 0.18,
        height: 2.0,
        rotation: 0,
        opacity: 1,
        fill: '#cc0000',
        strokeWidth: 0,
      },
      {
        id: 'el-accent-gold',
        type: 'rect',
        role: 'accent',
        name: 'Gold Accent Strip',
        x: 0.18,
        y: 0,
        width: 0.04,
        height: 2.0,
        rotation: 0,
        opacity: 1,
        fill: '#d97706',
        strokeWidth: 0,
      },
      {
        id: 'el-logo-badge',
        type: 'rounded-rect',
        role: 'logo',
        name: 'Brand Monogram Box',
        x: 0.38,
        y: 0.22,
        width: 0.42,
        height: 0.42,
        rotation: 0,
        opacity: 1,
        fill: '#cc0000',
        borderRadius: 6,
        text: 'GP',
        color: '#ffffff',
        fontFamily: 'Montserrat',
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
      },
      {
        id: 'el-company',
        type: 'text',
        role: 'company',
        name: 'Company Name',
        x: 0.9,
        y: 0.22,
        width: 2.35,
        height: 0.26,
        rotation: 0,
        opacity: 1,
        text: "GEPPY'S PRINTSHOP",
        fontFamily: 'Montserrat',
        fontSize: 12,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'left',
        letterSpacing: 1,
      },
      {
        id: 'el-tagline',
        type: 'text',
        role: 'tagline',
        name: 'Tagline',
        x: 0.9,
        y: 0.46,
        width: 2.35,
        height: 0.2,
        rotation: 0,
        opacity: 1,
        text: 'COMMERCIAL PRINT & AI DESIGN STUDIO',
        fontFamily: 'Inter',
        fontSize: 6.5,
        fontWeight: '600',
        color: '#cc0000',
        textAlign: 'left',
        letterSpacing: 0.8,
      },
      {
        id: 'el-name',
        type: 'text',
        role: 'name',
        name: 'Full Name',
        x: 0.38,
        y: 0.84,
        width: 2.1,
        height: 0.26,
        rotation: 0,
        opacity: 1,
        text: 'Alex Geppy',
        fontFamily: 'Inter',
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        textAlign: 'left',
      },
      {
        id: 'el-title',
        type: 'text',
        role: 'title',
        name: 'Job Title',
        x: 0.38,
        y: 1.08,
        width: 2.1,
        height: 0.2,
        rotation: 0,
        opacity: 1,
        text: 'Lead Print Production Specialist',
        fontFamily: 'Inter',
        fontSize: 8,
        fontWeight: '500',
        color: '#475569',
        textAlign: 'left',
      },
      {
        id: 'el-divider',
        type: 'line',
        role: 'accent',
        name: 'Divider Line',
        x: 0.38,
        y: 1.32,
        width: 2.85,
        height: 0.02,
        rotation: 0,
        opacity: 1,
        stroke: '#e2e8f0',
        strokeWidth: 1,
      },
      {
        id: 'el-phone',
        type: 'text',
        role: 'phone',
        name: 'Phone Number',
        x: 0.38,
        y: 1.4,
        width: 1.5,
        height: 0.18,
        rotation: 0,
        opacity: 1,
        text: '☎ (555) 234-5678',
        fontFamily: 'Inter',
        fontSize: 7.5,
        fontWeight: '500',
        color: '#334155',
        textAlign: 'left',
      },
      {
        id: 'el-email',
        type: 'text',
        role: 'email',
        name: 'Email Address',
        x: 0.38,
        y: 1.57,
        width: 1.9,
        height: 0.18,
        rotation: 0,
        opacity: 1,
        text: '✉ orders@geppysprintshop.com',
        fontFamily: 'Inter',
        fontSize: 7.5,
        fontWeight: '500',
        color: '#334155',
        textAlign: 'left',
      },
      {
        id: 'el-address',
        type: 'text',
        role: 'address',
        name: 'Street Address',
        x: 0.38,
        y: 1.74,
        width: 2.2,
        height: 0.18,
        rotation: 0,
        opacity: 1,
        text: '📍 742 Evergreen Terrace, Suite 100',
        fontFamily: 'Inter',
        fontSize: 7,
        fontWeight: 'normal',
        color: '#64748b',
        textAlign: 'left',
      },
      {
        id: 'el-qr',
        type: 'qr',
        role: 'qr',
        name: 'QR Code',
        x: 2.75,
        y: 1.36,
        width: 0.52,
        height: 0.52,
        rotation: 0,
        opacity: 1,
        qrValue: 'https://geppysprintshop.com',
        fill: '#1e293b',
      },
    ],
  };
}

export function createStarterBackMaster(): MasterDesign {
  return {
    id: 'master-b',
    name: 'Master B (Back)',
    backgroundColor: '#111827',
    elements: [
      {
        id: 'back-bar',
        type: 'rect',
        role: 'accent',
        name: 'Bottom Crimson Accent',
        x: 0,
        y: 1.82,
        width: 3.5,
        height: 0.18,
        rotation: 0,
        opacity: 1,
        fill: '#cc0000',
      },
      {
        id: 'back-logo',
        type: 'rounded-rect',
        role: 'logo',
        name: 'Center Emblem',
        x: 1.48,
        y: 0.42,
        width: 0.54,
        height: 0.54,
        rotation: 0,
        opacity: 1,
        fill: '#cc0000',
        borderRadius: 10,
        text: 'GP',
        color: '#ffffff',
        fontFamily: 'Montserrat',
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
      },
      {
        id: 'back-company',
        type: 'text',
        role: 'company',
        name: 'Back Brand Title',
        x: 0.4,
        y: 1.08,
        width: 2.7,
        height: 0.28,
        rotation: 0,
        opacity: 1,
        text: "GEPPY'S PRINTSHOP",
        fontFamily: 'Montserrat',
        fontSize: 13,
        fontWeight: '800',
        color: '#ffffff',
        textAlign: 'center',
        letterSpacing: 1.5,
      },
      {
        id: 'back-website',
        type: 'text',
        role: 'website',
        name: 'Website URL',
        x: 0.5,
        y: 1.38,
        width: 2.5,
        height: 0.22,
        rotation: 0,
        opacity: 1,
        text: 'www.geppysprintshop.com',
        fontFamily: 'Inter',
        fontSize: 8.5,
        fontWeight: '500',
        color: '#f87171',
        textAlign: 'center',
        letterSpacing: 0.5,
      },
    ],
  };
}

export function createInitialProject(
  template: PrintTemplate = PRINT_TEMPLATES[8], // Default: Business Card - 10up
  startEmpty: boolean = false
): PrintProject {
  const saved = template.savedSetup;

  const starterFront =
    !startEmpty && saved?.masters?.['master-a']
      ? JSON.parse(JSON.stringify(saved.masters['master-a']))
      : startEmpty
      ? {
          id: 'master-a' as const,
          name: 'Master A (Front)',
          backgroundColor: '#ffffff',
          elements: [],
        }
      : adaptDesignToTemplate(
          createStarterBusinessCardMaster(),
          3.5,
          2.0,
          template
        );

  const starterBack =
    !startEmpty && saved?.masters?.['master-b']
      ? JSON.parse(JSON.stringify(saved.masters['master-b']))
      : startEmpty
      ? {
          id: 'master-b' as const,
          name: 'Master B (Back)',
          backgroundColor: '#ffffff',
          elements: [],
        }
      : adaptDesignToTemplate(createStarterBackMaster(), 3.5, 2.0, template);

  return {
    id: `proj-${Date.now()}`,
    title: `${template.name}  Custom`,
    template: JSON.parse(JSON.stringify(template)),
    bleedIn: saved?.bleedIn ?? template.defaultBleedIn,
    marginXIn: saved?.marginXIn ?? template.defaultMarginXIn,
    marginYIn: saved?.marginYIn ?? template.defaultMarginYIn,
    showCropMarks: saved?.showCropMarks ?? true,
    showBleedGuide: saved?.showBleedGuide ?? true,
    showMarginGuide: saved?.showMarginGuide ?? true,
    showGridLines: saved?.showGridLines ?? true,
    relativeToMargin: saved?.relativeToMargin ?? false,
    numbering: saved?.numbering
      ? JSON.parse(JSON.stringify(saved.numbering))
      : undefined,
    mailMerge: saved?.mailMerge
      ? JSON.parse(JSON.stringify(saved.mailMerge))
      : undefined,
    bankTabConfig: saved?.bankTabConfig
      ? JSON.parse(JSON.stringify(saved.bankTabConfig))
      : template.bankTabs
      ? createDefaultBankTabConfig(template.bankTabs)
      : undefined,
    masters: {
      'master-a': starterFront,
      'master-b': starterBack,
    },
    pages: [
      {
        id: 'page-1',
        name: 'Page 1 (Front)',
        side: 'front',
        masterId: 'master-a',
        ignoreMaster: false,
        pageElements: [],
      },
      {
        id: 'page-2',
        name: 'Page 2 (Back)',
        side: 'back',
        masterId: 'master-b',
        ignoreMaster: false,
        pageElements: [],
      },
    ],
  };
}
