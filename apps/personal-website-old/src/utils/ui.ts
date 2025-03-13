export const removeUrlHashAfterNavigation = () => {
  // remove the anchor part of the URL after clicking on a link after 300ms
  requestAnimationFrame(() => {
    window.history.replaceState(
      null,
      '',
      window.location.href.replace(window.location.hash, '')
    );
  });
};
