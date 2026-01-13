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
        'page-bg': '#F9F9F6',
        'paper': '#FFFFFF',
        'paper-shadow': 'rgba(0,0,0,0.04)',
        
        // Divider
        'divider': '#E5E5E0',
        
        // Text hierarchy
        'text-primary': '#1A1A1A',
        'text-secondary': '#6B6B6B',
        'text-tertiary': '#9CA3AF',
        
        // Accent - refined paper blue
        'accent': '#4A6FA5',
        'accent-hover': '#3D5D8A',
        
        // Semantic - muted tones for paper aesthetic
        'support': '#2D8A6E',
        'oppose': '#C75B5B',
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
        // Headings - Serif (refined line-heights for paper aesthetic)
        // Requirements: 1.3, 1.5 - Clear typographic hierarchy
        'heading-1': ['2rem', { lineHeight: '1.25', fontWeight: '600' }],
        'heading-2': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-3': ['1.25rem', { lineHeight: '1.35', fontWeight: '500' }],
        // Body - Sans-serif (line-height 1.7 for optimal readability)
        // Requirements: 1.3 - Body text line-height 1.6-1.8
        'body-large': ['1.125rem', { lineHeight: '1.7' }],
        'body': ['1rem', { lineHeight: '1.7' }],
        'body-small': ['0.875rem', { lineHeight: '1.6' }],
        // UI elements
        'label': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.05em' }],
        'caption': ['0.75rem', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        // Horizontal rule utility for paper dividers
        '.horizontal-rule': {
          'height': '1px',
          'background-color': '#E5E5E0',
          'border': 'none',
          'width': '100%',
        },
        // Small-caps utility for metadata labels
        '.small-caps': {
          'font-variant': 'small-caps',
          'text-transform': 'lowercase',
          'letter-spacing': '0.05em',
        },
        // Monospace label utility for metadata
        '.monospace-label': {
          'font-family': 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          'font-size': '0.75rem',
          'letter-spacing': '0.05em',
          'text-transform': 'uppercase',
        },
      })
    }
  ],
}
