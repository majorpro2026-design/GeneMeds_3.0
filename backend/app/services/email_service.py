"""Email service for GeneMeds.

Handles SMTP configuration, message rendering with dynamic HTML escaping,
plain-text alternatives, and delivery via Gmail SMTP STARTTLS.
"""
from __future__ import annotations

import html
import logging
import os
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional

logger = logging.getLogger(__name__)


class EmailServiceError(Exception):
    """Base exception for email service operations."""
    pass


class EmailConfigurationError(EmailServiceError):
    """Raised when SMTP credentials or settings are missing or invalid."""
    pass


class EmailDeliveryError(EmailServiceError):
    """Raised when email transmission fails."""
    pass


@dataclass(frozen=True)
class EmailConfig:
    """SMTP and application branding configuration."""

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_email: str = ""
    smtp_password: str = ""
    from_name: str = "GeneMeds Team"
    portal_url: str = "http://localhost:5173"
    support_email: str = "support@genemeds.com"
    timeout_seconds: int = 15

    @classmethod
    def from_env(cls) -> EmailConfig:
        port_raw = os.getenv("SMTP_PORT", "587")
        try:
            port = int(port_raw)
        except ValueError:
            port = 587

        timeout_raw = os.getenv("SMTP_TIMEOUT", "15")
        try:
            timeout = int(timeout_raw)
        except ValueError:
            timeout = 15

        return cls(
            smtp_host=os.getenv("SMTP_HOST", "smtp.gmail.com").strip(),
            smtp_port=port,
            smtp_email=os.getenv("SMTP_EMAIL", "").strip(),
            smtp_password=os.getenv("SMTP_PASSWORD", "").strip(),
            from_name=os.getenv("EMAIL_FROM_NAME", "GeneMeds Team").strip(),
            portal_url=os.getenv("GENEMEDS_PORTAL_URL", "http://localhost:5173").strip(),
            support_email=os.getenv("SUPPORT_EMAIL", "support@genemeds.com").strip(),
            timeout_seconds=timeout,
        )


def build_welcome_email(
    recipient_email: str,
    hcp_name: str,
    config: Optional[EmailConfig] = None,
) -> EmailMessage:
    """Construct a multipart MIME email with HTML and plain-text alternatives."""
    if config is None:
        config = EmailConfig.from_env()

    clean_name = hcp_name.strip() if hcp_name else "Healthcare Professional"
    safe_name = html.escape(clean_name)
    safe_portal_url = html.escape(config.portal_url, quote=True)
    safe_support_email = html.escape(config.support_email)

    # Plain-text alternative
    plain_text = (
        f"Dear {clean_name},\n\n"
        f"Welcome to GeneMeds!\n\n"
        f"We're delighted to let you know that your Healthcare Professional registration has been approved.\n\n"
        f"We're excited to have you join our community and look forward to supporting you as you get started with GeneMeds.\n\n"
        f"You can now access your GeneMeds account using the link below.\n\n"
        f"{config.portal_url}\n\n"
        f"If you need assistance, please contact our support team at {config.support_email}.\n\n"
        f"Warm regards,\n"
        f"The GeneMeds Team\n"
    )

    # Professional, responsive HTML alternative
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to GeneMeds</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F5FF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1F1B2E;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F7F5FF; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #E4DFF5; overflow: hidden; box-shadow: 0 4px 16px rgba(109, 74, 216, 0.08);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #6D4AD8; padding: 32px 36px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">GeneMeds</h1>
              <p style="margin: 6px 0 0 0; color: #E9E3FB; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px;">Healthcare Professional Portal</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <p style="margin: 0 0 18px 0; font-size: 16px; line-height: 1.6; color: #1F1B2E;">
                Dear {safe_name},
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #1F1B2E; font-weight: 600;">
                Welcome to GeneMeds!
              </p>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #1F1B2E;">
                We're delighted to let you know that your Healthcare Professional registration has been approved.
              </p>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #1F1B2E;">
                We're excited to have you join our community and look forward to supporting you as you get started with GeneMeds.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #1F1B2E;">
                You can now access your GeneMeds account using the link below.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #6D4AD8;">
                    <a href="{safe_portal_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: #6D4AD8; border: 1px solid #6D4AD8;">
                      Access GeneMeds
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 28px 0 20px 0; font-size: 14px; line-height: 1.6; color: #6B6785;">
                If you need assistance, please contact our support team at <a href="mailto:{safe_support_email}" style="color: #6D4AD8; text-decoration: underline;">{safe_support_email}</a>.
              </p>
              <p style="margin: 24px 0 0 0; font-size: 15px; line-height: 1.6; color: #1F1B2E;">
                Warm regards,<br>
                <strong style="color: #1E1B3A;">The GeneMeds Team</strong>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F7F5FF; border-top: 1px solid #E4DFF5; padding: 20px 36px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6B6785; line-height: 1.5;">
                This is an automated notification from GeneMeds. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    message = EmailMessage()
    message["Subject"] = f"Welcome aboard, {clean_name}! | GeneMeds"
    message["From"] = (
        formataddr((config.from_name, config.smtp_email))
        if config.from_name and config.smtp_email
        else (config.smtp_email or "no-reply@genemeds.com")
    )
    message["To"] = recipient_email
    message.set_content(plain_text)
    message.add_alternative(html_content, subtype="html")

    return message


def send_welcome_email(
    recipient_email: str,
    hcp_name: str,
    config: Optional[EmailConfig] = None,
) -> bool:
    """Send welcome email to the recipient using Gmail SMTP with STARTTLS.

    Raises:
        EmailConfigurationError: If SMTP credentials are missing.
        EmailDeliveryError: If SMTP connection, TLS handshake, auth, or sending fails.
    """
    if config is None:
        config = EmailConfig.from_env()

    clean_email = recipient_email.strip() if recipient_email else ""
    if not clean_email:
        raise ValueError("Recipient email address is required.")

    if not config.smtp_email or not config.smtp_password:
        logger.error(
            "SMTP configuration missing: SMTP_EMAIL or SMTP_PASSWORD is not set. Cannot send email to %s",
            clean_email,
        )
        raise EmailConfigurationError("SMTP_EMAIL or SMTP_PASSWORD is not configured.")

    message = build_welcome_email(clean_email, hcp_name, config)

    try:
        ssl_context = ssl.create_default_context()
        with smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=config.timeout_seconds) as server:
            server.ehlo()
            server.starttls(context=ssl_context)
            server.ehlo()
            server.login(config.smtp_email, config.smtp_password)
            server.send_message(message)

        logger.info("Welcome email sent successfully to %s", clean_email)
        return True
    except (smtplib.SMTPException, ssl.SSLError, OSError, ValueError) as exc:
        # Log sanitized error without credentials or email contents
        logger.error(
            "Failed to send welcome email to %s via SMTP (%s:%d): %s",
            clean_email,
            config.smtp_host,
            config.smtp_port,
            type(exc).__name__,
        )
        raise EmailDeliveryError(f"Failed to deliver welcome email to {clean_email}: {exc}") from exc


def send_welcome_email_task(recipient_email: str, hcp_name: str) -> None:
    """FastAPI BackgroundTasks entrypoint.

    Catches and logs all errors to ensure background failures do not crash the runner
    or affect completed approval operations.
    """
    try:
        send_welcome_email(recipient_email, hcp_name)
    except Exception as exc:
        logger.error(
            "Background welcome email delivery failed for %s: %s",
            recipient_email,
            type(exc).__name__,
        )
