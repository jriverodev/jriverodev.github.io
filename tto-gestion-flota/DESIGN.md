---
name: SIAGOP Móvil Industrial Dark
version: alpha
description: A high-density, industrial-grade design system for fleet management and maintenance tracking.
colors:
  background: "#020617" # Slate-950
  surface: "#0f172a"    # Slate-900
  border: "#1e293b"     # Slate-800
  text-primary: "#f8fafc" # Slate-50
  text-secondary: "#94a3b8" # Slate-400
  primary: "#2563eb"    # Blue-600 (Operational Actions)
  secondary: "#f97316"  # Orange-500 (Navigation & Brand)
  success: "#10b981"    # Emerald-500 (Status Ready)
  warning: "#f59e0b"    # Amber-500 (Status Pending)
  danger: "#ef4444"     # Red-500 (Errors & Deletion)
typography:
  h1:
    fontFamily: ui-sans-serif, system-ui, sans-serif
    fontSize: 2rem
    fontWeight: 900
  body:
    fontFamily: ui-sans-serif, system-ui, sans-serif
    fontSize: 0.875rem
  mono:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
    fontSize: 0.75rem
rounded:
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
spacing:
  xs: 0.5rem
  sm: 1rem
  md: 1.5rem
  lg: 2rem
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
---

## Overview

Industrial Utility meets Modern Dark Mode. The TTOCC interface is designed for low-light environments (patios, workshops) and high-density information display. It prioritizes legibility of status codes and unit identifiers.

## Colors

The system uses a deep Slate foundation to reduce eye strain, with vibrant semi-transparent accents for status hierarchy.

- **Primary (Blue):** Used for primary calls to action and "In Process" status.
- **Secondary (Orange):** Used for brand elements and navigation icons.
- **Success (Emerald):** Used for "Ready" status and affirmative actions.
- **Warning (Amber):** Used for "Pending" or "To Attend" status.
- **Neutral (Slate):** Various shades of slate define the hierarchy of surfaces and borders.

## Typography

Hierarchy is established through weight and tracking rather than just size.

- **Headings:** Heavy weights (Black/900) with wide tracking for an "industrial" look.
- **Data:** Monospace fonts are used for IDs (V-102, #001) to ensure character alignment and quick scanning.
- **Body:** Compact sans-serif for descriptions and labels.

## Components

### Cards & Containers
Containers use subtle borders (`slate-800`) rather than heavy shadows to maintain a clean, flat aesthetic.

### Status Badges
Badges should always use a background opacity (e.g., `bg-opacity-10`) with a solid border of the same color to ensure they don't overpower the text.

### Modals
Modals use a heavy backdrop blur (`backdrop-blur-md`) to maintain context while focusing the user on the task at hand.

## Do's and Don'ts

### Do
- Use monospace for all Unit IDs.
- Ensure all interactive elements have a minimum tap target of 44x44px on mobile.
- Use `uppercase` and `tracking-widest` for secondary labels.

### Don't
- Do not use pure white (#FFFFFF) for text; use Slate-50 or Slate-100.
- Avoid using solid backgrounds for large status indicators; prefer the bordered badge style.
- Never use more than two different font families.
