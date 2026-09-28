import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { SessaoProvider } from './auth/SessaoProvider';
// Serifada dos títulos, empacotada no build (e pré-cacheada pelo service
// worker) em vez de vir do Google Fonts: nada de requisição a terceiros no
// primeiro carregamento (RNF-04). Só o subconjunto latino, que cobre o português.
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './index.css';

const raiz = document.getElementById('root');
if (!raiz) {
  throw new Error('Elemento #root não encontrado em index.html');
}

// BrowserRouter (e não HashRouter) porque o staticwebapp.config.json já faz o
// fallback de navegação para /index.html no Azure. As future flags adotam desde
// já o comportamento do v7 e silenciam os avisos de migração.
createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SessaoProvider>
        <App />
      </SessaoProvider>
    </BrowserRouter>
  </StrictMode>,
);
