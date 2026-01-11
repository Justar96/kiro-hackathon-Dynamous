# Requirements Document

## Introduction

This specification covers enhancements to the authentication experience and user profile dropdown menu for the Debate Platform. The focus areas include:

1. Custom profile dropdown menu - replacing the default Neon Auth UserButton with a custom dropdown that includes platform-specific links and actions
2. Sign-up flow improvements - adding username collection during registration and better onboarding
3. Auth modal styling - aligning the Neon Auth UI components with the platform's paper-clean aesthetic

## Glossary

- **Profile_Dropdown**: A custom dropdown menu component that appears when clicking the user avatar, providing navigation to profile, settings, and sign-out
- **Username_Field**: A custom field added to the sign-up form for collecting the user's display name
- **Onboarding_Message**: A contextual message explaining sandbox mode and platform features to new users
- **Paper_Clean_Aesthetic**: The platform's design language featuring warm off-white backgrounds, subtle shadows, serif headings, and minimal visual noise
- **Custom_Menu_Item**: A navigation link or action button within the profile dropdown

## Requirements

### Requirement 1: Custom Profile Dropdown Menu

**User Story:** As a signed-in user, I want a profile dropdown menu with platform-specific options, so that I can easily navigate to my profile and manage my account.

#### Acceptance Criteria

1. WHEN a signed-in user clicks their avatar THEN THE System SHALL display a dropdown menu with user information and navigation options
2. THE Profile_Dropdown SHALL display the user's avatar, display name, and email address at the top
3. THE Profile_Dropdown SHALL include a "View Profile" link that navigates to the user's profile page (/users/$userId)
4. THE Profile_Dropdown SHALL include a "My Debates" link that navigates to a filtered view of the user's debates
5. THE Profile_Dropdown SHALL include a "Sign Out" action that logs the user out and clears session data
6. THE Profile_Dropdown SHALL follow the paper-clean aesthetic with warm off-white background and subtle shadows
7. WHEN the dropdown is open THEN THE System SHALL close it when clicking outside or pressing Escape
8. THE Profile_Dropdown SHALL have appropriate touch targets (minimum 44px) for accessibility
9. WHEN on desktop viewports THEN THE Profile_Dropdown trigger SHALL show the user's name alongside the avatar

### Requirement 2: Sign-Up Flow Enhancements

**User Story:** As a new user, I want to set my username during sign-up, so that I have a display name from the start.

#### Acceptance Criteria

1. WHEN a user signs up THEN THE System SHALL collect a username/display name field
2. THE Username_Field SHALL be required and validate for minimum 3 characters
3. THE Username_Field SHALL validate for uniqueness before submission
4. WHEN sign-up succeeds THEN THE System SHALL create the user profile with the provided username
5. WHEN sign-up succeeds THEN THE System SHALL display a welcome message explaining sandbox mode
6. THE Onboarding_Message SHALL explain that new users start in sandbox mode with 0.5× vote weight
7. THE Onboarding_Message SHALL explain how to complete 5 debates to unlock full voting weight

### Requirement 3: Auth Modal Styling

**User Story:** As a user, I want the authentication forms to match the platform's visual style, so that the experience feels cohesive.

#### Acceptance Criteria

1. THE Auth_Modal form inputs SHALL use the platform's font family (Inter for body text)
2. THE Auth_Modal buttons SHALL use the platform's color scheme (text-primary background, paper text)
3. THE Auth_Modal headings SHALL use the platform's serif font (Source Serif 4)
4. THE Auth_Modal background SHALL use the paper color (#FFFFFF) with subtle shadow
5. THE Auth_Modal error messages SHALL use the oppose color (#DC2626) for visibility
6. THE Auth_Modal success states SHALL use the support color (#059669)
7. THE Auth_Modal OAuth buttons SHALL be styled consistently with the platform aesthetic
8. THE Auth_Modal links SHALL use the accent color (#2563EB) with hover states

### Requirement 4: Responsive Profile Menu Behavior

**User Story:** As a mobile user, I want the profile menu to work well on small screens, so that I can access my account on any device.

#### Acceptance Criteria

1. WHEN the viewport is mobile-sized THEN THE Profile_Dropdown trigger SHALL show only the avatar (icon size)
2. WHEN the viewport is tablet or larger THEN THE Profile_Dropdown trigger SHALL show avatar with user name
3. THE Profile_Dropdown menu SHALL be positioned to stay within viewport bounds
4. THE Profile_Dropdown menu items SHALL have appropriate spacing for touch interaction
5. WHEN the keyboard opens on mobile THEN THE Profile_Dropdown SHALL remain accessible

### Requirement 5: User Session Display

**User Story:** As a signed-in user, I want to see my account status at a glance, so that I know I'm logged in with the correct account.

#### Acceptance Criteria

1. THE Profile_Dropdown header SHALL display the user's avatar image or initial
2. THE Profile_Dropdown header SHALL display the user's display name prominently
3. THE Profile_Dropdown header SHALL display the user's email in secondary text
4. IF the user is in sandbox mode THEN THE Profile_Dropdown SHALL show a sandbox status indicator
5. THE Profile_Dropdown SHALL show the user's reputation score

