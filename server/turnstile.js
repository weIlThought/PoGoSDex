export class TurnstileValidator {
  constructor(secretKey, timeout = 10000) {
    this.secretKey = secretKey;
    this.timeout = timeout;
    if (!this.secretKey) {
      console.warn("TurnstileValidator: TURNSTILE_SECRET_KEY is not set");
    }
  }

  async validate(token, remoteip, options = {}) {
    if (!token || typeof token !== "string") {
      return { success: false, "error-codes": ["missing-input-response"] };
    }
    if (!this.secretKey) {
      return { success: false, "error-codes": ["missing-input-secret"] };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const form = new URLSearchParams();
      form.append("secret", this.secretKey);
      form.append("response", token);
      if (remoteip) form.append("remoteip", remoteip);
      if (options.idempotencyKey)
        form.append("idempotency_key", options.idempotencyKey);

      const res = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: form,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        }
      );

      const json = await res.json();
      return json;
    } catch (err) {
      if (err.name === "AbortError") {
        return { success: false, "error-codes": ["internal-timeout"] };
      }
      console.error("Turnstile validation error:", err);
      return { success: false, "error-codes": ["internal-error"] };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Express middleware factory: erwartet token im Body-Feld cf-turnstile-response
  middleware(options = {}) {
    const validator = this;
    return async function (req, res, next) {
      try {
        const token =
          (req.body && req.body["cf-turnstile-response"]) ||
          req.header("cf-turnstile-response") ||
          "";
        const remoteip =
          req.headers["cf-connecting-ip"] ||
          req.ip ||
          req.headers["x-forwarded-for"] ||
          "";
        const result = await validator.validate(token, remoteip, options);
        // hänge Ergebnis an req an
        req.turnstile = result;
        if (!result.success) {
          return res.status(400).json({
            error: "turnstile_failed",
            "error-codes": result["error-codes"] || [],
          });
        }
        next();
      } catch (e) {
        next(e);
      }
    };
  }
}

export default TurnstileValidator;
