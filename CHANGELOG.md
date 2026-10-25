# Change Log — Geppy's Printshop

## [2026-10-25 08:59] — feat: update .env, geppystampwhite.png (+35 more)
- **`src/App.tsx`**: Fixed issue in src/App.tsx: "Can you make that icon larger" — I increased the size of the Geppy logo icon in the header by updating its Tailwind CSS classes from `w-6 h-6` to `w-8 h-8`. This makes the logo more prominent and easier to see in the application's top bar.
- **`src/App.tsx`**: Fixed issue in src/App.tsx: ""D:\Geppy_Apps\Geppy's Printshop\geppystampwhite.png" Ca..." — I have replaced the CSS-drawn staple icon in the top header with the official `geppystampwhite.png` logo. The image is now properly sized and styled to fit perfectly within the brand bar.
- **`src/index.css`**: Implemented "Add Spring Hover Animations" in src/index.css — I have added a global `.hover-lift` utility class to `src/index.css` using Tailwind's `@layer components`. This class provides a consistent hover effect that lifts elements slightly and adds a shadow with a smooth 200ms transition.
- **`src/App.tsx`**: Implemented "Add Glassmorphic Card Styling" in src/App.tsx — I have refactored the Gemini API Key modal in `src/App.tsx` to use a modern dark-mode glassmorphism theme. The modal now features a `backdrop-blur-md` effect, a semi-transparent `bg-slate-900/60` background, and updated text colors for bett

