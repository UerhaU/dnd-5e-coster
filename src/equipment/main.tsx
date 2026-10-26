import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EquipmentPage } from './EquipmentPage';
import '../spellbook/spellbook.css';
import './equipment.css';
createRoot(document.getElementById('root')!).render(<StrictMode><EquipmentPage /></StrictMode>);
