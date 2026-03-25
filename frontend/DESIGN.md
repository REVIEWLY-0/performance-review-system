# Design System Strategy: The Transparent Authority

## 1. Overview & Creative North Star
This design system is built to transform the mundane ritual of performance management into a high-stakes, editorial experience. We are moving away from the "SaaS-in-a-box" aesthetic—characterized by heavy borders and flat grey backgrounds—and moving toward a **"Transparent Authority"** North Star.

**The Strategy:**
The interface should feel like a premium digital publication. We achieve this through "The No-Line Rule," intentional white space, and a sophisticated typographic hierarchy that prioritizes information density without clutter. By utilizing layered tonal surfaces and glassmorphism, we create an environment that feels authoritative yet breathable.

---

## 2. Colors & Surface Architecture
The palette is rooted in deep, intellectual blues and a sophisticated range of tinted neutrals. We avoid pure black and harsh separators to maintain a "Retina-ready" softness.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to define major sections. Structural boundaries must be established through background shifts using the `surface-container` tokens. 
*   **Hero/Header:** Use `surface`.
*   **Main Content Area:** Use `surface-container-low`.
*   **Sidebar/Utility Rail:** Use `surface-container-high`.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-translucent materials. 
*   **Nesting Logic:** Place a `surface-container-lowest` card on top of a `surface-container-low` background to create a "lift" effect. 
*   **Glassmorphism:** For floating elements like dropdowns or popovers, use `surface-variant` with a 70% opacity and a `24px` backdrop-blur. This ensures the UI feels integrated with the content beneath it.

### Color Tokens (Selection)
| Role | Token | Value |
| :--- | :--- | :--- |
| **Primary** | `primary` | `#0053dc` |
| **On Primary** | `on_primary` | `#faf8ff` |
| **Surface** | `surface` | `#faf8ff` |
| **Surface (Low)** | `surface_container_low` | `#f2f3ff` |
| **Surface (Highest)** | `surface_container_highest` | `#d9e2ff` |
| **Accent (Error)** | `error` | `#a83836` |

---

## 3. Typography: The Editorial Scale
We use a dual-font strategy to balance character with utility. **Manrope** provides a geometric, modern authority for headings, while **Inter** ensures maximum legibility for data-heavy reviews.

*   **Display & Headline (Manrope):** Use for page titles and high-level metrics. High tracking (letter-spacing) of -0.02em is encouraged for larger sizes to feel "tight" and professional.
*   **Body & Labels (Inter):** The workhorse for feedback and input. Maintain a line-height of 1.5 for body-md to ensure long-form reviews are readable.

**Hierarchy Highlights:**
*   **Display-lg:** 3.5rem (Manrope) - The "Editorial Statement."
*   **Headline-sm:** 1.5rem (Manrope) - Section markers.
*   **Body-md:** 0.875rem (Inter) - The standard for all feedback text.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than drop shadows.

*   **The Layering Principle:** Instead of a shadow, place a card using `surface_container_lowest` (#ffffff) onto a background of `surface_container_low` (#f2f3ff). The contrast is enough to define the boundary naturally.
*   **Ambient Shadows:** For high-elevation elements (modals), use a shadow tinted with the `on_surface` color: `box-shadow: 0 20px 40px rgba(31, 49, 89, 0.06)`. It should feel like a soft glow of light, not a dark stain.
*   **The Ghost Border:** If a boundary is visually ambiguous (e.g., in Dark Mode), use `outline_variant` at **15% opacity**.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary` with `on_primary` text. Use a subtle gradient (from `primary` to `primary_dim`) to add a "metallic" premium sheen.
*   **Secondary:** Use `secondary_container` background with `on_secondary_container` text.
*   **Radius:** Standardize on `6px` (`md`) for a sharp, professional finish.

### Input Fields
*   **Base:** `surface_container_lowest` background.
*   **Focus State:** A 2px ring using `primary` at 30% opacity. 
*   **Labels:** Always use `label-md` in `on_surface_variant` for a muted, sophisticated secondary read.

### Cards & Data Tables
*   **Forbid Dividers:** Do not use horizontal lines between table rows or card sections. 
*   **Alternative:** Use `1.5rem` (`6`) spacing and subtle hover states using `surface_container_high`.
*   **The "Highlight" Card:** For top performers, use a `tertiary_container` background to subtly draw the eye without the "emergency" feel of a warning color.

### Performance Timeline (Custom Component)
Use a horizontal track with `primary_fixed_dim` for past events and a semi-transparent `outline_variant` for future steps, creating a clear "Progressive Transparency" effect.

---

## 6. Do's and Don'ts

### Do:
*   **DO** use whitespace as a separator. If you feel the need for a line, add 16px of padding instead.
*   **DO** use "Primary-Dim" for hover states on buttons to create a sense of tactile depression.
*   **DO** ensure Dark Mode uses `surface_dim` for the background to keep the "light-off" experience easy on the eyes.

### Don't:
*   **DON'T** use 100% opaque borders. They create "visual noise" that distracts from performance data.
*   **DON'T** use pure black (#000) for text. Always use `on_surface` (#1f3159) to maintain tonal harmony with the blues in the system.
*   **DON'T** mix radii. If a card is `8px`, its inner buttons must be `4px` or `6px` to maintain nested geometry.

---
**Director's Final Note:** Every pixel should feel like it was placed with a clinical, yet human, intent. If an element doesn't serve the hierarchy, remove it. Let the typography and the tonal shifts do the heavy lifting.