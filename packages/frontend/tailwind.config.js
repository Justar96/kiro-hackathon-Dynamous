/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background layers
        'page-bg': '#F7F6F2',
        'paper': '#FFFFFF',
        'paper-shadow': 'rgba(0,0,0,0.04)',
        
        // Text hierarchy
        'text-primary': '#111111',
        'text-secondary': '#6B7280',
        'text-tertiary': '#9CA3AF',
        
        // Accent
        'accent': '#2563EB',
        'accent-hover': '#1D4ED8',
        
        // Semantic
        'support': '#059669',
        'oppose': '#DC2626',
      },
      fontFamily: {
        'heading': ['"Source Serif 4"', 'Literata', 'Georgia', 'serif'],
        'body': ['Inter', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'paper-max': '720px',
        'paper-padding': '48px',
        'rail-width': '240px',
        'margin-width': '200px',
      },
      maxWidth: {
        'paper': '720px',
      },
      width: {
        'rail': '240px',
        'margin': '200px',
      },
      borderRadius: {
        'subtle': '2px',
        'small': '4px',
      },
      borderColor: {
        'hairline': 'rgba(0,0,0,0.08)',
      },
      boxShadow: {
        'paper': '0 1px 3px rgba(0,0,0,0.04)',
        'elevated': '0 4px 12px rgba(0,0,0,0.08)',
        'modal': '0 8px 24px rgba(0,0,0,0.12)',
        'toast': '0 4px 12px rgba(0,0,0,0.1)',
      },
      zIndex: {
        'dropdown': '100',
        'sticky': '200',
        'overlay': '300',
        'modal': '400',
        'toast': '600',
      },
      fontSize: {
        // Headings - Serif
        'heading-1': ['2rem', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-2': ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }],
        'heading-3': ['1.25rem', { lineHeight: '1.4', fontWeight: '500' }],
        // Body - Sans-serif
        'body-large': ['1.125rem', { lineHeight: '1.7' }],
        'body': ['1rem', { lineHeight: '1.6' }],
        'body-small': ['0.875rem', { lineHeight: '1.5' }],
        // UI elements
        'label': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.05em' }],
        'caption': ['0.75rem', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [],
}
