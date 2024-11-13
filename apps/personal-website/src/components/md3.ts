import { createComponent } from '@lit/react';
import { MdFilterChip } from '@material/web/chips/filter-chip';
import React from 'react';

export const FilterChip = createComponent({
  tagName: 'md-filter-chip',
  elementClass: MdFilterChip,
  react: React,
  events: {
    onClick: 'click',
  },
});
