require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// 1. Global Middleware
app.use(express.json());

// 2. CORS Security (Allows your GoHighLevel staging page to talk to this server)
app.use(cors({
    origin: '*' 
}));

// 3. Rate Limiting (Prevents automated bot spam)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute window
    max: 25, // Limit each IP to 25 submissions per window
    message: { error: "Too many requests from this IP. Please try again later." }
});

// 4. The Live Secure Proxy Endpoint
app.post('/api/referral', apiLimiter, async (req, res) => {
    try {
        // Validate that we actually received data
        if (!req.body || !req.body.email) {
            return res.status(400).json({ error: "Missing required contact email." });
        }

        console.log(`[Proxy] Intercepted submission for: ${req.body.email}`);

        // Forward the exact incoming payload to Brevo's API
        const response = await axios.post('https://api.brevo.com/v3/contacts', req.body, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': process.env.BREVO_API_KEY // Kept hidden on the server
            }
        });

        // Respond back to your frontend with success status
        console.log("[Proxy] Successfully synced with Brevo CRM.");
        return res.status(200).json({ message: "Referral sync complete.", data: response.data });

    } catch (error) {
        // Log detailed error response if Brevo rejects the payload
        if (error.response) {
            console.error("[Proxy Error] Brevo rejected payload:", error.response.data);
            return res.status(error.response.status).json({ error: error.response.data });
        }
        
        console.error("[Proxy Error] Network failure:", error.message);
        return res.status(500).json({ error: "Internal Gateway Routing Error" });
    }
});

// 5. Apply Form Endpoint (Odoo CRM + Brevo parallel run)
app.post('/api/apply', apiLimiter, async (req, res) => {
  // FIX 1: serviceRequired added to the destructure
  const { firstName, lastName, email, phone, address, statusInCanada, referralCode, salesRep, serviceRequired } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Missing required contact email." });
  }

  // 1. Forward to Odoo CRM
  let odooOk = false;
  try {
    await axios.post(process.env.ODOO_WEBHOOK_URL, {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address,
      status_in_canada: statusInCanada,
      referral_code: referralCode,
      sales_rep: salesRep,
      service_required: serviceRequired, // FIX 2: forwarded to Odoo
    });
    odooOk = true;
    console.log(`[Proxy] Lead sent to Odoo: ${email}`);
  } catch (err) {
    console.error('[Proxy Error] Odoo webhook failed:', err.message);
  }

  // 2. Parallel-run: also forward to Brevo (translated to Brevo's shape)
  let brevoOk = false;
  try {
    await axios.post('https://api.brevo.com/v3/contacts', {
      email,
      attributes: {
        FIRSTNAME: firstName,
        LASTNAME: lastName,
        PHONE: phone,
        STATUS: statusInCanada,
        ADDRESS: address,
        SALES_REP: salesRep,
        REFERRAL_CODE: referralCode,
        PROGRAM: "Student Application Submission",
        SERVICE_REQUIRED: serviceRequired
      },
      listIds: [2],
      updateEnabled: true,
    }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY }
    });
    brevoOk = true;
    console.log(`[Proxy] Contact synced to Brevo: ${email}`);
  } catch (err) {
    console.error('[Proxy Error] Brevo sync failed:', err.response?.data || err.message);
  }

  if (odooOk || brevoOk) return res.json({ ok: true, odoo: odooOk, brevo: brevoOk });
  return res.status(500).json({ ok: false });
});

app.listen(PORT, () => {
    console.log(`====> Secure Proxy Active: http://localhost:${PORT}`);
});