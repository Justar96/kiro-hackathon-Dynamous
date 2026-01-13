# Implementation Plan: Debate Page Paper Polish

## Overview

This plan implements UI/UX polish for both the debate page and index page to achieve a refined paper/academic editorial aesthetic. Tasks focus on typography enhancement, visual dividers, section anchors, and color palette refinement. The implementation builds incrementally on the existing codebase.

## Tasks

- [x] 1. Tailwind configuration updates
  - [x] 1.1 Update color palette in tailwind.config.js
    - Refine page-bg to warmer off-white (#F9F9F6)
    - Add divider color (#E5E5E0)
    - Refine support color to muted teal (#2D8A6E)
    - Refine oppose color to muted coral (#C75B5B)
    - _Requirements: 8.1, 8.4, 8.5_
  - [x] 1.2 Add paper-polish utility classes
    - Add horizontal-rule utility class
    - Add small-caps text utility
    - Add monospace-label utility
    - _Requirements: 3.3, 4.1, 4.5_

- [x] 2. Create HorizontalDivider component
  - [x] 2.1 Implement HorizontalDivider base component
    - Create component with spacing variants (sm, md, lg)
    - Style as 1px line in divider color
    - Add optional decorative variant
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 2.2 Write property test for divider spacing consistency
    - **Property 1: Horizontal Divider Spacing Consistency**
    - **Validates: Requirements 3.4**

- [x] 3. Checkpoint - Ensure divider component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create SectionAnchorNav component
  - [x] 4.1 Implement SectionAnchorNav component
    - Create right-margin anchor navigation
    - Style with uppercase monospace text
    - Add em-dash prefix styling
    - Implement smooth scroll on click
    - Hide on mobile viewports (< 1024px)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 4.2 Implement active section tracking
    - Use IntersectionObserver for scroll-based highlighting
    - Apply active visual state to current section
    - _Requirements: 6.6_
  - [x] 4.3 Write property test for anchor click navigation
    - **Property 2: Section Anchor Click Navigation**
    - **Validates: Requirements 6.3**
  - [x] 4.4 Write property test for responsive visibility
    - **Property 3: Responsive Anchor Visibility**
    - **Validates: Requirements 6.5**
  - [x] 4.5 Write property test for active section indication
    - **Property 4: Active Section Indication**
    - **Validates: Requirements 6.6**

- [x] 5. Checkpoint - Ensure anchor nav tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Enhance DossierHeader component
  - [x] 6.1 Update DossierHeader typography
    - Increase resolution heading size (text-heading-1 → larger)
    - Enhance small-caps status label styling
    - Add subtle horizontal divider below header
    - _Requirements: 1.1, 4.1, 3.1_
  - [x] 6.2 Add metadata refinements
    - Style date display with refined typography
    - Add optional word count / reading time
    - Apply letter-spacing to metadata labels
    - _Requirements: 4.2, 4.4, 4.5_

- [x] 7. Enhance ArgumentBlock component
  - [x] 7.1 Refine ArgumentBlock styling
    - Reduce border prominence (lighter, thinner)
    - Update side label to small-caps styling
    - Improve paragraph typography
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 7.2 Refine author and impact styling
    - Style author attribution as refined byline
    - Make impact badge visually muted
    - _Requirements: 5.4, 5.5_

- [x] 8. Enhance RoundSection component
  - [x] 8.1 Update round header typography
    - Apply serif font to round titles
    - Add subtle divider below header
    - Style round number in refined format
    - _Requirements: 7.1, 7.3, 7.5_
  - [x] 8.2 Add round description and status
    - Include muted description text
    - Add subtle completion indicator
    - _Requirements: 7.2, 7.4_

- [x] 9. Enhance ActiveRoundView component
  - [x] 9.1 Update section header styling
    - Apply serif typography to round title
    - Refine description text styling
    - Add consistent spacing
    - _Requirements: 7.1, 7.2_
  - [x] 9.2 Update placeholder styling
    - Refine placeholder card styling
    - Match paper aesthetic
    - _Requirements: 5.1_

- [x] 10. Checkpoint - Ensure debate page components updated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update debate page layout
  - [x] 11.1 Integrate SectionAnchorNav into RightMarginRail
    - Add SectionAnchorNav above market data
    - Wire up section anchors for debate page
    - _Requirements: 6.1, 6.2_
  - [x] 11.2 Add horizontal dividers between sections
    - Add divider below DossierHeader
    - Add dividers between round sections
    - Add divider before comments section
    - _Requirements: 3.1, 3.2, 3.5_
  - [x] 11.3 Update spacing and layout
    - Ensure consistent vertical spacing (32-48px)
    - Verify content column max-width
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 12. Enhance index page header
  - [x] 12.1 Update index page header typography
    - Apply serif font to "Debate Index" heading
    - Refine subtitle styling
    - Add subtle horizontal divider below
    - _Requirements: 1.1, 3.1_
  - [x] 12.2 Refine header metadata
    - Style tagline with proper typography
    - Apply consistent spacing
    - _Requirements: 4.2, 2.2_

- [x] 13. Enhance index page cards
  - [x] 13.1 Update left rail card styling
    - Refine card headers with small-caps
    - Apply consistent border and shadow styling
    - Match paper aesthetic
    - _Requirements: 4.1, 5.1_
  - [x] 13.2 Update right rail card styling
    - Refine "Most Persuasive" card header
    - Refine "Platform Stats" card header
    - Apply consistent styling
    - _Requirements: 4.1, 5.1_

- [x] 14. Enhance DebateIndexList styling
  - [x] 14.1 Update debate row typography
    - Apply serif font to resolution titles
    - Refine status label styling
    - _Requirements: 1.1, 4.1_
  - [x] 14.2 Refine market indicator styling
    - Update support/oppose bar colors
    - Refine percentage label styling
    - _Requirements: 8.4, 8.5_

- [x] 15. Enhance ResolutionCard component
  - [x] 15.1 Update compact variant styling
    - Apply serif font to resolution title
    - Refine status label with small-caps
    - Update market bar colors
    - _Requirements: 1.1, 4.1, 8.4, 8.5_
  - [x] 15.2 Update full card variant styling
    - Apply serif font to resolution title
    - Refine status badge styling
    - Update color palette
    - _Requirements: 1.1, 4.1, 8.4, 8.5_

- [x] 16. Update global CSS utilities
  - [x] 16.1 Add paper-polish CSS classes
    - Add .paper-divider class
    - Add .small-caps class
    - Add .monospace-label class
    - _Requirements: 3.3, 4.1, 4.5_
  - [x] 16.2 Update base typography styles
    - Refine heading line-heights
    - Update body text line-height to 1.7
    - _Requirements: 1.3, 1.5_

- [x] 17. Checkpoint - Ensure all styling updates complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Final polish and consistency check
  - [x] 18.1 Verify color palette consistency
    - Check all support/oppose color usages
    - Verify background colors match spec
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 18.2 Verify typography consistency
    - Check all heading usages
    - Verify metadata label styling
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  - [x] 18.3 Verify spacing consistency
    - Check vertical spacing between sections
    - Verify horizontal padding
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 19. Final checkpoint - Full visual verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property-based tests are required for comprehensive validation
- All property tests use fast-check with minimum 100 iterations
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation

### Implementation Order Rationale
1. **Tailwind config first** - Foundation for all styling changes
2. **New components** - HorizontalDivider and SectionAnchorNav
3. **Debate page components** - Core page enhancements
4. **Debate page layout** - Integration and wiring
5. **Index page** - Apply same aesthetic to home page
6. **Global CSS** - Utility classes for consistency
7. **Final polish** - Consistency verification

### Files to Modify
- `packages/frontend/tailwind.config.js` - Color palette and utilities
- `packages/frontend/src/index.css` - Global CSS utilities
- `packages/frontend/src/components/debate/DossierHeader.tsx`
- `packages/frontend/src/components/debate/ArgumentBlock.tsx`
- `packages/frontend/src/components/debate/RoundSection.tsx`
- `packages/frontend/src/components/debate/ActiveRoundView.tsx`
- `packages/frontend/src/components/debate/ResolutionCard.tsx`
- `packages/frontend/src/components/layout/ThreeColumnLayout.tsx`
- `packages/frontend/src/routes/debates.$debateId.tsx`
- `packages/frontend/src/routes/index.tsx`

### New Files to Create
- `packages/frontend/src/components/ui/HorizontalDivider.tsx`
- `packages/frontend/src/components/layout/SectionAnchorNav.tsx`
- `packages/frontend/src/components/ui/HorizontalDivider.test.tsx` (optional)
- `packages/frontend/src/components/layout/SectionAnchorNav.test.tsx` (optional)
