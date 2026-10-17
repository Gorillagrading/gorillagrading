module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, source, website, fullName, cardDescription, newsletter } = req.body || {};
  if (website) return res.status(200).json({ ok: true });

  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  ) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!scriptUrl || !secret) {
    return res.status(503).json({ error: "Sign-up is not configured" });
  }

  // Build payload - include additional fields if provided
  const payload = {
    email: email.trim().toLowerCase(),
    source: typeof source === "string" ? source.slice(0, 80) : "coming-soon",
    secret
  };

  // Add optional fields for card-check form
  if (fullName) {
    payload.fullName = typeof fullName === "string" ? fullName.trim().slice(0, 120) : "";
  }
  if (cardDescription) {
    payload.cardDescription = typeof cardDescription === "string" ? cardDescription.trim().slice(0, 200) : "";
  }
  if (newsletter !== undefined) {
    payload.newsletter = !!newsletter;
  }

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.status >= 300 && response.status < 400) {
      const scriptHost = new URL(scriptUrl).hostname;
      const redirectLocation = response.headers.get("location");
      const redirectHost = redirectLocation ? new URL(redirectLocation).hostname : "";

      if (
        response.status === 302 &&
        scriptHost === "script.google.com" &&
        redirectHost === "script.googleusercontent.com"
      ) {
        return res.status(200).json({ ok: true });
      }

      console.error("Unexpected Apps Script redirect", {
        status: response.status,
        scriptHost,
        redirectHost
      });
      return res.status(502).json({ error: "Unexpected redirect from signup service" });
    }

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (error) {
      console.error("Unexpected Apps Script response", {
        status: response.status,
        contentType: response.headers.get("content-type"),
        host: new URL(scriptUrl).hostname
      });
      return res.status(502).json({ error: "Unexpected response from signup service" });
    }

    if (!response.ok || !result.ok) {
      console.error("Google Apps Script rejected a signup", result.error || response.status);
      return res.status(502).json({ error: "Could not save the signup" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Signup forwarding failed", error.message);
    return res.status(502).json({ error: "Could not save the signup" });
  }
};
