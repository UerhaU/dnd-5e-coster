import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Spellbook } from './Spellbook';
import './spellbook.css';

createRoot(document.getElementById('root')!).render(<StrictMode><Spellbook /></StrictMode>);
