# Roomie — Shared-Living Companion

A premium mobile app that helps roommates, couples and flatmates run their shared home from one place: chores, kitchen inventory, groceries, shared expenses and a virtual food budget.
A built-in Kitchen AI suggests meals from what is already at home, prioritising food that expires soon and staying within budget.

## Who it's for
- Friends, flatmates and students sharing an apartment
- Couples running a joint household
- Any group of 2–6 people who want to stop coordinating chores, food and money over chat

## Core features and experience (Phase 1 — MVP)

**Accounts and households**
- Sign up / log in with email + password, or Google; forgot-password by email
- After signup: create a household (name, optional icon) and get a 6-character invite code to copy or share, or join one by code (shows house name and current members before joining)
- Household profile: members with role (Owner/Member), task count and contribution; owner can remove members and edit settings
- Basic preferences during onboarding (diet type, allergies, disliked foods) that the AI respects

**Home dashboard**
- Greeting by time of day, avatar, notification bell
- Gradient hero card with tonight's meal suggestion
- Shared food budget: remaining, spent this month, total
- Oversized metric cards: tasks today, groceries needed, inventory count, amount you owe
- Today's tasks, "Use soon" items close to expiry, "Ask AI" prompt

**Tasks and chores**
- Create tasks with assignee, due date/time, priority, category, notes and repeat (daily, weekly, monthly, custom interval)
- Status: Pending, In Progress, Completed, Overdue (overdue worked out automatically)
- Filters: All, Mine, Today, Upcoming, Completed
- Completing records who completed it and when, with a subtle animation
- Chore rotation: "Rotate automatically" passes the next occurrence to the next member
- Simple non-competitive stats: completed this week, pending, streak

**Inventory**
- Big item count, "expiring soon" count, search, category chips (Vegetables, Fruits, Meat, Dairy, Grains, Snacks, Drinks, Spices, Frozen, Other)
- Items have name, quantity, unit (kg, g, L, ml, pcs, packs, bottles, custom), category, purchase and expiry dates, estimated value, optional minimum quantity, notes, added by
- Expiry status in colour and in words: Fresh, Soon, Urgent, Expired
- Quick Add for common items (Eggs, Milk, Rice, Bread, Tomato, Onion, Chicken)
- Item detail: Use Item (enter amount used; quantity updates), Edit, Add to Grocery, Delete
- When an item hits zero, prompt: "Item finished. Add to grocery list?"
- Low Stock badge when below the minimum, with one-tap Add to Grocery

**Groceries**
- Count and estimated total; filters All, Needed, Purchased
- Each item shows why it was added: Manual, Low Stock, AI Meal
- Check, edit, change quantity, delete
- Purchase flow: enter actual cost and quantity → item is marked purchased, added to inventory, recorded as an expense, and (optionally) deducted from the food budget — all in one step

**Expenses and settle up**
- This month's total with category cards (Groceries, Utilities/Bills, Rent, Food, Other) and filter pills
- Transactions show title, payer, amount, date and split
- Add expense: title, amount, category, paid by, date, notes; split Equal, Custom (must add up to total) or Only Me
- Balances calculated automatically: "Alex owes John ₹500" with Mark Settled, which records a settlement
- Ledger only — no real money moves

**Shared food budget**
- Available balance, each member's contributions, total spent, remaining
- Add Contribution, Add Expense, full history (contribution, expense, refund, adjustment)

**Kitchen AI (Gemini 3 Flash)**
- Dedicated screen, "Cook smarter with what you already have"
- Quick action cards: What can we cook?, No-Spend Meals, Under ₹100, Under ₹200, Use Before Expiry, Quick, Healthy, High Protein, Vegetarian, Breakfast, Lunch, Dinner, Snacks
- Free-text requests as well
- The AI receives the real inventory, expiry days, household size, available budget and dietary preferences
- Each meal card shows: name, time, difficulty, servings, ingredients you have, missing ingredients, extra cost (₹0 / ₹35 / ₹80), why it was recommended, recipe steps
- Cook This: ingredient checklist → confirm → "Update inventory?" → quantities deducted only after confirmation
- Add Missing to Grocery: confirmation listing the items → added with source "AI Meal"
- AI never changes data by itself; friendly fallback with Retry if AI is unavailable
- Recent suggestions are kept so meal history can inform future picks

**Live sync**
- Tasks, groceries, inventory, expenses and budget update on every member's phone without refreshing

**Throughout**
- Polished empty states ("Your kitchen looks empty."), skeleton loading, AI loading messages ("Checking your inventory…")
- Clear errors for bad invite code, invalid quantity, negative amounts, splits that don't add up, network loss and AI limits
- Offline banner; unsent form input is kept
- Product name editable in one place

## User flow
1. Open app → Welcome → Sign up (name, email, password) or Google
2. Create house (get invite code, share) or Join house (enter code, confirm)
3. Set dietary preferences → Home
4. Add first inventory items → add a food-budget contribution → create first task
5. Center "+" button opens a sheet: Ask AI, Add Task, Add Inventory, Add Grocery, Add Expense
6. Ask AI "What can we cook?" → pick a meal → Add Missing to Grocery
7. Buy groceries → mark purchased with actual cost → becomes inventory + expense + budget deduction
8. Cook This → confirm ingredients → inventory reduced
9. Roommate joins with the code, sees and completes assigned tasks, adds groceries — everyone sees changes live
10. Expenses screen shows who owes whom → Mark Settled

Navigation: floating black pill bar with Home, Tasks, center "+" (AI/Add), Inventory, Profile. Groceries, Expenses and Budget are reached from dashboard cards and the Profile menu.

## UI/UX feel
- Premium consumer lifestyle/finance app, not an admin dashboard
- Warm off-white backgrounds (#FAFAF8 / #F7F7F5), near-black (#101010) text, primary buttons and active nav
- Large rounded cards (24–36px), few borders, very soft or no shadows, lots of whitespace
- Oversized numbers as the main visual device (₹1,250 · 24 Items · 3 Tasks)
- Uneven card sizes arranged like the references, horizontal snap carousels, pill filters, segmented controls, small circular icon containers
- Blurred gradients only in selected hero cards, one per section: Home warm cream/yellow, Tasks cool blue/cream, Inventory lime/olive, AI orange/yellow/light blue, Expenses coral/amber; Profile monochrome
- Subtle motion: card press scale, task-complete check, animated quantity changes, AI shimmer, tab transitions
- Designed for 390px phones first, checked at 375–430px; tablet uses 2 columns; web preview centred with a wider layout
- Status is always shown in words as well as colour; 44px minimum tap targets

**Taken from the four reference screenshots (the visual benchmark)**
- Header: circular outlined back and "more" buttons either side of a centred light-weight title; wide pill "Quick Search" field underneath
- Horizontal snap carousels of tall white cards (about 32px radius) with the next card peeking in from the right. Each card has an outlined circular icon at top left, a small warning badge on the icon when attention is needed (e.g. expiring, overdue), a pale circular ↗ button at top right, the label in the middle and a large number at bottom left with a smaller grey suffix ("24/38", "23%")
- Filter row: the active pill is solid black with white text, inactive pills are plain or softly outlined, all in one horizontal scroller
- Gradient hero cards with a soft blurred blend (olive→lime for Inventory; slate-blue→amber for AI), a faint dot-matrix texture, a thin progress ring around the icon, a black or white circular ↗ button, white text and a big number
- Warm full-screen washes: on selected screens (Home, AI) a blurred amber/gold gradient fills the top of the screen and fades into off-white, with translucent frosted stat tiles on top
- Giant centred number for the key metric on a screen (like "13,143 Steps"): used for the Home budget, Inventory item count and the Expenses monthly total
- Horizontal date strip with the selected day centred and larger, used for task due dates and, later, the meal planner and calendar
- Segmented controls: light grey track with a white selected capsule (Tasks: Today / Upcoming / Done; Budget: Overview / History)
- Two-column grid of white cards of uneven height, each with an outlined icon, a short label, a large number and a tiny sparkline or range bar with a coloured dot and word status ("Low", "Normal"), used for the Home quick metrics and Profile stats
- Finance layout (ZEN reference) for Expenses and Food Budget: big balance with the paise in lighter grey (₹4,850.00), a row of sub-balance cards, a black band of outlined pill actions (Add, Settle, Contribute, ···), then a white rounded sheet holding the transaction list with filter pills and a "View all ›" pill; amounts right-aligned with grey decimals
- Bottom navigation: stays the floating black pill requested in the brief, with minimal icons and a larger circular "+" in the middle; the active tab gets a white capsule
- Typography: a clean geometric sans-serif (e.g. Inter Tight or Geist) in light and regular weights for labels and large, tight-tracked numbers; very few bold weights

Screen mapping:
- Home: warm gold wash with a giant budget number and frosted tiles, then the meal hero and an uneven 2-column metric grid
- Tasks: date strip plus segmented control, white task cards, cool blue accent
- Inventory: search pill, big count, black-active category pills, olive/lime hero for "expiring soon", carousel of item cards with warning badges
- Groceries: finance-style list sheet with filter pills
- AI: amber wash, slate/amber gradient hero, quick-action carousel, meal cards
- Expenses / Food Budget: ZEN-style balance, black action band and transaction sheet
- Profile: monochrome with a 2-column stats grid

## Implementation phases
**Phase 1 — MVP (built now):** everything under "Core features" above.

**Phase 2:** household calendar (month and agenda views, bills/rent/cleaning/guest events), shared notes (with sensitive notes hidden in previews), AI meal planner (daily / 3-day / weekly), notification centre with read/unread and per-category settings, reminders (tasks, bills, expiry), universal search.

**Phase 3:** light analytics (monthly spend, food spend, waste avoided, tasks completed), phone push notifications, automatic low-stock grocery adds, multiple households per user, household photos, installable web app with offline caching, desktop sidebar layout.

## Assumptions
- Built as a native iOS/Android app (Expo), with a web version from the same code. It is not a Next.js PWA; installable-web-app/offline caching moves to Phase 3.
- Supabase is used as requested for accounts (email + Google), the database, live sync, access rules (members can only see their own household's data) and file storage.
- You will provide your Supabase project URL, publishable key and database connection string (or run a supplied setup script in the Supabase SQL editor) so tables and access rules can be created.
- AI calls go through a small secure server that checks the Supabase login before calling Gemini 3 Flash; the AI key is never in the app. Uses the Emergent universal key.
- Google sign-in needs a Google OAuth client added in your Supabase dashboard (steps will be given). It works on the web preview; on phones it is reliable only in a built app, not Expo Go. Email + password works everywhere.
- Email confirmation on signup is turned off for the MVP so testing is instant; it can be turned on later.
- Currency is ₹ (INR); dates in the phone's local time zone.
- One active household per user for the MVP.
- The four uploaded screenshots (credits carousel, credit factors, wellness steps, ZEN finance) are the visual benchmark. Their layout language is reused without copying any logos, brand names, text or exact layouts.
- Where the screenshots differ from the written brief, the brief wins. The bottom bar stays a floating black pill with five tabs, not the icons-plus-"+" bar in the wellness screenshot.
- Your refinement brief (bigger cards, more whitespace, oversized metrics, fewer borders, floating nav, asymmetric cards) is treated as the design standard from the start, applied to every screen.
- A demo household "Palm House" (John and Alex, sample inventory, tasks, groceries, expenses, budget) can be loaded so every screen can be tried straight away.
- Owners can remove members; any member can create, edit and complete shared items.
- Rotation cycles through all household members in join order.
- Food-budget deduction is a toggle on grocery purchases and food-category expenses, on by default.
