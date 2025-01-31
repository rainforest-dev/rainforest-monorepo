import md3 from '../../tailwindcss/md3';

export default {
  plugins: [
    md3({
      modules: {
        colors: {
          enabled: true,
          addDefaultTheme: false,
        },
      },
    }),
  ],
};
