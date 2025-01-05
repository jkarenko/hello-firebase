import React from 'react';
import { createRoot } from 'react-dom/client';
import { NextUIProvider } from '@nextui-org/react';
import './index.css';
import App from './App';

const root = createRoot(document.getElementById('root')!);

// Disable StrictMode in development to prevent double mounting
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  root.render(
    <NextUIProvider>
      <App />
    </NextUIProvider>
  );
} else {
  root.render(
    <React.StrictMode>
      <NextUIProvider>
        <App />
      </NextUIProvider>
    </React.StrictMode>
  );
}
