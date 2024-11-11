<template>
  <nav
    class="fixed top-0 inset-x-0 text-on-surface h-16 px-10 flex-row-center justify-between"
  >
    <div></div>
    <ul class="flex-row-center gap-10">
      <li>
        <a href="#experience" @click="handleClick">Experience</a>
      </li>
      <li>
        <a href="#skills" @click="handleClick">Skills</a>
      </li>
    </ul>
  </nav>
</template>
<script lang="ts" setup>
const handleClick = () => {
  // remove the anchor part of the URL after clicking on a link after 300ms
  requestAnimationFrame(() => {
    window.history.replaceState(
      null,
      '',
      window.location.href.replace(window.location.hash, '')
    );
  });
};
</script>
