# Design Document: Auth & Profile Enhancements

## Overview

This document describes the technical design for enhancing the authentication experience and user profile dropdown menu. The key improvements include:

1. **Custom Profile Dropdown** - A platform-styled dropdown replacing the default Neon Auth UserButton
2. **Sign-Up Enhancements** - Username collection and onboarding messaging
3. **Auth Modal Styling** - CSS customizations to align Neon Auth UI with the paper-clean aesthetic

### Tech Stack (Existing)
- **Frontend**: React 18 with TanStack Router/Query
- **Authentication**: Neon Auth (@neondatabase/neon-js) with Better Auth UI
- **Styling**: Tailwind CSS
- **Design System**: Paper-clean aesthetic (warm off-white, subtle shadows, serif headings)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Navigation Header                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    ProfileDropdown Component                      │  │
│  │  ┌──────────────┐  ┌──────────────────────────────────────────┐  │  │
│  │  │   Trigger    │  │           Dropdown Menu                   │  │  │
│  │  │ (Avatar +    │  │  ┌─────────────────────────────────────┐  │  │  │
│  │  │  Name)       │  │  │  User Header (avatar, name, email)  │  │  │  │
│  │  └──────────────┘  │  ├─────────────────────────────────────┤  │  │  │
│  │                    │  │  View Profile                        │  │  │  │
│  │                    │  │  My Debates                          │  │  │  │
│  │                    │  ├─────────────────────────────────────┤  │  │  │
│  │                    │  │  Sign Out                            │  │  │  │
│  │                    │  └─────────────────────────────────────┘  │  │  │
│  │                    └──────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        Auth Modal (Enhanced)                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  NeonAuthUIProvider with custom CSS variables                     │  │
│  │  ┌──────────────────────────────────────────────────────────┐    │  │
│  │  │  AuthView with additionalFields (username)               │    │  │
│  │  │  - Custom font families                                   │    │  │
│  │  │  - Platform color scheme                                  │    │  │
│  │  │  - Paper-clean styling                                    │    │  │
│  │  └──────────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### ProfileDropdown

Custom dropdown component replacing the default UserButton.

```typescript
interface ProfileDropdownProps {
  className?: string;
}

interface ProfileDropdownState {
  isOpen: boolean;
}
```

### ProfileDropdownTrigger

The clickable trigger element showing avatar and optionally user name.

```typescript
interface ProfileDropdownTriggerProps {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
  isOpen: boolean;
  onClick: () => void;
  showName?: boolean; // true on desktop, false on mobile
}
```

### ProfileDropdownMenu

The dropdown menu content with user info and navigation links.

```typescript
interface ProfileDropdownMenuProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  platformUser: {
    username: string;
    reputationScore: number;
    sandboxCompleted: boolean;
  } | null;
  onClose: () => void;
  onSignOut: () => void;
}

interface DropdownMenuItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger';
}
```

### UserAvatar

Reusable avatar component with fallback to initials.

```typescript
interface UserAvatarProps {
  src: string | null;
  name: string | null;
  email: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

### Enhanced AuthProvider Configuration

Updated NeonAuthUIProvider with username field and custom styling.

```typescript
interface EnhancedAuthProviderProps {
  children: React.ReactNode;
}

// Additional fields configuration for sign-up
const additionalFields = {
  username: {
    label: 'Username',
    placeholder: 'Choose a username',
    type: 'string',
    required: true,
    validate: (value: string) => {
      if (value.length < 3) return 'Username must be at least 3 characters';
      if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores';
      return true;
    },
  },
};
```

### OnboardingToast

Welcome message component shown after successful sign-up.

```typescript
interface OnboardingToastProps {
  username: string;
  onDismiss: () => void;
}
```

## Data Models

### Dropdown State
```typescript
interface DropdownState {
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLButtonElement>;
  menuRef: React.RefObject<HTMLDivElement>;
}
```

### User Display Data
```typescript
interface UserDisplayData {
  // From Neon Auth session
  authUser: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  // From platform user table
  platformUser: {
    id: string;
    username: string;
    reputationScore: number;
    sandboxCompleted: boolean;
    debatesParticipated: number;
  } | null;
}
```

## Styling Approach

### CSS Custom Properties for Neon Auth UI

Override Neon Auth UI styles using CSS custom properties:

```css
/* Auth modal styling overrides */
:root {
  /* Typography */
  --auth-font-family: 'Inter', 'IBM Plex Sans', system-ui, sans-serif;
  --auth-heading-font-family: 'Source Serif 4', 'Literata', Georgia, serif;
  
  /* Colors */
  --auth-background: #FFFFFF;
  --auth-foreground: #111111;
  --auth-muted: #6B7280;
  --auth-muted-foreground: #9CA3AF;
  --auth-primary: #111111;
  --auth-primary-foreground: #FFFFFF;
  --auth-accent: #2563EB;
  --auth-accent-foreground: #FFFFFF;
  --auth-destructive: #DC2626;
  --auth-success: #059669;
  --auth-border: rgba(0, 0, 0, 0.08);
  --auth-ring: #2563EB;
  
  /* Spacing & Radius */
  --auth-radius: 2px;
  --auth-radius-lg: 4px;
}
```

### Dropdown Styling

```css
.profile-dropdown-menu {
  @apply bg-paper rounded-small border border-black/[0.08] shadow-lg;
  @apply min-w-[240px] py-2;
}

.profile-dropdown-item {
  @apply px-4 py-2.5 text-body-small text-text-primary;
  @apply hover:bg-page-bg transition-colors;
  @apply min-h-[44px] flex items-center gap-3;
}

.profile-dropdown-header {
  @apply px-4 py-3 border-b border-black/[0.08];
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Dropdown Toggle Behavior

*For any* signed-in user, clicking the profile dropdown trigger SHALL toggle the dropdown open state (closed → open, open → closed).

**Validates: Requirements 1.1**

### Property 2: Dropdown User Info Display

*For any* user with name, email, and optional avatar, the profile dropdown header SHALL display all three pieces of information (avatar or initial fallback, display name, and email).

**Validates: Requirements 1.2, 5.1, 5.2, 5.3**

### Property 3: Dropdown Close on Outside Click/Escape

*For any* open dropdown, clicking outside the dropdown OR pressing the Escape key SHALL close the dropdown.

**Validates: Requirements 1.7**

### Property 4: Touch Target Minimum Size

*For any* interactive element in the profile dropdown (trigger, menu items, sign out button), the element SHALL have a minimum height of 44px for accessibility.

**Validates: Requirements 1.8, 4.4**

### Property 5: Responsive Trigger Display

*For any* viewport width:
- Below 640px (mobile): trigger SHALL show only avatar
- 640px and above (tablet/desktop): trigger SHALL show avatar AND user name

**Validates: Requirements 1.9, 4.1, 4.2**

### Property 6: Username Validation

*For any* username input:
- Strings with fewer than 3 characters SHALL be rejected
- Strings with 3+ alphanumeric characters and underscores SHALL be accepted
- Strings with special characters (other than underscore) SHALL be rejected

**Validates: Requirements 2.2**

### Property 7: Auth Modal Styling Consistency

*For any* auth modal render, the following CSS properties SHALL match the platform design system:
- Body text font-family includes 'Inter'
- Heading font-family includes 'Source Serif 4' or 'Literata'
- Primary button background color is #111111 (text-primary)
- Link color is #2563EB (accent)

**Validates: Requirements 3.1, 3.2, 3.3, 3.8**

### Property 8: Dropdown Menu Viewport Bounds

*For any* dropdown menu position, the menu SHALL remain fully visible within the viewport bounds (no overflow outside visible area).

**Validates: Requirements 4.3**

### Property 9: Sandbox Status Display

*For any* user in sandbox mode (sandboxCompleted === false), the profile dropdown SHALL display a sandbox status indicator. For users with sandboxCompleted === true, no sandbox indicator SHALL be shown.

**Validates: Requirements 5.4**

### Property 10: Reputation Score Display

*For any* user with a reputation score, the profile dropdown SHALL display the score value.

**Validates: Requirements 5.5**

## Error Handling

### Dropdown Errors
- User data fetch failure → Show avatar with "?" initial, display "Loading..." for name
- Sign out failure → Display error toast, keep dropdown open for retry
- Navigation failure → Display error toast with retry option

### Sign-Up Errors
- Username validation failure → Display inline error below field
- Username uniqueness check failure → Display "Username already taken" error
- Network error during sign-up → Preserve form data, show retry option
- Backend error → Display generic error message with support contact

### Styling Errors
- Font loading failure → Fall back to system fonts (system-ui for body, Georgia for headings)
- CSS variable override failure → Use inline styles as fallback

## Testing Strategy

### Unit Tests
- ProfileDropdown component rendering and state
- UserAvatar fallback to initials
- Username validation logic
- Responsive trigger display

### Property-Based Tests
Property-based tests will use fast-check to verify universal properties:

- **Dropdown Toggle**: Test that clicking trigger toggles state for random user data
- **User Info Display**: Test that all user info fields are rendered for random user objects
- **Username Validation**: Test validation rules against random string inputs
- **Responsive Behavior**: Test trigger display at random viewport widths
- **Touch Targets**: Test that all interactive elements meet 44px minimum

### Integration Tests
- Full sign-up flow with username collection
- Profile dropdown navigation to profile page
- Sign out flow with cache clearing
- Onboarding toast display after sign-up

### Test Configuration
- Minimum 100 iterations per property test
- Use fast-check for property-based testing
- Use React Testing Library for component tests
- Mock viewport width for responsive tests
