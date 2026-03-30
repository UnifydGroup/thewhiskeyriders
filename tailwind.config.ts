import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: '#0D0D0D',
          'dark-grey': '#1A1A1A',
          brown: '#B5621E',
          tan: '#C9B98A',
          cream: '#F5F0E8',
        },
      },
      backgroundColor: {
        'brand-black': '#0D0D0D',
        'brand-grey': '#1A1A1A',
      },
      textColor: {
        'brand-cream': '#F5F0E8',
        'brand-tan': '#C9B98A',
        'brand-brown': '#B5621E',
      },
      borderColor: {
        'brand-brown': '#B5621E',
        'brand-tan': '#C9B98A',
      },
    },
  },
  plugins: [],
};
export default config;
