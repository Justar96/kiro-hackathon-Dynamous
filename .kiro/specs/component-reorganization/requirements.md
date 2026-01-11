# Requirements Document

## Introduction

This feature reorganizes the frontend components directory (`packages/frontend/src/components`) to improve maintainability, remove obsolete files, and reduce technical debt. The current flat structure with 49 files makes navigation difficult and contains deprecated components that were replaced during the unified-round-section implementation.

## Glossary

- **Component_Directory**: The `packages/frontend/src/components` folder containing all React components
- **Obsolete_Component**: A component that has been replaced by newer implementation and is no longer used
- **Property_Test**: A test file with `.property.tsx` suffix containing property-based tests using fast-check
- **Barrel_Export**: The `index.ts` file that re-exports components for cleaner imports
- **Component_Group**: A logical grouping of related components (e.g., auth, layout, debate)

## Requirements

### Requirement 1: Remove Obsolete Components

**User Story:** As a developer, I want obsolete components removed from the codebase, so that I don't accidentally use deprecated code and the codebase stays lean.

#### Acceptance Criteria

1. WHEN the reorganization is complete, THE Component_Directory SHALL NOT contain the `RoundSection.tsx` file (replaced by UnifiedRoundSection)
2. WHEN removing obsolete components, THE Barrel_Export SHALL be updated to remove corresponding exports
3. THE system SHALL verify no remaining imports reference removed components before deletion

### Requirement 2: Organize Components into Logical Groups

**User Story:** As a developer, I want components organized into logical subdirectories, so that I can quickly find and maintain related components.

#### Acceptance Criteria

1. THE Component_Directory SHALL contain subdirectories for each Component_Group
2. WHEN a component belongs to a specific domain, THE system SHALL place it in the corresponding subdirectory
3. THE following Component_Groups SHALL be created:
   - `auth/` - Authentication-related components (AuthModal, AuthProvider, ProfileDropdown, UserAvatar, OnboardingToast)
   - `layout/` - Layout and navigation components (ThreeColumnLayout, LeftNavRail, RightMarginRail)
   - `debate/` - Debate-specific components (UnifiedRoundSection, ActiveRoundView, ArgumentBlock, ArgumentSubmissionForm, RoundProgressIndicator, RoundNavigator, RoundHistory, ResolutionCard, DossierHeader, SpectatorComments, MarketChart, StanceInput, EvidenceFootnote)
   - `common/` - Shared UI primitives (Modal, ModalOverlay, BottomSheet, Toast, ErrorBoundary, ErrorMessage, Skeleton, FormField, ConnectionStatus)
   - `index/` - Debate listing components (DebateIndexList, DebateIndexRow)
4. WHEN a component has associated files (types, utils, property tests), THE system SHALL co-locate them in the same subdirectory

### Requirement 3: Update Import Paths

**User Story:** As a developer, I want imports to work seamlessly after reorganization, so that the refactoring doesn't break existing code.

#### Acceptance Criteria

1. WHEN components are moved to subdirectories, THE Barrel_Export SHALL be updated to re-export from new locations
2. THE system SHALL maintain backward-compatible exports from `components/index.ts`
3. WHEN updating imports, THE system SHALL use relative paths within component groups
4. IF an import path changes, THEN THE system SHALL update all consuming files

### Requirement 4: Consolidate Related Files

**User Story:** As a developer, I want related files (component, types, utils, tests) co-located, so that I can find all relevant code in one place.

#### Acceptance Criteria

1. WHEN a component has a `.types.ts` file, THE system SHALL place it in the same directory as the component
2. WHEN a component has a `.utils.ts` file, THE system SHALL place it in the same directory as the component
3. WHEN a component has a `.property.tsx` test file, THE system SHALL place it in the same directory as the component
4. WHEN a component has an `.integration.test.tsx` file, THE system SHALL place it in the same directory as the component

### Requirement 5: Maintain Test Coverage

**User Story:** As a developer, I want all existing tests to pass after reorganization, so that I have confidence the refactoring didn't break functionality.

#### Acceptance Criteria

1. WHEN the reorganization is complete, THE system SHALL pass all existing property tests
2. WHEN the reorganization is complete, THE system SHALL pass all existing unit tests
3. WHEN test files are moved, THE system SHALL update their import paths accordingly
4. THE system SHALL NOT modify test logic during reorganization

### Requirement 6: Clean Up Barrel Exports

**User Story:** As a developer, I want the barrel export file to be well-organized, so that I can easily see what's available from the components package.

#### Acceptance Criteria

1. THE Barrel_Export SHALL group exports by Component_Group with clear section comments
2. THE Barrel_Export SHALL export all public components and types
3. WHEN a component is internal to a group, THE system SHALL NOT export it from the main barrel
4. THE Barrel_Export SHALL maintain alphabetical ordering within each group

### Requirement 7: Remove Duplicate Functionality

**User Story:** As a developer, I want duplicate or redundant code eliminated, so that there's a single source of truth for each piece of functionality.

#### Acceptance Criteria

1. WHEN the `useIsMobile` hook exists in multiple files, THE system SHALL consolidate to a single shared location
2. WHEN utility functions are duplicated, THE system SHALL consolidate to shared utils
3. THE system SHALL update all consumers to use the consolidated implementations
