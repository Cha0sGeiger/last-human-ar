# Last (Hu)man Standing — AR poster

WebAR companion for the In the Loop AI meetup poster (10 Nov 2026, HUB385 Zagreb).
Scan the QR code on `print/poster-print.png`, tap **Pokreni AR kameru**, and point the phone at the poster.

- `index.html`, `app.js` — landing page + MindAR image tracking (three.js)
- `assets/poster.mind` — compiled image target. **Recompile it if the poster artwork changes**, or tracking breaks.
- `print/poster-print.png` — 2160×2700 poster with the QR code, matching the target.
