# Product Guidelines

## 1. Design & UX Principles
- **Clarity & Simplicity**: Interfaces should be clean and intuitive, minimizing cognitive load. Functionality over unnecessary decoration.
- **Consistency**: Utilize the shared `Rainforest UI` components to maintain a cohesive look and feel across all applications within the monorepo.
- **Responsive Design**: All applications must seamlessly adapt to mobile, tablet, and desktop viewports without horizontal scrolling.

## 2. Accessibility (a11y)
- **WCAG 2.2 Level AA Compliance**: All UI components and features must adhere to these standards.
- **Keyboard Operability**: Ensure a logical focus order. All interactive elements must be accessible and operable via keyboard. Do not remove default focus outlines without replacing them with high-contrast alternatives.
- **Semantic HTML**: Use native semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<button>`) appropriately to structure content and support screen readers.
- **Forms & Validation**: Every form input must have an associated label. Errors must be clearly announced using `aria-invalid` and `aria-live` regions.

## 3. Performance & Quality
- **Core Web Vitals**: Optimize for fast Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and zero Cumulative Layout Shift (CLS).
- **Graceful Degradation**: Core application features should remain functional even if network conditions are poor.

## 4. Prose & Branding
- **Tone**: Professional, friendly, and direct.
- **Terminology**: Use consistent terminology across documentation and UI text.