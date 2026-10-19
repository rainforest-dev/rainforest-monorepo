'use client';

import dynamic from 'next/dynamic';

import { HallSkeleton } from '@/components/hall/HallSkeleton';

export const LoadThreeHall = dynamic(() => import('./ThreeHall'), {
  ssr: false,
  loading: HallSkeleton,
});
