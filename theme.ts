
  "use client";
  import { createTheme } from '@mui/material/styles';

  const theme = createTheme({
    cssVariables: {
      colorSchemeSelector: 'data-toolpad-color-scheme',
    },
    colorSchemes: { light: true, dark: true },
    breakpoints: {
    values: {
      xs: 0,
      sm: 500,    // custom value (default is 600)
      md: 800,    // custom value (default is 900)
      lg: 1200,   // you can change these too
      xl: 1536,
    },
  },
  });

  export default theme;
  