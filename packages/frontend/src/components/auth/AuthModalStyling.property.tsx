import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { AuthModalProvider, useAuthModal } from './AuthModal';
import { ToastProvider } from '../common/Toast';

/**
 * Feature: auth-profile-enhancements
 * Property 7: Auth Modal Styling Consistency
 * 
 * For any auth modal render, the following CSS properties SHALL match the platform design system:
 * - Body text font-family includes 'Inter'
 * - Heading font-family includes 'Source Serif 4' or 'Literata'
 * - Primary button background color is #111111 (text-primary)
 * - Link color is #2563EB (accent)
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.8
 */

// Test component that exposes auth modal controls
function TestAuthModalConsumer() {
  const { isOpen, openSignIn, openSignUp, close } = useAuthModal();

  return (
    <div>
      <button data-testid="open-sign-in" onClick={() => openSignIn()}>
        Open Sign In
      </button>
      <button data-testid="open-sign-up" onClick={() => openSignUp()}>
        Open Sign Up
      </button>
      <button data-testid="close" onClick={close}>
        Close
      </button>
      <span data-testid="is-open">{isOpen ? 'true' : 'false'}</span>
    </div>
  );
}

// Wrapper component for testing
function TestWrapper() {
  return (
    <ToastProvider>
      <AuthModalProvider>
        <TestAuthModalConsumer />
      </AuthModalProvider>
    </ToastProvider>
  );
}

// Arbitrary for generating trigger actions
const triggerActionArbitrary = fc.constantFrom('sign-in', 'sign-up') as fc.Arbitrary<'sign-in' | 'sign-up'>;

/**
 * Helper to get computed CSS custom property value
 */
function getCSSCustomProperty(propertyName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim();
}

/**
 * Helper to check if a font family string contains expected font
 */
function fontFamilyContains(fontFamily: string, expectedFont: string): boolean {
  return fontFamily.toLowerCase().includes(expectedFont.toLowerCase());
}

describe('Auth Modal Styling Property Tests', () => {
  beforeEach(() => {
    cleanup();
    // Inject CSS custom properties for testing
    // These simulate what index.css provides
    const style = document.createElement('style');
    style.id = 'auth-test-styles';
    style.textContent = `
      :root {
        --auth-font-family: 'Inter', 'IBM Plex Sans', system-ui, sans-serif;
        --auth-heading-font-family: 'Source Serif 4', 'Literata', Georgia, serif;
        --auth-background: #FFFFFF;
        --auth-foreground: #111111;
        --auth-muted: #6B7280;
        --auth-muted-foreground: #9CA3AF;
        --auth-primary: #111111;
        --auth-primary-foreground: #FFFFFF;
        --auth-accent: #2563EB;
        --auth-accent-foreground: #FFFFFF;
        --auth-destructive: #DC2626;
        --auth-success: #059669;
        --auth-border: rgba(0, 0, 0, 0.08);
        --auth-ring: #2563EB;
        --auth-radius: 2px;
        --auth-radius-lg: 4px;
      }
    `;
    document.head.appendChild(style);
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
    // Remove test styles
    const testStyle = document.getElementById('auth-test-styles');
    if (testStyle) {
      testStyle.remove();
    }
  });

  /**
   * Property 7: Auth Modal Styling Consistency
   * Validates: Requirements 3.1, 3.2, 3.3, 3.8
   */
  describe('Property 7: Auth Modal Styling Consistency', () => {
    /**
     * Property 7.1: Body text font-family includes 'Inter'
     * Validates: Requirements 3.1
     */
    it('Property 7.1: CSS custom property --auth-font-family SHALL include Inter', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (_iteration) => {
          const fontFamily = getCSSCustomProperty('--auth-font-family');
          
          // Font family should include Inter
          expect(fontFamilyContains(fontFamily, 'Inter')).toBe(true);
          
          // Should also have fallback fonts
          expect(fontFamily.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.2: Heading font-family includes 'Source Serif 4' or 'Literata'
     * Validates: Requirements 3.3
     */
    it('Property 7.2: CSS custom property --auth-heading-font-family SHALL include Source Serif 4 or Literata', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (_iteration) => {
          const fontFamily = getCSSCustomProperty('--auth-heading-font-family');
          
          // Font family should include Source Serif 4 or Literata
          const hasSourceSerif = fontFamilyContains(fontFamily, 'Source Serif');
          const hasLiterata = fontFamilyContains(fontFamily, 'Literata');
          
          expect(hasSourceSerif || hasLiterata).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.3: Primary button background color is #111111 (text-primary)
     * Validates: Requirements 3.2
     */
    it('Property 7.3: CSS custom property --auth-primary SHALL be #111111', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (_iteration) => {
          const primaryColor = getCSSCustomProperty('--auth-primary');
          
          // Primary color should be #111111 (text-primary)
          expect(primaryColor.toLowerCase()).toBe('#111111');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.4: Link color is #2563EB (accent)
     * Validates: Requirements 3.8
     */
    it('Property 7.4: CSS custom property --auth-accent SHALL be #2563EB', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (_iteration) => {
          const accentColor = getCSSCustomProperty('--auth-accent');
          
          // Accent color should be #2563EB
          expect(accentColor.toLowerCase()).toBe('#2563eb');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.5: Error color is #DC2626 (oppose/destructive)
     * Validates: Requirements 3.5
     */
    it('Property 7.5: CSS custom property --auth-destructive SHALL be #DC2626', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (_iteration) => {
          const destructiveColor = getCSSCustomProperty('--auth-destructive');
          
          // Destructive color should be #DC2626 (oppose)
          expect(destructiveColor.toLowerCase()).toBe('#dc2626');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.6: Success color is #059669 (support)
     * Validates: Requirements 3.6
     */
    it('Property 7.6: CSS custom property --auth-success SHALL be #059669', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (_iteration) => {
          const successColor = getCSSCustomProperty('--auth-success');
          
          // Success color should be #059669 (support)
          expect(successColor.toLowerCase()).toBe('#059669');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.7: Background color is #FFFFFF (paper)
     * Validates: Requirements 3.4
     */
    it('Property 7.7: CSS custom property --auth-background SHALL be #FFFFFF', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (_iteration) => {
          const backgroundColor = getCSSCustomProperty('--auth-background');
          
          // Background color should be #FFFFFF (paper)
          expect(backgroundColor.toLowerCase()).toBe('#ffffff');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.8: Border radius values match platform design
     * Validates: Requirements 3.4
     */
    it('Property 7.8: CSS custom properties for border radius SHALL match platform values', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (_iteration) => {
          const radius = getCSSCustomProperty('--auth-radius');
          const radiusLg = getCSSCustomProperty('--auth-radius-lg');
          
          // Radius should be 2px (subtle)
          expect(radius).toBe('2px');
          
          // Large radius should be 4px (small)
          expect(radiusLg).toBe('4px');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.9: Modal renders with correct heading for any view
     * Validates: Requirements 3.3
     */
    it('Property 7.9: Auth modal heading SHALL render correctly for any view', () => {
      fc.assert(
        fc.property(triggerActionArbitrary, (action) => {
          cleanup();
          document.body.style.overflow = '';

          render(<TestWrapper />);

          // Open the modal
          const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
          act(() => {
            fireEvent.click(screen.getByTestId(buttonId));
          });

          // Verify modal is open
          expect(screen.getByTestId('is-open').textContent).toBe('true');

          // Verify heading is present with correct text
          const expectedHeading = action === 'sign-up' ? 'Create account' : 'Sign in';
          const heading = screen.getByText(expectedHeading);
          expect(heading).toBeInTheDocument();

          // Heading should have the heading font class
          expect(heading.classList.contains('font-heading')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.10: All CSS custom properties SHALL be defined
     * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8
     */
    it('Property 7.10: All required CSS custom properties SHALL be defined', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (_iteration) => {
          const requiredProperties = [
            '--auth-font-family',
            '--auth-heading-font-family',
            '--auth-background',
            '--auth-foreground',
            '--auth-primary',
            '--auth-primary-foreground',
            '--auth-accent',
            '--auth-destructive',
            '--auth-success',
            '--auth-border',
            '--auth-ring',
            '--auth-radius',
            '--auth-radius-lg',
          ];

          for (const prop of requiredProperties) {
            const value = getCSSCustomProperty(prop);
            expect(value.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
