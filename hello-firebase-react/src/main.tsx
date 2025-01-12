import React from 'react';
import { createRoot } from 'react-dom/client';
import { NextUIProvider } from '@nextui-org/react';
import { Toaster } from 'sonner';
import './index.css';
import App from './App';
import { initializeFirebase } from './firebase';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Initialize Firebase first
initializeFirebase();

const root = createRoot(document.getElementById('root')!);

// Create a container for modals outside the root
const modalContainer = document.createElement('div');
modalContainer.id = 'modal-container';
document.body.appendChild(modalContainer);

// Disable StrictMode in development to prevent double mounting
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  root.render(
    <BrowserRouter>
      <NextUIProvider>
        <NextThemesProvider attribute="class" defaultTheme="light">
          <App />
          <Toaster richColors closeButton position="top-right" />
        </NextThemesProvider>
      </NextUIProvider>
    </BrowserRouter>
  );
} else {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <NextUIProvider>
          <NextThemesProvider attribute="class" defaultTheme="light">
            <App />
            <Toaster richColors closeButton position="top-right" />
          </NextThemesProvider>
        </NextUIProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
