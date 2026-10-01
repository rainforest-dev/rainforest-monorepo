import { connection } from 'next/server';
import { Suspense } from 'react';

import { FilterPanel } from '@/components/library';
import { getFilterOptions, listDeliveryPlatforms } from '@/lib/server';

export default function FiltersSlot() {
  return (
    <Suspense fallback={null}>
      <FiltersContent />
    </Suspense>
  );
}

async function FiltersContent() {
  await connection();
  const [options, platforms] = await Promise.all([
    getFilterOptions(),
    listDeliveryPlatforms(),
  ]);
  return <FilterPanel options={options} platforms={platforms} />;
}
