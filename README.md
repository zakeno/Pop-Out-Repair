# Pop-Out Repair Photos

A small phone app for logging Pre, During and Post repair photos for each tunnel segment under a UTN, then exporting them as a PDF (one page per segment) or as correctly named photos.

- No account, no login, no server. Everything runs in the browser and photos stay on the phone.
- Plain HTML, CSS and JavaScript. No build step, no dependencies. MIT licence.
- Works offline once opened the first time.

## Put it online (free, once)

The app is just static files, so any static host works. GitHub Pages:

1. Create a free GitHub account and a new repository (for example `repair-photos`).
2. Upload every file and the `icons` folder from this project to the repository.
3. Repository Settings > Pages > Deploy from a branch > `main` / root > Save.
4. After a minute your app is at `https://YOUR-NAME.github.io/repair-photos/`.

Alternatives: Netlify (drag the folder onto app.netlify.com/drop), Cloudflare Pages.
The hosted site contains only the app code, never your photos.

## Install on iPhone

1. Open the address in Safari (must be Safari).
2. Tap Share > Add to Home Screen > Add.
3. Open it from the Home Screen icon. It now works without signal.

Android: open in Chrome > menu > Install app (or Add to Home screen).

## Use

1. Add the UTN, then tap the letters for each segment repaired.
2. Tap Pre, During or Post to open the camera. Retake or remove any time.
3. Come back later and add the next stage to the same segment.
4. Save PDF, Save to Photos or Photos as ZIP. On iPhone these open the share sheet: choose Save to Files or Save Image.

## Important

- Photos are stored in the browser on this phone only. iPhones can clear browser storage if space runs low, so export each UTN when you finish it.
- Delete the app from the Home Screen or clear website data and the stored photos are gone.
- Edit the settings at the top of `app.js` (form number, PDF title) to match your form. Leave `FORM_NO_SHOWN` empty to print no form number.
- When you change any file, change `CACHE = 'repair-photos-v1'` in `sw.js` (v2, v3 ...) so phones pick up the update.

## Files

| File | Purpose |
|---|---|
| index.html, style.css | Layout and look |
| app.js | App logic and settings |
| lib.js | PDF and ZIP builders (no libraries) |
| sw.js, manifest.webmanifest, icons/ | Offline use and Home Screen install |

## v2 notes
- First run asks for FGJV CONST, FGJV QUA and SHL initials (shown on every row), name and designation. Leave SHL blank to print "Not present". Change them any time under Settings.
- Optional logo: pick an image once in Settings; it is stored on the phone only.
- Per UTN: enter expiry (item 3) and specification (item 6). Per segment: choose type (SC1, SC2, SC4, SC5, SC7, IPT) and number of repairs.
- Save PDF gives Form 0008 page 1 plus one photo page per segment. Signatures and dates are blank. No date stamps.
- Upload all files to the repo root (flat layout), including formdata.js and lib.js.
