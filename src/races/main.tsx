import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RacesPage } from './RacesPage';
import '../spellbook/spellbook.css';
import './races.css';
createRoot(document.getElementById('root')!).render(<StrictMode><RacesPage/></StrictMode>);
