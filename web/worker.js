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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── Verify route: /verify/{uuid} ──────────────────────────────────────────
    const verifyMatch = path.match(/^\/verify\/([a-f0-9-]{36})$/i);
    if (verifyMatch) {
      const exportId = verifyMatch[1];

      // Fetch the export record from Supabase
      let exportRow = null;
      let fetchError = false;
      try {
        const res = await fetch(
          `${env.SUPABASE_URL}/rest/v1/record_exports?id=eq.${exportId}&select=exported_at,record_count,export_hash,vehicle_id`,
          { headers: { 'apikey': env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}` } }
        );
        const rows = await res.json();
        exportRow = rows?.[0] ?? null;
      } catch (e) {
        fetchError = true;
      }

      // Fetch vehicle summary if we have a vehicle_id
      let vehicleLabel = '';
      if (exportRow?.vehicle_id) {
        try {
          const vRes = await fetch(
            `${env.SUPABASE_URL}/rest/v1/rpc/get_vehicle_summary`,
            {
              method: 'POST',
              headers: {
                'apikey': env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ p_vehicle_id: exportRow.vehicle_id }),
            }
          );
          const vRows = await vRes.json();
          const v = vRows?.[0];
          if (v) vehicleLabel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ');
        } catch (_) {}
      }

      let body;
      if (fetchError) {
        body = `
          <span class="status-icon">⚠️</span>
          <h1>Verification Unavailable</h1>
          <p class="message" style="margin-top:12px;">Could not reach the MXTracker database. Please try again shortly.</p>`;
      } else if (!exportRow) {
        body = `
          <span class="status-icon">❌</span>
          <h1>Export Not Found</h1>
          <p class="message" style="margin-top:12px;">No export record exists for this ID. The link may be invalid or the report may not have been generated with MXTracker.</p>`;
      } else {
        const exportDate = new Date(exportRow.exported_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
        body = `
          <span class="status-icon">✅</span>
          <h1>Export Verified</h1>
          ${vehicleLabel ? `<p class="vehicle-name">${vehicleLabel}</p>` : ''}
          <div class="meta-grid">
            <div class="meta-item"><label>Export Date</label><span>${exportDate}</span></div>
            <div class="meta-item"><label>Records</label><span>${exportRow.record_count}</span></div>
          </div>
          <div class="hash-section">
            <div class="hash-label">SHA-256 Integrity Hash</div>
            <div class="hash-value">${exportRow.export_hash}</div>
          </div>
          <div class="compare-section">
            <div class="compare-label">Enter hash from PDF to verify</div>
            <input type="text" id="hashInput" class="hash-input" placeholder="Paste SHA-256 hash from PDF footer…" spellcheck="false" autocomplete="off" />
            <button class="compare-btn" onclick="compareHash()">Compare</button>
            <div id="compareResult" class="compare-result" style="display:none;"></div>
          </div>
          <script>
            var stored = '${exportRow.export_hash}';
            function compareHash() {
              var input = document.getElementById('hashInput').value.trim().toLowerCase();
              var result = document.getElementById('compareResult');
              if (!input) return;
              result.style.display = 'block';
              if (input === stored) {
                result.className = 'compare-result match';
                result.innerHTML = '<strong>\u2705 Hashes match.</strong> This document is identical to what was exported from MXTracker.';
              } else {
                result.className = 'compare-result mismatch';
                result.innerHTML = '<strong>\u274c Hashes do not match.</strong> This document may have been altered after export.';
              }
            }
            document.addEventListener('DOMContentLoaded', function() {
              document.getElementById('hashInput').addEventListener('keydown', function(e) {
                if (e.key === 'Enter') compareHash();
              });
            });
          </script>`;  
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
