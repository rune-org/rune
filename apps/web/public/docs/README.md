# Documentation Images

This directory contains images used in Rune's documentation.

## Directory Structure

```
docs/
├── auth/               # Authentication documentation images
│   ├── admin-signup-form.png
│   ├── login-form.png
│   ├── change-password-form.png
│   ├── admin-reset-password.png
│   └── saml-config.png
└── README.md          # This file
```

## Adding New Images

1. **Create a subdirectory** for your docs section (e.g., `docs/workflows/`)
2. **Add your images** with descriptive names using kebab-case
3. **Reference in MDX** files using:

```mdx
![Alt text](/docs/section-name/image-name.png)
```

## Image Guidelines

- **Format:** PNG or JPEG
- **Size:** Optimize for web (< 500KB per image)
- **Naming:** Use kebab-case (lowercase with hyphens)
- **Alt text:** Always provide descriptive alt text for accessibility

## Example Usage in MDX

```mdx
# My Documentation Page

Here's a screenshot of the form:

![Admin signup form showing name, email, and password fields](/docs/auth/admin-signup-form.png)

The form has three fields as shown above.
```

## Current Placeholders

The following images are placeholders and need actual screenshots:

- `auth/admin-signup-form.png` — Admin signup form
- `auth/login-form.png` — Login form with email/password
- `auth/change-password-form.png` — Password change interface
- `auth/admin-reset-password.png` — Admin user management with reset button
- `auth/saml-config.png` — SAML configuration screen

To replace placeholders, take screenshots and overwrite the placeholder files.