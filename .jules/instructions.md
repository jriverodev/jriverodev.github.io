# Design Instructions and Guidelines

## Design Rules & Token Configuration
- **Palette**: Slate / Operative Blue (`#2563eb` / `blue-600`).
- **Dark Mode (Default)**:
  - App Background: `slate-900` (`#0f172a`)
  - Card/Surface: `slate-800` (`#1e293b`)
  - Border: `slate-700` (`#334155`)
  - Primary Text: `slate-50` (`#f8fafc`)
  - Secondary Text: `slate-400` (`#94a3b8`)
- **Light Mode**:
  - App Background: `slate-50` (`#f8fafc`)
  - Card/Surface: `white` (`#ffffff`)
  - Border: `slate-200` (`#e2e8f0`)
  - Primary Text: `slate-900` (`#0f172a`)
  - Secondary Text: `slate-500` (`#64748b`)
- **Brand Accent**: Operative Blue (`blue-600` / `#2563eb`).

## Prohibited Elements
1. NO two-color gradients (e.g. `from-purple-500 to-blue-500`).
2. NO purple or generic indigo tones (`#7c3aed`).
3. NO border radiuses greater than 8px (`rounded-lg` or `rounded-md` max; forbid `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-[32px]`).
4. NO backdrop blur effects (`backdrop-filter`, `backdrop-blur`), translucent borders (`rgba(255,255,255,0.1)`), or colored glow shadows on buttons.
5. NO decorative arrows (`->`, `→`) in buttons.
6. NO emojis as icons. Use flat FontAwesome / Heroicons icon set only.
