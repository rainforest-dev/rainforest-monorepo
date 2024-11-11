<template>
  <div class="w-full grid grid-cols-4 gap-1">
    <ul class="flex flex-col *:odd:h-28 *:even:h-8 text-sm *:p-1">
      <li class="bg-primary text-on-primary">Primary</li>
      <li class="bg-on-primary text-primary">On Primary</li>
      <li class="bg-primary-container text-on-primary-container">
        Primary Container
      </li>
      <li class="bg-on-primary-container text-primary-container">
        On Primary Container
      </li>
    </ul>
    <ul class="flex flex-col *:odd:h-28 *:even:h-8 text-sm *:p-1">
      <li class="bg-secondary text-on-secondary">Secondary</li>
      <li class="bg-on-secondary text-secondary">On Secondary</li>
      <li class="bg-secondary-container text-on-secondary-container">
        Secondary Container
      </li>
      <li class="bg-on-secondary-container text-secondary-container">
        On Secondary Container
      </li>
    </ul>
    <ul class="flex flex-col *:odd:h-28 *:even:h-8 text-sm *:p-1">
      <li class="bg-tertiary text-on-tertiary">Tertiary</li>
      <li class="bg-on-tertiary text-tertiary">On Tertiary</li>
      <li class="bg-tertiary-container text-on-tertiary-container">
        Tertiary Container
      </li>
      <li class="bg-on-tertiary-container text-tertiary-container">
        On Tertiary Container
      </li>
    </ul>
    <ul class="flex flex-col *:odd:h-28 *:even:h-8 text-sm *:p-1">
      <li class="bg-error text-on-error">Error</li>
      <li class="bg-on-error text-error">On Error</li>
      <li class="bg-error-container text-on-error-container">
        Error Container
      </li>
      <li class="bg-on-error-container text-error-container">
        On Error Container
      </li>
    </ul>
  </div>
  <ul class="w-full grid grid-cols-4 *:h-10 text-sm *:p-1">
    <li class="bg-outline text-surface">Outline</li>
    <li class="bg-outline-variant text-on-surface">Outline Variant</li>
    <li class="bg-surface text-on-surface">Surface</li>
    <li class="bg-on-surface text-surface">On Surface</li>
    <li class="bg-surface-variant text-on-surface-variant">Surface Variant</li>
    <li class="bg-on-surface-variant text-surface-variant">
      On Surface Variant
    </li>
    <li class="bg-inverse-surface text-inverse-on-surface">Inverse Surface</li>
    <li class="bg-inverse-on-surface text-inverse-surface">
      Inverse On Surface
    </li>
    <li class="bg-inverse-primary text-on-surface">Inverse Primary</li>
  </ul>
</template>
