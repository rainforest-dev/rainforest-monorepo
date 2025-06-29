# <a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a> Rainforest's Monorepo

> A modern, full-stack TypeScript monorepo featuring personal projects with cutting-edge web technologies

[![Website](https://img.shields.io/badge/website-rainforest.tools-blue)](https://rainforest.tools)
[![Built with Nx](https://img.shields.io/badge/built%20with-Nx-143055.svg?logo=nx)](https://nx.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange?logo=pnpm)](https://pnpm.io/)

## 🏗️ Architecture Overview

This monorepo contains a collection of modern web applications and reusable libraries, all built with TypeScript and managed by Nx. The architecture follows domain-driven design principles with clear separation between applications and shared libraries.

### 📱 Applications

| Project | Description | Tech Stack | Status |
|---------|-------------|------------|--------|
| **[personal-website](./apps/personal-website/)** | Advanced personal portfolio with AI/ML capabilities | Astro, React, Vue, Lit, PWA | ✅ Active |
| **[personal-liff](./apps/personal-liff/)** | LINE mini-app for mobile integration | Next.js, LIFF, Mantine UI | ✅ Active |
| **[personal-liff-e2e](./apps/personal-liff-e2e/)** | End-to-end testing suite for LIFF app | Cypress, Nx | ✅ Active |

### 📚 Libraries

| Project | Description | Tech Stack | Status |
|---------|-------------|------------|--------|
| **[rainforest-ui](./libs/rainforest-ui/)** | Modern UI component library | Lit, Tailwind CSS, Storybook | ✅ Active |

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (recommended package manager)
- **Git** for version control

### Installation

```bash
# Clone the repository
git clone https://github.com/rainforest-dev/rainforest-monorepo.git
cd rainforest-monorepo

# Install dependencies
pnpm install

# Start all development servers
pnpm dev
```

### Development Workflow

```bash
# Start specific app development
nx dev personal-website
nx dev personal-liff

# Build all projects
nx run-many -t build

# Run tests across all projects
nx run-many -t test

# Lint and format code
nx run-many -t lint
nx format:write
```

## 🛠️ Technology Stack

### Core Technologies
- **Framework**: Nx Monorepo
- **Language**: TypeScript 5.8+
- **Package Manager**: pnpm with workspaces
- **Build Tools**: Vite, Astro, Next.js

### Frontend Technologies
- **Astro** - Static site generation with component islands
- **Next.js** - React framework for production
- **Lit** - Lightweight web components
- **React** - UI library for interactive components
- **Vue** - Progressive framework for UIs
- **Tailwind CSS** - Utility-first CSS framework

### Advanced Features
- **AI/ML Integration** - Web LLM capabilities
- **PWA Support** - Offline-first applications
- **Internationalization** - Multi-language support
- **LINE Integration** - LIFF platform for mobile apps
- **Material Design** - Google's design system

## 📋 Project Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all development servers |
| `pnpm build` | Build all projects for production |
| `pnpm test` | Run tests across all projects |
| `pnpm lint` | Lint all code |
| `pnpm format` | Format code with Prettier |
| `pnpm nx graph` | View dependency graph |
| `pnpm nx release` | Version and release packages |

## 🏃‍♂️ Development Commands

### Running Individual Projects

```bash
# Personal Website (Astro)
nx dev personal-website        # Development server
nx build personal-website      # Production build
nx preview personal-website    # Preview production build

# Personal LIFF App (Next.js)
nx dev personal-liff          # Development server with HTTPS
nx build personal-liff        # Production build
nx start personal-liff        # Production server

# UI Library
nx build rainforest-ui        # Build library
nx storybook rainforest-ui    # Start Storybook
```

### Testing

```bash
# Run all tests
nx run-many -t test

# Run specific project tests
nx test rainforest-ui
nx e2e personal-liff-e2e

# Test with coverage
nx test rainforest-ui --coverage
```

## 🔧 Development Tools

### Code Quality
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking
- **Nx** - Monorepo management and build optimization

### Testing
- **Vitest** - Unit testing framework
- **Cypress** - End-to-end testing
- **Storybook** - Component testing and documentation

### CI/CD
- **GitHub Actions** - Continuous integration
- **Vercel** - Deployment platform
- **Nx Cloud** - Build caching and distribution

## 📁 Project Structure

```
rainforest-monorepo/
├── apps/                          # Applications
│   ├── personal-website/          # Astro personal portfolio
│   ├── personal-liff/             # LINE LIFF mini-app
│   └── personal-liff-e2e/         # E2E tests for LIFF
├── libs/                          # Shared libraries
│   └── rainforest-ui/             # UI component library
├── .github/                       # GitHub workflows
├── .devcontainer/                 # Development container config
├── .vscode/                       # VS Code configuration
├── nx.json                        # Nx workspace configuration
├── package.json                   # Root package configuration
├── pnpm-workspace.yaml           # pnpm workspace configuration
└── tsconfig.base.json            # TypeScript base configuration
```

## 🌐 Deployment

### Production Builds

All applications are optimized for production deployment:

- **personal-website**: Deployed to Vercel with SSG optimization
- **personal-liff**: Deployed to Vercel with serverless functions
- **rainforest-ui**: Published to npm registry

### Environment Variables

Required environment variables for development:

```bash
# Copy environment template
cp .env.example .env.local

# Configure your environment variables
# See individual app READMEs for specific requirements
```

## 🤝 Contributing

We welcome contributions! Please see our [contributing guidelines](./CONTRIBUTING.md) for details.

### Development Process

1. **Fork** the repository
2. **Create** a feature branch from `main`
3. **Make** your changes with tests
4. **Ensure** all checks pass
5. **Submit** a pull request

### Code Standards

- Follow TypeScript strict mode
- Use conventional commit messages
- Maintain test coverage above 80%
- Update documentation for API changes

## 📖 Documentation

Each module has comprehensive documentation:

- **[Personal Website](./apps/personal-website/README.md)** - Portfolio site with AI capabilities
- **[Personal LIFF](./apps/personal-liff/README.md)** - LINE mini-app development
- **[Rainforest UI](./libs/rainforest-ui/README.md)** - Component library usage

## 🔗 Useful Links

### Nx Resources
- [Learn more about Nx](https://nx.dev/nx-api/js?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Community
- [Discord](https://go.nx.dev/community)
- [Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl)
- [YouTube](https://www.youtube.com/@nxdevtools)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

**Built with ❤️ by Rainforest Dev**
