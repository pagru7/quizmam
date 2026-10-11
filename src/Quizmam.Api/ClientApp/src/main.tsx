import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import './index.css';
import App from './App.tsx';

const theme = createTheme({
  palette: {
    primary: { main: '#2f62f4' },
    background: { default: '#f3f5fb' },
  },
  shape: { borderRadius: 10 },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
