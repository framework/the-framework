Status: open
Topics: [UX]
GitHub: [#1150](https://github.com/gemstack-land/the-framework/issues/1150)

# Improve "Add project"

## TLDR

Replace the current "Add project" modal with the usual system file picker. Remove the "It's a folder of repos" option for now — its meaning is unclear to users; the proper directory-of-repos feature comes post-MVP (see the #1115 "directory of repos" design).

## Why it matters

Adding a project is the very first thing a new user does (onboarding step 1, #958); a custom modal with a confusing option is friction exactly where the product must feel effortless. The system file picker is the zero-explanation path.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1150](https://github.com/gemstack-land/the-framework/issues/1150), created 2026-07-25, label: `UX ✨` (the `priority: high` label was dropped on 2026-07-29).

### Original description

Remove this modal:

<img width="386" height="160" alt="Image" src="https://github.com/user-attachments/assets/3ada4a32-f61e-49be-b7b1-bfc4823951e0" />


Instead show the usual system file picker.

"It's a folder of repos" => unclear to user what it means => let's remove it for now. Let's do the proper directory of repos thing post-MVP.

Also:
- https://github.com/gemstack-land/the-framework/issues/958#issuecomment-5078541328

### Notes from the GitHub thread

- The OP now also points at a comment on #958 (Onboarding); that issue has since been closed ("mostly done") in favor of follow-ups, so the add-project onboarding context referenced there is carried by this ticket.
