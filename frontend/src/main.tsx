import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthShell } from './layouts/AuthShell';
import './index.css';

const raiz = document.getElementById('root');
if (!raiz) {
  throw new Error('Elemento #root não encontrado em index.html');
}

// Esta base não tem telas ainda — o roteador entra junto com o login (RF-02).
// A moldura abaixo existe para que o build, o Tailwind e o service worker
// possam ser verificados de ponta a ponta desde já.
createRoot(raiz).render(
  <StrictMode>
    <AuthShell titulo="Nutri-Hub" descricao="Aplicação em construção.">
      <p className="text-sm text-slate-600">As telas serão adicionadas nas próximas entregas.</p>
    </AuthShell>
  </StrictMode>,
);
