import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { registerServiceWorker } from './serviceWorkerRegistration';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register Service Worker for Cache-First static/model assets and Network-First dynamic services
registerServiceWorker();
