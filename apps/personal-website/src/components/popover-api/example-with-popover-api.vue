<template>
  <div class="w-full border h-40 flex items-center justify-center *:border">
    <button popovertarget="my-popover">Open Popover</button>

    <div id="my-popover" popover class="top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2">
      <p>
        I am a popover with more information. Hit <kbd>esc</kbd> or click away to
        close me.
      </p>
    </div>
  </div>
</template>
