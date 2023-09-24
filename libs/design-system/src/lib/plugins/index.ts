import plugin from 'tailwindcss/plugin';

export const utils = plugin(({ addVariant, addUtilities }) => {
  addVariant('child', '& > *');
  addVariant('recursively', '& *');
  addVariant('radio-enabled', 'input[type=radio]:enabled + &');
  addVariant('radio-disabled', 'input[type=radio]:disabled + &');
  addVariant('radio-checked', 'input[type=radio]:enabled:checked + &');

  addUtilities({
    '.full': {
      width: '100%',
      height: '100%',
    },
    '.absolute-full': {
      position: 'absolute',
      top: '0',
      bottom: '0',
      left: '0',
      right: '0',
    },
    '.fixed-full': {
      position: 'fixed',
      top: '0',
      bottom: '0',
      left: '0',
      right: '0',
    },
    '.flex-center': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '.flex-row-center': {
      display: 'flex',
      alignItems: 'center',
    },
    '.flex-col-center': {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    '.absolute-center': {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    },
    '.fixed-center': {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    },
  });
});
