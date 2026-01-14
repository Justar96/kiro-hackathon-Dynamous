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
 * MindChangeIcon - Checkmark in circle representing a mind change.
 * Used to indicate when a user's stance has been changed by an argument.
 * 
 * Requirements: 1.5, 3.2
 */
export const MindChangeIcon = forwardRef<SVGSVGElement, IconProps>(function MindChangeIcon(
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
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
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
