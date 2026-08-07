import React from 'react';
import ReactDOM from 'react-dom/client';
import BigChillApp from './BigChillApp.jsx';
import { registerServiceWorker } from './pwa.js';
import './bigchill.css';

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BigChillApp />
  </React.StrictMode>
);
