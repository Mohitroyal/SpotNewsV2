import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// TEST app only: a small orange label so nobody confuses it with the real app
if (import.meta.env.VITE_APP_ENV === 'test') {
  const tag = document.createElement('div');
  tag.textContent = 'TEST';
  tag.setAttribute('style', 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 4px);left:50%;transform:translateX(-50%);z-index:99999;background:#F97316;color:#fff;font:800 12px/1 system-ui,sans-serif;letter-spacing:1px;padding:4px 10px;border-radius:999px;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.3)');
  document.body.appendChild(tag);
}
