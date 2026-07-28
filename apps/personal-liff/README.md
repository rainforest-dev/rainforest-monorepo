# 📱 Personal LIFF App

> A modern LINE mini-app built with Next.js, providing seamless integration with the LINE messaging platform

[![LINE LIFF](https://img.shields.io/badge/LINE-LIFF%202.26-00C300?logo=line)](https://developers.line.biz/en/docs/liff/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black?logo=next.js)](https://nextjs.org/)
[![Mantine](https://img.shields.io/badge/Mantine-8.0-339AF0?logo=mantine)](https://mantine.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)

## 🌟 Overview

Personal LIFF (LINE Front-end Framework) is a mini-application that runs inside the LINE messaging app, providing users with enhanced functionality while maintaining seamless integration with LINE's ecosystem. Built with Next.js and Mantine UI, it offers a modern, responsive experience optimized for mobile devices.

## ✨ Features

### 🚀 Core Features

- **🔗 LINE Integration** - Full LIFF SDK integration for LINE platform features
- **📱 Mobile-First** - Optimized for mobile devices and LINE's webview
- **🎨 Modern UI** - Beautiful interface with Mantine components
- **⚡ Fast Performance** - Next.js optimization with Turbo mode
- **🔒 Secure** - HTTPS support for production compliance
- **📊 Data Fetching** - SWR for efficient data management

### 📱 LINE Platform Features

- **👤 User Profile** - Access LINE user information
- **💬 Message API** - Send messages to LINE chats
- **📷 Camera Integration** - Access device camera through LINE
- **📍 Location Services** - Get user location data
- **🎵 Audio Features** - Record and play audio
- **📤 Share Functions** - Share content to LINE conversations

## 🏗️ Technology Stack

### Core Framework

- **Next.js 15.3** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development

### UI & Styling

- **Mantine 8.0** - Modern React components library
- **@mantine/hooks** - Useful React hooks collection
- **CSS Modules** - Component-scoped styling

### LINE Integration

- **@line/liff 2.26** - Official LINE Front-end Framework SDK

### Data Management

- **SWR 2.3** - Data fetching with caching and revalidation

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- LINE Developer Account
- LIFF App configured in LINE Developers Console

### LINE LIFF Setup

1. **Create LINE Developer Account**
   - Visit [LINE Developers](https://developers.line.biz/)
   - Create a new provider and channel

2. **Configure LIFF App**

   ```
   App Type: Web app
   Endpoint URL: https://yourdomain.com/liff
   Size: Full
   Scope: profile, openid, chat_message.write
   ```

3. **Get LIFF ID**
   - Copy the LIFF ID from the console
   - Add to your environment variables

### Development Setup

```bash
# From monorepo root
pnpm install

# Start development server
nx dev personal-liff

# Development server with HTTPS (required for LIFF)
nx dev personal-liff --experimental-https
```

The development server will be available at:

- HTTP: `http://localhost:9000`
- HTTPS: `https://localhost:9000` (recommended for LIFF testing)

### Environment Variables

Create `.env.local` in the app directory:

```bash
# LINE LIFF Configuration
NEXT_PUBLIC_LIFF_ID=your_liff_id_here

# API Configuration (if needed)
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
API_SECRET_KEY=your_api_secret

# Development
NEXT_PUBLIC_ENV=development
```

## 📁 Project Structure

```
apps/personal-liff/
├── pages/                   # Next.js pages (Pages Router)
│   ├── _app.tsx            # App component
│   ├── _document.tsx       # Document component
│   ├── index.tsx           # Homepage
│   └── api/                # API routes
├── hooks/                  # Custom React hooks
│   ├── useLiff.ts         # LIFF SDK hook
│   └── useLineProfile.ts  # LINE profile hook
├── components/            # React components
│   ├── ui/               # UI components
│   ├── line/             # LINE-specific components
│   └── forms/            # Form components
├── lib/                  # Utility libraries
│   ├── liff.ts          # LIFF initialization
│   └── api.ts           # API utilities
├── types/               # TypeScript type definitions
│   └── line.ts         # LINE-related types
├── styles/             # Global styles
├── public/             # Static assets
│   ├── icons/         # App icons
│   └── manifest.json  # PWA manifest
├── next.config.js     # Next.js configuration
├── package.json       # Dependencies and scripts
└── tsconfig.json      # TypeScript configuration
```

## 🛠️ Development

### Available Scripts

| Command                       | Description                          |
| ----------------------------- | ------------------------------------ |
| `nx dev personal-liff`        | Start development server (port 9000) |
| `nx build personal-liff`      | Build for production                 |
| `nx start personal-liff`      | Start production server              |
| `nx lint personal-liff`       | Lint code                            |
| `nx type-check personal-liff` | TypeScript type checking             |

### LIFF Development Workflow

1. **Initialize LIFF**

   ```typescript
   // hooks/useLiff.ts
   import { useEffect, useState } from 'react';
   import liff from '@line/liff';

   export const useLiff = () => {
     const [isReady, setIsReady] = useState(false);
     const [error, setError] = useState<string | null>(null);

     useEffect(() => {
       const initLiff = async () => {
         try {
           await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
           setIsReady(true);
         } catch (err) {
           setError(err instanceof Error ? err.message : 'LIFF init failed');
         }
       };

       initLiff();
     }, []);

     return { isReady, error, liff };
   };
   ```

2. **Get User Profile**

   ```typescript
   // hooks/useLineProfile.ts
   import { useEffect, useState } from 'react';
   import { useLiff } from './useLiff';

   export const useLineProfile = () => {
     const { isReady, liff } = useLiff();
     const [profile, setProfile] = useState(null);

     useEffect(() => {
       if (isReady && liff.isLoggedIn()) {
         liff.getProfile().then(setProfile);
       }
     }, [isReady, liff]);

     return profile;
   };
   ```

3. **Send Messages**

   ```typescript
   // lib/lineMessage.ts
   import liff from '@line/liff';

   export const sendMessage = async (text: string) => {
     if (!liff.isInClient()) {
       throw new Error('Not in LINE client');
     }

     await liff.sendMessages([
       {
         type: 'text',
         text: text,
       },
     ]);
   };
   ```

### Component Development

#### Using Mantine Components

```typescript
// components/UserProfile.tsx
import { Card, Avatar, Text, Group } from '@mantine/core';
import { useLineProfile } from '../hooks/useLineProfile';

export function UserProfile() {
  const profile = useLineProfile();

  if (!profile) {
    return <Text>Loading profile...</Text>;
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group>
        <Avatar src={profile.pictureUrl} alt={profile.displayName} />
        <div>
          <Text weight={500}>{profile.displayName}</Text>
          <Text size="sm" color="dimmed">
            {profile.statusMessage}
          </Text>
        </div>
      </Group>
    </Card>
  );
}
```

#### LIFF-Specific Components

```typescript
// components/line/ShareButton.tsx
import { Button } from '@mantine/core';
import { IconShare } from '@tabler/icons-react';
import { sendMessage } from '../../lib/lineMessage';

interface ShareButtonProps {
  message: string;
}

export function ShareButton({ message }: ShareButtonProps) {
  const handleShare = async () => {
    try {
      await sendMessage(message);
      // Show success notification
    } catch (error) {
      console.error('Failed to share message:', error);
    }
  };

  return (
    <Button
      leftIcon={<IconShare size="1rem" />}
      onClick={handleShare}
      variant="filled"
    >
      Share to LINE
    </Button>
  );
}
```

## 🔧 Configuration

### Next.js Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL', // Allow iframe embedding in LINE
          },
        ],
      },
    ];
  },

  images: {
    domains: ['profile.line-scdn.net'],
  },
};

module.exports = nextConfig;
```

### Mantine Configuration

```typescript
// pages/_app.tsx
import { MantineProvider } from '@mantine/core';
import { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider
      withGlobalStyles
      withNormalizeCSS
      theme={{
        colorScheme: 'light',
      }}
    >
      <Component {...pageProps} />
    </MantineProvider>
  );
}
```

## 🧪 Testing

### LIFF Testing

1. **Desktop Testing**

   ```bash
   # Start with HTTPS for LIFF compatibility
   nx dev personal-liff --experimental-https
   ```

2. **Mobile Testing**
   - Use ngrok or similar tunneling service
   - Test in actual LINE client
   - Use LINE's LIFF browser for debugging

3. **Test Checklist**
   - [ ] LIFF initialization
   - [ ] User profile access
   - [ ] Message sending
   - [ ] Camera/media access
   - [ ] Responsive design
   - [ ] Error handling

## 🚀 Deployment

### Build Process

```bash
# Production build
nx build personal-liff

# Build outputs to .next/
```

### Vercel Deployment

1. **Environment Variables**

   ```bash
   # Production environment variables
   NEXT_PUBLIC_LIFF_ID=prod_liff_id
   NEXT_PUBLIC_API_BASE_URL=https://api.production.com
   ```

2. **Deployment Configuration**
   ```json
   // vercel.json
   {
     "framework": "nextjs",
     "regions": ["hnd1"],
     "functions": {
       "pages/api/**": {
         "maxDuration": 30
       }
     }
   }
   ```

### LIFF URL Configuration

Update LIFF endpoint URL in LINE Developers Console:

```
Production URL: https://your-domain.vercel.app
```

## 🔒 Security & Privacy

### Data Protection

- **No sensitive data storage** - Use LINE's secure platform
- **HTTPS only** - All communication encrypted
- **Minimal permissions** - Request only necessary scopes
- **User consent** - Clear permission requests

### Privacy Compliance

- **Data minimization** - Collect only required data
- **User control** - Allow users to manage their data
- **Transparency** - Clear privacy policy
- **Compliance** - Follow LINE's privacy guidelines

## 📱 LINE Platform Guidelines

### Design Guidelines

- **Mobile-first** - Optimize for mobile screens
- **LINE design** - Follow LINE's UI patterns
- **Loading states** - Handle network delays gracefully
- **Error handling** - Provide clear error messages

### Performance Guidelines

- **Fast loading** - Optimize initial page load
- **Smooth interactions** - 60fps animations
- **Efficient API calls** - Use SWR for caching
- **Memory management** - Clean up resources

## 🤝 Contributing

See the main [Contributing Guide](../../CONTRIBUTING.md) for general guidelines.

### LIFF-Specific Guidelines

1. **Testing** - Always test in actual LINE client
2. **HTTPS** - Use HTTPS for all LIFF development
3. **Permissions** - Request minimal required permissions
4. **Error Handling** - Gracefully handle LINE client unavailability
5. **Performance** - Optimize for mobile network conditions

## 📚 Resources

### LINE Documentation

- [LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [LIFF SDK Reference](https://developers.line.biz/en/reference/liff/)
- [LINE Design Guidelines](https://designsystem.line.me/)

### Framework Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Mantine Documentation](https://mantine.dev/)
- [SWR Documentation](https://swr.vercel.app/)

### Tools

- [LIFF Inspector](https://developers.line.biz/console/)
- [LINE Bot Designer](https://developers.line.biz/en/services/bot-designer/)

---

**Built for the LINE ecosystem with modern web technologies 🚀**
