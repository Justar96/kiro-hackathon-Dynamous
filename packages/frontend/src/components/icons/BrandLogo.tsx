import { useState, useEffect, memo } from 'react';
import type { IconSize } from './types';
import { SIZE_MAP } from './types';

export interface BrandLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Logo name from svgl (e.g., 'react', 'typescript') */
  name: string;
  /** Size variant */
  size?: IconSize;
  /** Light or dark variant */
  variant?: 'light' | 'dark';
  /** Additional CSS classes */
  className?: string;
  /** Fallback text if logo fails to load */
  fallback?: string;
  /** Accessibility label for semantic logos */
  'aria-label'?: string;
}

// Simple in-memory cache for loaded logos
const logoCache = new Map<string, string>();

// Track failed fetches to avoid repeated requests
const failedFetches = new Set<string>();

/**
 * BrandLogo component for displaying brand/technology logos from svgl API.
 * 
 * Features:
 * - Fetches SVG logos from svgl API with caching
 * - Supports light/dark variants
 * - Graceful fallback rendering on failure
 * - Consistent sizing with icon system
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export const BrandLogo = memo(function BrandLogo({
  name,
  size = 'md',
  variant = 'light',
  className = '',
  fallback,
  'aria-label': ariaLabel,
  ...restProps
}: BrandLogoProps) {
  const cacheKey = `${name}-${variant}`;
  const [svg, setSvg] = useState<string | null>(logoCache.get(cacheKey) || null);
  const [error, setError] = useState(failedFetches.has(cacheKey));

  useEffect(() => {
    // Skip if already cached or known to fail
    if (logoCache.has(cacheKey)) {
      setSvg(logoCache.get(cacheKey)!);
      return;
    }

    if (failedFetches.has(cacheKey)) {
      setError(true);
      return;
    }

    // Fetch from svgl API
    const controller = new AbortController();
    
    fetch(`https://api.svgl.app/api/svg/${encodeURIComponent(name)}`, {
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch logo: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // svgl API returns route as string or object with light/dark variants
        let svgContent: string | undefined;
        
        if (typeof data.route === 'string') {
          svgContent = data.route;
        } else if (data.route) {
          svgContent = variant === 'dark' && data.route.dark 
            ? data.route.dark 
            : data.route.light || data.route;
        }

        if (svgContent) {
          logoCache.set(cacheKey, svgContent);
          setSvg(svgContent);
        } else {
          throw new Error('No SVG content in response');
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          failedFetches.add(cacheKey);
          setError(true);
        }
      });

    return () => controller.abort();
  }, [name, variant, cacheKey]);

  const sizeClass = SIZE_MAP[size];
  const combinedClassName = `${sizeClass} ${className}`.trim();

  // Accessibility props
  const accessibilityProps = {
    'aria-hidden': !ariaLabel ? true : undefined,
    'aria-label': ariaLabel,
    role: ariaLabel ? 'img' : undefined,
  };

  // Error or loading state - show fallback
  if (error || !svg) {
    if (fallback) {
      return (
        <span 
          className={`${combinedClassName} inline-flex items-center justify-center text-text-secondary text-xs font-medium`}
          {...accessibilityProps}
          {...restProps}
        >
          {fallback}
        </span>
      );
    }
    // Neutral placeholder
    return (
      <span 
        className={`${combinedClassName} bg-gray-100 dark:bg-gray-800 rounded inline-block`}
        {...accessibilityProps}
        {...restProps}
      />
    );
  }

  // Check if svg is a URL or inline SVG content
  const isUrl = svg.startsWith('http://') || svg.startsWith('https://');

  if (isUrl) {
    return (
      <img
        src={svg}
        alt={ariaLabel || name}
        className={combinedClassName}
        {...(ariaLabel ? {} : { 'aria-hidden': true })}
        {...(restProps as React.ImgHTMLAttributes<HTMLImageElement>)}
      />
    );
  }

  // Inline SVG content
  return (
    <span 
      className={`${combinedClassName} inline-block [&>svg]:w-full [&>svg]:h-full`}
      dangerouslySetInnerHTML={{ __html: svg }}
      {...accessibilityProps}
      {...restProps}
    />
  );
});

// Export cache utilities for testing
export const _testUtils = {
  getCache: () => logoCache,
  getFailedFetches: () => failedFetches,
  clearCache: () => {
    logoCache.clear();
    failedFetches.clear();
  },
};
