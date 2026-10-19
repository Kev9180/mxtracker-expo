// Cloudflare Worker for confirm.mxtracker.app
// Handles email reminder confirmations (?result=) and export verification (/verify/{id})
// Deploy this file via the Cloudflare Dashboard → Workers & Pages → confirm-mxtracker → Edit Code
//
// Required environment variables (set in Cloudflare Dashboard → Worker → Settings → Variables):
//   SUPABASE_URL       e.g. https://xyzxyz.supabase.co
//   SUPABASE_ANON_KEY  the public anon key from your Supabase project settings

function page(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MXTracker</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f5f5f0 0%, #e8e8e8 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); max-width: 520px; width: 100%; overflow: hidden; }
    .header { background: #0f0f0f; padding: 28px 24px; display: flex; align-items: center; gap: 8px; border-bottom: 3px solid #e3001b; }
    .logo-mx { font-size: 28px; font-weight: 900; color: #e3001b; letter-spacing: 2px; }
    .logo-tracker { font-size: 14px; font-weight: 900; color: white; letter-spacing: 4px; }
    .content { padding: 40px 32px; }
    .status-icon { font-size: 48px; margin-bottom: 16px; display: block; text-align: center; }
    h1 { font-size: 22px; font-weight: 900; color: #0f0f0f; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; text-align: center; }
    .vehicle-name { font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #999; text-transform: uppercase; text-align: center; margin-bottom: 28px; }
    .hash-section { background: #f5f5f0; border: 1px solid #e8e8e8; border-left: 4px solid #e3001b; padding: 16px 18px; margin-bottom: 24px; }
    .hash-label { font-size: 9px; font-weight: 900; letter-spacing: 2px; color: #999; text-transform: uppercase; margin-bottom: 8px; }
    .hash-value { font-family: monospace; font-size: 11px; color: #111; word-break: break-all; line-height: 1.7; }
    .hash-explainer { font-size: 13px; color: #555; line-height: 1.7; margin-bottom: 20px; }
    .table-wrap { overflow-x: auto; margin: 20px 0; }
    .records-table { width: 100%; min-width: 760px; table-layout: fixed; border-collapse: collapse; font-size: 12px; text-align: left; }
    .records-table th:nth-child(1), .records-table td:nth-child(1), .records-table th:nth-child(5), .records-table td:nth-child(5) { white-space: nowrap; }
    .records-table th { background: #0f0f0f; color: #fff; padding: 9px 8px; font-size: 10px; }
    .records-table td { padding: 9px 8px; border-bottom: 1px solid #e8e8e8; vertical-align: top; overflow-wrap: anywhere; }
    .records-table tr:nth-child(even) td { background: #f9f9f9; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .meta-item label { font-size: 9px; font-weight: 900; letter-spacing: 2px; color: #999; text-transform: uppercase; display: block; margin-bottom: 4px; }
    .meta-item span { font-size: 14px; font-weight: 600; color: #111; }
    .instructions { background: #fffbf0; border-left: 3px solid #f0a500; padding: 14px 16px; font-size: 13px; color: #555; line-height: 1.7; }
    .instructions strong { color: #111; }
    .message { font-size: 16px; color: #555; line-height: 1.6; margin-bottom: 16px; text-align: center; }
    .error-box { background: #fff5f5; border-left: 4px solid #e3001b; padding: 16px 18px; font-size: 14px; color: #c60016; }
    .compare-section { margin-top: 24px; }
    .compare-label { font-size: 9px; font-weight: 900; letter-spacing: 2px; color: #999; text-transform: uppercase; margin-bottom: 8px; }
    .hash-input { width: 100%; font-family: monospace; font-size: 12px; padding: 10px 12px; border: 1px solid #e8e8e8; outline: none; color: #111; background: #fff; box-sizing: border-box; }
    .hash-input:focus { border-color: #e3001b; }
    .compare-btn { margin-top: 10px; width: 100%; padding: 12px; background: #0f0f0f; color: white; border: none; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; }
    .compare-btn:hover { background: #e3001b; }
    .compare-result { margin-top: 12px; padding: 14px 16px; font-size: 14px; line-height: 1.5; }
    .compare-result.match { background: #f0fff4; border-left: 4px solid #22c55e; color: #166534; }
    .compare-result.mismatch { background: #fff5f5; border-left: 4px solid #e3001b; color: #c60016; }
    .footer { background: #f9f9f9; padding: 16px 32px; border-top: 1px solid #e8e8e8; font-size: 12px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-mx">MX</div>
      <div class="logo-tracker">TRACKER</div>
    </div>
    <div class="content">${bodyHtml}</div>
    <div class="footer">MXTracker &middot; <a href="https://mxtracker.app" style="color:#aaa;text-decoration:none;">mxtracker.app</a></div>
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── Verify route: /verify/{uuid} ──────────────────────────────────────────
    const verifyMatch = path.match(/^\/verify\/([a-f0-9-]{36})$/i);
    if (verifyMatch) {
      const exportId = verifyMatch[1];

      let verification = null;
      let fetchError = false;
      try {
        const res = await fetch(
          `${env.SUPABASE_URL}/functions/v1/verify-record-export`,
          {
            method: 'POST',
            headers: {
              'apikey': env.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ export_id: exportId }),
          }
        );
        if (res.status === 404) {
          verification = { status: 'not_found' };
        } else if (!res.ok && res.status !== 409) {
          fetchError = true;
        } else {
          verification = await res.json();
        }
      } catch (e) {
        fetchError = true;
      }

      let body;
      if (fetchError) {
        body = `
          <span class="status-icon">⚠️</span>
          <h1>Verification Unavailable</h1>
          <p class="message" style="margin-top:12px;">Could not reach the MXTracker database. Please try again shortly.</p>`;
      } else if (verification?.status === 'not_found') {
        body = `
          <span class="status-icon">❌</span>
          <h1>Export Not Found</h1>
          <p class="message" style="margin-top:12px;">No export record exists for this ID. The link may be invalid or the report may not have been generated with MXTracker.</p>`;
      } else if (verification?.status === 'legacy') {
        body = `
          <span class="status-icon">ℹ️</span>
          <h1>Older Export</h1>
          <p class="message" style="margin-top:12px;">This report was exported before MXTracker began saving the original maintenance records. We cannot verify that its records match the version originally exported.</p>`;
      } else if (verification?.status === 'integrity_error') {
        body = `
          <span class="status-icon">⚠️</span>
          <h1>Verification Problem</h1>
          <p class="message" style="margin-top:12px;">MXTracker could not validate the saved export record. Do not rely on this report as verified; please contact MXTracker support.</p>`;
      } else {
        const snapshot = verification.record_snapshot;
        const vehicle = snapshot.vehicle ?? {};
        const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
          .filter(Boolean).map(escapeHtml).join(' ');
        const mileageUnit = vehicle.odometer_unit === 'kilometers' ? 'km' : 'mi';
        const exportDate = new Date(verification.exported_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
        const recordRows = (snapshot.records ?? []).map(record => `
          <tr>
            <td>${escapeHtml(record.completed_date || '—')}</td>
            <td>${escapeHtml(record.task_name)}</td>
            <td>${escapeHtml(record.mileage_at_service == null ? '—' : `${record.mileage_at_service.toLocaleString()} ${mileageUnit}`)}</td>
            <td>${escapeHtml(record.performed_by || '—')}</td>
            <td>${escapeHtml(record.cost == null ? '—' : `$${Number(record.cost).toFixed(2)}`)}</td>
            <td>${escapeHtml(record.notes || '—')}</td>
          </tr>`).join('');
        const editedRecordCount = new Set((snapshot.changes ?? []).map(change => change.maintenance_record_id)).size;
        body = `
          <span class="status-icon">📋</span>
          <h1>MXTracker's Saved Records</h1>
          ${vehicleLabel ? `<p class="vehicle-name">${vehicleLabel}</p>` : ''}
          <div class="meta-grid">
            <div class="meta-item"><label>Export Date</label><span>${exportDate}</span></div>
            <div class="meta-item"><label>Records</label><span>${verification.record_count}</span></div>
          </div>
            <p class="message">These are the maintenance records MXTracker saved when this report was exported. Compare them with the seller's PDF. If any details differ, the PDF is not an unchanged copy of the saved report.</p>
            <p class="instructions"><strong>Saved record check passed.</strong> MXTracker confirmed these saved records match their integrity fingerprint. This page does not inspect the PDF automatically, so compare its records with the seller's copy.</p>
            <div class="table-wrap"><table class="records-table">
              <colgroup>
                <col style="width:15%" /><col style="width:19%" /><col style="width:14%" />
                <col style="width:17%" /><col style="width:14%" /><col style="width:21%" />
              </colgroup>
              <thead><tr><th>Date</th><th>Service</th><th>Mileage (${mileageUnit})</th><th>Performed by</th><th>Cost</th><th>Notes</th></tr></thead>
              <tbody>${recordRows || '<tr><td colspan="6">No records were included in this export.</td></tr>'}</tbody>
            </table></div>
            ${editedRecordCount ? `<p class="instructions">${editedRecordCount} record${editedRecordCount === 1 ? ' had an edit' : 's had edits'} saved before this export. See the Modification History in the PDF for details.</p>` : '<p class="instructions">No record edits were logged before this export.</p>'}
            <p class="instructions"><strong>What this confirms:</strong> this page shows the records saved for this export. It cannot confirm that the listed service was actually performed or that the owner's original entries were truthful.</p>`;
      }

      return new Response(page(body), { headers: { 'content-type': 'text/html;charset=UTF-8' } });
    }

    // ── Open-app route: /open/{vehicleId}/{recordId}?task=...&vehicle=... ────────
    const openMatch = path.match(/^\/open\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/i);
    if (openMatch) {
      const vehicleId = openMatch[1];
      const recordId = openMatch[2];
      const taskName = url.searchParams.get('task') || 'Maintenance';
      const vehicleName = url.searchParams.get('vehicle') || '';
      const deepLink = `mxtracker://reminders/${vehicleId}/${recordId}`;

      const openBody = `
        <span class="status-icon">🔧</span>
        <h1>Mark as Complete</h1>
        <p class="vehicle-name">${vehicleName ? vehicleName.toUpperCase() : ''}</p>
        <p class="message">${taskName}</p>
        <p class="message" style="font-size:14px;color:#999;margin-bottom:28px;">Opening MXTracker to log this service...</p>
        <a href="${deepLink}" id="openBtn" style="display:block;background:#e3001b;color:#fff;padding:16px 24px;font-size:12px;font-weight:900;letter-spacing:3px;text-decoration:none;text-align:center;text-transform:uppercase;margin-bottom:16px;">Open in MXTracker</a>
        <p style="font-size:11px;color:#bbb;line-height:1.6;">If the app doesn't open automatically, tap the button above. Make sure MXTracker is installed on this device.</p>
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() { window.location.href = '${deepLink}'; }, 100);
          });
        <\/script>`;

      return new Response(page(openBody), { headers: { 'content-type': 'text/html;charset=UTF-8' } });
    }

    // ── Confirmation route: /?result= ─────────────────────────────────────────
    const result = url.searchParams.get('result');
    const confirmations = {
      snooze_week:  { icon: '⏰', title: 'Reminder Snoozed',  message: "We'll remind you again in <strong>1 week</strong> about this service." },
      snooze_month: { icon: '📅', title: 'Reminder Snoozed',  message: "We'll remind you again in <strong>1 month</strong> about this service." },
      stop:         { icon: '✓',  title: 'Reminders Stopped', message: "You won't receive any more reminders for this service. You can re-enable reminders in the app." },
    };
    const config = confirmations[result];
    const body = config
      ? `<span class="status-icon">${config.icon}</span><h1>${config.title}</h1><p class="message" style="margin-top:16px;">${config.message}</p>`
      : `<span class="status-icon">❌</span><h1>Invalid Link</h1><p class="message" style="margin-top:12px;">This confirmation link is missing required parameters or has expired.</p>`;

    return new Response(page(body), { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }
};
