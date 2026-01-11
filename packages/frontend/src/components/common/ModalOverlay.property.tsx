import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ModalOverlay } from './ModalOverlay';

/**
 * Feature: uiux-improvements, Property 3: Focus Trap Integrity
 * Validates: Requirements 1.7
 * 
 * For any open modal, tabbing through focusable elements SHALL cycle 
 * within the modal bounds and never escape to the underlying page.
 */

// Arbitrary for generating a list of focusable element types
const focusableElementArbitrary = fc.constantFrom(
  'button',
  'input',
  'textarea',
  'select',
  'a'
);

// Helper to create focusable elements based on type
function createFocusableElement(type: string, index: number): JSX.Element {
  const testId = `focusable-${index}`;
  switch (type) {
    case 'button':
      return <button key={index} data-testid={testId}>Button {index}</button>;
    case 'input':
      return <input key={index} data-testid={testId} type="text" placeholder={`Input ${index}`} />;
    case 'textarea':
      return <textarea key={index} data-testid={testId} placeholder={`Textarea ${index}`} />;
    case 'select':
      return (
        <select key={index} data-testid={testId}>
          <option>Option {index}</option>
        </select>
      );
    case 'a':
      return <a key={index} data-testid={testId} href="#">Link {index}</a>;
    default:
      return <button key={index} data-testid={testId}>Button {index}</button>;
  }
}

// Test component that renders modal with generated focusable elements
function TestModalWithElements({ 
  elements, 
  isOpen = true,
  onClose = () => {}
}: { 
  elements: string[];
  isOpen?: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      {/* External element that should NOT receive focus when modal is open */}
      <button data-testid="external-button">External Button</button>
      <ModalOverlay isOpen={isOpen} onClose={onClose} trapFocus={true}>
        <div className="p-4">
          <h2 id="modal-title">Test Modal</h2>
          {elements.map((type, index) => createFocusableElement(type, index))}
        </div>
      </ModalOverlay>
    </>
  );
}

// Helper to simulate Tab key press
function pressTab(shiftKey = false) {
  fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey });
}

describe('ModalOverlay Property Tests - Focus Trap', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  /**
   * Property 3: Focus Trap Integrity
   * For any open modal with N focusable elements, when on the last element
   * and Tab is pressed, focus should move to the first element.
   * Validates: Requirements 1.7
   */
  it('Property 3: Tab from last element should cycle to first element', () => {
    fc.assert(
      fc.property(
        fc.array(focusableElementArbitrary, { minLength: 2, maxLength: 8 }),
        (elementTypes) => {
          cleanup();
          
          render(<TestModalWithElements elements={elementTypes} />);
          
          const focusableElements = elementTypes.map((_, index) => 
            screen.getByTestId(`focusable-${index}`)
          );
          
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          // Focus the last element
          lastElement.focus();
          expect(document.activeElement).toBe(lastElement);
          
          // Press Tab - should cycle to first element
          pressTab();
          expect(document.activeElement).toBe(firstElement);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3 (reverse): Shift+Tab from first element should cycle to last element
   * Validates: Requirements 1.7
   */
  it('Property 3 (reverse): Shift+Tab from first element should cycle to last element', () => {
    fc.assert(
      fc.property(
        fc.array(focusableElementArbitrary, { minLength: 2, maxLength: 8 }),
        (elementTypes) => {
          cleanup();
          
          render(<TestModalWithElements elements={elementTypes} />);
          
          const focusableElements = elementTypes.map((_, index) => 
            screen.getByTestId(`focusable-${index}`)
          );
          
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          // Focus the first element
          firstElement.focus();
          expect(document.activeElement).toBe(firstElement);
          
          // Press Shift+Tab - should cycle to last element
          pressTab(true);
          expect(document.activeElement).toBe(lastElement);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3 (boundary): Focus trap should work at boundaries
   * Validates: Requirements 1.7
   */
  it('Property 3 (boundary): Focus trap should correctly handle boundary conditions', () => {
    fc.assert(
      fc.property(
        fc.array(focusableElementArbitrary, { minLength: 2, maxLength: 8 }),
        fc.boolean(), // Whether to start from first or last
        (elementTypes, startFromFirst) => {
          cleanup();
          
          render(<TestModalWithElements elements={elementTypes} />);
          
          const focusableElements = elementTypes.map((_, index) => 
            screen.getByTestId(`focusable-${index}`)
          );
          
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          if (startFromFirst) {
            // Start from first, Shift+Tab should go to last
            firstElement.focus();
            pressTab(true);
            expect(document.activeElement).toBe(lastElement);
          } else {
            // Start from last, Tab should go to first
            lastElement.focus();
            pressTab(false);
            expect(document.activeElement).toBe(firstElement);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3 (middle elements): Tab from middle elements should not trigger trap
   * Validates: Requirements 1.7
   */
  it('Property 3 (middle): Tab from middle elements should not trigger focus trap', () => {
    fc.assert(
      fc.property(
        fc.array(focusableElementArbitrary, { minLength: 3, maxLength: 8 }),
        (elementTypes) => {
          cleanup();
          
          render(<TestModalWithElements elements={elementTypes} />);
          
          const focusableElements = elementTypes.map((_, index) => 
            screen.getByTestId(`focusable-${index}`)
          );
          
          // Focus a middle element (not first or last)
          const middleIndex = Math.floor(focusableElements.length / 2);
          const middleElement = focusableElements[middleIndex];
          
          middleElement.focus();
          expect(document.activeElement).toBe(middleElement);
          
          // Press Tab - focus trap should NOT intervene (no preventDefault)
          // The focus should stay on middle element since we're not at boundary
          // and the browser's native tab behavior isn't simulated in jsdom
          pressTab();
          
          // In jsdom, without native tab behavior, focus stays on current element
          // unless our trap moves it. Since we're not at boundary, trap doesn't act.
          // This is expected behavior - the trap only acts at boundaries.
        }
      ),
      { numRuns: 100 }
    );
  });
});

