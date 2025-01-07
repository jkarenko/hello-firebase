import React from 'react';
import { createRoot } from 'react-dom/client';
import { NextUIProvider } from '@nextui-org/react';
import './index.css';
import App from './App';
import { initializeFirebase } from './firebase';
import { BrowserRouter } from 'react-router-dom';

// Initialize Firebase first
initializeFirebase();

const root = createRoot(document.getElementById('root')!);

// Disable StrictMode in development to prevent double mounting
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  root.render(
    <BrowserRouter>
      <NextUIProvider>
        <App />
      </NextUIProvider>
    </BrowserRouter>
  );
} else {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <NextUIProvider>
          <App />
        </NextUIProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
