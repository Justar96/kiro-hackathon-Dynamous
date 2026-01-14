import { forwardRef } from 'react';
import { motion, type Variants } from 'motion/react';
import type { IconProps } from '../types';
import { SIZE_MAP } from '../types';
import { useReducedMotion } from '../useReducedMotion';

const pulseVariants: Variants = {
  initial: { scale: 1 },
  animate: { scale: [1, 1.1, 1], transition: { duration: 0.3 } },
};

const hoverVariants: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.1, transition: { duration: 0.2 } },
};

const mountVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
};

/**
 * VoteIcon - Group of people representing votes/participants.
 * Used to indicate vote counts and audience participation.
 * 
 * Requirements: 1.5, 3.2
 */
export const VoteIcon = forwardRef<SVGSVGElement, IconProps>(function VoteIcon(
  {
    size = 'md',
    className = '',
    animate = 'none',
    noAnimation = false,
    decorative = true,
    strokeWidth = 2,
    'aria-label': ariaLabel,
    ...props
  },
  ref
) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !noAnimation && !prefersReducedMotion && animate !== 'none';

  const sizeClass = SIZE_MAP[size];
  const combinedClassName = `${sizeClass} ${className}`.trim();

  const accessibilityProps = {
    'aria-hidden': decorative && !ariaLabel ? true : undefined,
    'aria-label': ariaLabel,
    role: ariaLabel ? 'img' : undefined,
  };

  const svgContent = (
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" 
    />
  );

  if (!shouldAnimate) {
    return (
      <svg
        ref={ref}
        className={combinedClassName}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        {...accessibilityProps}
        {...props}
      >
        {svgContent}
      </svg>
    );
  }

  const variants = animate === 'hover' ? hoverVariants 
    : animate === 'mount' ? mountVariants 
    : pulseVariants;

  return (
    <motion.svg
      ref={ref}
      className={combinedClassName}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      variants={variants}
      initial="initial"
      animate={animate === 'mount' || animate === 'state-change' ? 'animate' : undefined}
      whileHover={animate === 'hover' ? 'hover' : undefined}
      {...accessibilityProps}
      {...props}
    >
      {svgContent}
    </motion.svg>
  );
});
