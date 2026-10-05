'use client';

import dynamic from 'next/dynamic';

import { StudySkeleton } from '@/components/views/study/StudySkeleton';

export const LoadThreeStudy = dynamic(() => import('./ThreeStudy'), {
  ssr: false,
  loading: StudySkeleton,
});
