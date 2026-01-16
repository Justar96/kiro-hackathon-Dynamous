/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme - paper dossier tones
        'page-bg': '#0D0D0F',
        'paper': '#161619',
        'paper-aged': '#1C1C20',
        'paper-shadow': 'rgba(0,0,0,0.4)',
        
        // Divider - muted
        'divider': '#2A2A2E',
        
        // Text hierarchy
        'text-primary': '#E8E8EC',
        'text-secondary': '#9A9AA0',
        'text-tertiary': '#5C5C64',
        
        // Accent - blue
        'accent': '#5B8DEF',
        'accent-hover': '#4A7DE0',
        
        // Semantic
        'support': '#4ADE80',
        'oppose': '#F87171',
        
        // Extras
        'stamp-red': '#DC2626',
        'folder-tab': '#2A2A2E',
        'ink-faded': '#6B6B74',
      },
      fontFamily: {
        'heading': ['"Source Serif 4"', 'Literata', 'Georgia', 'serif'],
        'body': ['Inter', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        'mono': ['"Courier Prime"', '"Courier New"', 'Courier', 'monospace'],
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E\")",
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
        'paper': '0 1px 4px rgba(0,0,0,0.3)',
        'elevated': '0 4px 12px rgba(0,0,0,0.4)',
        'modal': '0 8px 24px rgba(0,0,0,0.5)',
        'toast': '0 4px 12px rgba(0,0,0,0.4)',
        'inset-worn': 'inset 0 0 20px rgba(0,0,0,0.2)',
      },
      zIndex: {
        'dropdown': '100',
        'sticky': '200',
        'overlay': '300',
        'modal': '400',
        'toast': '600',
      },
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-out',
        'fadeInUp': 'fadeInUp 0.3s ease-out',
        'scaleIn': 'scaleIn 0.2s ease-out',
        'check': 'check 0.3s ease-out',
        'lock': 'lock 0.2s ease-out',
        'delta': 'delta 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        check: {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        lock: {
          '0%': { backgroundColor: 'rgba(45, 138, 110, 0.1)' },
          '100%': { backgroundColor: 'transparent' },
        },
        delta: {
          '0%': { opacity: '0', transform: 'translateX(-4px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
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
    function({ addUtilities, addComponents }) {
      addUtilities({
        // Horizontal rule utility for paper dividers
        '.horizontal-rule': {
          'height': '1px',
          'background-color': '#2A2A2E',
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
          'font-family': '"Courier Prime", "Courier New", Courier, monospace',
          'font-size': '0.75rem',
          'letter-spacing': '0.05em',
          'text-transform': 'uppercase',
        },
        // Typewriter text
        '.typewriter': {
          'font-family': '"Courier Prime", "Courier New", Courier, monospace',
        },
      })
      addComponents({
        // Dossier card - dark theme
        '.dossier-card': {
          'background-color': '#161619',
          'border': '1px solid #2A2A2E',
          'box-shadow': '0 1px 4px rgba(0,0,0,0.3)',
          'position': 'relative',
        },
        // Folder tab
        '.folder-tab': {
          'background-color': '#2A2A2E',
          'color': '#E8E8EC',
          'font-family': '"Courier Prime", "Courier New", Courier, monospace',
          'font-size': '0.6875rem',
          'letter-spacing': '0.1em',
          'text-transform': 'uppercase',
          'padding': '0.25rem 0.75rem',
          'position': 'absolute',
          'top': '-1px',
          'left': '1rem',
          'border-radius': '0 0 4px 4px',
        },
        // Stamp style
        '.stamp': {
          'font-family': '"Courier Prime", "Courier New", Courier, monospace',
          'font-weight': '700',
          'text-transform': 'uppercase',
          'letter-spacing': '0.15em',
          'color': '#DC2626',
          'border': '3px solid #DC2626',
          'padding': '0.25rem 0.5rem',
          'transform': 'rotate(-5deg)',
          'opacity': '0.85',
        },
        // Worn edge effect
        '.worn-edge': {
          'position': 'relative',
          '&::before': {
            'content': '""',
            'position': 'absolute',
            'inset': '0',
            'border': '1px solid rgba(255,255,255,0.05)',
            'pointer-events': 'none',
            'box-shadow': 'inset 0 0 30px rgba(0,0,0,0.3)',
          },
        },
        // Redacted text
        '.redacted': {
          'background-color': '#E8E8EC',
          'color': 'transparent',
          'user-select': 'none',
        },
      })
    }
  ],
}
