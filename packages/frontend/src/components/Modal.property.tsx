import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { Modal } from './Modal';

/**
 * Feature: uiux-improvements, Property 24: Responsive Modal Rendering
 * Validates: Requirements 8.1, 8.2
 * 
 * For any modal:
 * - On viewports < 640px, it SHALL render as a bottom sheet
 * - On viewports ≥ 640px, it SHALL render as a centered overlay
 */

// Mobile breakpoint constant
const MOBILE_BREAKPOINT = 640;

// Arbitrary for generating viewport widths
const mobileWidthArbitrary = fc.integer({ min: 320, max: MOBILE_BREAKPOINT - 1 });
const desktopWidthArbitrary = fc.integer({ min: MOBILE_BREAKPOINT, max: 2560 });

// Helper to mock window.innerWidth
function mockViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  // Trigger resize event to update the hook
  window.dispatchEvent(new Event('resize'));
}

// Test component
function TestModal({ isOpen = true }: { isOpen?: boolean }) {
  return (
    <Modal isOpen={isOpen} onClose={() => {}}>
      <div data-testid="modal-content">Modal Content</div>
    </Modal>
  );
}

describe('Modal Property Tests - Responsive Rendering', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
    // Restore original innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  /**
   * Property 24: Responsive Modal Rendering - Mobile
   * On viewports < 640px, modal SHALL render as a bottom sheet
   * Validates: Requirements 8.1
   */
  it('Property 24 (mobile): Modal should render as bottom sheet on mobile viewports', () => {
    fc.assert(
      fc.property(mobileWidthArbitrary, (width) => {
        cleanup();
        
        // Set viewport width before rendering
        mockViewportWidth(width);
        
        render(<TestModal />);
        
        // Bottom sheet has specific characteristics:
        // - It's positioned at the bottom (has 'bottom-0' class)
        // - It has rounded top corners (has 'rounded-t-xl' class)
        // - It slides in from bottom
        const dialog = screen.getByRole('dialog');
        
        // Check for bottom sheet specific classes
        expect(dialog.className).toContain('bottom-0');
        expect(dialog.className).toContain('rounded-t-xl');
        
        // Content should be rendered
        expect(screen.getByTestId('modal-content')).toBeInTheDocument();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24: Responsive Modal Rendering - Desktop
   * On viewports ≥ 640px, modal SHALL render as a centered overlay
   * Validates: Requirements 8.2
   */
  it('Property 24 (desktop): Modal should render as centered overlay on desktop viewports', () => {
    fc.assert(
      fc.property(desktopWidthArbitrary, (width) => {
        cleanup();
        
        // Set viewport width before rendering
        mockViewportWidth(width);
        
        render(<TestModal />);
        
        // Centered overlay has specific characteristics:
        // - It's centered (parent has 'items-center justify-center')
        // - It has rounded corners (has 'rounded-small' class)
        // - It has max-width constraints
        const dialog = screen.getByRole('dialog');
        
        // Check for modal overlay specific classes
        expect(dialog.className).toContain('rounded-small');
        expect(dialog.className).toMatch(/max-w-(sm|md|lg)/);
        
        // Should NOT have bottom sheet classes
        expect(dialog.className).not.toContain('bottom-0');
        expect(dialog.className).not.toContain('rounded-t-xl');
        
        // Content should be rendered
        expect(screen.getByTestId('modal-content')).toBeInTheDocument();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24 (boundary): Modal should switch at exactly 640px
   * Validates: Requirements 8.1, 8.2
   */
  it('Property 24 (boundary): Modal should switch rendering at exactly 640px boundary', () => {
    // Test at 639px (mobile)
    cleanup();
    mockViewportWidth(639);
    render(<TestModal />);
    
    let dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('bottom-0'); // Bottom sheet
    
    // Test at 640px (desktop)
    cleanup();
    mockViewportWidth(640);
    render(<TestModal />);
    
    dialog = screen.getByRole('dialog');
    expect(dialog.className).not.toContain('bottom-0'); // Modal overlay
    expect(dialog.className).toMatch(/max-w-(sm|md|lg)/);
  });

  /**
   * Property 24 (content preservation): Content should be preserved across viewport sizes
   * Validates: Requirements 8.1, 8.2
   */
  it('Property 24 (content): Modal content should be preserved regardless of viewport size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 2560 }),
        (width) => {
          cleanup();
          mockViewportWidth(width);
          
          render(<TestModal />);
          
          // Content should always be present
          const content = screen.getByTestId('modal-content');
          expect(content).toBeInTheDocument();
          expect(content.textContent).toBe('Modal Content');
        }
      ),
      { numRuns: 100 }
    );
  });
});
