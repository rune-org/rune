# Footer Links Audit

> File: `apps/web/src/lib/site.ts` — all footer links are configured here.

---

## Social Links

| Link | Current href | Status | Action |
|---|---|---|---|
| GitHub | `https://github.com/rune-org` | Real URL | Keep as-is |
| Twitter/X | `#` | No account linked | **Remove** until real account exists, then add URL |
| Discord | `#` | No server linked | **Remove** until real server exists, then add URL |

---

## Product Section

### Workflows — `/workflows`

**Status:** No page exists. The app has `/create/workflows` (the internal product page) but the footer link should point to a **public marketing/feature page**.

**What to put on this page:**
- What workflows are and how they work
- Key capabilities (triggers, actions, branching logic, etc.)
- Screenshot or demo GIF of the workflow builder
- CTA to sign up or try it

**Decision:** Coming Soon (add "coming soon" indicator or disable the link)

---

### Templates — `/templates`

**Status:** No page exists. The app has `/create/templates` internally.

**What to put on this page:**
- Public gallery of pre-built workflow templates
- Filterable by category (e.g. Marketing, DevOps, Sales)
- Each template has a title, description, and CTA to use it

**Decision:** Coming Soon

---

### Docs — `/docs`

**Status:** No page exists.

**What to put on this page:**
- Full product documentation: getting started, concepts, how-to guides, API reference
- Can be built in-house or hosted on an external platform (Mintlify, GitBook, Docusaurus, etc.) and linked from here

**Decision:** Coming Soon

---

## Company Section

### About — `/about`

**Status:** No page exists.

**What to put on this page:**
- Product/company mission and vision
- Brief story of how Rune was built
- Team section (optional)
- CTA to get started

**Decision:** Coming Soon — simple to build, worth doing early

---

### Security — `/security`

**Status:** No page exists.

**What to put on this page:**
- How user data is stored and protected
- Encryption standards (at rest, in transit)
- Compliance certifications (SOC2, GDPR, ISO 27001 — if/when applicable)
- Responsible disclosure / bug bounty info
- Contact email for security issues

**Decision:** Coming Soon — important for B2B trust

---

### Privacy — `/privacy`

**Status:** No page exists.

**What to put on this page:**
- Full privacy policy (legal document)
- What data is collected, how it is used, how it is stored
- User rights (deletion, export, etc.)
- Contact for privacy inquiries

**Decision:** Coming Soon — **legally required**, should be prioritized

---

## Resources Section

### Guides — `/guides`

**Status:** No page exists.

**What to put on this page:**
- Step-by-step tutorials for common use cases
- E.g. "Build your first workflow", "Connect to Slack", "Automate email notifications"
- Blog-style articles covering tips and best practices

**Decision:** Coming Soon — build after core docs exist

---

### API Reference — `/api`

**Status:** No page exists.

**What to put on this page:**
- Full REST/GraphQL API documentation
- Authentication, endpoints, request/response examples
- SDKs or code snippets
- Can be auto-generated from OpenAPI spec using tools like Scalar, Swagger UI, or Redoc

**Decision:** Coming Soon

---

### Changelog — `/changelog`

**Status:** No page exists.

**What to put on this page:**
- Dated list of product releases and updates
- Each entry: version/date, what was added, changed, or fixed
- Can be generated from GitHub releases or maintained manually

**Decision:** Coming Soon — easy to maintain, good for user trust

---

### Community — `/community`

**Status:** No page exists. No community platform (Discord, forum, etc.) is set up yet.

**Decision:** **Remove from footer** until a community platform exists. When Discord/forum is ready, this link can either point to `/community` (a landing page) or directly to the external platform URL.

---

## Support Section

### Help Center — `/help`

**Status:** No page exists.

**What to put on this page:**
- FAQ section
- Common troubleshooting guides
- Links to full docs
- Search functionality (optional)
- Can be built in-house or hosted on Intercom, Zendesk, Notion, etc.

**Decision:** Coming Soon

---

### Contact — `/contact`

**Status:** No page exists.

**What to put on this page:**
- Contact form (name, email, subject, message)
- Or a direct support email address
- Optionally: separate channels for sales vs support

**Decision:** Coming Soon — simple to build, high value

---

### Status — `/status`

**Status:** No page exists. A status page typically runs as a separate external service (e.g. Statuspage.io, BetterUptime, Instatus).

**Decision:** **Remove from footer** until an external status page is set up (e.g. `status.rune.io`). When it exists, the href should point directly to the external URL, not an internal route.

---

## Summary

### Remove from footer now (not applicable)

| Link | Reason |
|---|---|
| Twitter social | No account |
| Discord social | No server |
| Community | No community platform |
| Status | No status page service |

### Applicable — build these soon (legally or trust-critical)

| Link | Notes |
|---|---|
| Privacy (`/privacy`) | Legally required |
| About (`/about`) | Standard, simple to build |
| Contact (`/contact`) | Simple, high value |
| Security (`/security`) | Important for B2B |

### Coming Soon (applicable but not ready yet)

| Link | Notes |
|---|---|
| Workflows (`/workflows`) | Feature landing/marketing page |
| Templates (`/templates`) | Public template gallery |
| Docs (`/docs`) | Full documentation |
| Guides (`/guides`) | Tutorials and use cases |
| API Reference (`/api`) | API docs |
| Changelog (`/changelog`) | Release notes |
| Help Center (`/help`) | Support documentation |
