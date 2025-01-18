import { createComponent } from '@lit/react';
import { MdChipSet } from '@material/web/chips/chip-set';
import { MdFilterChip } from '@material/web/chips/filter-chip';
import { MdOutlinedSelect } from '@material/web/select/outlined-select';
import { MdSelectOption } from '@material/web/select/select-option';
import { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field';
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

export const OutlinedTextField = createComponent({
  tagName: 'md-outlined-text-field',
  elementClass: MdOutlinedTextField,
  react: React,
});

export const SelectOption = createComponent({
  tagName: 'md-select-option',
  elementClass: MdSelectOption,
  react: React,
});

export const OutlinedSelect = createComponent({
  tagName: 'md-outlined-select',
  elementClass: MdOutlinedSelect,
  react: React,
  events: {
    onChange: 'change',
  },
});
