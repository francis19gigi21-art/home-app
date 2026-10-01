# Roomie — PRD

## Problem statement
Complete production-ready roommate / shared-living management app: household chores, kitchen inventory with expiry, grocery list, shared expenses with settle-up, virtual shared food budget, and a Gemini-powered Kitchen AI that suggests meals from what's at home (prioritising near-expiry items and budget). Premium consumer design: off-white base, near-black accents, oversized numbers, large rounded cards, floating black pill nav.

## Stack (as deployed)
- **Frontend:** Expo (React Native + web), expo-router, @tanstack/react-query, Supabase JS, reanimated, react-native-keyboard-controller
- **Backend:** FastAPI at /api — only AI routes (Gemini 3 Flash via Emergent universal key), verifies Supabase JWT via JWKS (ES256)
- **DB/Auth/Realtime:** Supabase project `chodcbmrjkruaigrevfj` (region ap-southeast-1). Schema in /app/backend/schema.sql (tables, RLS via is_household_member/is_household_owner, invite RPCs get_household_by_invite/join_household, realtime publication). Extra FK added later: household_members.user_id → profiles.id (needed for PostgREST embeds)
- Product name/currency in /app/frontend/src/config.ts; theme tokens in /app/frontend/src/theme.ts

## Test accounts (see /app/memory/test_credentials.md)
- john@roomie.app / RoomieDemo123 (owner of "Palm House", invite PALM26)
- alex@roomie.app / RoomieDemo123 (member)

## Implemented (2026-09-30, MVP Phase 1)
- Auth: email+password (signup/login/forgot), Google button wired (provider pending user-side Google OAuth setup)
- Onboarding: create house (6-char invite code, copy/share), join by code with household preview, dietary preferences
- Home: greeting, giant budget metric, frosted sub-tiles, AI hero, metric grid (tasks/groceries/inventory/you-owe), today's tasks, use-soon carousel
- Tasks: segments Today/Upcoming/Done, All/Mine, stats (week/pending/streak), create with assignee/date-strip/time/priority/recurrence/rotation, complete→next occurrence + rotation, notifications to assignee
- Inventory: giant count, search, category pills, expiring hero, quick-add chips, detail with Use Item (quantity deduction, zero→grocery prompt), edit, low-stock tags
- Groceries: All/Needed/Purchased, add sheet, purchase flow (→ inventory + expense + budget deduction, one step), source labels
- Expenses: monthly total (grey decimals), category cards, filters, split Equal/Custom(validated)/Only-me, balances "X owes Y", Mark Settled (settlements table)
- Food budget: available/contributions/spent, contribute + budget expense, history with signed amounts
- Kitchen AI: quick actions (incl. No-Spend max_spend=0, Under ₹100/₹200), free text, structured meal cards, Cook This (confirmed inventory deduction), Add Missing → groceries (source ai_meal), friendly error + retry, history persisted
- Notifications: fan-out on task/grocery/expense events, Today/Earlier groups, mark read/all
- Household: invite code copy/share, members with role/task-count/contribution, owner remove member
- Realtime sync on all shared tables (unique channel topics per hook instance — fixed iter-1 crash)
- Offline banner (netinfo), toasts (no Alerts), skeletons, empty states everywhere

## Testing
- Iteration 1: all flows pass after tester fixed realtime duplicate-channel crash; FK gap found
- Iteration 2: FK verified, member names/splits/notifications/household/budget all pass; pytest 7/7 backend

## Backlog
- **P0 (user-side):** enable Google provider (OAuth client steps already provided); rotate the leaked sb_secret key
- **P1 (Phase 2):** calendar (month/agenda), shared notes (sensitive hidden), AI meal planner (daily/3-day/weekly), notification settings per category, reminders, universal search
- **P2 (Phase 3):** analytics cards, push notifications (needs native build), auto low-stock grocery adds, multiple households, household photos (object storage), PWA install/offline cache, desktop sidebar
- **Minor:** merge duplicate inventory rows on grocery purchase; RN-web shadow*/pointerEvents deprecation warnings

## Known limitations
- Google sign-in requires user's Google OAuth client in Supabase; native OAuth needs a built app (Expo Go limitation)
- Inventory quantity deduction assumes recipe units match inventory units
