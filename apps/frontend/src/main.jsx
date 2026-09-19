import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

/**
 * StrictMode is deliberately not used here. Its development double-invocation of
 * effects would open two camera streams and join the meeting twice, which is
 * exactly the kind of noise that makes WebRTC bugs hard to read.
 */
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
