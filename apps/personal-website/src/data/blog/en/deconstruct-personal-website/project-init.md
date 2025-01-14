---
title: 'Project Init'
pubDate: 2024-12-19
description: 'Setting up the project for my personal website.'
author: rainforest
image:
  src: '/assets/project-init.png'
  alt: 'Project Init'
tags:
  - 'series:deconstruct-personal-website'
  - 'astro'
  - 'nx'
---

# Project Init

## NX Workspace

```bash
pnpm dlx create-nx-workspace@latest
```

## New app personal-website using Astro

```bash
pnpm create astro@latest
```

### Integrations

```bash
pnpm astro add react vue mdx
```

- Tailwind CSS v4 Beta

```bash
pnpm install -D tailwindcss@next @tailwindcss/vite@next
```

## CI with GitHub Actions and NX Cloud

## Deploy to Vercel
