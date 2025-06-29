# 🤝 Contributing to Rainforest Monorepo

Thank you for your interest in contributing to the Rainforest Monorepo! This guide will help you get started with contributing to our collection of modern web applications and libraries.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Security](#security)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

**Positive behaviors include:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behaviors include:**
- Harassment of any kind
- Discriminatory language or actions
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (recommended package manager)
- **Git** for version control

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/rainforest-monorepo.git
   cd rainforest-monorepo
   ```

3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/rainforest-dev/rainforest-monorepo.git
   ```

### Initial Setup

```bash
# Install dependencies
pnpm install

# Verify everything works
pnpm build

# Run tests
pnpm test
```

## 🔄 Development Workflow

### Branch Strategy

We use a **feature branch workflow**:

1. **main** - Production-ready code
2. **feature/*** - New features
3. **fix/*** - Bug fixes  
4. **docs/*** - Documentation updates
5. **refactor/*** - Code refactoring
6. **perf/*** - Performance improvements

### Creating a Feature Branch

```bash
# Ensure you're on main and up to date
git checkout main
git pull upstream main

# Create and switch to feature branch
git checkout -b feature/amazing-new-feature

# Make your changes and commit
git add .
git commit -m "feat: add amazing new feature"

# Push to your fork
git push origin feature/amazing-new-feature
```

### Staying Up to Date

```bash
# Fetch latest changes from upstream
git fetch upstream

# Rebase your feature branch
git checkout feature/your-feature-branch
git rebase upstream/main
```

## 📁 Project Structure

Understanding the monorepo structure will help you contribute effectively:

```
rainforest-monorepo/
├── apps/                          # Applications
│   ├── personal-website/          # Astro personal portfolio
│   ├── personal-liff/             # LINE LIFF mini-app
│   └── personal-liff-e2e/         # E2E tests for LIFF
├── libs/                          # Shared libraries
│   └── rainforest-ui/             # UI component library
├── .github/                       # GitHub workflows and templates
├── .devcontainer/                 # Development container config
├── .vscode/                       # VS Code configuration
├── tools/                         # Build tools and utilities
├── nx.json                        # Nx workspace configuration
├── package.json                   # Root package configuration
├── pnpm-workspace.yaml           # pnpm workspace configuration
└── tsconfig.base.json            # TypeScript base configuration
```

### Working with Specific Projects

#### Personal Website (Astro)
```bash
# Start development server
nx dev personal-website

# Build for production
nx build personal-website

# Run type checking
nx check personal-website
```

#### Personal LIFF App (Next.js)
```bash
# Start development server with HTTPS
nx dev personal-liff

# Build for production
nx build personal-liff

# Start production server
nx start personal-liff
```

#### Rainforest UI Library (Lit)
```bash
# Build the library
nx build rainforest-ui

# Start Storybook
nx storybook rainforest-ui

# Run unit tests
nx test rainforest-ui
```

## 💻 Coding Standards

### TypeScript

We use **strict TypeScript** across all projects:

```typescript
// ✅ Good: Explicit types and proper naming
interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
}

function getUserProfile(userId: string): Promise<UserProfile> {
  return fetchUserData(userId);
}

// ❌ Bad: Any types and unclear naming
function getData(id: any): any {
  return fetch(id);
}
```

### Code Style

We use **ESLint** and **Prettier** for consistent formatting:

```bash
# Lint all code
nx run-many -t lint

# Format all code
nx format:write

# Check formatting
nx format:check
```

### Naming Conventions

- **Variables/Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Files**: `kebab-case.extension`
- **Components**: `PascalCase.extension`

```typescript
// ✅ Good naming
const userProfile = getUserProfile();
interface UserData { }
const API_BASE_URL = 'https://api.example.com';

// Component files
UserProfile.tsx
user-profile.component.ts
```

### Import Organization

Organize imports in this order:

```typescript
// 1. Node.js built-ins
import { readFile } from 'fs/promises';

// 2. External libraries
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// 3. Internal libraries (from this monorepo)
import { RfButton } from '@rainforest-dev/rainforest-ui';

// 4. Relative imports
import { validateInput } from '../utils/validation';
import { UserService } from './user.service';
```

## 🧪 Testing Guidelines

### Testing Strategy

We maintain **comprehensive test coverage** across all projects:

- **Unit Tests**: Individual functions and components
- **Integration Tests**: Multiple components working together
- **E2E Tests**: Full user workflows
- **Visual Tests**: Component appearance and interactions

### Writing Tests

#### Unit Tests (Vitest)

```typescript
// utils/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail } from './validation';

describe('validateEmail', () => {
  it('should return true for valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user+tag@domain.co.uk')).toBe(true);
  });

  it('should return false for invalid emails', () => {
    expect(validateEmail('invalid-email')).toBe(false);
    expect(validateEmail('test@')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail(null)).toBe(false);
  });
});
```

#### Component Tests (Lit)

```typescript
// components/button.test.ts
import { expect, test } from '@storybook/test';
import { render, fireEvent } from '@testing-library/lit';
import './button';

test('renders button with correct variant', () => {
  const { container } = render('<rf-button variant="primary">Click me</rf-button>');
  const button = container.querySelector('rf-button');
  
  expect(button).toBeInTheDocument();
  expect(button).toHaveAttribute('variant', 'primary');
  expect(button).toHaveTextContent('Click me');
});

test('handles click events', async () => {
  let clicked = false;
  const { container } = render('<rf-button>Click me</rf-button>');
  const button = container.querySelector('rf-button');
  
  button.addEventListener('click', () => { clicked = true; });
  await fireEvent.click(button);
  
  expect(clicked).toBe(true);
});
```

#### E2E Tests (Cypress)

```typescript
// cypress/e2e/user-flow.cy.ts
describe('User Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should allow user to log in', () => {
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="submit-button"]').click();
    
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-menu"]').should('be.visible');
  });
});
```

### Running Tests

```bash
# Run all tests
nx run-many -t test

# Run tests for specific project
nx test rainforest-ui
nx e2e personal-liff-e2e

# Run tests in watch mode
nx test rainforest-ui --watch

# Generate coverage report
nx test rainforest-ui --coverage
```

### Test Requirements

- **Coverage**: Maintain > 80% code coverage
- **Test Types**: Include unit, integration, and E2E tests
- **Edge Cases**: Test error conditions and edge cases
- **Accessibility**: Include a11y tests for UI components
- **Performance**: Test for performance regressions

## 📖 Documentation

### Documentation Standards

Good documentation is essential for maintainability:

#### Code Documentation

```typescript
/**
 * Validates an email address using RFC 5322 specification
 * 
 * @param email - The email address to validate
 * @returns True if email is valid, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = validateEmail('test@example.com'); // true
 * const isInvalid = validateEmail('invalid'); // false
 * ```
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

#### Component Documentation

```typescript
/**
 * @element rf-button
 * 
 * @summary A customizable button component with multiple variants and sizes
 * 
 * @description
 * The Button component provides a consistent interface for user actions.
 * It supports multiple visual variants, sizes, and states including loading
 * and disabled states.
 * 
 * @prop {string} variant - Button visual variant
 * @prop {string} size - Button size
 * @prop {boolean} disabled - Whether button is disabled
 * @prop {boolean} loading - Whether button shows loading state
 * 
 * @event {CustomEvent} click - Fired when button is clicked
 * 
 * @slot - Button content
 * 
 * @csspart button - The button element
 * @csspart icon - The icon container
 * 
 * @example
 * ```html
 * <rf-button variant="primary" size="medium">
 *   Click me
 * </rf-button>
 * ```
 */
@customElement('rf-button')
export class Button extends LitElement {
  // Implementation...
}
```

#### README Updates

When adding new features, update relevant README files:

- Root README for monorepo-wide changes
- App-specific READMEs for application features
- Library README for new components or APIs

### Storybook Documentation

For UI components, provide comprehensive Storybook stories:

```typescript
// button.stories.ts
import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';

const meta: Meta = {
  title: 'Components/Button',
  component: 'rf-button',
  parameters: {
    docs: {
      description: {
        component: 'A versatile button component with multiple variants and states.'
      }
    }
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
      description: 'Visual style variant'
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      description: 'Button size'
    }
  }
};

export const Interactive: Story = {
  args: {
    variant: 'primary',
    size: 'medium'
  },
  render: (args) => html`
    <rf-button variant=${args.variant} size=${args.size}>
      ${args.children || 'Button Text'}
    </rf-button>
  `
};
```

## 🔄 Pull Request Process

### Before Submitting

Ensure your contribution meets these requirements:

- [ ] **Code Quality**: Passes all linting and formatting checks
- [ ] **Tests**: All tests pass and coverage is maintained
- [ ] **Documentation**: Code is properly documented
- [ ] **Type Safety**: No TypeScript errors
- [ ] **Functionality**: Changes work as expected

```bash
# Pre-submission checklist
nx run-many -t lint test build
nx format:check
```

### Pull Request Template

Use this template for your PRs:

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
Include screenshots for UI changes.

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added for new functionality
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Peer Review**: At least one maintainer reviews the code
3. **Testing**: Manual testing for complex changes
4. **Approval**: Approved changes are merged by maintainers

### Commit Message Format

We follow **Conventional Commits** specification:

```bash
# Format: <type>(<scope>): <description>

# Examples:
feat(ui): add new button component
fix(website): resolve mobile navigation issue
docs(readme): update installation instructions
refactor(api): optimize data fetching logic
perf(ui): improve component rendering performance
test(button): add accessibility tests
chore(deps): update dependencies
```

**Types:**
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

## 🐛 Issue Reporting

### Bug Reports

When reporting bugs, include:

```markdown
**Describe the bug**
Clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
Clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. macOS 12.0]
 - Browser: [e.g. Chrome 95]
 - Node.js version: [e.g. 18.0.0]
 - Project version: [e.g. 1.0.0]

**Additional context**
Any other context about the problem.
```

### Feature Requests

For feature requests, provide:

```markdown
**Is your feature request related to a problem?**
Clear description of the problem.

**Describe the solution you'd like**
Clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Any other context or screenshots about the feature request.
```

### Security Issues

**Do not create public issues for security vulnerabilities.** Instead, email us directly at security@rainforest.dev with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## 🛠️ Development Environment

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint", 
    "ms-vscode.vscode-typescript-next",
    "nrwl.angular-console",
    "runem.lit-plugin",
    "ms-playwright.playwright"
  ]
}
```

### Development Container

Use the provided dev container for consistent development environment:

```bash
# Open in VS Code with Dev Containers extension
code .

# Or use GitHub Codespaces
gh codespace create
```

### Environment Variables

Copy environment templates:

```bash
# Root environment
cp .env.example .env.local

# App-specific environments
cp apps/personal-website/.env.example apps/personal-website/.env.local
cp apps/personal-liff/.env.example apps/personal-liff/.env.local
```

## 🚀 Deployment

### CI/CD Pipeline

Our GitHub Actions workflow automatically:

1. **Runs tests** on all PRs
2. **Builds applications** to verify compilation
3. **Deploys previews** for visual testing
4. **Deploys to production** when merged to main

### Manual Deployment

For maintainers with deployment access:

```bash
# Build all applications
nx run-many -t build

# Deploy specific application
nx deploy personal-website
nx deploy personal-liff

# Release library version
nx release
```

## 📞 Getting Help

Need help contributing? Here are ways to get support:

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Create issues for bugs and feature requests
- **Discord**: Join our community Discord (link in main README)
- **Email**: Contact maintainers at contribute@rainforest.dev

## 📜 License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

**Thank you for contributing to Rainforest Monorepo! 🌟**

Your contributions help make this project better for everyone. We appreciate your time and effort in improving our codebase, documentation, and community.
