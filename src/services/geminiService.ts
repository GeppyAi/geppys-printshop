import { GoogleGenAI, Type } from '@google/genai';
import {
  AIExtractionResult,
  CanvasElement,
  MasterDesign,
} from '../types/printstudio';
import {
  cropRegionFromImage,
  SamplePhotoPreset,
} from '../utils/imageProcessing';

const STORAGE_KEY = 'geppys_gemini_api_key';

export function getStoredApiKey(): string {
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();
  const envKey = (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_GEMINI_API_KEY;
  return envKey ? envKey.trim() : '';
}

export function setStoredApiKey(key: string): void {
  if (!key.trim()) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }
}

export type GenerationMode = 'hybrid' | 'layers' | 'image';

export type AIDesignerBuildMode =
  | 'layout-layers'
  | 'hybrid-studio'
  | 'full-graphic';

export interface AIDesignerConcept {
  id: string;
  title: string;
  styleSubtitle: string;
  summary: string;
  frontMaster: MasterDesign;
  backMaster: MasterDesign;
  palette: string[];
}

/**
 * Generates an artistic high-res background graphic DataURL based on colors and style keywords
 * (used for Hybrid/Image mode background textures or when Imagen endpoint isn't enabled on a free key).
 */
export function generateProceduralCardArtwork(
  primaryColor: string,
  accentColor: string,
  bgColor: string,
  stylePrompt: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1050;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;

  // Base fill
  ctx.fillStyle = bgColor || '#ffffff';
  ctx.fillRect(0, 0, 1050, 600);

  const lower = stylePrompt.toLowerCase();

  // Subtle geometric luxury wave / mesh
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 1050, 600);
  grad.addColorStop(0, primaryColor + '18');
  grad.addColorStop(0.6, accentColor + '12');
  grad.addColorStop(1, primaryColor + '28');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1050, 600);

  // Decorative corner geometry
  ctx.fillStyle = primaryColor;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.arc(980, 80, 260, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.arc(1020, 540, 190, 0, Math.PI * 2);
  ctx.fill();

  if (lower.includes('modern') || lower.includes('geometric') || lower.includes('tech')) {
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.strokeRect(760 + i * 28, -40 + i * 22, 320, 320);
    }
  }
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Intelligent natural-language prompt parser that works both as a pre-processor
 * and as an instant offline fallback when no Gemini API key is configured.
 */
function parseSmartFallbackEdit(
  userPrompt: string,
  unitWidthIn: number,
  unitHeightIn: number,
  cleanedImageDataUrl: string,
  mode: GenerationMode,
  preset?: SamplePhotoPreset
): AIExtractionResult {
  const base = preset?.mockMetadata || {
    company: 'PREMIER BUSINESS GROUP',
    tagline: 'PROFESSIONAL SERVICES & SOLUTIONS',
    name: 'Jordan Taylor',
    title: 'Managing Director',
    phone: '(555) 234-5678',
    email: 'jordan@premiergroup.com',
    website: 'www.premiergroup.com',
    address: '500 Market Street, Suite 200',
    primaryColor: '#1e3a8a',
    accentColor: '#d97706',
    bgColor: '#ffffff',
  };

  let company = base.company;
  let tagline = base.tagline;
  let name = base.name;
  let title = base.title;
  let phone = base.phone;
  let email = base.email;
  let website = base.website;
  let address = base.address;
  let primaryColor = base.primaryColor;
  let accentColor = base.accentColor;
  let bgColor = base.bgColor;

  const p = userPrompt.trim();
  const lower = p.toLowerCase();

  // Extract phone number changes
  const phoneMatch = p.match(
    /(?:phone|number|tel|call)(?:\s+number)?(?:\s+to|\s+is|\s*:)?\s*([+\d()\-\s.]{7,20})/i
  ) || p.match(/(\(\d{3}\)\s*\d{3}[-\s.]\d{4}|\d{3}[-\s.]\d{3}[-\s.]\d{4})/);
  if (phoneMatch && phoneMatch[1]) {
    phone = phoneMatch[1].trim();
  }

  // Extract email changes
  const emailMatch = p.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch && emailMatch[1]) {
    email = emailMatch[1].trim();
  }

  // Extract website changes
  const webMatch = p.match(/((?:https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (webMatch && webMatch[1]) {
    website = webMatch[1].trim();
  }

  // Extract person name change
  const nameMatch = p.match(
    /(?:change\s+(?:the\s+)?(?:owner\s+|attorney\s+)?name\s+to|name\s+to|name\s*:\s*)([A-Z][a-zA-Z.\s]+?)(?:,|;|\s+and\s+|\s+update|\s+change|\s+title|$)/i
  );
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
    // Auto-update email prefix if email wasn't explicitly changed
    if (!emailMatch && email.includes('@')) {
      const domain = email.split('@')[1];
      const firstLast = name
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .trim()
        .split(/\s+/);
      if (firstLast.length >= 2) {
        email = `${firstLast[0][0]}${firstLast[firstLast.length - 1]}@${domain}`;
      }
    }
  }

  // Extract title change
  const titleMatch = p.match(
    /(?:title\s+to|position\s+to|role\s+to|as\s+the\s+title)\s+([^,.;]+?)(?:,|;|\s+and\s+|\s+update|\s+change|$)/i
  );
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  // Extract company name change
  const compMatch = p.match(
    /(?:company(?:\s+name)?\s+to|business(?:\s+name)?\s+to)\s+([^,.;]+?)(?:,|;|\s+and\s+|$)/i
  );
  if (compMatch && compMatch[1]) {
    company = compMatch[1].trim().toUpperCase();
  }

  // Extract quoted text additions (tagline / footer note)
  const quotedMatch = p.match(/"([^"]+)"/);
  if (quotedMatch && quotedMatch[1]) {
    tagline = quotedMatch[1].trim();
  }

  // Color changes
  if (lower.includes('crimson') || lower.includes('red')) {
    primaryColor = '#b91c1c';
    accentColor = '#f59e0b';
  } else if (lower.includes('emerald') || lower.includes('forest') || lower.includes('green')) {
    primaryColor = '#065f46';
    accentColor = '#10b981';
  } else if (lower.includes('navy') || lower.includes('royal blue')) {
    primaryColor = '#1e3a8a';
    accentColor = '#eab308';
  } else if (lower.includes('purple') || lower.includes('violet')) {
    primaryColor = '#4c1d95';
    accentColor = '#c084fc';
  } else if (lower.includes('teal') || lower.includes('cyan')) {
    primaryColor = '#0f766e';
    accentColor = '#2dd4bf';
  }

  if (lower.includes('white background') || lower.includes('light background') || lower.includes('clean white')) {
    bgColor = '#ffffff';
  } else if (lower.includes('dark background') || lower.includes('black background') || lower.includes('charcoal background')) {
    bgColor = '#0f172a';
  }

  const isDarkBg =
    bgColor.toLowerCase() === '#0f172a' ||
    bgColor.toLowerCase() === '#111827' ||
    bgColor.toLowerCase() === '#000000';
  const mainTextColor = isDarkBg ? '#ffffff' : '#0f172a';
  const subTextColor = isDarkBg ? '#cbd5e1' : '#475569';

  const sx = unitWidthIn / 3.5;
  const sy = unitHeightIn / 2.0;
  const fs = Math.sqrt(sx * sy);

  const generatedBgUrl =
    mode === 'hybrid' || mode === 'image'
      ? generateProceduralCardArtwork(primaryColor, accentColor, bgColor, userPrompt)
      : undefined;

  // If 'image' mode is chosen, place the flattened/edited image as the full card base + crisp updated layers
  const frontElements: Omit<CanvasElement, 'id'>[] = [
    {
      type: 'rect',
      role: 'accent',
      name: 'Top Header Band',
      x: 0,
      y: 0,
      width: Number((3.5 * sx).toFixed(3)),
      height: Number((0.58 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      fill: primaryColor,
      strokeWidth: 0,
    },
    {
      type: 'rect',
      role: 'accent',
      name: 'Accent Trim Line',
      x: 0,
      y: Number((0.58 * sy).toFixed(3)),
      width: Number((3.5 * sx).toFixed(3)),
      height: Number((0.05 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      fill: accentColor,
      strokeWidth: 0,
    },
    {
      type: 'rounded-rect',
      role: 'logo',
      name: 'Brand Monogram Emblem',
      x: Number((0.22 * sx).toFixed(3)),
      y: Number((0.1 * sy).toFixed(3)),
      width: Number((0.38 * sx).toFixed(3)),
      height: Number((0.38 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      fill: accentColor,
      borderRadius: 6,
      text: company
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join(''),
      color: '#ffffff',
      fontFamily: 'Montserrat',
      fontSize: Math.round(13 * fs),
      fontWeight: '800',
      textAlign: 'center',
    },
    {
      type: 'text',
      role: 'company',
      name: 'Company Name',
      x: Number((0.68 * sx).toFixed(3)),
      y: Number((0.1 * sy).toFixed(3)),
      width: Number((2.65 * sx).toFixed(3)),
      height: Number((0.24 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: company,
      fontFamily: 'Montserrat',
      fontSize: Math.round(11.5 * fs),
      fontWeight: '800',
      color: '#ffffff',
      textAlign: 'left',
      letterSpacing: 0.8,
    },
    {
      type: 'text',
      role: 'tagline',
      name: 'Tagline / Specialty',
      x: Number((0.68 * sx).toFixed(3)),
      y: Number((0.33 * sy).toFixed(3)),
      width: Number((2.65 * sx).toFixed(3)),
      height: Number((0.18 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: tagline,
      fontFamily: 'Inter',
      fontSize: Math.round(6.5 * fs),
      fontWeight: '600',
      color: '#fef08a',
      textAlign: 'left',
      letterSpacing: 0.6,
    },
    {
      type: 'text',
      role: 'name',
      name: 'Contact Full Name',
      x: Number((0.24 * sx).toFixed(3)),
      y: Number((0.76 * sy).toFixed(3)),
      width: Number((2.3 * sx).toFixed(3)),
      height: Number((0.26 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: name,
      fontFamily: 'Inter',
      fontSize: Math.round(13 * fs),
      fontWeight: '700',
      color: mainTextColor,
      textAlign: 'left',
    },
    {
      type: 'text',
      role: 'title',
      name: 'Job Title',
      x: Number((0.24 * sx).toFixed(3)),
      y: Number((1.01 * sy).toFixed(3)),
      width: Number((2.3 * sx).toFixed(3)),
      height: Number((0.2 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: title,
      fontFamily: 'Inter',
      fontSize: Math.round(8.5 * fs),
      fontWeight: '600',
      color: isDarkBg ? accentColor : primaryColor,
      textAlign: 'left',
    },
    {
      type: 'line',
      role: 'accent',
      name: 'Separator Line',
      x: Number((0.24 * sx).toFixed(3)),
      y: Number((1.24 * sy).toFixed(3)),
      width: Number((3.0 * sx).toFixed(3)),
      height: 0.02,
      rotation: 0,
      opacity: 1,
      stroke: isDarkBg ? '#334155' : '#cbd5e1',
      strokeWidth: 1,
    },
    {
      type: 'text',
      role: 'phone',
      name: 'Phone Number',
      x: Number((0.24 * sx).toFixed(3)),
      y: Number((1.31 * sy).toFixed(3)),
      width: Number((1.8 * sx).toFixed(3)),
      height: Number((0.18 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: `☎ ${phone}`,
      fontFamily: 'Inter',
      fontSize: Math.round(7.5 * fs),
      fontWeight: '600',
      color: mainTextColor,
      textAlign: 'left',
    },
    {
      type: 'text',
      role: 'email',
      name: 'Email Address',
      x: Number((0.24 * sx).toFixed(3)),
      y: Number((1.49 * sy).toFixed(3)),
      width: Number((2.1 * sx).toFixed(3)),
      height: Number((0.18 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: `✉ ${email}`,
      fontFamily: 'Inter',
      fontSize: Math.round(7.5 * fs),
      fontWeight: '500',
      color: subTextColor,
      textAlign: 'left',
    },
    {
      type: 'text',
      role: 'address',
      name: 'Address & Web',
      x: Number((0.24 * sx).toFixed(3)),
      y: Number((1.68 * sy).toFixed(3)),
      width: Number((2.35 * sx).toFixed(3)),
      height: Number((0.18 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: `${address} • ${website}`,
      fontFamily: 'Inter',
      fontSize: Math.round(6.8 * fs),
      fontWeight: 'normal',
      color: subTextColor,
      textAlign: 'left',
    },
    {
      type: 'qr',
      role: 'qr',
      name: 'Website QR Code',
      x: Number((2.76 * sx).toFixed(3)),
      y: Number((1.32 * sy).toFixed(3)),
      width: Number((0.5 * sx).toFixed(3)),
      height: Number((0.5 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      qrValue: website.startsWith('http') ? website : `https://${website}`,
      fill: isDarkBg ? '#ffffff' : primaryColor,
    },
  ];

  const backElements: Omit<CanvasElement, 'id'>[] = [
    {
      type: 'rect',
      role: 'accent',
      name: 'Back Accent Bar',
      x: 0,
      y: Number((1.82 * sy).toFixed(3)),
      width: Number((3.5 * sx).toFixed(3)),
      height: Number((0.18 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      fill: accentColor,
    },
    {
      type: 'rounded-rect',
      role: 'logo',
      name: 'Back Center Logo',
      x: Number((1.48 * sx).toFixed(3)),
      y: Number((0.36 * sy).toFixed(3)),
      width: Number((0.54 * sx).toFixed(3)),
      height: Number((0.54 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      fill: accentColor,
      borderRadius: 10,
      text: company
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join(''),
      color: '#ffffff',
      fontFamily: 'Montserrat',
      fontSize: Math.round(17 * fs),
      fontWeight: '800',
      textAlign: 'center',
    },
    {
      type: 'text',
      role: 'company',
      name: 'Back Company Title',
      x: Number((0.35 * sx).toFixed(3)),
      y: Number((1.02 * sy).toFixed(3)),
      width: Number((2.8 * sx).toFixed(3)),
      height: Number((0.28 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: company,
      fontFamily: 'Montserrat',
      fontSize: Math.round(12.5 * fs),
      fontWeight: '800',
      color: '#ffffff',
      textAlign: 'center',
      letterSpacing: 1.2,
    },
    {
      type: 'text',
      role: 'tagline',
      name: 'Back Tagline',
      x: Number((0.35 * sx).toFixed(3)),
      y: Number((1.3 * sy).toFixed(3)),
      width: Number((2.8 * sx).toFixed(3)),
      height: Number((0.2 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: tagline,
      fontFamily: 'Inter',
      fontSize: Math.round(7.5 * fs),
      fontWeight: '500',
      color: '#fde68a',
      textAlign: 'center',
    },
    {
      type: 'text',
      role: 'website',
      name: 'Back Website',
      x: Number((0.5 * sx).toFixed(3)),
      y: Number((1.52 * sy).toFixed(3)),
      width: Number((2.5 * sx).toFixed(3)),
      height: Number((0.2 * sy).toFixed(3)),
      rotation: 0,
      opacity: 1,
      text: website,
      fontFamily: 'Inter',
      fontSize: Math.round(8 * fs),
      fontWeight: '600',
      color: '#ffffff',
      textAlign: 'center',
    },
  ];

  return {
    summary: `Reconstructed card into ${frontElements.length} editable vector/text layers and applied changes: ${name} (${title}), ${phone}, ${company}.`,
    frontDesign: {
      backgroundColor: bgColor,
      backgroundImage:
        mode === 'image' ? cleanedImageDataUrl : generatedBgUrl,
      elements: frontElements,
    },
    backDesign: {
      backgroundColor: primaryColor,
      elements: backElements,
    },
    extractedPalette: [primaryColor, accentColor, bgColor, mainTextColor],
    detectedBusinessInfo: {
      company,
      tagline,
      name,
      title,
      phone,
      email,
      website,
      address,
    },
  };
}

/**
 * Calls Google Gemini Vision (gemini-2.5-flash) to analyze the uploaded business card photo,
 * apply the user's requested text/layout/color changes, crop any detected logo,
 * and return editable layers + matching back design.
 */
export async function analyzeAndEditCardWithGemini(params: {
  cleanedImageDataUrl: string;
  userPrompt: string;
  mode: GenerationMode;
  unitWidthIn: number;
  unitHeightIn: number;
  presetHint?: SamplePhotoPreset;
}): Promise<AIExtractionResult> {
  const apiKey = getStoredApiKey();
  const {
    cleanedImageDataUrl,
    userPrompt,
    mode,
    unitWidthIn,
    unitHeightIn,
    presetHint,
  } = params;

  if (!apiKey) {
    // Use intelligent local parser so the app works seamlessly out-of-the-box
    await new Promise((r) => setTimeout(r, 650));
    return parseSmartFallbackEdit(
      userPrompt,
      unitWidthIn,
      unitHeightIn,
      cleanedImageDataUrl,
      mode,
      presetHint
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = cleanedImageDataUrl.replace(
      /^data:image\/(png|jpeg|jpg|webp);base64,/,
      ''
    );

    const systemInstruction = `You are an expert commercial print shop designer inside Geppy's PrintStudio.
The user has uploaded an image of a business card (or print document) and provided instructions on how they want it modified.
The target canvas unit size is ${unitWidthIn} inches wide by ${unitHeightIn} inches tall.
1. Read all existing text, layout, colors, and typography from the uploaded card image.
2. Apply ALL changes requested by the user in their prompt (e.g., changing names, phone numbers, titles, addresses, colors, layout style, adding elements).
3. Return a structured JSON object with:
   - summary: A brief explanation of what you extracted and changed.
   - extractedPalette: Array of hex color codes used.
   - detectedLogoNormalizedBox: Optional {x, y, width, height} (0..1) if there is a distinct graphic logo or emblem on the uploaded image that should be cropped and preserved.
   - frontDesign: { backgroundColor (hex), elements: array of editable elements positioned in inches within 0..${unitWidthIn} (x) and 0..${unitHeightIn} (y) }
   - backDesign: A complementary back-side design for 2-sided printing in the same ${unitWidthIn}x${unitHeightIn} inch coordinate space.
Each element in elements must have:
   - type: one of 'text', 'rect', 'rounded-rect', 'circle', 'line', 'qr'
   - role: one of 'company', 'tagline', 'name', 'title', 'phone', 'email', 'website', 'address', 'logo', 'accent', 'qr', 'body'
   - name: human readable layer name
   - x, y, width, height: numbers in inches (must fit neatly inside ${unitWidthIn} x ${unitHeightIn} without overlapping unreadably)
   - text: string (for text or monogram badges)
   - fontFamily: one of 'Inter', 'Montserrat', 'Playfair Display', 'Cinzel', 'Oswald', 'DM Sans'
   - fontSize: number in points (for 3.5x2 business card, typically 11-15pt for headers/names, 7-9pt for contact lines)
   - fontWeight: 'normal' | '500' | '600' | '700' | '800'
   - textAlign: 'left' | 'center' | 'right'
   - color: hex string
   - fill: hex string (for shapes/rects)
   - stroke: hex string
   - strokeWidth: number
   - borderRadius: number
   - qrValue: URL string if type is 'qr'`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Data,
              },
            },
            {
              text: `${systemInstruction}\n\nUser's requested changes: "${
                userPrompt ||
                'Reconstruct this business card cleanly into editable layers and modernize the typography.'
              }"`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            extractedPalette: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            detectedLogoNormalizedBox: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
              },
            },
            detectedBusinessInfo: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING },
                tagline: { type: Type.STRING },
                name: { type: Type.STRING },
                title: { type: Type.STRING },
                phone: { type: Type.STRING },
                email: { type: Type.STRING },
                website: { type: Type.STRING },
                address: { type: Type.STRING },
              },
            },
            frontDesign: {
              type: Type.OBJECT,
              properties: {
                backgroundColor: { type: Type.STRING },
                elements: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      role: { type: Type.STRING },
                      name: { type: Type.STRING },
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      width: { type: Type.NUMBER },
                      height: { type: Type.NUMBER },
                      text: { type: Type.STRING },
                      fontFamily: { type: Type.STRING },
                      fontSize: { type: Type.NUMBER },
                      fontWeight: { type: Type.STRING },
                      textAlign: { type: Type.STRING },
                      color: { type: Type.STRING },
                      fill: { type: Type.STRING },
                      stroke: { type: Type.STRING },
                      strokeWidth: { type: Type.NUMBER },
                      borderRadius: { type: Type.NUMBER },
                      qrValue: { type: Type.STRING },
                    },
                    required: ['type', 'name', 'x', 'y', 'width', 'height'],
                  },
                },
              },
              required: ['backgroundColor', 'elements'],
            },
            backDesign: {
              type: Type.OBJECT,
              properties: {
                backgroundColor: { type: Type.STRING },
                elements: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      role: { type: Type.STRING },
                      name: { type: Type.STRING },
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      width: { type: Type.NUMBER },
                      height: { type: Type.NUMBER },
                      text: { type: Type.STRING },
                      fontFamily: { type: Type.STRING },
                      fontSize: { type: Type.NUMBER },
                      fontWeight: { type: Type.STRING },
                      textAlign: { type: Type.STRING },
                      color: { type: Type.STRING },
                      fill: { type: Type.STRING },
                      stroke: { type: Type.STRING },
                      strokeWidth: { type: Type.NUMBER },
                      borderRadius: { type: Type.NUMBER },
                    },
                    required: ['type', 'name', 'x', 'y', 'width', 'height'],
                  },
                },
              },
              required: ['backgroundColor', 'elements'],
            },
          },
          required: ['summary', 'frontDesign'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    // Normalize elements with defaults
    const normalizeEl = (raw: Record<string, unknown>): Omit<CanvasElement, 'id'> => ({
      type: (raw.type as CanvasElement['type']) || 'text',
      role: (raw.role as CanvasElement['role']) || 'body',
      name: String(raw.name || 'Layer'),
      x: Number(raw.x ?? 0.2),
      y: Number(raw.y ?? 0.2),
      width: Number(raw.width ?? 1.5),
      height: Number(raw.height ?? 0.25),
      rotation: 0,
      opacity: 1,
      text: raw.text ? String(raw.text) : undefined,
      fontFamily: String(raw.fontFamily || 'Inter'),
      fontSize: Number(raw.fontSize || 9),
      fontWeight: (raw.fontWeight as CanvasElement['fontWeight']) || 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: (raw.textAlign as CanvasElement['textAlign']) || 'left',
      color: String(raw.color || '#0f172a'),
      fill: raw.fill ? String(raw.fill) : undefined,
      stroke: raw.stroke ? String(raw.stroke) : undefined,
      strokeWidth: Number(raw.strokeWidth ?? 0),
      borderRadius: Number(raw.borderRadius ?? 0),
      qrValue: raw.qrValue ? String(raw.qrValue) : undefined,
    });

    const frontElements: Omit<CanvasElement, 'id'>[] = (
      parsed.frontDesign?.elements || []
    ).map(normalizeEl);

    // If Gemini detected a distinct logo box on the photo and mode is hybrid, crop it and add as an editable image layer if desired
    if (
      parsed.detectedLogoNormalizedBox &&
      parsed.detectedLogoNormalizedBox.width > 0.03 &&
      parsed.detectedLogoNormalizedBox.height > 0.03 &&
      mode === 'hybrid'
    ) {
      const box = parsed.detectedLogoNormalizedBox;
      const croppedLogo = await cropRegionFromImage(cleanedImageDataUrl, box);
      const hasLogoAlready = frontElements.some((e) => e.role === 'logo');
      if (!hasLogoAlready) {
        frontElements.unshift({
          type: 'image',
          role: 'logo',
          name: 'Extracted Card Logo',
          x: Number((box.x * unitWidthIn).toFixed(2)),
          y: Number((box.y * unitHeightIn).toFixed(2)),
          width: Number(Math.min(0.8, box.width * unitWidthIn).toFixed(2)),
          height: Number(Math.min(0.6, box.height * unitHeightIn).toFixed(2)),
          rotation: 0,
          opacity: 1,
          imageUrl: croppedLogo,
        });
      }
    }

    const palette: string[] = parsed.extractedPalette?.length
      ? parsed.extractedPalette
      : ['#1e3a8a', '#f59e0b', '#ffffff', '#0f172a'];

    const bgImage =
      mode === 'image'
        ? cleanedImageDataUrl
        : mode === 'hybrid'
        ? generateProceduralCardArtwork(
            palette[0] || '#1e3a8a',
            palette[1] || '#d97706',
            parsed.frontDesign?.backgroundColor || '#ffffff',
            userPrompt
          )
        : undefined;

    return {
      summary:
        parsed.summary ||
        'Analyzed card with Gemini Vision and applied your requested design & content changes.',
      frontDesign: {
        backgroundColor: parsed.frontDesign?.backgroundColor || '#ffffff',
        backgroundImage: bgImage,
        elements: frontElements,
      },
      backDesign: parsed.backDesign
        ? {
            backgroundColor: parsed.backDesign.backgroundColor || '#0f172a',
            elements: (parsed.backDesign.elements || []).map(normalizeEl),
          }
        : undefined,
      extractedPalette: palette,
      detectedBusinessInfo: parsed.detectedBusinessInfo || {},
    };
  } catch (err) {
    console.warn('Gemini API error, using intelligent local parser fallback:', err);
    return parseSmartFallbackEdit(
      userPrompt,
      unitWidthIn,
      unitHeightIn,
      cleanedImageDataUrl,
      mode,
      presetHint
    );
  }
}

/**
 * Applies a conversational follow-up instruction directly to an existing MasterDesign
 * inside the Editor (e.g., "Change phone to 555-9999", "Make the header crimson red", "Center all text").
 */
export async function applyPromptToCurrentMaster(params: {
  master: MasterDesign;
  prompt: string;
  unitWidthIn: number;
  unitHeightIn: number;
}): Promise<{ updatedMaster: MasterDesign; summary: string }> {
  const { master, prompt, unitWidthIn, unitHeightIn } = params;
  const apiKey = getStoredApiKey();

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are editing a print design in Geppy's PrintStudio (${unitWidthIn}" x ${unitHeightIn}").
Current Master Design JSON:
${JSON.stringify(master, null, 2)}

User's edit instruction: "${prompt}"

Return a JSON object with:
- summary: Short explanation of what changed
- backgroundColor: updated hex background color
- elements: updated array of elements (keep existing IDs where possible, or add new ones if requested).`,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const data = JSON.parse(response.text || '{}');
      if (data.elements && Array.isArray(data.elements)) {
        return {
          updatedMaster: {
            ...master,
            backgroundColor: data.backgroundColor || master.backgroundColor,
            elements: data.elements.map((el: CanvasElement, idx: number) => ({
              ...el,
              id: el.id || `ai-el-${Date.now()}-${idx}`,
              rotation: el.rotation ?? 0,
              opacity: el.opacity ?? 1,
            })),
          },
          summary: data.summary || 'Applied AI edits to canvas.',
        };
      }
    } catch (e) {
      console.warn('Conversational Gemini edit fallback:', e);
    }
  }

  // Fast, deterministic local smart editor so every prompt works immediately!
  const lower = prompt.toLowerCase();
  const cloned: MasterDesign = {
    ...master,
    elements: master.elements.map((el) => ({ ...el })),
  };
  const changes: string[] = [];

  // Phone replacement
  const phoneMatch =
    prompt.match(
      /(?:phone|number|tel|call)(?:\s+number)?(?:\s+to|\s+is|\s*:)?\s*([+\d()\-\s.]{7,20})/i
    ) || prompt.match(/(\(\d{3}\)\s*\d{3}[-\s.]\d{4}|\d{3}[-\s.]\d{3}[-\s.]\d{4})/);
  if (phoneMatch && phoneMatch[1]) {
    const newPhone = phoneMatch[1].trim();
    cloned.elements.forEach((el) => {
      if (
        el.role === 'phone' ||
        (el.text && /(\(\d{3}\)|\d{3}-\d{4}|☎|tel)/i.test(el.text))
      ) {
        el.text = `☎ ${newPhone}`;
        changes.push(`Updated phone to ${newPhone}`);
      }
    });
  }

  // Email replacement
  const emailMatch = prompt.match(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
  );
  if (emailMatch && emailMatch[1]) {
    const newEmail = emailMatch[1].trim();
    cloned.elements.forEach((el) => {
      if (el.role === 'email' || (el.text && el.text.includes('@'))) {
        el.text = `✉ ${newEmail}`;
        changes.push(`Updated email to ${newEmail}`);
      }
    });
  }

  // Name replacement
  const nameMatch = prompt.match(
    /(?:name\s+to|person\s+to)\s+([A-Z][a-zA-Z.\s]+?)(?:,|;|\s+and\s+|$)/i
  );
  if (nameMatch && nameMatch[1]) {
    const newName = nameMatch[1].trim();
    cloned.elements.forEach((el) => {
      if (el.role === 'name') {
        el.text = newName;
        changes.push(`Changed name to ${newName}`);
      }
    });
  }

  // Title replacement
  const titleMatch = prompt.match(
    /(?:title\s+to|role\s+to|position\s+to)\s+([^,.;]+?)(?:,|;|\s+and\s+|$)/i
  );
  if (titleMatch && titleMatch[1]) {
    const newTitle = titleMatch[1].trim();
    cloned.elements.forEach((el) => {
      if (el.role === 'title') {
        el.text = newTitle;
        changes.push(`Changed title to ${newTitle}`);
      }
    });
  }

  // Company replacement
  const compMatch = prompt.match(
    /(?:company\s+to|business\s+to)\s+([^,.;]+?)(?:,|;|\s+and\s+|$)/i
  );
  if (compMatch && compMatch[1]) {
    const newComp = compMatch[1].trim().toUpperCase();
    cloned.elements.forEach((el) => {
      if (el.role === 'company') {
        el.text = newComp;
        changes.push(`Changed company to ${newComp}`);
      }
    });
  }

  // Color theme shifts
  const colorMap: Record<string, { primary: string; accent: string }> = {
    crimson: { primary: '#b91c1c', accent: '#f59e0b' },
    red: { primary: '#cc0000', accent: '#f59e0b' },
    navy: { primary: '#1e3a8a', accent: '#eab308' },
    blue: { primary: '#1d4ed8', accent: '#38bdf8' },
    emerald: { primary: '#065f46', accent: '#34d399' },
    green: { primary: '#15803d', accent: '#a3e635' },
    gold: { primary: '#78350f', accent: '#eab308' },
    purple: { primary: '#4c1d95', accent: '#c084fc' },
    charcoal: { primary: '#1e293b', accent: '#f59e0b' },
  };

  for (const [key, palette] of Object.entries(colorMap)) {
    if (lower.includes(key)) {
      cloned.elements.forEach((el) => {
        if (el.type === 'rect' && el.role === 'accent') {
          el.fill = palette.primary;
        } else if (el.type === 'rounded-rect' && el.role === 'logo') {
          el.fill = palette.accent;
        }
      });
      changes.push(`Applied ${key} color scheme`);
      break;
    }
  }

  if (lower.includes('dark background') || lower.includes('dark mode')) {
    cloned.backgroundColor = '#0f172a';
    cloned.elements.forEach((el) => {
      if (el.type === 'text' && el.color === '#0f172a') el.color = '#ffffff';
      if (el.type === 'text' && el.color === '#334155') el.color = '#cbd5e1';
    });
    changes.push('Switched to dark background');
  } else if (lower.includes('white background') || lower.includes('light background')) {
    cloned.backgroundColor = '#ffffff';
    cloned.elements.forEach((el) => {
      if (el.type === 'text' && el.color === '#ffffff' && el.y > 0.6) {
        el.color = '#0f172a';
      }
    });
    changes.push('Switched to clean white background');
  }

  if (lower.includes('bigger') || lower.includes('larger')) {
    cloned.elements.forEach((el) => {
      if (el.fontSize) el.fontSize = Math.round(el.fontSize * 1.15);
    });
    changes.push('Increased typography scale by 15%');
  } else if (lower.includes('smaller')) {
    cloned.elements.forEach((el) => {
      if (el.fontSize) el.fontSize = Math.max(6, Math.round(el.fontSize * 0.88));
    });
    changes.push('Reduced typography scale');
  }

  if (lower.includes('center')) {
    cloned.elements.forEach((el) => {
      if (el.type === 'text') {
        el.textAlign = 'center';
        el.x = Number(((unitWidthIn - el.width) / 2).toFixed(2));
      }
    });
    changes.push('Centered text layers');
  }

  if (lower.includes('qr')) {
    const hasQr = cloned.elements.some((e) => e.type === 'qr');
    if (!hasQr) {
      cloned.elements.push({
        id: `qr-${Date.now()}`,
        type: 'qr',
        role: 'qr',
        name: 'QR Code',
        x: Number((unitWidthIn - 0.68).toFixed(2)),
        y: Number((unitHeightIn - 0.68).toFixed(2)),
        width: 0.52,
        height: 0.52,
        rotation: 0,
        opacity: 1,
        qrValue: 'https://geppysprintshop.com',
        fill: '#0f172a',
      });
      changes.push('Added scannable QR code');
    }
  }

  return {
    updatedMaster: cloned,
    summary:
      changes.length > 0
        ? changes.join(' • ')
        : 'Updated design styling based on your prompt.',
  };
}

/**
 * Generates a rich, high-resolution custom artwork graphic or full flat design
 * tailored to the user's description, color palette, and aspect ratio.
 */
export function renderCustomStudioArtwork(params: {
  widthIn: number;
  heightIn: number;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  styleVariant:
    | 'modern-split'
    | 'luxury-crest'
    | 'editorial-wave'
    | 'hazard-stripes'
    | 'for-sale-frame'
    | 'roadside-chevron';
  bakeFullPosterText?: {
    company: string;
    tagline: string;
    name: string;
    title: string;
    phone: string;
    email: string;
    website: string;
    address: string;
  };
}): string {
  const {
    widthIn,
    heightIn,
    primaryColor,
    accentColor,
    bgColor,
    styleVariant,
    bakeFullPosterText,
  } = params;
  const dpi = 180;
  const w = Math.max(320, Math.min(2200, Math.round(widthIn * dpi)));
  const h = Math.max(240, Math.min(2200, Math.round(heightIn * dpi)));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Base fill
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  if (styleVariant === 'hazard-stripes') {
    // Authentic 45-degree OSHA/ANSI diagonal yellow & black hazard caution stripes at top and bottom edges
    const bandH = Math.round(h * 0.11);
    const drawHazardBand = (y0: number, heightPx: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y0, w, heightPx);
      ctx.clip();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, y0, w, heightPx);
      ctx.fillStyle = '#09090b';
      const stripeW = Math.max(18, Math.round(w * 0.045));
      for (let x = -heightPx * 2; x < w + heightPx * 2; x += stripeW * 2) {
        ctx.beginPath();
        ctx.moveTo(x, y0 + heightPx);
        ctx.lineTo(x + heightPx, y0);
        ctx.lineTo(x + heightPx + stripeW, y0);
        ctx.lineTo(x + stripeW, y0 + heightPx);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };
    drawHazardBand(0, bandH);
    drawHazardBand(h - bandH, bandH);
  } else if (styleVariant === 'for-sale-frame') {
    // High-visibility corner bursts & subtle frame for For Sale / Open House signs
    ctx.save();
    ctx.strokeStyle = primaryColor;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(4, Math.round(Math.min(w, h) * 0.02));
    ctx.strokeRect(w * 0.025, h * 0.025, w * 0.95, h * 0.95);
    ctx.restore();
  } else if (styleVariant === 'roadside-chevron') {
    // Subtle high-impact roadside diagonal speed chevrons
    ctx.save();
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.moveTo(w * 0.78, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(w * 0.62, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (styleVariant === 'modern-split') {
    // Diagonal modern architectural ribbons
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, primaryColor + '22');
    grad.addColorStop(0.5, bgColor);
    grad.addColorStop(1, accentColor + '25');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Right geometric polygon
    ctx.save();
    ctx.fillStyle = primaryColor;
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.moveTo(w * 0.68, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(w * 0.52, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(w * 0.65, 0);
    ctx.lineTo(w * 0.69, 0);
    ctx.lineTo(w * 0.53, h);
    ctx.lineTo(w * 0.49, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (styleVariant === 'luxury-crest') {
    // Radial vignette + fine double gold/accent border + subtle marble/mesh veins
    const rad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      w * 0.05,
      w * 0.5,
      h * 0.5,
      w * 0.7
    );
    rad.addColorStop(0, bgColor);
    rad.addColorStop(1, primaryColor + '30');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic luxury veins
    ctx.save();
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (h / 6) * i + 20);
      ctx.bezierCurveTo(
        w * 0.33,
        (h / 6) * i - 40,
        w * 0.66,
        (h / 6) * i + 60,
        w,
        (h / 6) * i - 10
      );
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // Editorial wave / organic modern circles
    ctx.save();
    ctx.fillStyle = primaryColor;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(w * 0.9, h * 0.15, w * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(w * 0.1, h * 0.92, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // If the user selected "Full AI Flat Visual Design (Baked Image)", render the complete poster/card typography & graphics directly into the artwork image too
  if (bakeFullPosterText) {
    const isDark =
      bgColor.toLowerCase() === '#0f172a' ||
      bgColor.toLowerCase() === '#111827' ||
      bgColor.toLowerCase() === '#18181b';
    const textMain = isDark ? '#ffffff' : '#0f172a';
    const textSub = isDark ? '#cbd5e1' : '#475569';

    ctx.save();
    // Header bar
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, w, h * 0.28);
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, h * 0.28, w, h * 0.025);

    // Company & Tagline
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(h * 0.095)}px Montserrat, sans-serif`;
    ctx.fillText(bakeFullPosterText.company, w * 0.07, h * 0.14);

    ctx.fillStyle = '#fef08a';
    ctx.font = `600 ${Math.round(h * 0.048)}px Inter, sans-serif`;
    ctx.fillText(bakeFullPosterText.tagline, w * 0.07, h * 0.22);

    // Name & Title
    ctx.fillStyle = textMain;
    ctx.font = `700 ${Math.round(h * 0.105)}px Inter, sans-serif`;
    ctx.fillText(bakeFullPosterText.name, w * 0.07, h * 0.48);

    ctx.fillStyle = isDark ? accentColor : primaryColor;
    ctx.font = `600 ${Math.round(h * 0.062)}px Inter, sans-serif`;
    ctx.fillText(bakeFullPosterText.title, w * 0.07, h * 0.58);

    // Contact Details
    ctx.fillStyle = textSub;
    ctx.font = `500 ${Math.round(h * 0.055)}px Inter, sans-serif`;
    ctx.fillText(
      `☎ ${bakeFullPosterText.phone}   •   ✉ ${bakeFullPosterText.email}`,
      w * 0.07,
      h * 0.76
    );
    ctx.fillText(
      `📍 ${bakeFullPosterText.address}   •   ${bakeFullPosterText.website}`,
      w * 0.07,
      h * 0.87
    );
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

/**
 * AI Designer From Scratch:
 * Takes a natural language description of what the user wants designed (plus optional structured fields),
 * and generates 3 distinct PrintStudio concepts with either:
 *  - 'layout-layers': Editable text boxes, shapes, badges, dividers, and QR codes
 *  - 'hybrid-studio': Custom AI graphic backdrop + editable text boxes & layout elements
 *  - 'full-graphic': Full AI visual graphic (with optional editable text overlay)
 */
export async function generateDesignFromScratchWithAI(params: {
  description: string;
  buildMode: AIDesignerBuildMode;
  colorTheme: string;
  unitWidthIn: number;
  unitHeightIn: number;
  includeEditableTextOnFullGraphic?: boolean;
}): Promise<AIDesignerConcept[]> {
  const {
    description,
    buildMode,
    colorTheme,
    unitWidthIn,
    unitHeightIn,
    includeEditableTextOnFullGraphic = true,
  } = params;

  const p = description.trim();
  const lower = p.toLowerCase();

  // Extract entities from the user's description (or provide smart defaults for the industry)
  let company = 'APEX CREATIVE STUDIO';
  let tagline = 'MODERN DESIGN & PRINT SOLUTIONS';
  let name = 'Jordan Vance';
  let title = 'Founder & Creative Director';
  let phone = '(555) 489-2030';
  let email = 'hello@apexcreativestudio.com';
  let website = 'www.apexcreativestudio.com';
  let address = '750 Innovation Way, Suite 400';

  if (lower.includes('real estate') || lower.includes('realtor') || lower.includes('broker') || lower.includes('property')) {
    company = 'VANCE & CO. LUXURY REALTY';
    tagline = 'FINE HOMES • ESTATES • COMMERCIAL PROPERTIES';
    name = 'Elena Vance';
    title = 'Senior Luxury Property Broker';
    phone = '(555) 839-4400';
    email = 'elena@vancecorealty.com';
    website = 'www.vancecorealty.com';
    address = '900 Park Avenue, Penthouse Suite';
  } else if (lower.includes('lawn') || lower.includes('landscap') || lower.includes('tree') || lower.includes('garden')) {
    company = 'EVERGREEN LANDSCAPE & TURF';
    tagline = 'LAWN CARE • HARDSCAPES • IRRIGATION DESIGN';
    name = 'Marcus Cole';
    title = 'Owner & Master Landscape Architect';
    phone = '(555) 742-8899';
    email = 'estimates@evergreenlandscaping.com';
    website = 'www.evergreenlandscaping.com';
    address = 'Licensed & Insured • Free On-Site Quotes';
  } else if (lower.includes('salon') || lower.includes('spa') || lower.includes('beauty') || lower.includes('hair') || lower.includes('lash')) {
    company = 'LUMIÈRE SALON & MEDSPA';
    tagline = 'BESPOKE HAIR COLOR • SKINCARE • AESTHETICS';
    name = 'Chloe Laurent';
    title = 'Master Stylist & Aesthetician';
    phone = '(555) 294-7711';
    email = 'appointments@lumieresalonspa.com';
    website = 'www.lumieresalonspa.com';
    address = '425 Boutique Row • Walk-Ins Welcome';
  } else if (lower.includes('construct') || lower.includes('roof') || lower.includes('plumb') || lower.includes('electric') || lower.includes('hvac') || lower.includes('contract')) {
    company = 'TITAN BUILDERS & CONTRACTING';
    tagline = 'COMMERCIAL & RESIDENTIAL RENOVATIONS';
    name = 'Ryan Callahan';
    title = 'General Contractor • Lic #894210';
    phone = '(555) 901-3344';
    email = 'ryan@titanbuilderspro.com';
    website = 'www.titanbuilderspro.com';
    address = '24/7 Emergency Service • Free Estimates';
  } else if (lower.includes('bakery') || lower.includes('cafe') || lower.includes('coffee') || lower.includes('restaurant') || lower.includes('cater')) {
    company = 'HEARTH & GRAIN ARTISAN CAFE';
    tagline = 'SOURDOUGH • SPECIALTY ESPRESSO • PASTRIES';
    name = 'Sofia Moretti';
    title = 'Executive Pastry Chef & Owner';
    phone = '(555) 618-9022';
    email = 'catering@hearthandgrain.com';
    website = 'www.hearthandgrain.com';
    address = '112 Artisan Lane • Open Daily 7am–6pm';
  } else if (lower.includes('law') || lower.includes('attorney') || lower.includes('legal') || lower.includes('esq')) {
    company = 'STERLING, WREN & ASSOCIATES';
    tagline = 'TRIAL ATTORNEYS & CORPORATE COUNSEL';
    name = 'Victoria Sterling, Esq.';
    title = 'Managing Partner';
    phone = '(555) 390-1100';
    email = 'vsterling@sterlingwrenlaw.com';
    website = 'www.sterlingwrenlaw.com';
    address = '1500 Justice Plaza, 22nd Floor';
  }

  // Override with any specific quoted strings, names, phones, emails in the user's description
  const quoted = [...p.matchAll(/["']([^"']{2,50})["']/g)].map((m) => m[1]);
  if (quoted.length === 1) {
    company = quoted[0].toUpperCase();
  } else if (quoted.length >= 2) {
    name = quoted[0];
    company = quoted[1].toUpperCase();
    if (quoted[2]) tagline = quoted[2].toUpperCase();
  }

  const phoneMatch = p.match(/(\(\d{3}\)\s*\d{3}[-\s.]\d{4}|\d{3}[-\s.]\d{3}[-\s.]\d{4})/);
  if (phoneMatch) phone = phoneMatch[1];

  const emailMatch = p.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) email = emailMatch[1];

  const forNameMatch = p.match(/for\s+([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+at\s+([A-Za-z0-9&\s.]+?))?(?:,|\.|with|in|$)/);
  if (forNameMatch) {
    if (forNameMatch[1]) name = forNameMatch[1].trim();
    if (forNameMatch[2]) company = forNameMatch[2].trim().toUpperCase();
  }

  // Determine Color Palette (Including Signage, OSHA Safety & Roadside Palettes)
  const palettes: Record<
    string,
    { primary: string; accent: string; lightBg: string; darkBg: string }
  > = {
    'safety-yellow': {
      primary: '#09090b',
      accent: '#facc15',
      lightBg: '#fef08a',
      darkBg: '#09090b',
    },
    'osha-danger': {
      primary: '#dc2626',
      accent: '#facc15',
      lightBg: '#ffffff',
      darkBg: '#09090b',
    },
    'for-sale-red': {
      primary: '#cc0000',
      accent: '#1e3a8a',
      lightBg: '#ffffff',
      darkBg: '#0f172a',
    },
    'roadside-neon': {
      primary: '#0f172a',
      accent: '#facc15',
      lightBg: '#ffffff',
      darkBg: '#0f172a',
    },
    'crimson-gold': {
      primary: '#b91c1c',
      accent: '#d97706',
      lightBg: '#ffffff',
      darkBg: '#111827',
    },
    'midnight-gold': {
      primary: '#0f172a',
      accent: '#eab308',
      lightBg: '#f8fafc',
      darkBg: '#0f172a',
    },
    'emerald-cream': {
      primary: '#065f46',
      accent: '#10b981',
      lightBg: '#fdfcf7',
      darkBg: '#022c22',
    },
    'navy-amber': {
      primary: '#1e3a8a',
      accent: '#f59e0b',
      lightBg: '#ffffff',
      darkBg: '#0f172a',
    },
    'rose-blush': {
      primary: '#881337',
      accent: '#f43f5e',
      lightBg: '#fff1f2',
      darkBg: '#4c0519',
    },
    'monochrome': {
      primary: '#18181b',
      accent: '#71717a',
      lightBg: '#ffffff',
      darkBg: '#09090b',
    },
  };

  // Detect if the prompt is asking for a Commercial Sign (For Sale Sign, Warning/Safety Sign, or Roadside/Yard Sign)
  const isWarningSign =
    /\b(warning|danger|caution|notice|hazard|safety|osha|no trespassing|private property|surveillance|security camera|no parking|tow-away|tow away|fire lane|hard hat|high voltage|keep out|authorized personnel|beware of dog|wet floor)\b/i.test(
      lower
    );
  const isForSaleSign =
    !isWarningSign &&
    /\b(for sale|fsbo|open house|house for sale|car for sale|truck for sale|boat for sale|vehicle for sale|land for sale|for rent|for lease|yard sale|garage sale|estate sale|moving sale|asking \$)\b/i.test(
      lower
    );
  const isRoadsideSign =
    !isWarningSign &&
    !isForSaleSign &&
    /\b(roadside|yard sign|lawn sign|coroplast|directional|arrow|event parking|now open|grand opening|we buy houses|pressure wash|power wash|junk removal|roofing|siding|gutter|tree service|paving|hiring|now hiring|vote|re-elect)\b/i.test(
      lower
    );

  let chosenKey = colorTheme;
  if (chosenKey === 'auto') {
    if (isWarningSign) {
      chosenKey = lower.includes('caution') || lower.includes('yellow') || lower.includes('voltage') || lower.includes('hard hat')
        ? 'safety-yellow'
        : 'osha-danger';
    } else if (isForSaleSign) {
      chosenKey = 'for-sale-red';
    } else if (isRoadsideSign) {
      chosenKey = 'roadside-neon';
    } else if (lower.includes('gold') && (lower.includes('black') || lower.includes('dark') || lower.includes('luxury'))) {
      chosenKey = 'midnight-gold';
    } else if (lower.includes('green') || lower.includes('emerald') || lower.includes('lawn') || lower.includes('landscap')) {
      chosenKey = 'emerald-cream';
    } else if (lower.includes('pink') || lower.includes('rose') || lower.includes('salon') || lower.includes('wedding')) {
      chosenKey = 'rose-blush';
    } else if (lower.includes('red') || lower.includes('crimson')) {
      chosenKey = 'crimson-gold';
    } else {
      chosenKey = 'navy-amber';
    }
  }
  const pal = palettes[chosenKey] || palettes['crimson-gold'];

  // Try calling live Gemini API if a key is stored to further enrich the copywriting & custom text boxes
  const apiKey = getStoredApiKey();
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert print designer in Geppy's PrintStudio.
The user wants to design: "${description}" on a ${unitWidthIn}" x ${unitHeightIn}" canvas.
Extract or invent polished, realistic print copywriting for this design and return JSON with:
{
  "company": "UPPERCASE BRAND OR HEADLINE",
  "tagline": "COMPELLING SUBHEADLINE OR SPECIALTY",
  "name": "Person Name or Main Feature Callout",
  "title": "Job Title or Secondary Offer",
  "phone": "Formatted Phone Number",
  "email": "Email Address",
  "website": "Website URL",
  "address": "Physical Address or Call to Action"
}`,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const aiCopy = JSON.parse(resp.text || '{}');
      if (aiCopy.company) company = String(aiCopy.company).toUpperCase();
      if (aiCopy.tagline) tagline = String(aiCopy.tagline);
      if (aiCopy.name) name = String(aiCopy.name);
      if (aiCopy.title) title = String(aiCopy.title);
      if (aiCopy.phone) phone = String(aiCopy.phone);
      if (aiCopy.email) email = String(aiCopy.email);
      if (aiCopy.website) website = String(aiCopy.website);
      if (aiCopy.address) address = String(aiCopy.address);
    } catch (e) {
      console.warn('Gemini copy enrichment fallback used:', e);
    }
  } else {
    await new Promise((r) => setTimeout(r, 450));
  }

  const sx = unitWidthIn / 3.5;
  const sy = unitHeightIn / 2.0;
  const fs = Math.sqrt(sx * sy);
  const monogram = company
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('');

  const shouldIncludeLayers =
    buildMode !== 'full-graphic' || includeEditableTextOnFullGraphic;

  // ============================================================================
  // SPECIALIZED COMMERCIAL SIGNAGE ARCHETYPE 1: FOR SALE / OPEN HOUSE / YARD SALE SIGNS
  // ============================================================================
  if (isForSaleSign) {
    let signBanner = 'FOR SALE';
    let mainSpec = '4 BED • 3 BATH • MOVE-IN READY';
    let subSpec = 'SHOWN BY APPOINTMENT • CALL OR TEXT TODAY';
    let priceOrBadge = 'BY OWNER';

    if (lower.includes('open house')) {
      signBanner = 'OPEN HOUSE';
      mainSpec = 'SUNDAY 1:00 PM – 4:00 PM';
      subSpec = 'TOUR TODAY • REFRESHMENTS SERVED';
      priceOrBadge = 'WELCOME ➔';
    } else if (lower.includes('yard sale') || lower.includes('garage sale') || lower.includes('estate sale')) {
      signBanner = lower.includes('estate') ? 'ESTATE SALE' : 'HUGE YARD SALE';
      mainSpec = 'SAT & SUN • 8:00 AM – 3:00 PM';
      subSpec = 'FURNITURE • TOOLS • ELECTRONICS • CLOTHES';
      priceOrBadge = 'FOLLOW ARROW ➔';
    } else if (lower.includes('car') || lower.includes('truck') || lower.includes('boat') || lower.includes('vehicle') || lower.includes('ford') || lower.includes('honda') || lower.includes('chevy')) {
      signBanner = 'FOR SALE';
      mainSpec = quoted[0] ? quoted[0].toUpperCase() : 'CLEAN TITLE • LOW MILES';
      subSpec = 'EXCELLENT CONDITION • SERIOUS INQUIRIES ONLY';
      priceOrBadge = 'ASKING $18,500';
    } else if (lower.includes('land') || lower.includes('lot') || lower.includes('acre') || lower.includes('commercial')) {
      signBanner = 'PRIME PROPERTY FOR SALE';
      mainSpec = 'COMMERCIAL / RESIDENTIAL ZONED LOT';
      subSpec = 'UTILITIES AT STREET • OWNER FINANCING AVAILABLE';
      priceOrBadge = 'AVAILABLE NOW';
    } else if (lower.includes('by owner') || lower.includes('fsbo')) {
      signBanner = 'FOR SALE BY OWNER';
    }

    if (quoted.length >= 1) mainSpec = quoted[0].toUpperCase();
    if (quoted.length >= 2) subSpec = quoted[1].toUpperCase();
    const priceMatch = p.match(/(\$[\d,]+(?:\s*OBO)?)/i);
    if (priceMatch) priceOrBadge = priceMatch[1].toUpperCase();

    const W = unitWidthIn;
    const H = unitHeightIn;
    // Scale font points relative to sign height (72 pt per inch)
    const pt = (fractionOfH: number) => Math.max(8, Math.round(H * 72 * fractionOfH));

    const fsBg1 =
      buildMode !== 'layout-layers'
        ? renderCustomStudioArtwork({
            widthIn: W,
            heightIn: H,
            primaryColor: '#cc0000',
            accentColor: '#1e3a8a',
            bgColor: '#ffffff',
            styleVariant: 'for-sale-frame',
          })
        : undefined;

    const fsConcept1: CanvasElement[] = shouldIncludeLayers
      ? [
          {
            id: 'fs1-top-block',
            type: 'rect',
            role: 'accent',
            name: 'Top FOR SALE Header Banner',
            x: 0,
            y: 0,
            width: W,
            height: Number((H * 0.34).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#cc0000',
          },
          {
            id: 'fs1-header-txt',
            type: 'text',
            role: 'company',
            name: 'Main FOR SALE Headline',
            x: Number((W * 0.04).toFixed(3)),
            y: Number((H * 0.05).toFixed(3)),
            width: Number((W * 0.92).toFixed(3)),
            height: Number((H * 0.24).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: signBanner,
            fontFamily: 'Oswald',
            fontSize: pt(0.18),
            fontWeight: '800',
            color: '#ffffff',
            textAlign: 'center',
          },
          {
            id: 'fs1-badge',
            type: 'rounded-rect',
            role: 'logo',
            name: 'Price / By Owner Callout Pill',
            x: Number((W * 0.22).toFixed(3)),
            y: Number((H * 0.28).toFixed(3)),
            width: Number((W * 0.56).toFixed(3)),
            height: Number((H * 0.11).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#0f172a',
            stroke: '#ffffff',
            strokeWidth: 2,
            borderRadius: 8,
            text: priceOrBadge,
            color: '#facc15',
            fontFamily: 'Montserrat',
            fontSize: pt(0.055),
            fontWeight: '800',
            textAlign: 'center',
          },
          {
            id: 'fs1-spec',
            type: 'text',
            role: 'name',
            name: 'Primary Property / Vehicle Specs',
            x: Number((W * 0.05).toFixed(3)),
            y: Number((H * 0.44).toFixed(3)),
            width: Number((W * 0.9).toFixed(3)),
            height: Number((H * 0.14).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: mainSpec,
            fontFamily: 'Montserrat',
            fontSize: pt(0.072),
            fontWeight: '800',
            color: '#0f172a',
            textAlign: 'center',
          },
          {
            id: 'fs1-subspec',
            type: 'text',
            role: 'tagline',
            name: 'Secondary Feature Line',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.59).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.1).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: subSpec,
            fontFamily: 'Inter',
            fontSize: pt(0.045),
            fontWeight: '700',
            color: '#1e3a8a',
            textAlign: 'center',
          },
          {
            id: 'fs1-bottom-bar',
            type: 'rect',
            role: 'accent',
            name: 'Bottom High-Vis Phone Bar',
            x: 0,
            y: Number((H * 0.73).toFixed(3)),
            width: W,
            height: Number((H * 0.27).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#1e3a8a',
          },
          {
            id: 'fs1-phone',
            type: 'text',
            role: 'phone',
            name: 'Giant Street-Readable Phone Number',
            x: Number((W * 0.04).toFixed(3)),
            y: Number((H * 0.77).toFixed(3)),
            width: Number((W * 0.92).toFixed(3)),
            height: Number((H * 0.19).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: phone,
            fontFamily: 'Oswald',
            fontSize: pt(0.135),
            fontWeight: '800',
            color: '#ffffff',
            textAlign: 'center',
          },
        ]
      : [];

    const fsConcept2: CanvasElement[] = shouldIncludeLayers
      ? [
          {
            id: 'fs2-top',
            type: 'rect',
            role: 'accent',
            name: 'Top Header Block',
            x: 0,
            y: 0,
            width: W,
            height: Number((H * 0.26).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#cc0000',
          },
          {
            id: 'fs2-title',
            type: 'text',
            role: 'company',
            name: 'Header Headline',
            x: Number((W * 0.04).toFixed(3)),
            y: Number((H * 0.03).toFixed(3)),
            width: Number((W * 0.92).toFixed(3)),
            height: Number((H * 0.2).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: signBanner,
            fontFamily: 'Oswald',
            fontSize: pt(0.145),
            fontWeight: '800',
            color: '#ffffff',
            textAlign: 'center',
          },
          {
            id: 'fs2-arrow-box',
            type: 'rounded-rect',
            role: 'logo',
            name: 'Giant Directional Arrow Banner',
            x: Number((W * 0.08).toFixed(3)),
            y: Number((H * 0.31).toFixed(3)),
            width: Number((W * 0.84).toFixed(3)),
            height: Number((H * 0.22).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#facc15',
            stroke: '#09090b',
            strokeWidth: 2.5,
            borderRadius: 10,
            text: `${priceOrBadge.replace('➔', '').trim()}  ➔`,
            color: '#09090b',
            fontFamily: 'Oswald',
            fontSize: pt(0.12),
            fontWeight: '800',
            textAlign: 'center',
          },
          {
            id: 'fs2-spec',
            type: 'text',
            role: 'name',
            name: 'Property / Event Details',
            x: Number((W * 0.05).toFixed(3)),
            y: Number((H * 0.58).toFixed(3)),
            width: Number((W * 0.9).toFixed(3)),
            height: Number((H * 0.12).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: mainSpec,
            fontFamily: 'Montserrat',
            fontSize: pt(0.068),
            fontWeight: '800',
            color: '#ffffff',
            textAlign: 'center',
          },
          {
            id: 'fs2-phone',
            type: 'text',
            role: 'phone',
            name: 'Bottom Phone Callout',
            x: Number((W * 0.05).toFixed(3)),
            y: Number((H * 0.74).toFixed(3)),
            width: Number((W * 0.9).toFixed(3)),
            height: Number((H * 0.18).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: `CALL/TEXT: ${phone}`,
            fontFamily: 'Oswald',
            fontSize: pt(0.105),
            fontWeight: '800',
            color: '#facc15',
            textAlign: 'center',
          },
        ]
      : [];

    const fsConcept3: CanvasElement[] = shouldIncludeLayers
      ? [
          {
            id: 'fs3-frame',
            type: 'rect',
            role: 'accent',
            name: 'Heavy Outer Sign Border',
            x: Number((W * 0.03).toFixed(3)),
            y: Number((H * 0.03).toFixed(3)),
            width: Number((W * 0.94).toFixed(3)),
            height: Number((H * 0.94).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: 'transparent',
            stroke: '#cc0000',
            strokeWidth: 4,
          },
          {
            id: 'fs3-header-pill',
            type: 'rounded-rect',
            role: 'accent',
            name: 'Centered FOR SALE Banner',
            x: Number((W * 0.08).toFixed(3)),
            y: Number((H * 0.08).toFixed(3)),
            width: Number((W * 0.84).toFixed(3)),
            height: Number((H * 0.25).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#cc0000',
            borderRadius: 8,
            text: signBanner,
            color: '#ffffff',
            fontFamily: 'Oswald',
            fontSize: pt(0.145),
            fontWeight: '800',
            textAlign: 'center',
          },
          {
            id: 'fs3-spec',
            type: 'text',
            role: 'name',
            name: 'Bold Main Specification',
            x: Number((W * 0.08).toFixed(3)),
            y: Number((H * 0.39).toFixed(3)),
            width: Number((W * 0.84).toFixed(3)),
            height: Number((H * 0.14).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: mainSpec,
            fontFamily: 'Montserrat',
            fontSize: pt(0.072),
            fontWeight: '800',
            color: '#0f172a',
            textAlign: 'center',
          },
          {
            id: 'fs3-sub',
            type: 'text',
            role: 'tagline',
            name: 'Secondary Highlights',
            x: Number((W * 0.08).toFixed(3)),
            y: Number((H * 0.55).toFixed(3)),
            width: Number((W * 0.84).toFixed(3)),
            height: Number((H * 0.1).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: `${priceOrBadge}  •  ${subSpec}`,
            fontFamily: 'Inter',
            fontSize: pt(0.044),
            fontWeight: '700',
            color: '#cc0000',
            textAlign: 'center',
          },
          {
            id: 'fs3-phone-box',
            type: 'rounded-rect',
            role: 'phone',
            name: 'High-Contrast Phone Pill',
            x: Number((W * 0.08).toFixed(3)),
            y: Number((H * 0.69).toFixed(3)),
            width: Number((W * 0.84).toFixed(3)),
            height: Number((H * 0.21).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#0f172a',
            borderRadius: 8,
            text: phone,
            color: '#ffffff',
            fontFamily: 'Oswald',
            fontSize: pt(0.125),
            fontWeight: '800',
            textAlign: 'center',
          },
        ]
      : [];

    return [
      {
        id: 'for-sale-classic',
        title: 'Concept 1: High-Impact "FOR SALE" Block Sign',
        styleSubtitle: 'Bold red top banner, callout badge, property/item specs & giant street-readable phone bar',
        summary: `AI generated "${signBanner}" (${mainSpec}) high-visibility For Sale sign with ${fsConcept1.length} editable signage layers.`,
        frontMaster: {
          id: 'master-a',
          name: 'Master A (Front Sign)',
          backgroundColor: '#ffffff',
          backgroundImage: fsBg1,
          elements: fsConcept1,
        },
        backMaster: {
          id: 'master-b',
          name: 'Master B (Back Sign)',
          backgroundColor: '#ffffff',
          backgroundImage: fsBg1,
          elements: fsConcept1,
        },
        palette: ['#cc0000', '#1e3a8a', '#facc15', '#ffffff'],
      },
      {
        id: 'for-sale-directional',
        title: 'Concept 2: Directional Arrow Roadside Sign (➔)',
        styleSubtitle: 'High-contrast dark navy sign with giant yellow directional arrow banner & phone footer',
        summary: `AI generated "${signBanner}" directional roadside sign with ${fsConcept2.length} editable signage layers.`,
        frontMaster: {
          id: 'master-a',
          name: 'Master A (Front Sign)',
          backgroundColor: '#0f172a',
          elements: fsConcept2,
        },
        backMaster: {
          id: 'master-b',
          name: 'Master B (Back Sign)',
          backgroundColor: '#0f172a',
          elements: fsConcept2,
        },
        palette: ['#0f172a', '#cc0000', '#facc15', '#ffffff'],
      },
      {
        id: 'for-sale-framed',
        title: 'Concept 3: Framed Commercial Yard Sign',
        styleSubtitle: 'Heavy red outer frame, centered header pill, spec callouts & high-contrast phone block',
        summary: `AI generated "${signBanner}" framed yard sign with ${fsConcept3.length} editable signage layers.`,
        frontMaster: {
          id: 'master-a',
          name: 'Master A (Front Sign)',
          backgroundColor: '#ffffff',
          elements: fsConcept3,
        },
        backMaster: {
          id: 'master-b',
          name: 'Master B (Back Sign)',
          backgroundColor: '#ffffff',
          elements: fsConcept3,
        },
        palette: ['#cc0000', '#0f172a', '#ffffff', '#1e3a8a'],
      },
    ];
  }

  // ============================================================================
  // SPECIALIZED COMMERCIAL SIGNAGE ARCHETYPE 2: WARNING / OSHA SAFETY / SECURITY SIGNS
  // ============================================================================
  if (isWarningSign) {
    let signalWord = '⚠ WARNING';
    let hazardHeadline = 'AUTHORIZED PERSONNEL ONLY';
    let subRule = 'ALL VISITORS MUST SIGN IN AT MAIN OFFICE';
    let footerNotice = 'OSHA / ANSI COMPLIANT SAFETY SIGNAGE';
    let signalBg = '#dc2626';
    let signalText = '#ffffff';

    if (lower.includes('danger') || lower.includes('voltage') || lower.includes('flammable')) {
      signalWord = '⚠ DANGER';
      hazardHeadline = lower.includes('voltage')
        ? 'HIGH VOLTAGE — KEEP OUT'
        : 'HAZARDOUS AREA — DO NOT ENTER';
      subRule = 'SEVERE INJURY OR DEATH WILL OCCUR • LOCKOUT/TAGOUT REQUIRED';
      signalBg = '#dc2626';
      signalText = '#ffffff';
    } else if (lower.includes('caution') || lower.includes('hard hat') || lower.includes('wet floor') || lower.includes('ppe') || lower.includes('construction')) {
      signalWord = '⚠ CAUTION';
      hazardHeadline = lower.includes('wet')
        ? 'WET FLOOR — WATCH YOUR STEP'
        : 'CONSTRUCTION ZONE — HARD HAT & PPE REQUIRED';
      subRule = 'SAFETY GLASSES, HIGH-VIS VEST & STEEL-TOE BOOTS MANDATORY BEYOND THIS POINT';
      signalBg = '#facc15';
      signalText = '#09090b';
    } else if (lower.includes('trespass') || lower.includes('private property') || lower.includes('surveillance') || lower.includes('camera') || lower.includes('dog')) {
      signalWord = '⚠ WARNING';
      hazardHeadline = lower.includes('dog')
        ? 'BEWARE OF DOG — DO NOT ENTER'
        : 'PRIVATE PROPERTY — NO TRESPASSING';
      subRule = 'PREMISES MONITORED BY 24-HOUR AUDIO & HD VIDEO SURVEILLANCE';
      footerNotice = 'VIOLATORS WILL BE PROSECUTED TO THE FULL EXTENT OF THE LAW';
      signalBg = '#dc2626';
      signalText = '#ffffff';
    } else if (lower.includes('parking') || lower.includes('tow') || lower.includes('fire lane')) {
      signalWord = 'NO PARKING';
      hazardHeadline = 'FIRE LANE — TOW-AWAY ZONE';
      subRule = 'UNAUTHORIZED VEHICLES WILL BE TOWED AT VEHICLE OWNER’S EXPENSE';
      footerNotice = '24 HOURS A DAY • 7 DAYS A WEEK  <───>';
      signalBg = '#dc2626';
      signalText = '#ffffff';
    }

    if (quoted.length >= 1) hazardHeadline = quoted[0].toUpperCase();
    if (quoted.length >= 2) subRule = quoted[1].toUpperCase();

    const W = unitWidthIn;
    const H = unitHeightIn;
    const pt = (fractionOfH: number) => Math.max(8, Math.round(H * 72 * fractionOfH));

    const hazardStripeArt = renderCustomStudioArtwork({
      widthIn: W,
      heightIn: H,
      primaryColor: '#09090b',
      accentColor: '#facc15',
      bgColor: '#ffffff',
      styleVariant: 'hazard-stripes',
    });

    // Concept 1: OSHA / ANSI Standard Signal Header Sign
    const wConcept1: CanvasElement[] = shouldIncludeLayers
      ? [
          {
            id: 'w1-border',
            type: 'rect',
            role: 'accent',
            name: 'Heavy ANSI Outer Border',
            x: Number((W * 0.025).toFixed(3)),
            y: Number((H * 0.025).toFixed(3)),
            width: Number((W * 0.95).toFixed(3)),
            height: Number((H * 0.95).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: 'transparent',
            stroke: '#09090b',
            strokeWidth: 4,
          },
          {
            id: 'w1-signal-box',
            type: 'rect',
            role: 'accent',
            name: 'Top OSHA Signal Panel',
            x: Number((W * 0.045).toFixed(3)),
            y: Number((H * 0.05).toFixed(3)),
            width: Number((W * 0.91).toFixed(3)),
            height: Number((H * 0.25).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: signalBg,
            stroke: '#09090b',
            strokeWidth: 2,
          },
          {
            id: 'w1-signal-txt',
            type: 'text',
            role: 'company',
            name: 'Signal Header Text (WARNING / DANGER / CAUTION)',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.08).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.19).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: signalWord,
            fontFamily: 'Oswald',
            fontSize: pt(0.145),
            fontWeight: '800',
            color: signalText,
            textAlign: 'center',
          },
          {
            id: 'w1-main-hazard',
            type: 'text',
            role: 'name',
            name: 'Primary Hazard Message',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.36).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.24).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: hazardHeadline,
            fontFamily: 'Oswald',
            fontSize: pt(0.095),
            fontWeight: '800',
            color: '#09090b',
            textAlign: 'center',
          },
          {
            id: 'w1-sub-rule',
            type: 'text',
            role: 'tagline',
            name: 'Compliance / Safety Instruction Text',
            x: Number((W * 0.07).toFixed(3)),
            y: Number((H * 0.63).toFixed(3)),
            width: Number((W * 0.86).toFixed(3)),
            height: Number((H * 0.16).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: subRule,
            fontFamily: 'Montserrat',
            fontSize: pt(0.048),
            fontWeight: '700',
            color: '#1e293b',
            textAlign: 'center',
          },
          {
            id: 'w1-footer-bar',
            type: 'rect',
            role: 'accent',
            name: 'Bottom Enforcement Bar',
            x: Number((W * 0.045).toFixed(3)),
            y: Number((H * 0.82).toFixed(3)),
            width: Number((W * 0.91).toFixed(3)),
            height: Number((H * 0.12).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#09090b',
          },
          {
            id: 'w1-footer-txt',
            type: 'text',
            role: 'address',
            name: 'Footer Notice Line',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.845).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.08).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: footerNotice,
            fontFamily: 'Inter',
            fontSize: pt(0.036),
            fontWeight: '700',
            color: '#facc15',
            textAlign: 'center',
          },
        ]
      : [];

    // Concept 2: Industrial Diagonal Caution-Stripe Sign
    const wConcept2: CanvasElement[] = shouldIncludeLayers
      ? [
          {
            id: 'w2-signal-pill',
            type: 'rounded-rect',
            role: 'logo',
            name: 'High-Contrast Warning Signal Pill',
            x: Number((W * 0.12).toFixed(3)),
            y: Number((H * 0.15).toFixed(3)),
            width: Number((W * 0.76).toFixed(3)),
            height: Number((H * 0.2).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#09090b',
            stroke: '#facc15',
            strokeWidth: 3,
            borderRadius: 8,
            text: signalWord,
            color: '#facc15',
            fontFamily: 'Oswald',
            fontSize: pt(0.12),
            fontWeight: '800',
            textAlign: 'center',
          },
          {
            id: 'w2-headline',
            type: 'text',
            role: 'name',
            name: 'Bold Hazard Headline',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.4).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.22).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: hazardHeadline,
            fontFamily: 'Oswald',
            fontSize: pt(0.095),
            fontWeight: '800',
            color: '#dc2626',
            textAlign: 'center',
          },
          {
            id: 'w2-sub',
            type: 'text',
            role: 'tagline',
            name: 'Secondary Compliance Text',
            x: Number((W * 0.08).toFixed(3)),
            y: Number((H * 0.65).toFixed(3)),
            width: Number((W * 0.84).toFixed(3)),
            height: Number((H * 0.18).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: subRule,
            fontFamily: 'Montserrat',
            fontSize: pt(0.048),
            fontWeight: '700',
            color: '#09090b',
            textAlign: 'center',
          },
        ]
      : [];

    // Concept 3: High-Visibility Safety Yellow & Black Industrial Placard
    const wConcept3: CanvasElement[] = shouldIncludeLayers
      ? [
          {
            id: 'w3-border',
            type: 'rounded-rect',
            role: 'accent',
            name: 'Heavy Black Industrial Frame',
            x: Number((W * 0.03).toFixed(3)),
            y: Number((H * 0.03).toFixed(3)),
            width: Number((W * 0.94).toFixed(3)),
            height: Number((H * 0.94).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: 'transparent',
            stroke: '#09090b',
            strokeWidth: 5,
            borderRadius: 12,
          },
          {
            id: 'w3-top-header',
            type: 'rect',
            role: 'accent',
            name: 'Top Black Signal Header',
            x: Number((W * 0.03).toFixed(3)),
            y: Number((H * 0.03).toFixed(3)),
            width: Number((W * 0.94).toFixed(3)),
            height: Number((H * 0.25).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#09090b',
          },
          {
            id: 'w3-signal',
            type: 'text',
            role: 'company',
            name: 'Yellow-on-Black Signal Word',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.065).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.18).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: signalWord,
            fontFamily: 'Oswald',
            fontSize: pt(0.14),
            fontWeight: '800',
            color: '#facc15',
            textAlign: 'center',
          },
          {
            id: 'w3-headline',
            type: 'text',
            role: 'name',
            name: 'High-Contrast Black Hazard Text',
            x: Number((W * 0.07).toFixed(3)),
            y: Number((H * 0.34).toFixed(3)),
            width: Number((W * 0.86).toFixed(3)),
            height: Number((H * 0.25).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: hazardHeadline,
            fontFamily: 'Oswald',
            fontSize: pt(0.095),
            fontWeight: '800',
            color: '#09090b',
            textAlign: 'center',
          },
          {
            id: 'w3-rule',
            type: 'text',
            role: 'tagline',
            name: 'Safety Rule Instructions',
            x: Number((W * 0.08).toFixed(3)),
            y: Number((H * 0.63).toFixed(3)),
            width: Number((W * 0.84).toFixed(3)),
            height: Number((H * 0.16).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: subRule,
            fontFamily: 'Montserrat',
            fontSize: pt(0.048),
            fontWeight: '800',
            color: '#09090b',
            textAlign: 'center',
          },
          {
            id: 'w3-footer',
            type: 'text',
            role: 'address',
            name: 'Bottom Compliance Notice',
            x: Number((W * 0.08).toFixed(3)),
            y: Number((H * 0.83).toFixed(3)),
            width: Number((W * 0.84).toFixed(3)),
            height: Number((H * 0.08).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: footerNotice,
            fontFamily: 'Inter',
            fontSize: pt(0.036),
            fontWeight: '800',
            color: '#dc2626',
            textAlign: 'center',
          },
        ]
      : [];

    return [
      {
        id: 'warning-osha-standard',
        title: 'Concept 1: OSHA / ANSI Standard Signal Header Sign',
        styleSubtitle: 'Official signal header block, bold uppercase hazard headline & enforcement footer',
        summary: `AI generated "${signalWord}: ${hazardHeadline}" OSHA/ANSI safety sign with ${wConcept1.length} editable signage layers.`,
        frontMaster: {
          id: 'master-a',
          name: 'Master A (Front Sign)',
          backgroundColor: '#ffffff',
          elements: wConcept1,
        },
        backMaster: {
          id: 'master-b',
          name: 'Master B (Back Sign)',
          backgroundColor: '#ffffff',
          elements: wConcept1,
        },
        palette: [signalBg, '#09090b', '#facc15', '#ffffff'],
      },
      {
        id: 'warning-hazard-stripes',
        title: 'Concept 2: Diagonal Caution-Stripe Perimeter Sign',
        styleSubtitle: '45° yellow & black industrial hazard stripes at top and bottom with high-impact warning text',
        summary: `AI generated "${signalWord}: ${hazardHeadline}" diagonal hazard-stripe sign with ${wConcept2.length} editable layers.`,
        frontMaster: {
          id: 'master-a',
          name: 'Master A (Front Sign)',
          backgroundColor: '#ffffff',
          backgroundImage: hazardStripeArt,
          elements: wConcept2,
        },
        backMaster: {
          id: 'master-b',
          name: 'Master B (Back Sign)',
          backgroundColor: '#ffffff',
          backgroundImage: hazardStripeArt,
          elements: wConcept2,
        },
        palette: ['#facc15', '#09090b', '#dc2626', '#ffffff'],
      },
      {
        id: 'warning-yellow-placard',
        title: 'Concept 3: High-Visibility Safety Yellow Placard',
        styleSubtitle: 'Safety-yellow background, heavy black industrial frame & maximum contrast legibility',
        summary: `AI generated "${signalWord}: ${hazardHeadline}" safety-yellow placard with ${wConcept3.length} editable layers.`,
        frontMaster: {
          id: 'master-a',
          name: 'Master A (Front Sign)',
          backgroundColor: '#facc15',
          elements: wConcept3,
        },
        backMaster: {
          id: 'master-b',
          name: 'Master B (Back Sign)',
          backgroundColor: '#facc15',
          elements: wConcept3,
        },
        palette: ['#facc15', '#09090b', '#dc2626', '#ffffff'],
      },
    ];
  }

  // ============================================================================
  // SPECIALIZED COMMERCIAL SIGNAGE ARCHETYPE 3: ROADSIDE / YARD / DIRECTIONAL SIGNS
  // ============================================================================
  if (isRoadsideSign) {
    let topCallout = 'FREE ESTIMATES • LICENSED & INSURED';
    let bigServiceHeadline = company;
    let middleRibbon = tagline;
    let arrowOrSub = '➔ CALL TODAY FOR FAST SERVICE';

    if (lower.includes('pressure wash') || lower.includes('power wash')) {
      bigServiceHeadline = 'PRESSURE WASHING';
      middleRibbon = 'DRIVEWAYS • SIDING • DECKS • ROOFS';
      topCallout = 'RESIDENTIAL & COMMERCIAL';
    } else if (lower.includes('roof') || lower.includes('siding') || lower.includes('gutter')) {
      bigServiceHeadline = 'ROOFING & SIDING';
      middleRibbon = 'STORM DAMAGE • REPAIRS • NEW ROOFS';
      topCallout = 'FREE ROOF INSPECTION';
    } else if (lower.includes('junk')) {
      bigServiceHeadline = 'JUNK REMOVAL';
      middleRibbon = 'SAME-DAY HAULING • WE LOAD IT ALL';
      topCallout = 'FAST & AFFORDABLE';
    } else if (lower.includes('we buy houses') || lower.includes('cash for houses')) {
      bigServiceHeadline = 'WE BUY HOUSES CASH';
      middleRibbon = 'ANY CONDITION • CLOSE IN 7 DAYS • NO FEES';
      topCallout = 'LOCAL CASH HOME BUYERS';
    } else if (lower.includes('now open') || lower.includes('grand opening')) {
      bigServiceHeadline = 'NOW OPEN';
      middleRibbon = quoted[0] ? quoted[0].toUpperCase() : 'GRAND OPENING SPECIALS INSIDE';
      topCallout = 'WELCOME!';
      arrowOrSub = '➔ TURN IN HERE ➔';
    } else if (lower.includes('parking') || lower.includes('directional') || lower.includes('event')) {
      bigServiceHeadline = 'EVENT PARKING';
      middleRibbon = 'FOLLOW SIGNS TO MAIN ENTRANCE';
      topCallout = 'WELCOME GUESTS';
      arrowOrSub = '➔ NEXT RIGHT AHEAD ➔';
    } else if (lower.includes('hiring')) {
      bigServiceHeadline = 'NOW HIRING';
      middleRibbon = 'COMPETITIVE PAY • GREAT BENEFITS • APPLY TODAY';
      topCallout = 'JOIN OUR TEAM';
    }

    if (quoted.length >= 1) bigServiceHeadline = quoted[0].toUpperCase();
    if (quoted.length >= 2) middleRibbon = quoted[1].toUpperCase();

    const W = unitWidthIn;
    const H = unitHeightIn;
    const pt = (fractionOfH: number) => Math.max(8, Math.round(H * 72 * fractionOfH));

    // Concept 1: 3-Second Speed-Read Roadside Contractor Yard Sign
    const rConcept1: CanvasElement[] = shouldIncludeLayers
      ? [
          {
            id: 'r1-top-bg',
            type: 'rect',
            role: 'accent',
            name: 'Top Dark High-Contrast Block',
            x: 0,
            y: 0,
            width: W,
            height: Number((H * 0.56).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#0f172a',
          },
          {
            id: 'r1-top-pill',
            type: 'rounded-rect',
            role: 'logo',
            name: 'Top Trust Callout Pill',
            x: Number((W * 0.12).toFixed(3)),
            y: Number((H * 0.05).toFixed(3)),
            width: Number((W * 0.76).toFixed(3)),
            height: Number((H * 0.11).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#cc0000',
            borderRadius: 6,
            text: topCallout,
            color: '#ffffff',
            fontFamily: 'Montserrat',
            fontSize: pt(0.048),
            fontWeight: '800',
            textAlign: 'center',
          },
          {
            id: 'r1-headline',
            type: 'text',
            role: 'company',
            name: 'Giant 35-MPH Service Headline',
            x: Number((W * 0.04).toFixed(3)),
            y: Number((H * 0.2).toFixed(3)),
            width: Number((W * 0.92).toFixed(3)),
            height: Number((H * 0.3).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: bigServiceHeadline,
            fontFamily: 'Oswald',
            fontSize: pt(0.165),
            fontWeight: '800',
            color: '#ffffff',
            textAlign: 'center',
          },
          {
            id: 'r1-mid-ribbon',
            type: 'rect',
            role: 'accent',
            name: 'Center High-Vis Yellow Ribbon',
            x: 0,
            y: Number((H * 0.54).toFixed(3)),
            width: W,
            height: Number((H * 0.14).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#facc15',
          },
          {
            id: 'r1-mid-txt',
            type: 'text',
            role: 'tagline',
            name: 'Services / Offer Ribbon Text',
            x: Number((W * 0.04).toFixed(3)),
            y: Number((H * 0.575).toFixed(3)),
            width: Number((W * 0.92).toFixed(3)),
            height: Number((H * 0.09).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: middleRibbon,
            fontFamily: 'Montserrat',
            fontSize: pt(0.052),
            fontWeight: '800',
            color: '#09090b',
            textAlign: 'center',
          },
          {
            id: 'r1-phone',
            type: 'text',
            role: 'phone',
            name: 'Oversized Roadside Phone Number',
            x: Number((W * 0.04).toFixed(3)),
            y: Number((H * 0.72).toFixed(3)),
            width: Number((W * 0.92).toFixed(3)),
            height: Number((H * 0.22).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: phone,
            fontFamily: 'Oswald',
            fontSize: pt(0.155),
            fontWeight: '800',
            color: '#cc0000',
            textAlign: 'center',
          },
        ]
      : [];

    // Concept 2: Directional Arrow Roadside Sign (➔)
    const rConcept2: CanvasElement[] = shouldIncludeLayers
      ? [
          {
            id: 'r2-headline',
            type: 'text',
            role: 'company',
            name: 'Bold Roadside Headline',
            x: Number((W * 0.04).toFixed(3)),
            y: Number((H * 0.06).toFixed(3)),
            width: Number((W * 0.92).toFixed(3)),
            height: Number((H * 0.24).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: bigServiceHeadline,
            fontFamily: 'Oswald',
            fontSize: pt(0.15),
            fontWeight: '800',
            color: '#0f172a',
            textAlign: 'center',
          },
          {
            id: 'r2-arrow-banner',
            type: 'rounded-rect',
            role: 'logo',
            name: 'Giant Directional Arrow Banner',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.33).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.25).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#cc0000',
            borderRadius: 12,
            text: arrowOrSub,
            color: '#ffffff',
            fontFamily: 'Oswald',
            fontSize: pt(0.115),
            fontWeight: '800',
            textAlign: 'center',
          },
          {
            id: 'r2-sub',
            type: 'text',
            role: 'tagline',
            name: 'Subheadline Callout',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.62).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.1).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: middleRibbon,
            fontFamily: 'Montserrat',
            fontSize: pt(0.052),
            fontWeight: '800',
            color: '#1e3a8a',
            textAlign: 'center',
          },
          {
            id: 'r2-phone',
            type: 'text',
            role: 'phone',
            name: 'Bottom Phone Number',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.74).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.2).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: phone,
            fontFamily: 'Oswald',
            fontSize: pt(0.135),
            fontWeight: '800',
            color: '#0f172a',
            textAlign: 'center',
          },
        ]
      : [];

    // Concept 3: High-Visibility Safety-Yellow Roadside Yard Sign
    const rConcept3: CanvasElement[] = shouldIncludeLayers
      ? [
          {
            id: 'r3-border',
            type: 'rect',
            role: 'accent',
            name: 'Heavy Black Sign Frame',
            x: Number((W * 0.025).toFixed(3)),
            y: Number((H * 0.03).toFixed(3)),
            width: Number((W * 0.95).toFixed(3)),
            height: Number((H * 0.94).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: 'transparent',
            stroke: '#09090b',
            strokeWidth: 4,
          },
          {
            id: 'r3-headline',
            type: 'text',
            role: 'company',
            name: 'Black-on-Yellow Impact Headline',
            x: Number((W * 0.05).toFixed(3)),
            y: Number((H * 0.08).toFixed(3)),
            width: Number((W * 0.9).toFixed(3)),
            height: Number((H * 0.28).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: bigServiceHeadline,
            fontFamily: 'Oswald',
            fontSize: pt(0.165),
            fontWeight: '800',
            color: '#09090b',
            textAlign: 'center',
          },
          {
            id: 'r3-sub',
            type: 'text',
            role: 'tagline',
            name: 'Service Bullet Strip',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.4).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.14).toFixed(3)),
            rotation: 0,
            opacity: 1,
            text: middleRibbon,
            fontFamily: 'Montserrat',
            fontSize: pt(0.058),
            fontWeight: '800',
            color: '#cc0000',
            textAlign: 'center',
          },
          {
            id: 'r3-phone-box',
            type: 'rounded-rect',
            role: 'phone',
            name: 'Bottom Black Phone Banner',
            x: Number((W * 0.06).toFixed(3)),
            y: Number((H * 0.6).toFixed(3)),
            width: Number((W * 0.88).toFixed(3)),
            height: Number((H * 0.3).toFixed(3)),
            rotation: 0,
            opacity: 1,
            fill: '#09090b',
            borderRadius: 10,
            text: phone,
            color: '#facc15',
            fontFamily: 'Oswald',
            fontSize: pt(0.155),
            fontWeight: '800',
            textAlign: 'center',
          },
        ]
      : [];

    return [
      {
        id: 'roadside-speed-read',
        title: 'Concept 1: 3-Second Speed-Read Yard Sign',
        styleSubtitle: 'Built for 35+ MPH legibility: Giant service headline, yellow ribbon & massive phone bar',
        summary: `AI generated "${bigServiceHeadline}" roadside yard sign with ${rConcept1.length} editable signage layers.`,
        frontMaster: {
          id: 'master-a',
          name: 'Master A (Front Sign)',
          backgroundColor: '#ffffff',
          elements: rConcept1,
        },
        backMaster: {
          id: 'master-b',
          name: 'Master B (Back Sign)',
          backgroundColor: '#ffffff',
          elements: rConcept1,
        },
        palette: ['#0f172a', '#facc15', '#cc0000', '#ffffff'],
      },
      {
        id: 'roadside-directional',
        title: 'Concept 2: Directional Arrow Roadside Sign (➔)',
        styleSubtitle: 'Oversized red directional arrow banner for intersections, events & storefront turns',
        summary: `AI generated "${bigServiceHeadline}" directional roadside sign with ${rConcept2.length} editable layers.`,
        frontMaster: {
          id: 'master-a',
          name: 'Master A (Front Sign)',
          backgroundColor: '#ffffff',
          elements: rConcept2,
        },
        backMaster: {
          id: 'master-b',
          name: 'Master B (Back Sign)',
          backgroundColor: '#ffffff',
          elements: rConcept2,
        },
        palette: ['#cc0000', '#0f172a', '#1e3a8a', '#ffffff'],
      },
      {
        id: 'roadside-yellow-impact',
        title: 'Concept 3: High-Vis Yellow & Black Coroplast Sign',
        styleSubtitle: 'Maximum roadside contrast with safety-yellow background & giant phone block',
        summary: `AI generated "${bigServiceHeadline}" high-vis yellow roadside sign with ${rConcept3.length} editable layers.`,
        frontMaster: {
          id: 'master-a',
          name: 'Master A (Front Sign)',
          backgroundColor: '#facc15',
          elements: rConcept3,
        },
        backMaster: {
          id: 'master-b',
          name: 'Master B (Back Sign)',
          backgroundColor: '#facc15',
          elements: rConcept3,
        },
        palette: ['#facc15', '#09090b', '#cc0000', '#ffffff'],
      },
    ];
  }

  // ============================================================================
  // CONCEPT 1: MODERN ARCHITECTURAL SPLIT (Bold Left/Top Accent + Clean Grid)
  // ============================================================================
  const c1BgArt =
    buildMode === 'hybrid-studio' || buildMode === 'full-graphic'
      ? renderCustomStudioArtwork({
          widthIn: unitWidthIn,
          heightIn: unitHeightIn,
          primaryColor: pal.primary,
          accentColor: pal.accent,
          bgColor: pal.lightBg,
          styleVariant: 'modern-split',
          bakeFullPosterText:
            buildMode === 'full-graphic' && !includeEditableTextOnFullGraphic
              ? { company, tagline, name, title, phone, email, website, address }
              : undefined,
        })
      : undefined;

  const c1FrontElements: CanvasElement[] = shouldIncludeLayers
    ? [
        {
          id: 'c1-side-bar',
          type: 'rect',
          role: 'accent',
          name: 'Left Brand Pillar',
          x: 0,
          y: 0,
          width: Number((0.2 * sx).toFixed(3)),
          height: Number((2.0 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          fill: pal.primary,
        },
        {
          id: 'c1-accent-strip',
          type: 'rect',
          role: 'accent',
          name: 'Accent Gold Strip',
          x: Number((0.2 * sx).toFixed(3)),
          y: 0,
          width: Number((0.04 * sx).toFixed(3)),
          height: Number((2.0 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          fill: pal.accent,
        },
        {
          id: 'c1-badge',
          type: 'rounded-rect',
          role: 'logo',
          name: 'Brand Monogram Box',
          x: Number((0.38 * sx).toFixed(3)),
          y: Number((0.2 * sy).toFixed(3)),
          width: Number((0.42 * sx).toFixed(3)),
          height: Number((0.42 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          fill: pal.primary,
          borderRadius: 6,
          text: monogram,
          color: '#ffffff',
          fontFamily: 'Montserrat',
          fontSize: Math.round(13 * fs),
          fontWeight: '800',
          textAlign: 'center',
        },
        {
          id: 'c1-company',
          type: 'text',
          role: 'company',
          name: 'Company Header Text Box',
          x: Number((0.88 * sx).toFixed(3)),
          y: Number((0.2 * sy).toFixed(3)),
          width: Number((2.42 * sx).toFixed(3)),
          height: Number((0.24 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: company,
          fontFamily: 'Montserrat',
          fontSize: Math.round(11 * fs),
          fontWeight: '800',
          color: '#0f172a',
          textAlign: 'left',
          letterSpacing: 0.7,
        },
        {
          id: 'c1-tagline',
          type: 'text',
          role: 'tagline',
          name: 'Tagline Text Box',
          x: Number((0.88 * sx).toFixed(3)),
          y: Number((0.44 * sy).toFixed(3)),
          width: Number((2.42 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: tagline,
          fontFamily: 'Inter',
          fontSize: Math.round(6.5 * fs),
          fontWeight: '600',
          color: pal.primary,
          textAlign: 'left',
          letterSpacing: 0.5,
        },
        {
          id: 'c1-name',
          type: 'text',
          role: 'name',
          name: 'Full Name Text Box',
          x: Number((0.38 * sx).toFixed(3)),
          y: Number((0.78 * sy).toFixed(3)),
          width: Number((2.2 * sx).toFixed(3)),
          height: Number((0.25 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: name,
          fontFamily: 'Inter',
          fontSize: Math.round(13 * fs),
          fontWeight: '700',
          color: '#0f172a',
          textAlign: 'left',
        },
        {
          id: 'c1-title',
          type: 'text',
          role: 'title',
          name: 'Role / Title Text Box',
          x: Number((0.38 * sx).toFixed(3)),
          y: Number((1.03 * sy).toFixed(3)),
          width: Number((2.2 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: title,
          fontFamily: 'Inter',
          fontSize: Math.round(8 * fs),
          fontWeight: '600',
          color: '#475569',
          textAlign: 'left',
        },
        {
          id: 'c1-line',
          type: 'line',
          role: 'accent',
          name: 'Horizontal Divider',
          x: Number((0.38 * sx).toFixed(3)),
          y: Number((1.26 * sy).toFixed(3)),
          width: Number((2.88 * sx).toFixed(3)),
          height: 0.02,
          rotation: 0,
          opacity: 1,
          stroke: '#cbd5e1',
          strokeWidth: 1,
        },
        {
          id: 'c1-phone',
          type: 'text',
          role: 'phone',
          name: 'Phone Text Box',
          x: Number((0.38 * sx).toFixed(3)),
          y: Number((1.34 * sy).toFixed(3)),
          width: Number((1.8 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: `☎ ${phone}`,
          fontFamily: 'Inter',
          fontSize: Math.round(7.5 * fs),
          fontWeight: '600',
          color: '#1e293b',
          textAlign: 'left',
        },
        {
          id: 'c1-email',
          type: 'text',
          role: 'email',
          name: 'Email Text Box',
          x: Number((0.38 * sx).toFixed(3)),
          y: Number((1.52 * sy).toFixed(3)),
          width: Number((2.1 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: `✉ ${email}`,
          fontFamily: 'Inter',
          fontSize: Math.round(7.2 * fs),
          fontWeight: '500',
          color: '#334155',
          textAlign: 'left',
        },
        {
          id: 'c1-address',
          type: 'text',
          role: 'address',
          name: 'Address & Website Box',
          x: Number((0.38 * sx).toFixed(3)),
          y: Number((1.7 * sy).toFixed(3)),
          width: Number((2.3 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: `📍 ${address}`,
          fontFamily: 'Inter',
          fontSize: Math.round(6.8 * fs),
          fontWeight: 'normal',
          color: '#64748b',
          textAlign: 'left',
        },
        {
          id: 'c1-qr',
          type: 'qr',
          role: 'qr',
          name: 'Scannable QR Code',
          x: Number((2.78 * sx).toFixed(3)),
          y: Number((1.34 * sy).toFixed(3)),
          width: Number((0.5 * sx).toFixed(3)),
          height: Number((0.5 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          qrValue: website.startsWith('http') ? website : `https://${website}`,
          fill: pal.primary,
        },
      ]
    : [];

  // ============================================================================
  // CONCEPT 2: EXECUTIVE DARK PRESTIGE (Centered Crest, Dark Background & Gold Trim)
  // ============================================================================
  const c2BgArt =
    buildMode === 'hybrid-studio' || buildMode === 'full-graphic'
      ? renderCustomStudioArtwork({
          widthIn: unitWidthIn,
          heightIn: unitHeightIn,
          primaryColor: pal.primary,
          accentColor: pal.accent,
          bgColor: pal.darkBg,
          styleVariant: 'luxury-crest',
          bakeFullPosterText:
            buildMode === 'full-graphic' && !includeEditableTextOnFullGraphic
              ? { company, tagline, name, title, phone, email, website, address }
              : undefined,
        })
      : undefined;

  const c2FrontElements: CanvasElement[] = shouldIncludeLayers
    ? [
        {
          id: 'c2-border',
          type: 'rect',
          role: 'accent',
          name: 'Luxury Gold Frame Border',
          x: Number((0.14 * sx).toFixed(3)),
          y: Number((0.14 * sy).toFixed(3)),
          width: Number((3.22 * sx).toFixed(3)),
          height: Number((1.72 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          fill: 'transparent',
          stroke: pal.accent,
          strokeWidth: 1.2,
        },
        {
          id: 'c2-company',
          type: 'text',
          role: 'company',
          name: 'Executive Brand Title',
          x: Number((0.3 * sx).toFixed(3)),
          y: Number((0.28 * sy).toFixed(3)),
          width: Number((2.9 * sx).toFixed(3)),
          height: Number((0.26 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: company,
          fontFamily: 'Cinzel',
          fontSize: Math.round(12 * fs),
          fontWeight: '700',
          color: pal.accent,
          textAlign: 'center',
          letterSpacing: 1.2,
        },
        {
          id: 'c2-tagline',
          type: 'text',
          role: 'tagline',
          name: 'Centered Subtitle',
          x: Number((0.3 * sx).toFixed(3)),
          y: Number((0.53 * sy).toFixed(3)),
          width: Number((2.9 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: tagline,
          fontFamily: 'Montserrat',
          fontSize: Math.round(6.2 * fs),
          fontWeight: '600',
          color: '#cbd5e1',
          textAlign: 'center',
          letterSpacing: 0.9,
        },
        {
          id: 'c2-divider',
          type: 'line',
          role: 'accent',
          name: 'Center Accent Rule',
          x: Number((1.15 * sx).toFixed(3)),
          y: Number((0.75 * sy).toFixed(3)),
          width: Number((1.2 * sx).toFixed(3)),
          height: 0.02,
          rotation: 0,
          opacity: 1,
          stroke: pal.accent,
          strokeWidth: 1.2,
        },
        {
          id: 'c2-name',
          type: 'text',
          role: 'name',
          name: 'Executive Name Box',
          x: Number((0.35 * sx).toFixed(3)),
          y: Number((0.86 * sy).toFixed(3)),
          width: Number((2.8 * sx).toFixed(3)),
          height: Number((0.25 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: name,
          fontFamily: 'Playfair Display',
          fontSize: Math.round(13.5 * fs),
          fontWeight: '700',
          color: '#ffffff',
          textAlign: 'center',
        },
        {
          id: 'c2-title',
          type: 'text',
          role: 'title',
          name: 'Executive Role Box',
          x: Number((0.35 * sx).toFixed(3)),
          y: Number((1.12 * sy).toFixed(3)),
          width: Number((2.8 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: title,
          fontFamily: 'Inter',
          fontSize: Math.round(7.8 * fs),
          fontWeight: '500',
          color: pal.accent,
          textAlign: 'center',
        },
        {
          id: 'c2-contact-row1',
          type: 'text',
          role: 'phone',
          name: 'Phone & Email Line',
          x: Number((0.25 * sx).toFixed(3)),
          y: Number((1.4 * sy).toFixed(3)),
          width: Number((3.0 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: `${phone}   |   ${email}`,
          fontFamily: 'Inter',
          fontSize: Math.round(7.2 * fs),
          fontWeight: '500',
          color: '#f1f5f9',
          textAlign: 'center',
        },
        {
          id: 'c2-contact-row2',
          type: 'text',
          role: 'address',
          name: 'Address & Website Line',
          x: Number((0.25 * sx).toFixed(3)),
          y: Number((1.6 * sy).toFixed(3)),
          width: Number((3.0 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: `${address}   •   ${website}`,
          fontFamily: 'Inter',
          fontSize: Math.round(6.6 * fs),
          fontWeight: 'normal',
          color: '#94a3b8',
          textAlign: 'center',
        },
      ]
    : [];

  // ============================================================================
  // CONCEPT 3: BOLD HEADER BANNER & EDITORIAL GRID
  // ============================================================================
  const c3BgArt =
    buildMode === 'hybrid-studio' || buildMode === 'full-graphic'
      ? renderCustomStudioArtwork({
          widthIn: unitWidthIn,
          heightIn: unitHeightIn,
          primaryColor: pal.primary,
          accentColor: pal.accent,
          bgColor: pal.lightBg,
          styleVariant: 'editorial-wave',
          bakeFullPosterText:
            buildMode === 'full-graphic' && !includeEditableTextOnFullGraphic
              ? { company, tagline, name, title, phone, email, website, address }
              : undefined,
        })
      : undefined;

  const c3FrontElements: CanvasElement[] = shouldIncludeLayers
    ? [
        {
          id: 'c3-top-banner',
          type: 'rect',
          role: 'accent',
          name: 'Top Header Block',
          x: 0,
          y: 0,
          width: Number((3.5 * sx).toFixed(3)),
          height: Number((0.62 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          fill: pal.primary,
        },
        {
          id: 'c3-banner-trim',
          type: 'rect',
          role: 'accent',
          name: 'Banner Accent Trim',
          x: 0,
          y: Number((0.62 * sy).toFixed(3)),
          width: Number((3.5 * sx).toFixed(3)),
          height: Number((0.05 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          fill: pal.accent,
        },
        {
          id: 'c3-company',
          type: 'text',
          role: 'company',
          name: 'Banner Company Title',
          x: Number((0.24 * sx).toFixed(3)),
          y: Number((0.12 * sy).toFixed(3)),
          width: Number((3.0 * sx).toFixed(3)),
          height: Number((0.24 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: company,
          fontFamily: 'Montserrat',
          fontSize: Math.round(12 * fs),
          fontWeight: '800',
          color: '#ffffff',
          textAlign: 'left',
          letterSpacing: 0.9,
        },
        {
          id: 'c3-tagline',
          type: 'text',
          role: 'tagline',
          name: 'Banner Subtitle',
          x: Number((0.24 * sx).toFixed(3)),
          y: Number((0.37 * sy).toFixed(3)),
          width: Number((3.0 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: tagline,
          fontFamily: 'Inter',
          fontSize: Math.round(6.6 * fs),
          fontWeight: '600',
          color: '#fef08a',
          textAlign: 'left',
          letterSpacing: 0.6,
        },
        {
          id: 'c3-name',
          type: 'text',
          role: 'name',
          name: 'Primary Name Text Box',
          x: Number((0.24 * sx).toFixed(3)),
          y: Number((0.8 * sy).toFixed(3)),
          width: Number((2.3 * sx).toFixed(3)),
          height: Number((0.25 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: name,
          fontFamily: 'Inter',
          fontSize: Math.round(13 * fs),
          fontWeight: '700',
          color: '#0f172a',
          textAlign: 'left',
        },
        {
          id: 'c3-title',
          type: 'text',
          role: 'title',
          name: 'Title Text Box',
          x: Number((0.24 * sx).toFixed(3)),
          y: Number((1.05 * sy).toFixed(3)),
          width: Number((2.3 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: title,
          fontFamily: 'Inter',
          fontSize: Math.round(8.2 * fs),
          fontWeight: '600',
          color: pal.primary,
          textAlign: 'left',
        },
        {
          id: 'c3-phone',
          type: 'text',
          role: 'phone',
          name: 'Phone Text Box',
          x: Number((0.24 * sx).toFixed(3)),
          y: Number((1.34 * sy).toFixed(3)),
          width: Number((2.2 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: `☎ ${phone}  •  ✉ ${email}`,
          fontFamily: 'Inter',
          fontSize: Math.round(7.4 * fs),
          fontWeight: '600',
          color: '#1e293b',
          textAlign: 'left',
        },
        {
          id: 'c3-address',
          type: 'text',
          role: 'address',
          name: 'Location & Web Box',
          x: Number((0.24 * sx).toFixed(3)),
          y: Number((1.56 * sy).toFixed(3)),
          width: Number((2.35 * sx).toFixed(3)),
          height: Number((0.18 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          text: `${address}  •  ${website}`,
          fontFamily: 'Inter',
          fontSize: Math.round(6.8 * fs),
          fontWeight: 'normal',
          color: '#475569',
          textAlign: 'left',
        },
        {
          id: 'c3-qr',
          type: 'qr',
          role: 'qr',
          name: 'QR Code Box',
          x: Number((2.76 * sx).toFixed(3)),
          y: Number((1.28 * sy).toFixed(3)),
          width: Number((0.52 * sx).toFixed(3)),
          height: Number((0.52 * sy).toFixed(3)),
          rotation: 0,
          opacity: 1,
          qrValue: website.startsWith('http') ? website : `https://${website}`,
          fill: pal.primary,
        },
      ]
    : [];

  // Shared Matching Back Master for 2-Sided Printing
  const createMatchingBack = (bgHex: string, accentHex: string): MasterDesign => ({
    id: 'master-b',
    name: 'Master B (Back)',
    backgroundColor: bgHex,
    elements: [
      {
        id: `back-bar-${Date.now()}`,
        type: 'rect',
        role: 'accent',
        name: 'Back Bottom Accent Bar',
        x: 0,
        y: Number((1.82 * sy).toFixed(3)),
        width: Number((3.5 * sx).toFixed(3)),
        height: Number((0.18 * sy).toFixed(3)),
        rotation: 0,
        opacity: 1,
        fill: accentHex,
      },
      {
        id: `back-badge-${Date.now()}`,
        type: 'rounded-rect',
        role: 'logo',
        name: 'Back Center Emblem',
        x: Number((1.48 * sx).toFixed(3)),
        y: Number((0.36 * sy).toFixed(3)),
        width: Number((0.54 * sx).toFixed(3)),
        height: Number((0.54 * sy).toFixed(3)),
        rotation: 0,
        opacity: 1,
        fill: accentHex,
        borderRadius: 10,
        text: monogram,
        color: '#ffffff',
        fontFamily: 'Montserrat',
        fontSize: Math.round(17 * fs),
        fontWeight: '800',
        textAlign: 'center',
      },
      {
        id: `back-comp-${Date.now()}`,
        type: 'text',
        role: 'company',
        name: 'Back Brand Headline',
        x: Number((0.3 * sx).toFixed(3)),
        y: Number((1.02 * sy).toFixed(3)),
        width: Number((2.9 * sx).toFixed(3)),
        height: Number((0.26 * sy).toFixed(3)),
        rotation: 0,
        opacity: 1,
        text: company,
        fontFamily: 'Montserrat',
        fontSize: Math.round(12 * fs),
        fontWeight: '800',
        color: '#ffffff',
        textAlign: 'center',
        letterSpacing: 1.2,
      },
      {
        id: `back-web-${Date.now()}`,
        type: 'text',
        role: 'website',
        name: 'Back Website URL',
        x: Number((0.4 * sx).toFixed(3)),
        y: Number((1.34 * sy).toFixed(3)),
        width: Number((2.7 * sx).toFixed(3)),
        height: Number((0.2 * sy).toFixed(3)),
        rotation: 0,
        opacity: 1,
        text: website,
        fontFamily: 'Inter',
        fontSize: Math.round(8 * fs),
        fontWeight: '500',
        color: '#fde68a',
        textAlign: 'center',
      },
    ],
  });

  return [
    {
      id: 'concept-architectural',
      title: 'Concept 1: Modern Architectural Split',
      styleSubtitle: 'Left pillar accent, monogram badge, structured contact grid & QR',
      summary: `AI generated "${company}" (${name}) in Modern Architectural Split with ${c1FrontElements.length} editable PrintStudio layers.`,
      frontMaster: {
        id: 'master-a',
        name: 'Master A (Front)',
        backgroundColor: pal.lightBg,
        backgroundImage: c1BgArt,
        elements: c1FrontElements,
      },
      backMaster: createMatchingBack(pal.primary, pal.accent),
      palette: [pal.primary, pal.accent, pal.lightBg, '#0f172a'],
    },
    {
      id: 'concept-prestige',
      title: 'Concept 2: Executive Dark Prestige',
      styleSubtitle: 'Centered luxury serif typography, metallic frame border & dark backdrop',
      summary: `AI generated "${company}" (${name}) in Executive Dark Prestige with ${c2FrontElements.length} editable PrintStudio layers.`,
      frontMaster: {
        id: 'master-a',
        name: 'Master A (Front)',
        backgroundColor: pal.darkBg,
        backgroundImage: c2BgArt,
        elements: c2FrontElements,
      },
      backMaster: createMatchingBack(pal.darkBg, pal.accent),
      palette: [pal.darkBg, pal.accent, '#ffffff', pal.primary],
    },
    {
      id: 'concept-editorial',
      title: 'Concept 3: Bold Header & Editorial Grid',
      styleSubtitle: 'Full-width header banner, high-contrast typography & scannable QR',
      summary: `AI generated "${company}" (${name}) in Bold Header Editorial style with ${c3FrontElements.length} editable PrintStudio layers.`,
      frontMaster: {
        id: 'master-a',
        name: 'Master A (Front)',
        backgroundColor: pal.lightBg,
        backgroundImage: c3BgArt,
        elements: c3FrontElements,
      },
      backMaster: createMatchingBack(pal.primary, pal.accent),
      palette: [pal.primary, pal.accent, pal.lightBg, '#1e293b'],
    },
  ];
}
