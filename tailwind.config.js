/** @type {import('tailwindcss').Config} */
export const darkMode = "class";
export const content = [
  "./public/**/*.{html,js}",
  "./public/**/**/*.{html,js}",
  "./server/**/*.{js}",
  "./data/**/*.{json}"
];
export const theme = {
  extend: {
    // Optional: Ergänzungen (Farben, Abstände) können hier hinzugefügt werden.
  },
};
export const plugins = [];

