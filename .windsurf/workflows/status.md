---
description: Display agent and project status. Progress tracking and status board.
---

<!-- generated from .agent/workflows -->
# /status - Show Status

$ARGUMENTS

---

## Task

Show current project and agent status.

### What It Shows

1. **Project Info**
   - Project name and path
   - Tech stack
   - Current features

2. **Agent Status Board**
   - Which agents are running
   - Which tasks are completed
   - Pending work

3. **File Statistics**
   - Files created count
   - Files modified count

4. **Preview Status**
   - Is server running
   - URL
   - Health check

---

## Example Output

```
=== Project Status ===

ðŸ“ Project: my-ecommerce
ðŸ“‚ Path: C:/projects/my-ecommerce
ðŸ·ï¸ Type: nextjs-ecommerce
ðŸ“Š Status: active

ðŸ”§ Tech Stack:
   Framework: next.js
   Database: postgresql
   Auth: clerk
   Payment: stripe

âœ… Features (5):
   â€¢ product-listing
   â€¢ cart
   â€¢ checkout
   â€¢ user-auth
   â€¢ order-history

â³ Pending (2):
   â€¢ admin-panel
   â€¢ email-notifications

ðŸ“„ Files: 73 created, 12 modified

=== Agent Status ===

âœ… database-architect â†’ Completed
âœ… backend-specialist â†’ Completed
ðŸ”„ frontend-specialist â†’ Dashboard components (60%)
â³ test-engineer â†’ Waiting

=== Preview ===

ðŸŒ URL: http://localhost:3000
ðŸ’š Health: OK
```

---

## Technical

Status uses these scripts:
- `python .agent/scripts/session_manager.py status`
- `python .agent/scripts/auto_preview.py status`
