# Boss Countdown Manager

Static HTML/JavaScript app for GitHub Pages. Data is stored in a Google Sheet through a Google Apps Script web app.

## Files

- `index.html`, `style.css`, `app.js`: deploy these to GitHub Pages.
- `apps-script/Code.gs`: paste this into Apps Script from your Google Sheet.

## Google Sheet Setup

1. Create a Google Sheet.
2. Open `Extensions > Apps Script`.
3. Paste `apps-script/Code.gs` into the script editor.
4. Deploy with `Deploy > New deployment > Web app`.
5. Set `Execute as` to yourself.
6. Set access to the users who should use the app, or `Anyone` if this is for public GitHub Pages.
7. Copy the Web app URL into the `SHEET_URL` variable in `index.html` before deploying.

```html
<script>
  var SHEET_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
</script>
```

The script uses the first sheet tab and expects these headers:

`Channel`, `Kundun`, `Medusa`, `Seluphan`, `Lordsilver`, `Core`, `Feara`, `Niexe`, `SOD`, `Bug`

## Time Input

When editing a boss, enter the remaining cooldown as `HHMM`.

- `1515` means the boss will spawn in 15 hours and 15 minutes.
- `0030` means the boss will spawn in 30 minutes.
- The app saves the calculated spawn moment as UTC ISO time in Google Sheets.
- Clients only see the countdown, calculated from saved UTC spawn time minus current UTC time.
