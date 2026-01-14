# Requirements Document

## Introduction

This feature replaces the current inline SVG icons throughout the debate platform with a centralized icon system using heroicons-animated for UI icons with smooth animations, and svgl for brand/logo SVGs. The goal is to improve visual polish, reduce code duplication, and provide delightful micro-interactions through animated icons.

## Glossary

- **Icon_System**: The centralized module that exports all icon components used throughout the application
- **Animated_Icon**: An SVG icon component from heroicons-animated that supports CSS/Motion-based animations on state changes
- **Brand_Logo**: An SVG logo from svgl representing external services, technologies, or the platform brand
- **Icon_Wrapper**: A React component that wraps icon libraries to provide consistent sizing, styling, and animation props
- **Trigger_Animation**: An animation that plays when a specific user interaction or state change occurs (hover, click, success, error)

## Requirements

### Requirement 1: Icon Library Integration

**User Story:** As a developer, I want to use a centralized icon library, so that I can easily add and maintain icons across the application without duplicating SVG code.

#### Acceptance Criteria

1. THE Icon_System SHALL export all UI icons from a single entry point (`components/icons/index.ts`)
2. WHEN importing an icon, THE Icon_System SHALL provide TypeScript types for all icon props including className, size, and animation triggers
3. THE Icon_System SHALL integrate heroicons-animated via shadcn CLI for animated UI icons
4. THE Icon_System SHALL provide a consistent API for both animated and static icons
5. WHEN an icon is not available in heroicons-animated, THE Icon_System SHALL fall back to standard heroicons or custom SVG components

### Requirement 2: Icon Replacement - Navigation and Layout

**User Story:** As a user, I want to see polished animated icons in navigation elements, so that the interface feels more responsive and modern.

#### Acceptance Criteria

1. WHEN the hamburger menu icon is clicked, THE Icon_System SHALL animate the icon from menu to close (X) state
2. WHEN the chevron icon indicates expandable content, THE Icon_System SHALL animate rotation on expand/collapse
3. WHEN the close (X) icon is hovered, THE Icon_System SHALL provide subtle scale or opacity feedback
4. THE Icon_System SHALL replace all inline SVG navigation icons in ThreeColumnLayout and IndexThreeColumnLayout components

### Requirement 3: Icon Replacement - Debate Components

**User Story:** As a user, I want to see meaningful icon animations in debate interactions, so that I receive visual feedback for my actions.

#### Acceptance Criteria

1. WHEN a user clicks "This changed my mind", THE Icon_System SHALL animate the lightbulb icon with a glow or pulse effect
2. WHEN displaying impact scores, THE Icon_System SHALL use consistent delta/change icons
3. WHEN showing completed rounds, THE Icon_System SHALL animate the checkmark icon on initial render
4. WHEN expanding/collapsing round history, THE Icon_System SHALL animate chevron icons smoothly
5. THE Icon_System SHALL replace all inline SVG icons in ArgumentBlock, ResolutionCard, RoundHistory, and SteelmanGate components

### Requirement 4: Icon Replacement - Feedback and Status

**User Story:** As a user, I want to see animated status icons, so that I can quickly understand the current state of operations.

#### Acceptance Criteria

1. WHEN a toast notification appears, THE Icon_System SHALL animate the success (checkmark) or error (X) icon
2. WHEN displaying loading states, THE Icon_System SHALL use animated spinner icons
3. WHEN showing connection status, THE Icon_System SHALL animate status indicator icons appropriately
4. WHEN an error boundary catches an error, THE Icon_System SHALL display an animated warning icon
5. THE Icon_System SHALL replace all inline SVG icons in Toast, ErrorMessage, ErrorBoundary, and ConnectionStatus components

### Requirement 5: Icon Replacement - Authentication

**User Story:** As a user, I want to see polished icons in authentication flows, so that the sign-in experience feels professional.

#### Acceptance Criteria

1. WHEN the profile dropdown opens, THE Icon_System SHALL animate the chevron rotation
2. WHEN displaying user profile menu items, THE Icon_System SHALL use consistent navigation icons
3. WHEN the sign-out action is triggered, THE Icon_System SHALL provide visual feedback via icon animation
4. THE Icon_System SHALL replace all inline SVG icons in ProfileDropdown and AuthModal components

### Requirement 6: Brand Logo Integration

**User Story:** As a developer, I want to use high-quality brand logos from svgl, so that external service logos are consistent and properly licensed.

#### Acceptance Criteria

1. THE Icon_System SHALL provide a mechanism to fetch and cache SVG logos from svgl API
2. WHEN displaying technology or service logos, THE Icon_System SHALL use svgl logos where available
3. THE Icon_System SHALL support both light and dark variants of brand logos where available
4. IF a brand logo is not available in svgl, THEN THE Icon_System SHALL gracefully fall back to a placeholder or text

### Requirement 7: Icon Sizing and Styling

**User Story:** As a developer, I want consistent icon sizing across the application, so that the visual hierarchy is maintained.

#### Acceptance Criteria

1. THE Icon_System SHALL support predefined size variants: xs (12px), sm (16px), md (20px), lg (24px), xl (32px)
2. WHEN a custom className is provided, THE Icon_System SHALL merge it with default styles
3. THE Icon_System SHALL inherit text color from parent by default (currentColor)
4. THE Icon_System SHALL support stroke-width customization for outline icons
5. WHEN used in buttons with minimum touch targets (44px), THE Icon_System SHALL not affect the touch target size

### Requirement 8: Animation Configuration

**User Story:** As a developer, I want to control icon animations, so that I can trigger them based on user interactions or state changes.

#### Acceptance Criteria

1. THE Icon_System SHALL support animation triggers: 'hover', 'click', 'mount', 'state-change'
2. WHEN animation is set to 'hover', THE Icon_System SHALL play animation on mouse enter
3. WHEN animation is set to 'click', THE Icon_System SHALL play animation on click event
4. WHEN animation is set to 'mount', THE Icon_System SHALL play animation once on component mount
5. THE Icon_System SHALL support disabling animations via a prop for reduced-motion preferences
6. WHEN the user has prefers-reduced-motion enabled, THE Icon_System SHALL disable or reduce animations automatically

### Requirement 9: Performance and Bundle Size

**User Story:** As a developer, I want icons to be tree-shakeable, so that only used icons are included in the bundle.

#### Acceptance Criteria

1. THE Icon_System SHALL support tree-shaking so unused icons are not bundled
2. WHEN importing icons, THE Icon_System SHALL support named imports for individual icons
3. THE Icon_System SHALL lazy-load brand logos from svgl to avoid blocking initial render
4. IF an icon fails to load, THEN THE Icon_System SHALL render a fallback without breaking the UI

### Requirement 10: Accessibility

**User Story:** As a user with assistive technology, I want icons to be properly labeled, so that I can understand their meaning.

#### Acceptance Criteria

1. WHEN an icon is decorative, THE Icon_System SHALL set aria-hidden="true"
2. WHEN an icon conveys meaning without adjacent text, THE Icon_System SHALL require an aria-label prop
3. THE Icon_System SHALL support role="img" for semantic icons
4. WHEN animations are disabled via prefers-reduced-motion, THE Icon_System SHALL still convey the icon's meaning
