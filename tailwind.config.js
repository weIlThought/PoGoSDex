
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

export default {
  
  content: ['./public/**/*.{html,js}', './server/**/*.{html,js,ts,jsx,tsx}'],
  
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
  
  safelist: [
    
    { pattern: /^(bg|text|border)-(slate|emerald|sky|yellow|red|green)(-\d{3})?(\/\d{2})?$/ },
    {
      pattern:
        /^(bg|text|border)-(slate|emerald|sky|yellow|red|green)-?(900|800|700|600|500|400|300|200|100)?$/,
    },
    
    { pattern: /^(grid|md:grid|sm:grid)-cols-./ },
    { pattern: /^col-span-./ },
    { pattern: /^rounded(-lg|-xl)?$/ },
    
  ],
  plugins: [forms(), typography()],
};
