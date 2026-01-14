import { forwardRef, useState, useCallback, type ComponentType, type SVGProps } from 'react';
import { motion, type Variants } from 'motion/react';
import type { IconProps } from './types';
import { SIZE_MAP } from './types';
import { useReducedMotion } from './useReducedMotion';

type HeroIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Animation variants for different triggers
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
 * Factory function to create animated icon components from heroicons.
 * 
 * Wraps heroicon components with consistent sizing, styling, animation,
 * and accessibility props.
 * 
 * @param Icon - The heroicon component to wrap
 * @param displayName - Optional display name for debugging
 * @returns A wrapped icon component with enhanced props
 */
export function createIcon(Icon: HeroIconComponent, displayName?: string) {
  const WrappedIcon = forwardRef<SVGSVGElement, IconProps>(function WrappedIcon(
    {
      size = 'md',
      className = '',
      animate = 'none',
      noAnimation = false,
      decorative = true,
      strokeWidth,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) {
    const prefersReducedMotion = useReducedMotion();
    const shouldAnimate = !noAnimation && !prefersReducedMotion && animate !== 'none';
    const [isClicked, setIsClicked] = useState(false);

    const sizeClass = SIZE_MAP[size];
    const combinedClassName = `${sizeClass} ${className}`.trim();

    const handleClick = useCallback(() => {
      if (animate === 'click' && shouldAnimate) {
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 300);
      }
    }, [animate, shouldAnimate]);

    // Determine accessibility attributes
    const accessibilityProps = {
      'aria-hidden': decorative && !ariaLabel ? true : undefined,
      'aria-label': ariaLabel,
      role: ariaLabel ? 'img' : undefined,
    };

    // Build the icon element
    const iconElement = (
      <Icon
        ref={ref}
        className={combinedClassName}
        strokeWidth={strokeWidth}
        {...accessibilityProps}
        {...props}
      />
    );

    // Return static icon if animations disabled
    if (!shouldAnimate) {
      return iconElement;
    }

    // Wrap with motion for animations
    const MotionIcon = motion.create(Icon);

    if (animate === 'hover') {
      return (
        <MotionIcon
          ref={ref}
          className={combinedClassName}
          strokeWidth={strokeWidth}
          variants={hoverVariants}
          initial="initial"
          whileHover="hover"
          {...accessibilityProps}
          {...props}
        />
      );
    }

    if (animate === 'click') {
      return (
        <MotionIcon
          ref={ref}
          className={combinedClassName}
          strokeWidth={strokeWidth}
          variants={pulseVariants}
          initial="initial"
          animate={isClicked ? 'animate' : 'initial'}
          onClick={handleClick}
          {...accessibilityProps}
          {...props}
        />
      );
    }

    if (animate === 'mount') {
      return (
        <MotionIcon
          ref={ref}
          className={combinedClassName}
          strokeWidth={strokeWidth}
          variants={mountVariants}
          initial="initial"
          animate="animate"
          {...accessibilityProps}
          {...props}
        />
      );
    }

    if (animate === 'state-change') {
      return (
        <MotionIcon
          ref={ref}
          className={combinedClassName}
          strokeWidth={strokeWidth}
          variants={pulseVariants}
          initial="initial"
          animate="animate"
          {...accessibilityProps}
          {...props}
        />
      );
    }

    return iconElement;
  });

  WrappedIcon.displayName = displayName || Icon.displayName || 'Icon';
  return WrappedIcon;
}
