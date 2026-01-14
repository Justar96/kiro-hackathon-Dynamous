/**
 * Icon System Entry Point
 * 
 * Centralized exports for all icons used throughout the application.
 * Uses @heroicons/react with createIcon wrapper for consistent sizing,
 * animation, and accessibility props.
 * 
 * Requirements: 1.1, 1.5
 */

// Export types and utilities
export * from './types';
export { createIcon } from './createIcon';
export { useReducedMotion } from './useReducedMotion';
export { BrandLogo, type BrandLogoProps } from './BrandLogo';

// Re-export heroicons with createIcon wrapper for consistent API
import { createIcon } from './createIcon';

// Navigation icons
import {
  Bars3Icon as HeroBars3Icon,
  XMarkIcon as HeroXMarkIcon,
  ChevronDownIcon as HeroChevronDownIcon,
  ChevronUpIcon as HeroChevronUpIcon,
  ChevronLeftIcon as HeroChevronLeftIcon,
  ChevronRightIcon as HeroChevronRightIcon,
} from '@heroicons/react/24/outline';

// Action icons
import {
  PlusIcon as HeroPlusIcon,
  CheckIcon as HeroCheckIcon,
  CheckCircleIcon as HeroCheckCircleIcon,
  XCircleIcon as HeroXCircleIcon,
} from '@heroicons/react/24/outline';

// Status icons
import {
  ExclamationTriangleIcon as HeroExclamationTriangleIcon,
  ArrowPathIcon as HeroArrowPathIcon,
  InformationCircleIcon as HeroInformationCircleIcon,
  ClockIcon as HeroClockIcon,
  ShieldCheckIcon as HeroShieldCheckIcon,
} from '@heroicons/react/24/outline';

// User icons
import {
  UserIcon as HeroUserIcon,
  ChatBubbleLeftIcon as HeroChatBubbleLeftIcon,
  ArrowRightOnRectangleIcon as HeroArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

// Chart/data icons
import {
  ChartBarIcon as HeroChartBarIcon,
  LightBulbIcon as HeroLightBulbIcon,
} from '@heroicons/react/24/outline';

// Navigation icons
export const MenuIcon = createIcon(HeroBars3Icon, 'MenuIcon');
export const XIcon = createIcon(HeroXMarkIcon, 'XIcon');
export const ChevronDownIcon = createIcon(HeroChevronDownIcon, 'ChevronDownIcon');
export const ChevronUpIcon = createIcon(HeroChevronUpIcon, 'ChevronUpIcon');
export const ChevronLeftIcon = createIcon(HeroChevronLeftIcon, 'ChevronLeftIcon');
export const ChevronRightIcon = createIcon(HeroChevronRightIcon, 'ChevronRightIcon');

// Action icons
export const PlusIcon = createIcon(HeroPlusIcon, 'PlusIcon');
export const CheckIcon = createIcon(HeroCheckIcon, 'CheckIcon');
export const CheckCircleIcon = createIcon(HeroCheckCircleIcon, 'CheckCircleIcon');
export const XCircleIcon = createIcon(HeroXCircleIcon, 'XCircleIcon');

// Status icons
export const WarningIcon = createIcon(HeroExclamationTriangleIcon, 'WarningIcon');
export const SpinnerIcon = createIcon(HeroArrowPathIcon, 'SpinnerIcon');
export const InfoIcon = createIcon(HeroInformationCircleIcon, 'InfoIcon');
export const ClockIcon = createIcon(HeroClockIcon, 'ClockIcon');
export const ShieldCheckIcon = createIcon(HeroShieldCheckIcon, 'ShieldCheckIcon');

// User icons
export const UserIcon = createIcon(HeroUserIcon, 'UserIcon');
export const ChatIcon = createIcon(HeroChatBubbleLeftIcon, 'ChatIcon');
export const SignOutIcon = createIcon(HeroArrowRightOnRectangleIcon, 'SignOutIcon');

// Chart/data icons
export const ChartIcon = createIcon(HeroChartBarIcon, 'ChartIcon');
export const LightBulbIcon = createIcon(HeroLightBulbIcon, 'LightBulbIcon');

// Custom domain-specific icons
export { DeltaIcon } from './custom/DeltaIcon';
export { MindChangeIcon } from './custom/MindChangeIcon';
export { ImpactIcon } from './custom/ImpactIcon';
export { VoteIcon } from './custom/VoteIcon';
