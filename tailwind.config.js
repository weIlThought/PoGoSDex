/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

export default {
  // Tailwind v4 is JIT-only and scans these paths for used classes.
  content: ['./public/**/*.{html,js}', './server/**/*.{js,ts,jsx,tsx}'],
  // Keep some theme extensions so existing layouts retain expected spacing and sizes.
  theme: {
    extend: {
      spacing: {
        72: '18rem',
        84: '21rem',
        96: '24rem',
      },
      borderRadius: {
        xl: '1rem',
      },
      boxShadow: {
        'xl-soft': '0 18px 40px rgba(8,16,32,0.36)',
      },
    },
  },
  // Safelist common and dynamic classes that are generated at runtime (JS) or built from data.
  safelist: [
    // slate/text/color patterns
    { pattern: /^(bg|text|border)-(slate|emerald|sky|yellow|red|green)(-\d{3})?(\/\d{2})?$/ },
    {
      pattern:
        /^(bg|text|border)-(slate|emerald|sky|yellow|red|green)-?(900|800|700|600|500|400|300|200|100)?$/,
    },
    // layout utilities
    { pattern: /^(grid|md:grid|sm:grid)-cols-./ },
    { pattern: /^col-span-./ },
    { pattern: /^rounded(-lg|-xl)?$/ },
    // project-specific helpers were used during migration; keep minimal dynamic patterns
  ],
  plugins: [forms(), typography()],
};
