# 🎨 Rainforest UI

> A modern, lightweight UI component library built with Lit and Tailwind CSS for web applications

[![Built with Lit](https://img.shields.io/badge/Lit-3.3-blue?logo=lit)](https://lit.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38BDF8?logo=tailwindcss)](https://tailwindcss.com)
[![Storybook](https://img.shields.io/badge/Storybook-8.6-FF4785?logo=storybook)](https://storybook.js.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)

## ✨ Overview

Rainforest UI is a comprehensive component library that provides modern, accessible, and customizable UI components for web applications. Built with Lit web components and styled with Tailwind CSS, it offers framework-agnostic components that work seamlessly across React, Vue, Angular, or vanilla JavaScript projects.

## 🌟 Features

### 🚀 Core Features
- **⚡ Lit Web Components** - Fast, lightweight, and framework-agnostic
- **🎨 Tailwind CSS** - Utility-first styling with full customization
- **♿ Accessibility First** - WCAG compliant with semantic HTML
- **📱 Responsive Design** - Mobile-first approach with responsive utilities
- **🌙 Theme Support** - Material Design 3 with dark/light modes
- **📖 Storybook Integration** - Interactive component documentation
- **🔧 TypeScript** - Full type safety and IntelliSense support

### 🎯 Advanced Capabilities
- **Material Design 3** - Google's latest design system integration
- **Dynamic Theming** - Runtime theme switching with CSS custom properties
- **Tree Shaking** - Optimized bundles with unused code elimination
- **Multiple Export Formats** - ESM, CJS, and UMD builds
- **Framework Integrations** - React wrappers and Vue directives included
- **Performance Optimized** - Minimal bundle size and fast rendering

## 🏗️ Architecture

### Technology Stack

**Core Framework**
- **Lit 3.3** - Web components with reactive properties
- **TypeScript 5.8** - Type-safe component development
- **Vite** - Fast build tooling and development

**Styling & Design**
- **Tailwind CSS 4.1** - Utility-first CSS framework
- **Material Design 3** - Google's design system
- **@tailwindcss/typography** - Beautiful typographic defaults
- **CSS Custom Properties** - Dynamic theming support

**Development Tools**
- **Storybook 8.6** - Component documentation and testing
- **Vitest** - Unit testing framework
- **ESLint** - Code linting with Lit-specific rules
- **Vite Bundle Analyzer** - Bundle size optimization

## 📦 Installation

### NPM Package

```bash
# Install from npm registry
npm install @rainforest-dev/rainforest-ui

# Or with pnpm
pnpm add @rainforest-dev/rainforest-ui

# Or with yarn
yarn add @rainforest-dev/rainforest-ui
```

### Monorepo Development

```bash
# From monorepo root
pnpm install

# Build the library
nx build rainforest-ui

# Start Storybook for development
nx storybook rainforest-ui
```

## 🚀 Getting Started

### Basic Usage

#### In HTML/JavaScript

```html
<!-- Import the components -->
<script type="module" src="@rainforest-dev/rainforest-ui"></script>

<!-- Use the components -->
<rf-button variant="primary">Click me</rf-button>
<rf-card elevation="2">
  <rf-typography variant="h2">Card Title</rf-typography>
  <rf-typography>Card content goes here</rf-typography>
</rf-card>
```

#### In React

```tsx
// Install React wrapper
import { RfButton, RfCard, RfTypography } from '@rainforest-dev/rainforest-ui/react';

function App() {
  return (
    <div>
      <RfButton variant="primary" onClick={() => console.log('Clicked!')}>
        Click me
      </RfButton>
      <RfCard elevation={2}>
        <RfTypography variant="h2">Card Title</RfTypography>
        <RfTypography>Card content goes here</RfTypography>
      </RfCard>
    </div>
  );
}
```

#### In Vue

```vue
<template>
  <div>
    <rf-button variant="primary" @click="handleClick">
      Click me
    </rf-button>
    <rf-card elevation="2">
      <rf-typography variant="h2">Card Title</rf-typography>
      <rf-typography>Card content goes here</rf-typography>
    </rf-card>
  </div>
</template>

<script setup>
import '@rainforest-dev/rainforest-ui';

const handleClick = () => {
  console.log('Clicked!');
};
</script>
```

### Styling Setup

#### With Tailwind CSS

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{html,js,ts,jsx,tsx,vue}',
    './node_modules/@rainforest-dev/rainforest-ui/**/*.js'
  ],
  theme: {
    extend: {
      // Customize your theme
    }
  },
  plugins: [
    require('@rainforest-dev/rainforest-ui/tailwindcss/plugin')
  ]
}
```

#### Custom CSS Variables

```css
/* Define your theme */
:root {
  --rf-primary: #3b82f6;
  --rf-secondary: #8b5cf6;
  --rf-surface: #ffffff;
  --rf-on-surface: #1f2937;
  --rf-border-radius: 8px;
  --rf-spacing-unit: 4px;
}

/* Dark theme */
[data-theme="dark"] {
  --rf-surface: #1f2937;
  --rf-on-surface: #f9fafb;
}
```

## 📁 Project Structure

```
libs/rainforest-ui/
├── src/
│   ├── components/          # Component implementations
│   │   ├── button/         # Button component
│   │   │   ├── button.ts   # Component definition
│   │   │   ├── button.css  # Component styles
│   │   │   └── button.stories.ts # Storybook stories
│   │   ├── card/           # Card component
│   │   ├── typography/     # Typography component
│   │   └── index.ts        # Component exports
│   ├── styles/             # Global styles and utilities
│   │   ├── base.css        # Base styles
│   │   ├── tokens.css      # Design tokens
│   │   └── utilities.css   # Utility classes
│   ├── themes/             # Theme definitions
│   │   ├── material.ts     # Material Design theme
│   │   └── custom.ts       # Custom theme utilities
│   ├── utils/              # Utility functions
│   │   ├── theme.ts        # Theme utilities
│   │   └── accessibility.ts # A11y helpers
│   └── index.ts            # Main library export
├── dist/                   # Built library output
│   ├── index.js           # ESM build
│   ├── index.cjs          # CJS build
│   ├── index.d.ts         # TypeScript definitions
│   ├── lit/               # Lit-specific exports
│   └── tailwindcss/       # Tailwind plugin and utilities
├── stories/               # Storybook configuration
├── .storybook/           # Storybook config
├── vite.config.ts        # Vite configuration
└── package.json          # Package configuration
```

## 🧩 Available Components

### Core Components

#### Button
```html
<rf-button variant="primary" size="medium" disabled>
  Primary Button
</rf-button>

<!-- Available variants -->
<rf-button variant="primary">Primary</rf-button>
<rf-button variant="secondary">Secondary</rf-button>
<rf-button variant="outline">Outline</rf-button>
<rf-button variant="ghost">Ghost</rf-button>
<rf-button variant="danger">Danger</rf-button>
```

#### Card
```html
<rf-card elevation="2" padding="large">
  <rf-typography slot="header" variant="h3">Card Header</rf-typography>
  <rf-typography>Card content with automatic spacing</rf-typography>
  <rf-button slot="actions" variant="primary">Action</rf-button>
</rf-card>
```

#### Typography
```html
<!-- Headings -->
<rf-typography variant="h1">Heading 1</rf-typography>
<rf-typography variant="h2">Heading 2</rf-typography>
<rf-typography variant="h3">Heading 3</rf-typography>

<!-- Body text -->
<rf-typography variant="body1">Primary body text</rf-typography>
<rf-typography variant="body2">Secondary body text</rf-typography>
<rf-typography variant="caption">Caption text</rf-typography>
```

#### Form Components
```html
<!-- Input Field -->
<rf-input 
  label="Email Address"
  type="email"
  placeholder="Enter your email"
  required
  error-message="Please enter a valid email"
></rf-input>

<!-- Select Dropdown -->
<rf-select label="Choose an option" required>
  <rf-option value="1">Option 1</rf-option>
  <rf-option value="2">Option 2</rf-option>
  <rf-option value="3">Option 3</rf-option>
</rf-select>

<!-- Checkbox -->
<rf-checkbox label="I agree to the terms" required></rf-checkbox>
```

#### Layout Components
```html
<!-- Grid System -->
<rf-grid container spacing="4">
  <rf-grid item xs="12" md="6">
    <rf-card>Content 1</rf-card>
  </rf-grid>
  <rf-grid item xs="12" md="6">
    <rf-card>Content 2</rf-card>
  </rf-grid>
</rf-grid>

<!-- Flex Container -->
<rf-flex direction="row" justify="space-between" align="center" gap="4">
  <rf-typography>Left content</rf-typography>
  <rf-button>Right action</rf-button>
</rf-flex>
```

## 🛠️ Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `nx build rainforest-ui` | Build library for production |
| `nx dev rainforest-ui` | Start development server |
| `nx storybook rainforest-ui` | Start Storybook development |
| `nx test rainforest-ui` | Run unit tests |
| `nx lint rainforest-ui` | Lint code |
| `nx build-storybook rainforest-ui` | Build Storybook for production |

### Creating New Components

1. **Create Component Directory**
   ```bash
   mkdir src/components/my-component
   cd src/components/my-component
   ```

2. **Component Implementation**
   ```typescript
   // my-component.ts
   import { LitElement, html, css } from 'lit';
   import { customElement, property } from 'lit/decorators.js';

   @customElement('rf-my-component')
   export class MyComponent extends LitElement {
     @property({ type: String })
     variant: 'primary' | 'secondary' = 'primary';

     static styles = css`
       :host {
         display: inline-block;
       }
       
       .component {
         @apply px-4 py-2 rounded-md;
       }
       
       .primary {
         @apply bg-blue-500 text-white;
       }
       
       .secondary {
         @apply bg-gray-200 text-gray-800;
       }
     `;

     render() {
       return html`
         <div class="component ${this.variant}">
           <slot></slot>
         </div>
       `;
     }
   }

   declare global {
     interface HTMLElementTagNameMap {
       'rf-my-component': MyComponent;
     }
   }
   ```

3. **Storybook Story**
   ```typescript
   // my-component.stories.ts
   import type { Meta, StoryObj } from '@storybook/web-components';
   import { html } from 'lit';
   import './my-component';

   const meta: Meta = {
     title: 'Components/MyComponent',
     component: 'rf-my-component',
     parameters: {
       docs: {
         description: {
           component: 'A customizable component for...'
         }
       }
     },
     argTypes: {
       variant: {
         control: { type: 'select' },
         options: ['primary', 'secondary']
       }
     }
   };

   export default meta;
   type Story = StoryObj;

   export const Primary: Story = {
     args: {
       variant: 'primary'
     },
     render: (args) => html`
       <rf-my-component variant=${args.variant}>
         Component content
       </rf-my-component>
     `
   };
   ```

4. **Export Component**
   ```typescript
   // src/index.ts
   export { MyComponent } from './components/my-component/my-component';
   ```

### Testing Components

```typescript
// my-component.test.ts
import { expect, test } from '@storybook/test';
import { render } from '@testing-library/lit';
import './my-component';

test('renders with default props', () => {
  const { container } = render('<rf-my-component>Test</rf-my-component>');
  const component = container.querySelector('rf-my-component');
  
  expect(component).toBeInTheDocument();
  expect(component).toHaveAttribute('variant', 'primary');
});

test('accepts custom variant', () => {
  const { container } = render('<rf-my-component variant="secondary">Test</rf-my-component>');
  const component = container.querySelector('rf-my-component');
  
  expect(component).toHaveAttribute('variant', 'secondary');
});
```

## 🎨 Theming & Customization

### CSS Custom Properties

The library uses CSS custom properties for theming:

```css
:root {
  /* Colors */
  --rf-primary: #3b82f6;
  --rf-primary-hover: #2563eb;
  --rf-secondary: #8b5cf6;
  --rf-success: #10b981;
  --rf-warning: #f59e0b;
  --rf-error: #ef4444;
  
  /* Typography */
  --rf-font-family: 'Inter', system-ui, sans-serif;
  --rf-font-size-sm: 0.875rem;
  --rf-font-size-base: 1rem;
  --rf-font-size-lg: 1.125rem;
  
  /* Spacing */
  --rf-spacing-xs: 0.25rem;
  --rf-spacing-sm: 0.5rem;
  --rf-spacing-md: 1rem;
  --rf-spacing-lg: 1.5rem;
  --rf-spacing-xl: 2rem;
  
  /* Border radius */
  --rf-radius-sm: 0.25rem;
  --rf-radius-md: 0.5rem;
  --rf-radius-lg: 0.75rem;
  
  /* Shadows */
  --rf-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --rf-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --rf-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

### Tailwind Plugin

The library includes a Tailwind plugin for seamless integration:

```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('@rainforest-dev/rainforest-ui/tailwindcss/plugin')
  ]
}
```

This plugin adds:
- Component-specific utility classes
- Design token classes
- Responsive variants
- Dark mode support

### Material Design Integration

```typescript
// Using Material Design utilities
import { materialTheme } from '@rainforest-dev/rainforest-ui/themes/material';

// Apply Material Design theme
materialTheme.apply(document.documentElement);

// Generate dynamic colors from source
const theme = materialTheme.fromSource('#6750a4');
theme.apply(document.documentElement);
```

## 📖 Storybook Documentation

View the complete component documentation and interactive examples:

```bash
# Start Storybook development server
nx storybook rainforest-ui

# Build Storybook for production
nx build-storybook rainforest-ui
```

Storybook includes:
- **Interactive Examples** - Play with component props in real-time
- **Documentation** - Comprehensive usage guides and examples
- **Accessibility Testing** - Built-in a11y checks and reports
- **Design Tokens** - Visual reference for colors, spacing, and typography
- **Code Examples** - Copy-paste ready code snippets

## 🧪 Testing

### Unit Testing

```bash
# Run all tests
nx test rainforest-ui

# Run tests in watch mode
nx test rainforest-ui --watch

# Run tests with coverage
nx test rainforest-ui --coverage
```

### Visual Testing

```bash
# Run visual regression tests
nx chromatic rainforest-ui

# Update visual baselines
nx chromatic rainforest-ui --auto-accept-changes
```

### Accessibility Testing

```bash
# Run a11y tests with Storybook
nx test-storybook rainforest-ui

# Manual a11y testing with axe
npm run axe:check
```

## 📦 Build & Distribution

### Build Process

```bash
# Build for production
nx build rainforest-ui

# Analyze bundle size
nx bundle-analyzer rainforest-ui
```

The build process generates:
- **ESM build** (`dist/index.js`) - Modern ES modules
- **CJS build** (`dist/index.cjs`) - CommonJS for Node.js
- **Type definitions** (`dist/index.d.ts`) - TypeScript support
- **Framework wrappers** (`dist/react/`, `dist/vue/`) - Framework integrations
- **Tailwind plugin** (`dist/tailwindcss/`) - Styling utilities

### Package Exports

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js", 
      "default": "./dist/index.cjs"
    },
    "./lit/*": {
      "types": "./dist/lit/*.d.ts",
      "import": "./dist/lit/*.js",
      "default": "./dist/lit/*.cjs"
    },
    "./tailwindcss/*": {
      "types": "./dist/tailwindcss/*.d.ts", 
      "import": "./dist/tailwindcss/*.js",
      "default": "./dist/tailwindcss/*.cjs"
    }
  }
}
```

## 🤝 Contributing

See the main [Contributing Guide](../../CONTRIBUTING.md) for general guidelines.

### Library-Specific Guidelines

1. **Components** - Follow Lit best practices and Material Design guidelines
2. **Styling** - Use Tailwind utilities with semantic CSS custom properties
3. **Accessibility** - Ensure WCAG AA compliance for all components
4. **Testing** - Include unit tests and Storybook stories for all components
5. **Documentation** - Provide comprehensive JSDoc comments and usage examples

### Design Principles

- **Consistency** - Maintain consistent visual language across components
- **Accessibility** - Design for all users with diverse abilities
- **Performance** - Optimize for minimal bundle size and fast rendering
- **Flexibility** - Support customization without breaking core functionality
- **Standards** - Follow web standards and best practices

## 📚 Resources

### Documentation
- [Lit Documentation](https://lit.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Material Design 3](https://m3.material.io)
- [Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components)

### Tools
- [Storybook](https://storybook.js.org)
- [Web Accessibility](https://www.w3.org/WAI/WCAG21/quickref/)
- [Lit Analyzer](https://github.com/runem/lit-analyzer)

---

**Built with modern web standards and ❤️**
