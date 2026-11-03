import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import StatutReseau from './components/StatutReseau.jsx'
import MiseAJour from './components/MiseAJour.jsx'
import './theme/globals.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <StatutReseau />
      <MiseAJour />
    </BrowserRouter>
  </StrictMode>,
)