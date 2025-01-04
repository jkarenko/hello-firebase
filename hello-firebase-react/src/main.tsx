import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);

// Disable StrictMode in development to prevent double mounting
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  root.render(<App />);
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
