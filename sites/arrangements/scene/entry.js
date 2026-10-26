import {start} from './main.js';
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(typeof DEBUG !== 'undefined' && DEBUG)); else start(typeof DEBUG !== 'undefined' && DEBUG);
