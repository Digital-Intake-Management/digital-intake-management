/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // CareLink brand colors from the prototype
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          500: '#3b4fe4',   // main blue from prototype
          600: '#2d3fd4',
          700: '#1e2fb0',
          DEFAULT: '#3b4fe4',
        },
        accent: {
          red: '#e63946',   // CareLink logo red
          teal: '#06d6a0',  // completed state green
        },
        surface: {
          DEFAULT: '#f0f2fa', // page background from prototype
          card: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 2px 16px 0 rgba(59, 79, 228, 0.08)',
        'card-lg': '0 8px 32px 0 rgba(59, 79, 228, 0.12)',
      },
    },
  },
  plugins: [],
};
