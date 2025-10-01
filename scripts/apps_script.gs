/** CONFIG **/
const SHEET_ID     = '1TffGe88K6uiKYheuOM91ylZNXQJp4aiRB3togVddYcE'; // your Sheet ID
const SHEET_ORDERS = 'Orders';
const SHEET_ITEMS  = 'OrderItems';

function doOptions(e) { return cors_(200, { ok: true }); }
function doGet(e) { return cors_(200, { ok: true, hint: 'POST JSON to this endpoint' }); }

function doPost(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    ensureSheets_(ss);

    if (!e.postData || !e.postData.contents)
      return cors_(400, { ok: false, error: 'No postData' });

    const d = JSON.parse(e.postData.contents);
    const ts = new Date();
    const orderUID = Utilities.getUuid();
    const items = Array.isArray(d.items) ? d.items : [];

    // Optional idempotency: if you send clientToken from the client, reuse same orderId if repeated
    const token = (d.clientToken || '').trim();
    const props = PropertiesService.getScriptProperties();
    if (token) {
      const existingOrderId = props.getProperty(token);
      if (existingOrderId) {
        return cors_(200, { ok: true, orderId: existingOrderId, itemCount: 0, dedup: true });
      }
    }

    const orderId = (d.orderId || '').trim() || autoOrderId_(ts);
    const paymentTerms = (d.paymentTerms || '').trim();
    const paymentDueDate = (paymentTerms === 'Credit') ? (d.paymentDueDate || '').trim() : '';
    const category = (d.customerCategory || '').trim();
    const isReferral = category.toLowerCase() === 'referral customer';
    const referralName = isReferral ? (d.referralName || '').trim() : '';
    const referralMobile = isReferral ? (d.referralMobile || '').trim() : '';

    // Append to Orders
    const orders = ss.getSheetByName(SHEET_ORDERS);
    orders.appendRow([
      ts,                                // Timestamp
      orderUID,                          // OrderUID
      orderId,                           // OrderID
      (d.customerName || '').trim(),     // CustomerName
      (d.contactNumber || '').trim(),    // ContactNumber
      (d.place || '').trim(),            // Place
      (d.deliveryDateTime || '').trim(), // DeliveryDateTime
      paymentTerms,                      // PaymentTerms
      paymentDueDate,                    // PaymentDueDate
      category,                          // CustomerCategory
      referralName,                      // ReferralName
      referralMobile,                    // ReferralMobile
      (d.salesExecutive || '').trim(),   // SalesExecutive
      (d.salesExecutivePhone || '').trim(), // SalesExecutivePhone
      (d.comments || '').trim(),         // Comments
      Number(d.grandTotal || 0),         // GrandTotal
      items.length,                      // ItemCount
      'webform'                          // Source
    ]);

    // Append to OrderItems (capture start/end for coloring)
    let itemCountWritten = 0;
    if (items.length) {
      const itemsSheet = ss.getSheetByName(SHEET_ITEMS);
      const startRow = itemsSheet.getLastRow() + 1;
      const rows = items.map((it, i) => [
        ts,                           // Timestamp
        orderUID,                     // OrderUID
        i + 1,                        // ItemIndex
        (it.name || '').trim(),       // ItemName
        Number(it.qty || 0),          // Qty
        Number(it.rate || 0),         // Rate
        Number(it.total ?? (Number(it.qty || 0) * Number(it.rate || 0))) // Total
      ]).filter(r => !(r[3] === '' && r[4] === 0 && r[5] === 0 && r[6] === 0));

      if (rows.length) {
        itemsSheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
        itemCountWritten = rows.length;

        // Color the newly added rows for this order
        const endRow = startRow + rows.length - 1;
        const color = colorFromUID_(orderUID); // stable color per order
        // Apply to columns A:G (your 7 columns)
        itemsSheet.getRange(startRow, 1, rows.length, 7).setBackground(color);
      }
    }

    if (token) props.setProperty(token, orderId);

    return cors_(200, { ok: true, orderId, itemCount: itemCountWritten });
  } catch (err) {
    console.error(err);
    return cors_(500, { ok: false, error: String(err) });
  }
}

/** Helpers **/
function cors_(statusCode, data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureSheets_(ss) {
  // Orders sheet (18 columns)
  let orders = ss.getSheetByName(SHEET_ORDERS);
  if (!orders) orders = ss.insertSheet(SHEET_ORDERS);
  if (isEmptyHeader_(orders)) {
    orders.getRange(1, 1, 1, 18).setValues([[
      'Timestamp',
      'OrderUID',
      'OrderID',
      'CustomerName',
      'ContactNumber',
      'Place',
      'DeliveryDateTime',
      'PaymentTerms',
      'PaymentDueDate',
      'CustomerCategory',
      'ReferralName',
      'ReferralMobile',
      'SalesExecutive',
      'SalesExecutivePhone',
      'Comments',
      'GrandTotal',
      'ItemCount',
      'Source'
    ]]);
    orders.setFrozenRows(1);
  }

  // Items sheet
  let items = ss.getSheetByName(SHEET_ITEMS);
  if (!items) items = ss.insertSheet(SHEET_ITEMS);
  if (isEmptyHeader_(items)) {
    items.getRange(1, 1, 1, 7).setValues([[
      'Timestamp',
      'OrderUID',
      'ItemIndex',
      'ItemName',
      'Qty',
      'Rate',
      'Total'
    ]]);
    items.setFrozenRows(1);
  }
}

function isEmptyHeader_(sh) {
  const row = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  return row.every(v => v === '' || v == null);
}

function autoOrderId_(d) {
  const p = n => String(n).padStart(2, '0');
  return `INV-${String(d.getFullYear()).slice(-2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.floor(Math.random() * 90) + 10}`;
}

/**
 * Compute a stable, pleasant pastel color from a UID
 * Returns hex string like "#aabbcc"
 */
function colorFromUID_(uid) {
  // Simple hash
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = Math.imul(31, h) + uid.charCodeAt(i) | 0;
  }
  // Map hash -> HSL pastel
  const hue = Math.abs(h) % 360;
  const sat = 45; // pastel-ish saturation
  const light = 88; // light background
  return hslToHex_(hue, sat, light);
}

// Convert HSL to hex for setBackground
function hslToHex_(h, s, l) {
  s /= 100; l /= 100;
  const C = (1 - Math.abs(2*l - 1)) * s;
  const X = C * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - C/2;
  let r=0,g=0,b=0;
  if (0 <= h && h < 60)   { r=C; g=X; b=0; }
  else if (60 <= h && h < 120){ r=X; g=C; b=0; }
  else if (120 <= h && h < 180){ r=0; g=C; b=X; }
  else if (180 <= h && h < 240){ r=0; g=X; b=C; }
  else if (240 <= h && h < 300){ r=X; g=0; b=C; }
  else { r=C; g=0; b=X; }
  const toHex = v => {
    const n = Math.round((v + m) * 255);
    return n.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Spreadsheet menu to recolor everything (optional) **/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('JSK Tools')
    .addItem('Recolor Order Items', 'recolorAllOrderItems')
    .addToUi();
}

function recolorAllOrderItems() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_ITEMS);
  if (!sh) return;

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const values = sh.getRange(2, 1, lastRow - 1, 2).getValues(); // A:Timestamp, B:OrderUID
  const colors = [];
  for (let i = 0; i < values.length; i++) {
    const uid = (values[i][1] || '').toString();
    const color = uid ? colorFromUID_(uid) : '#ffffff';
    colors.push(new Array(7).fill(color)); // A:G
  }
  sh.getRange(2, 1, colors.length, 7).setBackgrounds(colors);
}
