/** CONFIG **/
const SHEET_ID     = '1TffGe88K6uiKYheuOM91ylZNXQJp4aiRB3togVddYcE'; // your Sheet ID
const SHEET_ORDERS = 'Orders';
const SHEET_ITEMS  = 'OrderItems';

function doOptions(e) {
  return cors_(200, { ok: true });
}

function doGet(e) {
  return cors_(200, { ok: true, hint: 'POST JSON to this endpoint' });
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    ensureSheets_(ss);

    if (!e.postData || !e.postData.contents)
      return cors_(400, { ok: false, error: 'No postData' });

    const d = JSON.parse(e.postData.contents);
    const ts = new Date();
    const orderUID = Utilities.getUuid();
    const orderId = (d.orderId || '').trim() || autoOrderId_(ts);
    const items = Array.isArray(d.items) ? d.items : [];

    // Normalize conditional fields
    const paymentDueDate = (d.paymentTerms === 'Credit') ? (d.paymentDueDate || '').trim() : '';
    const isReferral = (d.customerCategory || '').trim().toLowerCase() === 'referral customer';
    const referralName = isReferral ? (d.referralName || '').trim() : '';
    const referralMobile = isReferral ? (d.referralMobile || '').trim() : '';

    // Append to Orders sheet (order must match headers exactly)
    const orders = ss.getSheetByName(SHEET_ORDERS);
    orders.appendRow([
      ts,                                // Timestamp
      orderUID,                          // OrderUID
      orderId,                           // OrderID
      (d.customerName || '').trim(),     // CustomerName
      (d.contactNumber || '').trim(),    // ContactNumber
      (d.place || '').trim(),            // Place
      (d.deliveryDateTime || '').trim(), // DeliveryDateTime
      (d.paymentTerms || '').trim(),     // PaymentTerms
      paymentDueDate,                    // PaymentDueDate
      (d.customerCategory || '').trim(), // CustomerCategory
      referralName,                      // ReferralName
      referralMobile,                    // ReferralMobile
      (d.salesExecutive || '').trim(),   // SalesExecutive
      (d.salesExecutivePhone || '').trim(), // SalesExecutivePhone
      (d.comments || '').trim(),         // Comments
      Number(d.grandTotal || 0),         // GrandTotal
      items.length,                      // ItemCount
      'webform'                          // Source
    ]);

    // Append to OrderItems sheet
    if (items.length) {
      const itemsSheet = ss.getSheetByName(SHEET_ITEMS);
      const rows = items.map((it, i) => [
        ts,                           // Timestamp
        orderUID,                     // OrderUID (to join with Orders)
        i + 1,                        // ItemIndex
        (it.name || '').trim(),       // ItemName
        Number(it.qty || 0),          // Qty
        Number(it.rate || 0),         // Rate
        Number(it.total ?? (Number(it.qty || 0) * Number(it.rate || 0))) // Total
      ]).filter(r => !(r[3] === '' && r[4] === 0 && r[5] === 0 && r[6] === 0));

      if (rows.length)
        itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return cors_(200, { ok: true, orderId, itemCount: items.length });
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
  // Orders sheet
  let orders = ss.getSheetByName(SHEET_ORDERS);
  if (!orders) orders = ss.insertSheet(SHEET_ORDERS);

  // If header row is empty, lay down full header (18 columns)
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
  // FIXED: proper string template with backticks
  return `INV-${String(d.getFullYear()).slice(-2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.floor(Math.random() * 90) + 10}`;
}
