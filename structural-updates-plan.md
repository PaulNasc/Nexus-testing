# Structural Updates Plan

## Goal
Implement UI/UX improvements (Dashboard, Modals) and a comprehensive User Groups & Onboarding system with scalable, secure architecture.

## Tasks
- [ ] Task 1: Fix Dashboard "0"s and add invisible scrollbar to Recent Activity card → Verify: Check Dashboard activity list visually.
- [ ] Task 2: Refactor Detail Modals to show only 1 ID tag (clickable to copy ID + Title) → Verify: Open any detail modal, click ID tag, paste clipboard to ensure format is "ID - Title".
- [ ] Task 3: Adjust Modals Team Container to show 2 avatars + "+X" with tooltip → Verify: Open a modal with >2 interested users, hover over "+X" to see tooltip.
- [ ] Task 4: Compact Detail Modals to fill blank spaces and move Branch dropdown up in Plan Modals → Verify: Open plan modal, check layout compactness and branch dropdown position.
- [ ] Task 5: Database Schema for Groups: Create `groups`, `group_members` tables (or update existing roles logic) and default groups → Verify: Check Supabase schema.
- [ ] Task 6: Implement "Groups" tab in User Management to manage groups and users without a group (with manual notification button) → Verify: Open User Management, view/edit groups.
- [ ] Task 7: Implement persistent Onboarding Modal for role/group request ("Welcome, what team are you part of?") → Verify: Login with new user without role, modal appears, can skip.
- [ ] Task 8: Implement push notification logic (every 20min) for users without a role/group → Verify: Notification timer triggers appropriately.
- [ ] Task 9: Update "Interested Team" dropdowns in all forms/modals to group users by their Group (expandable, group icons, select all) → Verify: Open create/edit modal, test team dropdown.

## Done When
- [ ] All UI glitches ("0"s, duplicate IDs, large empty spaces) are resolved.
- [ ] Team container correctly truncates and shows tooltips.
- [ ] Groups can be managed in User Management.
- [ ] New users see the persistent onboarding modal.
- [ ] Team selection dropdowns support nested groups and single-user selection.
