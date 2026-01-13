# Requirements Document

## Introduction

This specification covers UI/UX polish for the debate page to better align with a paper/academic editorial aesthetic. The reference design features clean serif typography, generous whitespace, subtle horizontal dividers, monospace metadata, and an elegant minimal layout reminiscent of academic papers and editorial publications.

The existing debate page has foundational paper-clean styling but needs refinement to achieve the full editorial aesthetic: more prominent serif headings, better visual hierarchy through typography rather than boxes, subtle dividers, and right-margin navigation anchors.

## Glossary

- **Debate_Page**: The main view displaying a debate's resolution, rounds, arguments, and audience participation
- **Paper_Aesthetic**: A visual design style inspired by academic papers and editorial publications featuring serif typography, generous margins, and minimal decoration
- **Section_Anchor**: A right-margin navigation element that links to sections within the page
- **Horizontal_Rule**: A subtle divider line used to separate content sections
- **Metadata_Label**: Small-caps or monospace text displaying supplementary information like dates, word counts, or status
- **Serif_Heading**: A heading using serif typeface for editorial elegance
- **Content_Column**: The main reading area with constrained width for optimal line length

## Requirements

### Requirement 1: Typography Enhancement

**User Story:** As a reader, I want elegant serif typography for headings, so that the debate feels like reading an academic paper or editorial piece.

#### Acceptance Criteria

1. THE Debate_Page SHALL use serif font (Georgia or similar) for the resolution heading
2. THE Debate_Page SHALL use serif font for round section headings
3. WHEN displaying body text THEN THE System SHALL use a readable sans-serif font with 1.6-1.8 line height
4. THE Metadata_Label elements SHALL use small-caps or monospace styling with letter-spacing
5. THE System SHALL maintain a clear typographic hierarchy: resolution > round headings > argument text > metadata

### Requirement 2: Layout and Whitespace

**User Story:** As a reader, I want generous whitespace and proper margins, so that the content is easy to read and feels spacious.

#### Acceptance Criteria

1. THE Content_Column SHALL have a maximum width of 680-720px for optimal reading
2. THE Debate_Page SHALL have consistent vertical spacing between sections (32-48px)
3. WHEN displaying arguments THEN THE System SHALL use adequate paragraph spacing (24px between arguments)
4. THE System SHALL maintain consistent horizontal padding (24-32px on mobile, centered on desktop)
5. THE Debate_Page SHALL have a warm off-white background (#FAFAF8 or similar)

### Requirement 3: Visual Dividers

**User Story:** As a reader, I want subtle visual dividers between sections, so that I can easily distinguish different parts of the debate.

#### Acceptance Criteria

1. THE System SHALL display a subtle Horizontal_Rule below the resolution header
2. THE System SHALL display Horizontal_Rule dividers between round sections
3. THE Horizontal_Rule SHALL be a thin line (1px) in a muted color (#E5E5E0 or similar)
4. THE Horizontal_Rule SHALL have consistent margins above and below (24-32px)
5. WHERE a section contains no content THEN THE System SHALL still display the divider for visual consistency

### Requirement 4: Metadata Presentation

**User Story:** As a reader, I want metadata displayed in a refined academic style, so that supplementary information doesn't distract from the main content.

#### Acceptance Criteria

1. THE Status_Label (e.g., "Round 1", "Resolved") SHALL use uppercase small-caps styling
2. THE Date_Display SHALL use a refined format with proper typography
3. WHEN displaying author information THEN THE System SHALL show it in a muted, secondary style
4. THE Word_Count or reading time SHALL be displayed in monospace near the resolution (optional)
5. THE Metadata_Label elements SHALL use tracking/letter-spacing of 0.05-0.1em

### Requirement 5: Argument Block Refinement

**User Story:** As a reader, I want arguments displayed as essay paragraphs rather than cards, so that the reading experience feels more like an academic paper.

#### Acceptance Criteria

1. THE Argument_Block SHALL minimize visual chrome (reduce border prominence)
2. THE Side_Label (For/Against) SHALL use small-caps styling with subtle color accent
3. WHEN displaying argument content THEN THE System SHALL use proper paragraph typography with first-line indent or adequate spacing
4. THE Author_Attribution SHALL appear in a refined byline style below or above the argument
5. THE Impact_Badge SHALL be visually muted and positioned unobtrusively

### Requirement 6: Section Navigation Anchors

**User Story:** As a reader, I want right-margin navigation anchors, so that I can quickly jump to different sections of the debate.

#### Acceptance Criteria

1. THE Debate_Page SHALL display Section_Anchor links in the right margin on desktop viewports
2. THE Section_Anchor SHALL include: Resolution, Round 1, Round 2, Round 3, Comments
3. WHEN a user clicks a Section_Anchor THEN THE System SHALL smooth-scroll to that section
4. THE Section_Anchor text SHALL use uppercase monospace styling
5. WHEN viewport is mobile-sized THEN THE System SHALL hide the right-margin anchors
6. THE Active_Section SHALL be visually indicated in the anchor navigation

### Requirement 7: Round Section Headers

**User Story:** As a reader, I want round sections to have clear academic-style headers, so that I can easily identify each phase of the debate.

#### Acceptance Criteria

1. THE Round_Header SHALL display the round name in serif typography
2. THE Round_Header SHALL include a brief description in muted text below the title
3. THE Round_Header SHALL be separated from content by a subtle divider or spacing
4. WHEN a round is complete THEN THE System SHALL indicate completion status subtly
5. THE Round_Number SHALL be displayed in a refined style (e.g., "I", "II", "III" or "Round 1")

### Requirement 8: Color Palette Refinement

**User Story:** As a reader, I want a refined color palette, so that the page feels calm and academic rather than loud.

#### Acceptance Criteria

1. THE Background_Color SHALL be a warm off-white (#FAFAF8, #F9F9F6, or similar)
2. THE Primary_Text_Color SHALL be a soft black (#1A1A1A or #2D2D2D)
3. THE Secondary_Text_Color SHALL be a muted gray (#6B6B6B or similar)
4. THE Support_Color SHALL be a muted teal/green (#2D8A6E or similar)
5. THE Oppose_Color SHALL be a muted coral/red (#C75B5B or similar)
6. THE Accent_Color for links and interactive elements SHALL be a refined blue (#4A6FA5 or similar)

