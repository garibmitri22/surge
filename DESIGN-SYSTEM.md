# Surge — Design System (the cohesion bible)

**The ONE law:** every surface — landing AND the app — is the same product. Same palette, type,
components, orb, motion. Marketing moments may be *richer/more atmospheric*, but always the same
DNA dialed up — never a different world. **Functionality first: usable beats pretty.** **Readability
is law: nothing ships that you can't read.**

> Why this exists (June 7): the landing started looking good but felt like a different product than
> the app (cartoonish orbs, different feel). Cohesion fixes that. Build landing → app to THIS spec.

---

## 1. Foundations

### Palette (one set, everywhere)
- **Neutrals:** page bg `#F7F8FA` · surface/cards `#FFFFFF` · borders `#E6E8EE` (subtle).
- **Ink (text):** primary `#0F1422` (near-black — the readable headline/body color) · secondary
  `#5A6172` · tertiary `#9AA1B0` (hints only, never body copy).
- **Brand accent:** indigo `#6366F1` (primary actions) · hover `#4F46E5`.
- **Agent signature colors (identical everywhere — drive each orb + that agent's accents):**
  Aria `#A78BFA` (purple) · Nova `#34D399` (green) · Opus `#60A5FA` (blue) · Atlas `#F59E0B` (amber).
- **Atmosphere (hero moments only, optional):** deep night base `#0E1322` with the agent's signature
  color as a soft glow. Same hues as above → cohesive, not a separate theme.

### Typography
- One sans family (Geist / Inter-class). Scale: Display 56–72 (hero) · H1 40 · H2 28 · H3 20 ·
  Body 17 · Small 14. Weights: 400 regular, 500 medium, 700 for hero display only.
  Line-height: 1.15 headers, 1.6 body.
- **Hierarchy law:** size + weight guide the eye. Headers heavy + dark `#0F1422`; metadata light.
  If it needs color to stand out, the hierarchy is wrong.

### Contrast — NON-NEGOTIABLE
- All text passes WCAG AA. **No gray-on-white headlines. No text on busy/low-contrast backgrounds.**
  Headlines are `#0F1422`. Body is never lighter than `#5A6172`. Readability beats aesthetics, always.

### Spacing / layout
- 8px grid. Generous whitespace. Max content width ~1100px. Consistent section padding (96px desktop).

---

## 2. The orb / agents (consistent + premium everywhere)
- **ONE orb treatment** across landing AND app — premium: real depth, a soft *grounded* glow, never
  a flat cartoon blob. Signature color per agent. The orb that's cinematic on the landing is the SAME
  orb in the app — just calmer. Never two different-looking orbs.
- Every agent shown as: **orb + name + role + status badge.** First-person voice in agent copy.
- **Motion:** the orb breathes subtly, and reacts to speech (TTS amplitude) when talking. Same
  behavior site + app.

---

## 3. Components (one style, used on every surface)
- **Buttons:** primary = indigo solid, white text, `radius-lg`, subtle press scale. Secondary =
  outline. Identical on landing + app.
- **Cards:** white, 1px `#E6E8EE` border, `radius-lg`, generous padding. Same everywhere.
- **Badges/status:** pill, agent signature color at low opacity bg + saturated text, small. Same.
- **Inputs:** one consistent field style.

---

## 4. Motion language
- Purposeful + subtle. Short eased fade/slide-in on scroll. The orb's life. No gimmicks, nothing that
  hurts readability or performance. Marketing surfaces may add atmosphere (subtle gradient fields,
  the orb's glow); the app stays calm. Same easing/feel everywhere.

---

## 5. The cohesion model (light app + richer brand, SAME DNA)
- **App (dashboard / leads / tasks / workforce):** clean light, functionality-first — same palette,
  type, components, and orb as the brand surfaces.
- **Landing / agent showcase:** same DNA, may add atmosphere and the orb's glow — but same colors,
  type, and components. Result: going site → app feels like *the same product*, just task-focused.
- **The test:** screenshot the landing next to the dashboard. If they look like two companies, it
  fails. They should look like two rooms in the same house.

---

## 6. Copy voice (so it matches the look)
- Confident + outcome-first; never hedge or plant doubt on marketing surfaces.
- Honesty = a FLEX, framed positively: "every number is real, no inflated dashboards" — NEVER "even
  if there are no results."
- The homepage sells the **whole workforce** (lead gen + marketing + sales + booking), not one feature.

---

## 7. Order of work
1. Lock the **landing** to this system (get it genuinely "really good").
2. Bring the **app** surfaces to the SAME system (palette / type / components / orb) — incremental,
   never breaking functionality.
3. Render the **orb identically premium** in both. Verify with the side-by-side test (§5).
