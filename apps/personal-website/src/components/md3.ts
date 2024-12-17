import { createComponent } from '@lit/react';
import { MdChipSet } from '@material/web/chips/chip-set';
import { MdFilterChip } from '@material/web/chips/filter-chip';
import React from 'react';

export const ChipSet = createComponent({
  tagName: 'md-chip-set',
  elementClass: MdChipSet,
  react: React,
});

export const FilterChip = createComponent({
  tagName: 'md-filter-chip',
  elementClass: MdFilterChip,
  react: React,
  events: {
    onClick: 'click',
  },
});
