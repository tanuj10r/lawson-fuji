/* The phone page's entry (m.html): loaded only when the page's own check found WebGL 2.  The mini town's plan
 * first (plan.js sets config.js to the compact Fujikawaguchikko before any builder reads it:
 * docs/decisions/mobile-lite.md, "Mobile v3"), then the game. */
import './plan.js';
import './main.js';
