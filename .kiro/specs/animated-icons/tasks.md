# Implementation Plan: Animated Icons System

## Overview

This plan implements a centralized icon system using heroicons-animated for UI icons and svgl for brand logos. Tasks are organized to build the foundation first, then progressively replace inline SVGs across the codebase.

## Tasks

- [x] 1. Set up icon system foundation
  - [x] 1.1 Install heroicons-animated dependencies
    - Run `pnpm dlx shadcn add @heroicons-animated/react` or install via npm
    - Add motion library if required by heroicons-animated
    - _Requirements: 1.3_

  - [x] 1.2 Create icon types and constants
    - Create `packages/frontend/src/components/icons/types.ts`
    - Define IconSize, AnimationTrigger, IconProps interfaces
    - Define SIZE_MAP constant mapping sizes to Tailwind classes
    - _Requirements: 1.2, 7.1_

  - [x] 1.3 Create useReducedMotion hook
    - Create `packages/frontend/src/components/icons/useReducedMotion.ts`
    - Implement media query listener for prefers-reduced-motion
    - _Requirements: 8.6_

  - [x] 1.4 Create createIcon factory function
    - Create `packages/frontend/src/components/icons/createIcon.tsx`
    - Implement wrapper that applies size, className, accessibility props
    - Integrate useReducedMotion for animation control
    - _Requirements: 1.4, 7.2, 7.3, 8.5, 10.1, 10.3_

  - [x] 1.5 Write property tests for icon wrapper
    - **Property 1: Consistent Icon API**
    - **Property 2: Size Variant Rendering**
    - **Property 3: ClassName Merging**
    - **Property 5: Animation Disable**
    - **Property 6: Decorative Accessibility**
    - **Property 7: Semantic Icon Role**
    - **Validates: Requirements 1.4, 7.1, 7.2, 8.5, 10.1, 10.3**

- [x] 2. Create icon exports and custom icons
  - [x] 2.1 Create main icon index file
    - Create `packages/frontend/src/components/icons/index.ts`
    - Re-export heroicons-animated icons with consistent naming
    - Export types, createIcon, useReducedMotion
    - _Requirements: 1.1, 1.5_

  - [x] 2.2 Create custom domain icons
    - Create `packages/frontend/src/components/icons/custom/DeltaIcon.tsx`
    - Create `packages/frontend/src/components/icons/custom/MindChangeIcon.tsx`
    - Create `packages/frontend/src/components/icons/custom/ImpactIcon.tsx`
    - Create `packages/frontend/src/components/icons/custom/VoteIcon.tsx`
    - Migrate existing inline SVGs from ResolutionCard.tsx
    - _Requirements: 1.5, 3.2_

- [x] 3. Implement brand logo component
  - [x] 3.1 Create BrandLogo component
    - Create `packages/frontend/src/components/icons/BrandLogo.tsx`
    - Implement svgl API fetching with caching
    - Support light/dark variants
    - Implement fallback rendering
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 3.2 Write property tests for BrandLogo
    - **Property 8: Logo Cache Consistency**
    - **Property 9: Fallback Rendering**
    - **Validates: Requirements 6.1, 6.4, 9.4**

- [x] 4. Checkpoint - Verify foundation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify icon imports work correctly
  - Test reduced motion behavior

- [x] 5. Replace icons in layout components
  - [x] 5.1 Update ThreeColumnLayout icons
    - Replace hamburger menu icon with MenuIcon
    - Replace close (X) icons with XIcon
    - Replace chart icon with ChartIcon
    - Replace chevron icons with ChevronUpIcon/ChevronDownIcon
    - Add animation triggers for menu open/close
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.2 Update IndexThreeColumnLayout icons
    - Replace menu icon with MenuIcon
    - Replace stats icon with ChartIcon
    - Replace close icons with XIcon
    - _Requirements: 2.4_

- [x] 6. Replace icons in debate components
  - [x] 6.1 Update RoundHistory icons
    - Replace ChevronDownIcon, ChevronUpIcon, CheckCircleIcon
    - Add animation on expand/collapse
    - Add mount animation for completed checkmarks
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 6.2 Update ResolutionCard icons
    - Replace MindChangeIcon, VoteIcon, ImpactIcon, DeltaIcon with custom icons
    - Remove inline icon function definitions
    - _Requirements: 3.2, 3.5_

  - [x] 6.3 Update ArgumentBlock icons
    - Replace checkmark icon in MindChangedButton
    - Replace lightbulb icon with LightBulbIcon
    - Add click animation for "This changed my mind"
    - _Requirements: 3.1, 3.5_

  - [x] 6.4 Update SteelmanGate icons
    - Replace status icons (pending, approved, rejected)
    - Replace lightbulb and shield icons
    - Add appropriate status animations
    - _Requirements: 3.5_

- [x] 7. Replace icons in common components
  - [x] 7.1 Update Toast component
    - Replace success checkmark with CheckIcon
    - Replace error X with XIcon
    - Add mount animation for toast icons
    - _Requirements: 4.1, 4.5_

  - [x] 7.2 Update ErrorMessage component
    - Replace ErrorIcon with WarningIcon or XCircleIcon
    - _Requirements: 4.5_

  - [x] 7.3 Update ErrorBoundary component
    - Replace warning icon with WarningIcon
    - Add subtle animation on error display
    - _Requirements: 4.4, 4.5_

  - [x] 7.4 Update ConnectionStatus component
    - Replace spinner with SpinnerIcon
    - Replace disconnected icon with appropriate status icon
    - Replace warning icon with WarningIcon
    - _Requirements: 4.2, 4.3, 4.5_

- [x] 8. Replace icons in auth components
  - [x] 8.1 Update ProfileDropdown icons
    - Replace chevron icon with ChevronDownIcon
    - Replace user icon with UserIcon
    - Replace chat icon with ChatIcon
    - Replace sign-out icon with SignOutIcon
    - Add rotation animation for dropdown chevron
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 8.2 Update AuthModal icons (if applicable)
    - Review and replace any inline SVG icons
    - _Requirements: 5.4_

- [x] 9. Replace icons in index/route components
  - [x] 9.1 Update index.tsx route icons
    - Replace plus icon with PlusIcon
    - Replace chart icon with ChartIcon
    - _Requirements: 2.4_

  - [x] 9.2 Update __root.tsx icons
    - Replace error warning icon with WarningIcon
    - _Requirements: 4.4_

- [x] 10. Checkpoint - Verify all replacements
  - Ensure all tests pass, ask the user if questions arise.
  - Verify no inline SVG icons remain (except custom domain icons)
  - Test animations work correctly
  - Verify accessibility with screen reader

- [x] 11. Final cleanup and documentation
  - [x] 11.1 Remove unused inline icon definitions
    - Clean up any remaining inline SVG function components
    - Ensure all icons import from components/icons
    - _Requirements: 1.1_

  - [x] 11.2 Update component index exports
    - Add icons to main components/index.ts if needed
    - _Requirements: 1.1_

- [ ] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify bundle size is acceptable
  - Confirm animations respect reduced-motion preference

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- heroicons-animated uses shadcn CLI pattern - icons are added individually
