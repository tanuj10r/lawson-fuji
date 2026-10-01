/* The phone page's entry (m.html).  The mini town's plan first (plan.js sets config.js to the compact
 * Fujikawaguchikko before any builder reads it: docs/decisions/mobile-lite.md, "Mobile v3"), then the game. */
import './plan.js';

import('./main.js');
