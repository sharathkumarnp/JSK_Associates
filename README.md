# JSK Associates – Customer Order Form

A lightweight web form to capture customer orders with:
- Auto‑expanding items list & live totals
- Sales Executive field
- Invoice **preview modal** and **PDF print** (prints only the invoice, not the whole page)
- Google Sheets backend via Apps Script
- Ready for GitHub Pages hosting

## Repo Structure
```
/assets/logo.png           # place your logo here
/index.html                # main app
/scripts/apps_script.gs    # Google Apps Script backend
/README.md
```

## 1) Google Sheet
Create a spreadsheet and copy its **Sheet ID** (between `/d/` and `/edit` in the URL). Create two tabs:
- `Orders`
- `OrderItems`
Headers are auto‑created by the script if the tabs are empty.

## 2) Apps Script
Open your Sheet → **Extensions → Apps Script** → paste `scripts/apps_script.gs`.  
Edit: `const SHEET_ID = 'PUT_YOUR_SHEET_ID_HERE'` → replace with your ID.

**Deploy:**
- Deploy → **New deployment** → **Web app**
- **Execute as:** *Me*
- **Who has access:** *Anyone*
- Copy the `/exec` URL and put it into `index.html` at the `WEB_APP_URL` constant.

## 3) Logo
Save your logo as `assets/logo.png`. (PNG/SVG recommended).

## 4) Host on GitHub Pages
- Create a **public** repo, e.g. `jsk-order-form`
- Commit these files
- Settings → Pages → **Deploy from a branch**, `main` branch, root
- Public URL: `https://<your-user>.github.io/jsk-order-form/`

## Columns Written
**Orders**
```
Timestamp | OrderUID | OrderID | CustomerName | ContactNumber | Place | DeliveryDateTime | PaymentTerms | SalesExecutive | Comments | GrandTotal | ItemCount | Source
```
**OrderItems**
```
Timestamp | OrderUID | ItemIndex | ItemName | Qty | Rate | Total
```

## Troubleshooting
- **401 Unauthorized** on POST → Your deployment is not public: set *Who has access = Anyone* and redeploy.
- **No rows written** → Tab names must be exactly `Orders` and `OrderItems`. Ensure `SHEET_ID` is correct.
- **Printing prints full page** → Use **Print Invoice PDF**; it prints only the invoice HTML using a hidden iframe.
