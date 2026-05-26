require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middleware
app.use(express.json());

// 2. CORS Security (Behnam: Restrict this to apply.heraldglobalacademy.com)
app.use(cors({
    origin: '*' // Change this in production!
}));

// 3. Rate Limiting (Behnam: Configure this to prevent spam)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per window
    message: "Too many referrals submitted from this IP, please try again later."
});

// 4. The Secure Proxy Endpoint
app.post('/api/referral', apiLimiter, async (req, res) => {
    try {
        const brevoEndpoint = 'https://api.brevo.com/v3/contacts';
        const apiKey = process.env.BREVO_API_KEY;

        // Behnam: Wire up the axios POST request to Brevo here
        // using req.body as the payload and the apiKey in the headers.

        res.status(200).json({ message: "Secure proxy endpoint hit successfully!" });

    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).json({ error: "Failed to route data to CRM" });
    }
});

app.listen(PORT, () => {
    console.log(`Secure proxy server running on port ${PORT}`);
});