'use client';

import dynamic from 'next/dynamic';

import { HallSkeleton } from '@/components/views/hall/HallSkeleton';

export const LoadThreeHall = dynamic(() => import('./ThreeHall'), {
  ssr: false,
  loading: HallSkeleton,
});
