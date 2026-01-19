/**
 * Anchise Design System Tokens
 * 
 * Use these constants for consistency across all components.
 * DO NOT use arbitrary colors - always reference this file.
 */

export const colors = {
  // Backgrounds
  bg: {
    primary: '#0F0F12',      // Main background
    secondary: '#1A1A1F',    // Cards, elevated surfaces
    tertiary: '#2A2A30',     // Hover states, inputs
    hover: '#3A3A40',        // Active states
  },
  
  // Text
  text: {
    primary: '#FFFFFF',      // Main text
    secondary: '#AFAFB3',    // Muted text, labels
    tertiary: '#757575',     // Disabled, hints
  },
  
  // Accent (Gold)
  gold: {
    DEFAULT: '#C9A75E',      // Primary gold
    hover: '#B8924B',        // Gold hover
    active: '#A6833F',       // Gold pressed
    muted: 'rgba(201, 167, 94, 0.1)', // Gold background tint
  },
  
  // Borders
  border: {
    DEFAULT: '#3A3A40',      // Default border
    subtle: '#2A2A30',       // Subtle border
    focus: '#C9A75E',        // Focus ring
  },
  
  // Semantic
  semantic: {
    error: '#D9534F',
    errorHover: '#C9433F',
    success: '#5CB85C',
    warning: '#F0AD4E',
    info: '#5BC0DE',
  },
} as const;

export const spacing = {
  gap: {
    1: '8px',
    2: '12px',
    3: '16px',
    4: '24px',
    5: '32px',
    section: '48px',
  },
  padding: {
    mobile: '20px',
    tablet: '28px',
    desktop: '40px',
  },
  maxWidth: {
    content: '980px',
    narrow: '640px',
    wide: '1200px',
  },
} as const;

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '14px',
  xl: '16px',
  full: '9999px',
} as const;

export const typography = {
  fontFamily: {
    serif: 'var(--font-noto-serif), Georgia, serif',
    sans: 'var(--font-inter), system-ui, sans-serif',
  },
  heading: {
    h1: { size: '28px', weight: 600, lineHeight: '34px' },
    h2: { size: '20px', weight: 600, lineHeight: '26px' },
    h3: { size: '16px', weight: 600, lineHeight: '22px' },
  },
  body: {
    large: { size: '16px', weight: 400, lineHeight: '22px' },
    regular: { size: '14px', weight: 400, lineHeight: '20px' },
    small: { size: '12px', weight: 400, lineHeight: '16px' },
  },
} as const;

/**
 * Button Variants Reference:
 * 
 * | Variant     | Background    | Text      | Use Case                    |
 * |-------------|---------------|-----------|------------------------------|
 * | default     | Gold          | Dark      | Primary actions              |
 * | outline     | Transparent   | White     | Secondary actions            |
 * | ghost       | Transparent   | Muted     | Tertiary actions, nav links  |
 * | secondary   | Dark gray     | White     | Alternative to outline       |
 * | destructive | Red           | White     | Delete, cancel               |
 * | link        | None          | Gold      | Inline links                 |
 */

