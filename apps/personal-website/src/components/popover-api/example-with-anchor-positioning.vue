<template>
  <div class="w-full border h-40 flex items-center justify-center *:border relative">
    <button :popovertarget="name">Open Popover</button>

    <div :id="name" popover>
      <p>
        I am a popover with more information. Hit <kbd>esc</kbd> or click away to
        close me.
      </p>
    </div>
  </div>
</template>
<script setup>
const name = 'example-with-anchor-positioning'
</script>
<style scoped>
button {
  anchor-name: --anchor;
}

[popover] {
  inset: auto;
  position: absolute;
  position-anchor: --anchor;
  bottom: anchor(top);
  left: anchor(right);

}
</style>