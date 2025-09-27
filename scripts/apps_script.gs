// Google Apps Script backend for JSK Associates Order Form
// Save as scripts/apps_script.gs or paste into Extensions → Apps Script

/***** CONFIG *****/
const SHEET_ID     = 'PUT_YOUR_SHEET_ID_HERE';     // <-- Replace with your Sheet ID
const SHEET_ORDERS = 'Orders';
const SHEET_ITEMS  = 'OrderItems';

function doOptions(e){ return cors_(200, {ok:true}); }
function doGet(e){ return cors_(200, {ok:true, hint:'POST JSON to this endpoint'}); }

function doPost(e){
  try{
    const ss = SpreadsheetApp.openById(SHEET_ID);
    ensureSheets_(ss);

    if(!e.postData || !e.postData.contents)
      return cors_(400,{ok:false,error:'No postData'});

    const d = JSON.parse(e.postData.contents);
    const ts=new Date(), orderUID=Utilities.getUuid();
    const orderId = (d.orderId||'').trim() || autoOrderId_(ts);
    const items = Array.isArray(d.items)? d.items : [];
    const orders = ss.getSheetByName(SHEET_ORDERS);
    orders.appendRow([
      ts, orderUID, orderId,
      (d.customerName||'').trim(),
      (d.contactNumber||'').trim(),
      (d.place||'').trim(),
      (d.deliveryDateTime||'').trim(),
      (d.paymentTerms||'').trim(),
      (d.salesExecutive||'').trim(),
      (d.comments||'').trim(),
      Number(d.grandTotal||0),
      items.length,
      'webform'
    ]);

    if(items.length){
      const itemsSh = ss.getSheetByName(SHEET_ITEMS);
      const rows = items.map((it,i)=>[
        ts, orderUID, i+1,
        (it.name||'').trim(),
        Number(it.qty||0),
        Number(it.rate||0),
        Number(it.total ?? (Number(it.qty||0)*Number(it.rate||0)))
      ]).filter(r => !(r[3]==='' && r[4]===0 && r[5]===0 && r[6]===0));
      if(rows.length) itemsSh.getRange(itemsSh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
    }
    return cors_(200,{ok:true, orderId, itemCount:items.length});
  }catch(err){
    console.error(err);
    return cors_(500,{ok:false,error:String(err)});
  }
}

/***** Helpers *****/
function ensureSheets_(ss){
  // Orders
  let a=ss.getSheetByName(SHEET_ORDERS); if(!a) a=ss.insertSheet(SHEET_ORDERS);
  if(isEmptyHeader_(a)){
    a.getRange(1,1,1,13).setValues([
      ['Timestamp','OrderUID','OrderID','CustomerName','ContactNumber','Place','DeliveryDateTime','PaymentTerms','SalesExecutive','Comments','GrandTotal','ItemCount','Source']
    ]);
    a.setFrozenRows(1);
  }

  // OrderItems
  let b=ss.getSheetByName(SHEET_ITEMS); if(!b) b=ss.insertSheet(SHEET_ITEMS);
  if(isEmptyHeader_(b)){
    b.getRange(1,1,1,7).setValues([
      ['Timestamp','OrderUID','ItemIndex','ItemName','Qty','Rate','Total']
    ]);
    b.setFrozenRows(1);
  }
}
function isEmptyHeader_(sh){
  const row=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0];
  return row.every(v=>v===''||v==null);
}
function autoOrderId_(d){
  const p=n=>String(n).padStart(2,'0');
  return `INV-${String(d.getFullYear()).slice(-2)}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.floor(Math.random()*90)+10}`;
}
function cors_(status,obj){
  const out=ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  out.setHeader('Access-Control-Allow-Origin','*');
  out.setHeader('Access-Control-Allow-Headers','Content-Type');
  out.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');
  return out;
}
