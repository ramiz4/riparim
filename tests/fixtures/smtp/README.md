# Isolated SMTP TLS fixture

The certificate and private key are synthetic test material for the loopback
server in `tests/smtp-tls.test.mjs`. They protect no account or real service.
The child client trusts this certificate only via its own NODE_EXTRA_CA_CERTS.
Tests without this isolated trust must fail before credentials are sent.
