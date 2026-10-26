from __future__ import annotations

import smtplib
import ssl
from unittest.mock import MagicMock, patch

import pytest

from app.services.email_service import (
    EmailConfig,
    EmailConfigurationError,
    EmailDeliveryError,
    build_welcome_email,
    send_welcome_email,
    send_welcome_email_task,
)


@pytest.fixture
def mock_config():
    return EmailConfig(
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        smtp_email="test-sender@gmail.com",
        smtp_password="app-password-1234",
        from_name="GeneMeds Team",
        portal_url="http://localhost:5173",
        support_email="support@genemeds.com",
        timeout_seconds=5,
    )


def test_build_welcome_email_content(mock_config):
    msg = build_welcome_email(
        recipient_email="doctor@example.com",
        hcp_name="Dr. Jane Smith",
        config=mock_config,
    )

    assert msg["Subject"] == "Welcome aboard, Dr. Jane Smith! | GeneMeds"
    assert "doctor@example.com" in msg["To"]
    assert "GeneMeds Team" in msg["From"]
    assert "test-sender@gmail.com" in msg["From"]

    # Verify plain-text content
    plain_content = msg.get_body(preferencelist=("plain",)).get_content()
    assert "Dear Dr. Jane Smith," in plain_content
    assert "Welcome to GeneMeds!" in plain_content
    assert "Healthcare Professional registration has been approved" in plain_content
    assert "http://localhost:5173" in plain_content
    assert "support@genemeds.com" in plain_content
    assert "The GeneMeds Team" in plain_content

    # Verify HTML content
    html_content = msg.get_body(preferencelist=("html",)).get_content()
    assert "Dear Dr. Jane Smith," in html_content
    assert "Welcome to GeneMeds!" in html_content
    assert "Access GeneMeds" in html_content
    assert "href=\"http://localhost:5173\"" in html_content
    assert "support@genemeds.com" in html_content


def test_html_escaping(mock_config):
    xss_name = "<script>alert('pwned')</script> & Dr. O'Connor"
    msg = build_welcome_email(
        recipient_email="test@example.com",
        hcp_name=xss_name,
        config=mock_config,
    )

    html_content = msg.get_body(preferencelist=("html",)).get_content()
    assert "<script>" not in html_content
    assert "&lt;script&gt;alert(&#x27;pwned&#x27;)&lt;/script&gt; &amp; Dr. O&#x27;Connor" in html_content


def test_send_welcome_email_success(mock_config):
    with patch("smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_server

        result = send_welcome_email(
            recipient_email="doctor@example.com",
            hcp_name="Dr. Smith",
            config=mock_config,
        )

        assert result is True
        mock_smtp_class.assert_called_once_with("smtp.gmail.com", 587, timeout=5)
        mock_server.ehlo.assert_called()
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("test-sender@gmail.com", "app-password-1234")
        mock_server.send_message.assert_called_once()


def test_send_welcome_email_missing_credentials():
    empty_config = EmailConfig(
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        smtp_email="",
        smtp_password="",
    )

    with pytest.raises(EmailConfigurationError, match="SMTP_EMAIL or SMTP_PASSWORD is not configured"):
        send_welcome_email("doctor@example.com", "Dr. Smith", config=empty_config)


def test_send_welcome_email_smtp_failure(mock_config):
    with patch("smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Authentication failed")
        mock_smtp_class.return_value.__enter__.return_value = mock_server

        with pytest.raises(EmailDeliveryError, match="Failed to deliver welcome email"):
            send_welcome_email("doctor@example.com", "Dr. Smith", config=mock_config)


def test_send_welcome_email_task_catches_error(mock_config):
    """Background task wrapper should catch any error and not raise, ensuring background workers stay healthy."""
    with patch("app.services.email_service.send_welcome_email", side_effect=EmailDeliveryError("Connection timed out")):
        # Should not raise exception
        send_welcome_email_task("doctor@example.com", "Dr. Smith")
