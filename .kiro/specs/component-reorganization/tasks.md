# Implementation Plan: Component Reorganization

## Overview

This plan reorganizes the frontend components directory from a flat 49-file structure into logical subdirectories. The implementation follows a safe, incremental approach: create structure first, move files, update imports, then clean up.

## Tasks

- [x] 1. Create directory structure and shared utilities
  - [x] 1.1 Create subdirectory structure
    - Create `packages/frontend/src/components/auth/`
    - Create `packages/frontend/src/components/layout/`
    - Create `packages/frontend/src/components/debate/`
    - Create `packages/frontend/src/components/common/`
    - Create `packages/frontend/src/components/index-list/`
    - _Requirements: 2.1, 2.3_

  - [x] 1.2 Create shared hooks file with consolidated useIsMobile
    - Create `packages/frontend/src/components/common/hooks.ts`
    - Implement `useIsMobile` hook with configurable breakpoint
    - Export hook for use by other components
    - _Requirements: 7.1, 7.2_

- [x] 2. Move common components
  - [x] 2.1 Move Modal components to common/
    - Move `Modal.tsx`, `Modal.property.tsx` to `common/`
    - Move `ModalOverlay.tsx`, `ModalOverlay.property.tsx` to `common/`
    - Move `BottomSheet.tsx` to `common/`
    - Update Modal.tsx to import useIsMobile from `./hooks`
    - _Requirements: 2.2, 4.3_

  - [x] 2.2 Move feedback components to common/
    - Move `Toast.tsx`, `Toast.property.tsx` to `common/`
    - Move `ErrorBoundary.tsx`, `ErrorBoundary.property.tsx` to `common/`
    - Move `ErrorMessage.tsx`, `ErrorMessage.property.tsx` to `common/`
    - _Requirements: 2.2, 4.3_

  - [x] 2.3 Move utility components to common/
    - Move `Skeleton.tsx`, `Skeleton.property.tsx` to `common/`
    - Move `FormField.tsx` to `common/`
    - Move `ConnectionStatus.tsx` to `common/`
    - _Requirements: 2.2, 4.3_

  - [x] 2.4 Create common barrel export
    - Create `packages/frontend/src/components/common/index.ts`
    - Export all common components, hooks, and types
    - _Requirements: 3.1, 6.2_

- [x] 3. Move auth components
  - [x] 3.1 Move auth components to auth/
    - Move `AuthModal.tsx`, `AuthModal.property.tsx` to `auth/`
    - Move `AuthModalStyling.property.tsx`, `AuthModalToast.property.tsx` to `auth/`
    - Move `AuthProvider.tsx`, `AuthProvider.property.tsx` to `auth/`
    - Move `ProfileDropdown.tsx`, `ProfileDropdown.property.tsx` to `auth/`
    - Move `UserAvatar.tsx` to `auth/`
    - Move `OnboardingToast.tsx` to `auth/`
    - Move `SignUpProfileFlow.integration.test.tsx` to `auth/`
    - _Requirements: 2.2, 4.3, 4.4_

  - [x] 3.2 Create auth barrel export
    - Create `packages/frontend/src/components/auth/index.ts`
    - Export all auth components and types
    - _Requirements: 3.1, 6.2_

- [x] 4. Move layout components
  - [x] 4.1 Move layout components to layout/
    - Move `ThreeColumnLayout.tsx` to `layout/`
    - Move `LeftNavRail.tsx`, `LeftNavRail.property.tsx` to `layout/`
    - Move `RightMarginRail.tsx` to `layout/`
    - _Requirements: 2.2, 4.3_

  - [x] 4.2 Create layout barrel export
    - Create `packages/frontend/src/components/layout/index.ts`
    - Export all layout components and types
    - _Requirements: 3.1, 6.2_

- [x] 5. Checkpoint - Verify common, auth, layout moves
  - Ensure all tests pass, ask the user if questions arise.
  - Run `bun run build` to verify no import errors
  - _Requirements: 5.1, 5.2_
  - **Status: COMPLETE** - Build passes. All 13 test files pass for common, auth, and layout components.

- [x] 6. Move debate components
  - [x] 6.1 Move UnifiedRoundSection and related files to debate/
    - Move `UnifiedRoundSection.tsx` to `debate/`
    - Move `UnifiedRoundSection.types.ts` to `debate/`
    - Move `UnifiedRoundSection.utils.ts` to `debate/`
    - Move `UnifiedRoundSection.property.tsx` to `debate/`
    - _Requirements: 2.2, 4.1, 4.2, 4.3_

  - [x] 6.2 Move round-related components to debate/
    - Move `ActiveRoundView.tsx` to `debate/`
    - Move `ArgumentSubmissionForm.tsx` to `debate/`
    - Move `RoundProgressIndicator.tsx` to `debate/`
    - Move `RoundNavigator.tsx` to `debate/`
    - Move `RoundHistory.tsx` to `debate/`
    - Update RoundHistory.tsx to import useIsMobile from `../common/hooks`
    - _Requirements: 2.2, 7.3_

  - [x] 6.3 Move argument and content components to debate/
    - Move `ArgumentBlock.tsx` to `debate/`
    - Move `ResolutionCard.tsx` to `debate/`
    - Move `DossierHeader.tsx` to `debate/`
    - Move `SpectatorComments.tsx` to `debate/`
    - Move `EvidenceFootnote.tsx` to `debate/`
    - _Requirements: 2.2_

  - [x] 6.4 Move market components to debate/
    - Move `MarketChart.tsx` to `debate/`
    - Move `StanceInput.tsx` to `debate/`
    - _Requirements: 2.2_

  - [x] 6.5 Create debate barrel export
    - Create `packages/frontend/src/components/debate/index.ts`
    - Export all debate components and types
    - _Requirements: 3.1, 6.2_

- [x] 7. Move index list components
  - [x] 7.1 Move index components to index-list/
    - Move `DebateIndexList.tsx` to `index-list/`
    - Move `DebateIndexRow.tsx` to `index-list/`
    - _Requirements: 2.2_

  - [x] 7.2 Create index-list barrel export
    - Create `packages/frontend/src/components/index-list/index.ts`
    - Export all index list components
    - _Requirements: 3.1, 6.2_

- [x] 8. Update main barrel export
  - [x] 8.1 Rewrite components/index.ts
    - Update to re-export from subdirectory barrels
    - Group exports by component category with section comments
    - Maintain all existing exports for backward compatibility
    - _Requirements: 3.1, 3.2, 6.1, 6.2_

- [x] 9. Checkpoint - Verify all moves complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run `bun run build` to verify no import errors
  - _Requirements: 5.1, 5.2_

- [x] 10. Remove obsolete files included rename all new round session files to standard
  - [x] 10.1 Delete RoundSection.tsx
    - Verify no imports reference RoundSection
    - Delete `packages/frontend/src/components/RoundSection.tsx`
    - Remove export from barrel if still present
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 11. Final verification
  - [x] 11.1 Run full test suite
    - Execute `bun run test` in packages/frontend
    - Verify all property tests pass
    - Verify all unit tests pass
    - _Requirements: 5.1, 5.2_

  - [x] 11.2 Verify build
    - Execute `bun run build`
    - Verify no TypeScript errors
    - _Requirements: 3.4_

- [x] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify directory structure matches design
  - Confirm RoundSection.tsx is deleted
  - Confirm useIsMobile is consolidated

## Notes

- All tasks are required (no optional tasks)
- Each task references specific requirements for traceability
- File moves should preserve git history where possible (use `git mv`)
- Import paths within moved files need updating to reflect new locations
- The main barrel export maintains backward compatibility - no changes needed in consuming code outside components/
