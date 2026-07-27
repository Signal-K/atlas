---
id: epic-guest-experience
type: epic
title: Guest experience — lightweight, browser-storage first
status: done
priority: medium
source: "Liam, in chat, following up on 'less punishing' skip-signup feedback"
---

# Guest experience — lightweight, browser-storage first

Liam's direction: signing up should read as an offer, not a wall.
Declining it should cost nothing — everything stays saved in the
browser exactly as before — and there should be one obvious, permanent
place to "graduate" a browser's worth of local data into a real account
whenever the user is ready, rather than only being asked once at a
save-triggered popup.

Also raised in the same conversation: a claim that "notifications won't
work in Safari mobile" didn't sound right. Investigated and found a real
bug behind it (see story-reminder-notification-reliability) — Safari
mobile permission-granting works fine; the app's own reminder-firing code
was using a browser API (`new Notification()`) that MDN documents as
throwing on nearly all mobile browsers, Safari included. Not a Safari
limitation, an Atlas bug.

## Child stories

- story-guest-account-graduation
- story-reminder-notification-reliability

## Status

Both child stories done, including a follow-up fix
(story-reminder-notification-reliability's "onboarding stuck on
'Enabling...'" section) for a second, related bug found right after the
first notification fix shipped. See each story for specifics.
