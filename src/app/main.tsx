import { render } from 'preact';
import '../ui/base.css';
import { Shell } from '../ui/Shell.tsx';
import { registerServiceWorker } from './registerServiceWorker.ts';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');

render(<Shell />, root);
registerServiceWorker();
