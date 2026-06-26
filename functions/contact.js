// Autra Group — Contact Form Handler (Cloudflare Pages Function)
// Receives form submissions and stores them for later retrieval

export async function onRequest(context) {
  const { request, env } = context;

  // CORS for same-origin only (no cross-site)
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const formData = await request.formData();
    const name = (formData.get('name') || '').trim();
    const email = (formData.get('email') || '').trim();
    const company = (formData.get('company') || '').trim();
    const market = (formData.get('market') || '').trim();
    const message = (formData.get('message') || '').trim();
    const honeypot = (formData.get('website') || '').trim();
    const timestamp = formData.get('_t') || '';

    // Validate honeypot — if filled, it's a bot
    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Validate time-based check — less than 3 seconds = bot
    const submitTime = Date.now();
    const formStart = parseInt(timestamp, 10);
    if (formStart && submitTime - formStart < 3000) {
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and message are required.' }),
        { status: 400, headers }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid email address.' }),
        { status: 400, headers }
      );
    }

    // Build submission record
    const submission = {
      id: crypto.randomUUID(),
      name,
      email,
      company: company || 'Not provided',
      market: market || 'Not specified',
      message,
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Log submission (accessible via `wrangler tail`)
    console.log('CONTACT_FORM_SUBMISSION:', JSON.stringify(submission));

    // Try to send email via Email Routing send_email binding if available
    // This requires the binding to be configured in wrangler.toml
    // and Email Routing to have a verified destination
    if (env.SEND_EMAIL_BINDING) {
      try {
        await env.SEND_EMAIL_BINDING.send({
          from: { name: 'Autra Group Website', email: 'noreply@autragroupltd.com' },
          to: [{ email: 'info@autragroupltd.com' }],
          subject: `New Contact: ${name} from ${company || email}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <table style="border-collapse:collapse;width:100%;max-width:600px">
              <tr><td style="padding:8px;font-weight:700;border:1px solid #ddd">Name</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(name)}</td></tr>
              <tr><td style="padding:8px;font-weight:700;border:1px solid #ddd">Email</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(email)}</td></tr>
              <tr><td style="padding:8px;font-weight:700;border:1px solid #ddd">Company</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(company)}</td></tr>
              <tr><td style="padding:8px;font-weight:700;border:1px solid #ddd">Market</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(market)}</td></tr>
              <tr><td style="padding:8px;font-weight:700;border:1px solid #ddd">Message</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(message)}</td></tr>
              <tr><td style="padding:8px;font-weight:700;border:1px solid #ddd">Time</td><td style="padding:8px;border:1px solid #ddd">${submission.timestamp}</td></tr>
            </table>
          `,
        });
        console.log('Email sent successfully');
      } catch (emailErr) {
        console.error('Email send failed:', emailErr.message);
      }
    } else {
      console.log('No SEND_EMAIL_BINDING configured — submission logged only');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thank you! We\'ll be in touch within 24 hours.',
      }),
      { headers }
    );
  } catch (err) {
    console.error('Contact form error:', err.message);
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again or email us directly.' }),
      { status: 500, headers }
    );
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
