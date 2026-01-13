# Design Document: Debate Page Paper Polish

## Overview

This design document details the UI/UX polish for the debate page to achieve a refined paper/academic editorial aesthetic. The goal is to enhance the existing components with more prominent serif typography, better visual hierarchy, subtle dividers, and right-margin section anchors—inspired by academic papers and editorial publications like the reference image.

The existing codebase already has a solid foundation with serif headings (`font-heading`), a paper-clean color palette, and a three-column layout. This polish focuses on refinement rather than restructuring.

## Architecture

The polish will be implemented through:

1. **Tailwind Config Updates** - Refine color palette and add new utility classes
2. **Component Style Updates** - Enhance existing components with paper-aesthetic styling
3. **New Component: SectionAnchorNav** - Right-margin navigation anchors (desktop only)
4. **CSS Utility Classes** - Add paper-specific utilities for dividers and typography

### Component Hierarchy

```
ThreeColumnLayout
├── LeftNavRail (existing - minor style updates)
├── CenterPaper
│   ├── DossierHeader (enhanced typography)
│   ├── HorizontalDivider (new)
│   ├── RoundSection (refined styling)
│   │   ├── RoundHeader (serif typography)
│   │   └── ArgumentBlock (essay-style refinement)
│   ├── OutcomeSection
│   └── SpectatorComments
└── RightMarginRail
    ├── SectionAnchorNav (new - desktop only)
    └── MarketData (existing)
```

## Components and Interfaces

### 1. HorizontalDivider Component

A subtle divider for separating content sections.

```typescript
interface HorizontalDividerProps {
  /** Spacing variant */
  spacing?: 'sm' | 'md' | 'lg';
  /** Optional decorative center element */
  decorative?: boolean;
}
```

**Styling:**
- 1px line in muted color (`#E5E5E0`)
- Consistent margins based on spacing variant
- Optional decorative short line (like in reference image)

### 2. SectionAnchorNav Component

Right-margin navigation anchors for desktop viewports.

```typescript
interface SectionAnchor {
  id: string;
  label: string;
}

interface SectionAnchorNavProps {
  anchors: SectionAnchor[];
  activeSection: string;
  onAnchorClick: (sectionId: string) => void;
}
```

**Styling:**
- Uppercase monospace text with letter-spacing
- Right-aligned with em-dash prefix (like "RESOLUTION —")
- Muted color, accent on active
- Hidden on mobile (< 1024px)

### 3. Enhanced DossierHeader

Updates to existing component for stronger paper aesthetic.

**Changes:**
- Larger serif heading (2.25rem instead of 2rem)
- More prominent small-caps status label
- Subtle horizontal divider below
- Optional word count / reading time metadata

### 4. Enhanced ArgumentBlock

Refinements for essay-style presentation.

**Changes:**
- Reduced border prominence (lighter, thinner)
- Small-caps side label with refined styling
- Better paragraph typography (first-line indent option)
- Muted author byline styling
- Visually quieter impact badge

### 5. Enhanced RoundSection Header

Academic-style round headers.

**Changes:**
- Serif typography for round titles
- Roman numeral option (I, II, III)
- Subtle divider below header
- Muted description text

## Data Models

No new data models required. This is purely a visual/styling enhancement.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Since this is a UI polish spec focused on visual styling, most requirements relate to visual presentation which are better tested as examples rather than properties. However, we can test some behavioral aspects as properties:

### Property 1: Horizontal Divider Spacing Consistency

*For any* HorizontalDivider component rendered with a spacing variant ('sm', 'md', 'lg'), the computed margin above and below SHALL match the specified spacing value for that variant.

**Validates: Requirements 3.4**

### Property 2: Section Anchor Click Navigation

*For any* section anchor in the SectionAnchorNav component, when clicked, the page SHALL initiate a scroll to the corresponding section element with that ID.

**Validates: Requirements 6.3**

### Property 3: Responsive Anchor Visibility

*For any* viewport width less than 1024px, the SectionAnchorNav component SHALL not be visible (display: none or visibility: hidden).

**Validates: Requirements 6.5**

### Property 4: Active Section Indication

*For any* scroll position where a section element is within the viewport's active zone, the corresponding anchor in SectionAnchorNav SHALL have the active visual state applied.

**Validates: Requirements 6.6**

## Error Handling

This is a visual polish spec with minimal error scenarios:

1. **Missing Section IDs**: If a section anchor references a non-existent ID, the click handler should gracefully do nothing (no scroll, no error)
2. **Font Loading Failure**: If serif fonts fail to load, the system should fall back to Georgia/system serif fonts (already configured in Tailwind)

## Testing Strategy

### Dual Testing Approach

This spec uses both unit tests and property-based tests:
- **Unit tests**: Verify specific examples, edge cases, and visual styling
- **Property tests**: Verify universal behaviors across all inputs

### Unit Tests

- HorizontalDivider renders with correct spacing classes for each variant
- SectionAnchorNav renders all expected anchors (Resolution, Rounds, Outcome, Comments)
- SectionAnchorNav applies active class to current section
- Enhanced typography classes are applied to headings
- Color palette values match specification

### Property-Based Tests

Using fast-check with minimum 100 iterations:

1. **Property 1: Horizontal Divider Spacing Consistency**
   - Generate random spacing variants
   - Verify computed margins match variant specification
   - **Validates: Requirements 3.4**

2. **Property 2: Section Anchor Click Navigation**
   - Generate random anchor selections
   - Verify scroll is initiated to correct element
   - **Validates: Requirements 6.3**

3. **Property 3: Responsive Anchor Visibility**
   - Generate random viewport widths
   - Verify visibility state matches breakpoint rules
   - **Validates: Requirements 6.5**

4. **Property 4: Active Section Indication**
   - Generate random scroll positions
   - Verify active state matches visible section
   - **Validates: Requirements 6.6**

### Visual Verification (Manual)

- Typography hierarchy is clear and consistent
- Color palette matches warm off-white specification
- Dividers are subtle but visible
- Responsive behavior works correctly on mobile/tablet/desktop

### Testing Framework

- Vitest for unit and property tests
- fast-check for property-based testing
- React Testing Library for component testing
- @testing-library/user-event for interaction testing

