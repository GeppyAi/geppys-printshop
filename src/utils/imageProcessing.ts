import { CornerPoint } from '../types/printstudio';

export interface CleanupOptions {
  corners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint]; // TL, TR, BR, BL (0..1)
  enhanceLighting: boolean;
  contrastBoost: number; // 0 to 100
  brightnessBoost: number; // -50 to 50
  outputWidth?: number;
  outputHeight?: number;
}

/**
 * Performs a 4-point bilinear perspective warp + optional lighting/shadow cleanup
 * to turn a skewed phone photo of a business card into a flat, print-ready scan.
 */
export async function processCardPhoto(
  imageSrc: string,
  options: CleanupOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const outW = options.outputWidth || 1050;
      const outH = options.outputHeight || 600;

      // Read source pixels
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      const srcCtx = srcCanvas.getContext('2d');
      if (!srcCtx) {
        resolve(imageSrc);
        return;
      }
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, img.width, img.height);

      // Output canvas
      const dstCanvas = document.createElement('canvas');
      dstCanvas.width = outW;
      dstCanvas.height = outH;
      const dstCtx = dstCanvas.getContext('2d');
      if (!dstCtx) {
        resolve(imageSrc);
        return;
      }
      const dstImage = dstCtx.createImageData(outW, outH);
      const dstPixels = dstImage.data;
      const srcPixels = srcData.data;

      const [tl, tr, br, bl] = options.corners;

      // Contrast factor
      const contrast = options.enhanceLighting
        ? (options.contrastBoost || 22) * 2.55
        : 0;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      const bright = options.enhanceLighting ? options.brightnessBoost || 10 : 0;

      for (let y = 0; y < outH; y++) {
        const v = y / (outH - 1);
        for (let x = 0; x < outW; x++) {
          const u = x / (outW - 1);

          // Bilinear interpolation of source normalized coordinates
          const normX =
            (1 - u) * (1 - v) * tl.x +
            u * (1 - v) * tr.x +
            u * v * br.x +
            (1 - u) * v * bl.x;
          const normY =
            (1 - u) * (1 - v) * tl.y +
            u * (1 - v) * tr.y +
            u * v * br.y +
            (1 - u) * v * bl.y;

          const sx = Math.min(
            img.width - 1,
            Math.max(0, Math.round(normX * (img.width - 1)))
          );
          const sy = Math.min(
            img.height - 1,
            Math.max(0, Math.round(normY * (img.height - 1)))
          );

          const sIdx = (sy * img.width + sx) * 4;
          const dIdx = (y * outW + x) * 4;

          let r = srcPixels[sIdx];
          let g = srcPixels[sIdx + 1];
          let b = srcPixels[sIdx + 2];

          if (options.enhanceLighting) {
            r = Math.min(255, Math.max(0, factor * (r - 128) + 128 + bright));
            g = Math.min(255, Math.max(0, factor * (g - 128) + 128 + bright));
            b = Math.min(255, Math.max(0, factor * (b - 128) + 128 + bright));
          }

          dstPixels[dIdx] = r;
          dstPixels[dIdx + 1] = g;
          dstPixels[dIdx + 2] = b;
          dstPixels[dIdx + 3] = 255;
        }
      }

      dstCtx.putImageData(dstImage, 0, 0);
      resolve(dstCanvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
}

/**
 * Crops a normalized bounding box (0..1) from an image DataURL and returns a cropped DataURL
 * (used when AI detects a logo/emblem on the uploaded business card photo).
 */
export async function cropRegionFromImage(
  imageSrc: string,
  normBox: { x: number; y: number; width: number; height: number }
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const sx = Math.max(0, Math.round(normBox.x * img.width));
      const sy = Math.max(0, Math.round(normBox.y * img.height));
      const sw = Math.max(
        16,
        Math.min(img.width - sx, Math.round(normBox.width * img.width))
      );
      const sh = Math.max(
        16,
        Math.min(img.height - sy, Math.round(normBox.height * img.height))
      );

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

export interface SamplePhotoPreset {
  id: string;
  label: string;
  description: string;
  suggestedPrompt: string;
  defaultCorners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
  generateDataUrl: () => string;
  mockMetadata: {
    company: string;
    tagline: string;
    name: string;
    title: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    primaryColor: string;
    accentColor: string;
    bgColor: string;
  };
}

/**
 * Built-in realistic camera photos of physical business cards on a desk
 * so the user can immediately test "Upload Photo -> Perspective Cleanup -> AI Edit Prompt"
 */
export const SAMPLE_BUSINESS_CARD_PHOTOS: SamplePhotoPreset[] = [
  {
    id: 'sample-contractor',
    label: 'Apex Roofing & Exteriors (Desk Photo)',
    description: 'Tilted phone photo of a contractor business card on a wood desk',
    suggestedPrompt:
      'Change the name to Marcus Vance, update the phone number to (555) 890-4411, change the navy blue theme to crimson red & charcoal, and add "Licensed & Insured • Free Estimates" at the bottom.',
    defaultCorners: [
      { x: 0.09, y: 0.14 },
      { x: 0.91, y: 0.09 },
      { x: 0.93, y: 0.88 },
      { x: 0.07, y: 0.85 },
    ],
    mockMetadata: {
      company: 'APEX ROOFING & EXTERIORS',
      tagline: 'COMMERCIAL & RESIDENTIAL SPECIALISTS',
      name: 'David Miller',
      title: 'Senior Project Estimator',
      phone: '(555) 319-7820',
      email: 'dmiller@apexroofingpro.com',
      website: 'www.apexroofingpro.com',
      address: '410 Industrial Pkwy, Suite B',
      primaryColor: '#1e3a8a',
      accentColor: '#f59e0b',
      bgColor: '#ffffff',
    },
    generateDataUrl: () => {
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 560;
      const ctx = c.getContext('2d')!;

      // Wood desk background
      const deskGrad = ctx.createLinearGradient(0, 0, 900, 560);
      deskGrad.addColorStop(0, '#78553a');
      deskGrad.addColorStop(0.5, '#62432c');
      deskGrad.addColorStop(1, '#4c321f');
      ctx.fillStyle = deskGrad;
      ctx.fillRect(0, 0, 900, 560);

      // Subtle wood grain lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 15);
        ctx.bezierCurveTo(300, i * 15 + 12, 600, i * 15 - 10, 900, i * 15 + 5);
        ctx.stroke();
      }

      // Tilted card transform
      ctx.save();
      ctx.translate(450, 280);
      ctx.rotate(-0.035);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 14;

      // Card base
      ctx.fillStyle = '#fcfbf7';
      ctx.fillRect(-370, -210, 740, 420);
      ctx.shadowColor = 'transparent';

      // Navy header band
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(-370, -210, 740, 125);

      // Amber accent stripe
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-370, -85, 740, 12);

      // Roof icon triangle
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-310, -135);
      ctx.lineTo(-275, -175);
      ctx.lineTo(-240, -135);
      ctx.closePath();
      ctx.fill();

      // Company text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Montserrat, sans-serif';
      ctx.fillText('APEX ROOFING & EXTERIORS', -220, -150);
      ctx.fillStyle = '#fcd34d';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.fillText('COMMERCIAL & RESIDENTIAL SPECIALISTS', -220, -122);

      // Person Name & Title
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 30px Inter, sans-serif';
      ctx.fillText('David Miller', -320, -15);
      ctx.fillStyle = '#475569';
      ctx.font = '500 17px Inter, sans-serif';
      ctx.fillText('Senior Project Estimator', -320, 15);

      // Contact info
      ctx.fillStyle = '#1e293b';
      ctx.font = '500 16px Inter, sans-serif';
      ctx.fillText('Tel: (555) 319-7820', -320, 75);
      ctx.fillText('Email: dmiller@apexroofingpro.com', -320, 108);
      ctx.fillText('Web: www.apexroofingpro.com', -320, 141);
      ctx.fillStyle = '#64748b';
      ctx.fillText('410 Industrial Pkwy, Suite B', -320, 174);

      // Warm camera lighting gradient overlay
      const lightGrad = ctx.createLinearGradient(-370, -210, 370, 210);
      lightGrad.addColorStop(0, 'rgba(255, 248, 220, 0.08)');
      lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
      ctx.fillStyle = lightGrad;
      ctx.fillRect(-370, -210, 740, 420);

      ctx.restore();
      return c.toDataURL('image/jpeg', 0.92);
    },
  },
  {
    id: 'sample-bakery',
    label: 'Bella Vista Artisan Bakery (Counter Photo)',
    description: 'Boutique gold & espresso cafe card photographed on marble',
    suggestedPrompt:
      'Change owner name to Sofia Rossi, change title to Head Pastry Chef & Founder, update phone to (555) 402-9988, and add "Custom Wedding Cakes & Catering" as the tagline.',
    defaultCorners: [
      { x: 0.08, y: 0.11 },
      { x: 0.92, y: 0.14 },
      { x: 0.9, y: 0.89 },
      { x: 0.07, y: 0.86 },
    ],
    mockMetadata: {
      company: 'BELLA VISTA BAKERY',
      tagline: 'ARTISAN BREADS • ESPRESSO • PASTRIES',
      name: 'Elena Moretti',
      title: 'Owner & Master Baker',
      phone: '(555) 612-3344',
      email: 'hello@bellavistabakery.com',
      website: 'www.bellavistabakery.com',
      address: '88 Mulberry Street, Downtown',
      primaryColor: '#451a03',
      accentColor: '#d97706',
      bgColor: '#fffbeb',
    },
    generateDataUrl: () => {
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 560;
      const ctx = c.getContext('2d')!;

      // Marble surface background
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, 900, 560);

      ctx.save();
      ctx.translate(450, 280);
      ctx.rotate(0.025);
      ctx.shadowColor = 'rgba(15,23,42,0.35)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetX = -6;
      ctx.shadowOffsetY = 12;

      // Cream card base
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(-370, -210, 740, 420);
      ctx.shadowColor = 'transparent';

      // Ornate double border
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3;
      ctx.strokeRect(-346, -188, 692, 376);
      ctx.lineWidth = 1;
      ctx.strokeRect(-338, -180, 676, 360);

      // Center text
      ctx.textAlign = 'center';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 32px Playfair Display, Georgia, serif';
      ctx.fillText('BELLA VISTA BAKERY', 0, -105);

      ctx.fillStyle = '#b45309';
      ctx.font = '600 13px Montserrat, sans-serif';
      ctx.fillText('ARTISAN BREADS • ESPRESSO • PASTRIES', 0, -72);

      // Divider
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-110, -45);
      ctx.lineTo(110, -45);
      ctx.stroke();

      ctx.fillStyle = '#292524';
      ctx.font = 'bold 26px Playfair Display, Georgia, serif';
      ctx.fillText('Elena Moretti', 0, 5);
      ctx.fillStyle = '#78350f';
      ctx.font = 'italic 16px Georgia, serif';
      ctx.fillText('Owner & Master Baker', 0, 32);

      ctx.fillStyle = '#44403c';
      ctx.font = '500 15px Inter, sans-serif';
      ctx.fillText('(555) 612-3344  |  hello@bellavistabakery.com', 0, 95);
      ctx.fillText('88 Mulberry Street, Downtown  •  www.bellavistabakery.com', 0, 128);

      ctx.restore();
      return c.toDataURL('image/jpeg', 0.92);
    },
  },
  {
    id: 'sample-law',
    label: 'Sterling & Vance Law Group (Modern Dark Card)',
    description: 'Dark slate & gold executive business card',
    suggestedPrompt:
      'Switch to a clean white background with dark navy text, change attorney name to Victoria Sterling, Esq., title to Managing Partner, and phone to (555) 901-2200.',
    defaultCorners: [
      { x: 0.08, y: 0.12 },
      { x: 0.92, y: 0.12 },
      { x: 0.92, y: 0.88 },
      { x: 0.08, y: 0.88 },
    ],
    mockMetadata: {
      company: 'STERLING & VANCE LLP',
      tagline: 'ATTORNEYS AT LAW',
      name: 'Jonathan Vance, Esq.',
      title: 'Senior Litigation Partner',
      phone: '(555) 774-1900',
      email: 'jvance@sterlingvancelaw.com',
      website: 'www.sterlingvancelaw.com',
      address: '1200 Financial Plaza, 18th Floor',
      primaryColor: '#0f172a',
      accentColor: '#eab308',
      bgColor: '#0f172a',
    },
    generateDataUrl: () => {
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 560;
      const ctx = c.getContext('2d')!;

      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, 0, 900, 560);

      ctx.save();
      ctx.translate(450, 280);
      ctx.rotate(-0.015);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 10;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-370, -210, 740, 420);
      ctx.shadowColor = 'transparent';

      // Gold bar on right
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(340, -210, 30, 420);

      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 28px Cinzel, Georgia, serif';
      ctx.fillText('STERLING & VANCE LLP', -315, -125);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 13px Montserrat, sans-serif';
      ctx.fillText('ATTORNEYS AT LAW', -315, -95);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Inter, sans-serif';
      ctx.fillText('Jonathan Vance, Esq.', -315, -10);
      ctx.fillStyle = '#eab308';
      ctx.font = '500 16px Inter, sans-serif';
      ctx.fillText('Senior Litigation Partner', -315, 20);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '400 15px Inter, sans-serif';
      ctx.fillText('Direct: (555) 774-1900', -315, 85);
      ctx.fillText('jvance@sterlingvancelaw.com', -315, 115);
      ctx.fillText('1200 Financial Plaza, 18th Floor • www.sterlingvancelaw.com', -315, 145);

      ctx.restore();
      return c.toDataURL('image/jpeg', 0.92);
    },
  },
];
