# BetterBites

A personalized recipe transformation app. Paste any recipe, and BetterBites rewrites it around your allergies, dietary preferences, health goals, budget, and safety needs.

---

## Project Description

Our project is a recipe transformation website that helps users make personalized versions of recipes they find based on their nutrition goals, dietary restrictions, and personal preferences. It is tailored to all adults, including the elderly and pregnant women. Users first create a profile with important nutrition-related information, such as BMI, allergies, health goals, medical history, food preferences, and budget. Then, they can input a recipe (personal or something they found on the internet), and the platform uses AI to analyze the ingredients, suggest personalized substitutions, provide nutrition information, generate a modified recipe, and grocery list. Users are also able to rate the recipes they try. These ratings help the platform understand what the user likes and dislikes. Over time, the AI uses this past feedback and recipe data to generate better recipe recommendations that are more personalized and tailored to each user’s taste, goals, and dietary needs.
The website can be especially helpful for people who struggle with strict diets, such as patients managing diabetes, high blood pressure, high cholesterol, food allergies, or weight-related health goals. Many patients are told what they “should” eat, but they are not always given practical recipes that match their taste, budget, culture, or lifestyle. It does not shame users for their food choices. Instead, it helps them find realistic meals they would actually enjoy. It can scale to many users because profiles, recipe ratings, and AI-generated recommendations can improve over time. It can also expand to more dietary categories, languages, cultures, grocery stores, and healthcare settings. 
Our platform helps bridge that gap by turning health recommendations into realistic meal suggestions. Hospitals, doctors, dietitians, and caregivers could also use this website as a supportive tool when helping patients make better food choices. For example, if a patient dislikes certain foods, follows religious/cultural diets, needs to lose/gain weight, or needs low-sodium or low-sugar meals, the platform can suggest personalized recipes that fit those needs. This can make medical nutrition advice easier to follow and more patient-centered. 
The website is designed to be easy to use, especially for elderly users, with clear navigation, simple buttons, and a clean layout. Recipes can also be saved and archived so users can return to them later. Recipes can then be “added to cart” within a different tab and put into a grocery checklist. The progress can be monitored through a bar at the top of the page. 
Importantly, this website is not meant to replace doctors, dietitians, or medical diagnoses. Instead, it supports healthcare professionals by helping translate dietary guidance into meal ideas that patients can actually use. For risky medical conditions, allergies, pregnancy, eating disorders, or major diet changes, users should always consult a doctor or licensed dietitian

---

## Set up instructions 

Clone the repository, install dependencies with npm install, then create a local .env.local file based on .env.example. The app expects environment variables for Supabase, Claude, USDA, and FatSecret, including NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ANTHROPIC_API_KEY, USDA_API_KEY, FATSECRET_CLIENT_ID, and FATSECRET_CLIENT_SECRET. Run the app locally with npm run dev, or build it with npm run build. You also need to create the Supabase tables for profiles and recipes before cloud sync will work.

---
## What It Does

Users create a nutrition profile once. Then, in the Chef tab, they paste or type any recipe. The app transforms it into a personalized version and shows a simplified result — ingredient swaps, before/after nutrition, scores, cost summary, and safety warnings. Transformed recipes can be saved, rated, and aggregated into a grocery list.

> BetterBites is not medical advice or a medical diagnostic tool. For high-risk concerns (pregnancy, medications, severe allergies, medical conditions), consult a doctor or healthcare professional.

---

## Core User Flow

1. Create a nutrition profile
2. Open the Chef tab and paste a recipe
3. App transforms the recipe based on your profile
4. View simplified results first (scores, ingredients, cost, warnings)
5. Expand for full detail or visit the Why This? tab
6. Save the recipe
7. Saved recipes appear in the Recipes tab (with star ratings)
8. Ingredients from saved recipes roll up into the Grocery List tab

---

## App Tabs

| Tab | Purpose |
|---|---|
| Chef | Paste a recipe and get a personalized transformation |
| Recipes | View, rate, and manage your saved recipes |
| Grocery List | Aggregated ingredients from all saved recipes with estimated costs |
| Why This? | Expandable explanations of why each change was made |
| Profile | View and edit your nutrition profile |

---

## Profile Fields Collected

- Age, gender, height, weight (BMI calculated automatically)
- Activity level
- Medical conditions and medications (optional)
- Pregnancy status (if relevant)
- Allergies and dietary preferences (vegan, halal, gluten-free, etc.)
- Nutrition goals (weight loss, muscle gain, heart health, etc.)
- Disliked foods and appetite level
- Weekly grocery budget
- Chewing/swallowing difficulty questions (shown only if age ≥ 65)

---

## Transformation Output

Each transformed recipe shows:

- Personalized recipe name
- Final ingredients and procedure
- Before/after nutrition snapshot (calories, protein, carbs, fat, fiber)
- Scores: Overall, Health, Taste, Transformation, Budget
- Estimated cost and budget remaining
- Key warnings and safety flags
- Short explanation of why changes were made
- Medical disclaimer when high-risk factors are detected

---

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Backend / Auth / DB:** Supabase (magic link auth, PostgreSQL with RLS)
- **AI:** Claude API (Anthropic)
- **Static data:** JSON files for nutrition rules, safety rules, and simulated grocery prices

---

## Folder Structure

```
BiteBetter/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Redirects to onboarding or dashboard
│   │   ├── onboarding/page.tsx       # Multi-step profile wizard
│   │   ├── dashboard/
│   │   │   ├── layout.tsx            # Sidebar + tab shell
│   │   │   ├── chef/page.tsx
│   │   │   ├── recipes/page.tsx
│   │   │   ├── grocery-list/page.tsx
│   │   │   ├── why-this/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── api/
│   │       ├── profile/route.ts
│   │       ├── transform-recipe/route.ts
│   │       ├── recipes/route.ts
│   │       ├── recipes/[id]/route.ts
│   │       └── grocery-list/route.ts
│   ├── components/
│   │   ├── ui/                       # Shared primitives
│   │   ├── onboarding/               # ProfileWizard + step components
│   │   ├── chef/                     # RecipeInput, TransformResult, ScoreBadges, etc.
│   │   ├── recipes/                  # RecipeCard, StarRating
│   │   └── grocery/                  # GroceryListView
│   ├── lib/
│   │   ├── supabase/                 # Browser + server clients
│   │   ├── recipe-transformer.ts     # Core transformation logic
│   │   ├── scoring.ts
│   │   ├── safety.ts
│   │   ├── grocery-prices.ts
│   │   └── bmi.ts
│   ├── data/
│   │   ├── nutrition-rules.json
│   │   ├── safety-rules.json
│   │   └── grocery-prices.json
│   └── types/
│       ├── profile.ts
│       ├── recipe.ts
│       └── scores.ts
```

---

## Supabase Tables

| Table | Purpose |
|---|---|
| `profiles` | One row per user, stores all profile fields. RLS: user sees only their own row. |
| `recipes` | Saved transformed recipes (includes original text + full transformation as JSONB). RLS: user sees only their own rows. |

Grocery list is derived client-side from saved recipe ingredients — no separate table needed.

---

## API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/profile` | Fetch current user's profile |
| POST | `/api/profile` | Create or upsert profile |
| POST | `/api/transform-recipe` | Transform a pasted recipe |
| GET | `/api/recipes` | List saved recipes |
| POST | `/api/recipes` | Save a transformed recipe |
| PATCH | `/api/recipes/[id]` | Update star rating |
| DELETE | `/api/recipes/[id]` | Delete a saved recipe |
| GET | `/api/grocery-list` | Aggregated ingredients from all saved recipes |

---

## Build Phases

| Phase | Scope | Est. Time |
|---|---|---|
| 1 | Project bootstrap (Next.js, Tailwind, Supabase setup) | ~1 hour |
| 2 | Auth + profile onboarding wizard | ~2 hours |
| 3 | Recipe transformer core (rule-based) + Chef tab UI | ~3 hours |
| 4 | Save recipes + Recipes tab + star ratings | ~1 hour |
| 5 | Grocery List tab | ~45 min |
| 6 | Claude API integration (swap in for rule-based) | ~1.5 hours |
| 7 | Why This? tab, Profile tab, polish | ~1 hour |

---

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).

2. Create `.env.local` in the project root (do **not** commit this file):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

3. Run the following SQL in the Supabase SQL editor:

```sql
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  profile jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  recipe jsonb not null,
  rating int,
  feedback jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Notes:**
- `.env.local` is gitignored — never commit it.
- This MVP uses a hard-coded `demo-user` ID and has no authentication.
- Before going to production, add Supabase Auth and enable Row Level Security (RLS) so each user only sees their own data.
- If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are missing, the app falls back to localStorage-only mode automatically.

---

## What Is Simulated in the MVP

| Feature | MVP Approach | Future |
|---|---|---|
| Recipe parsing | Regex line splitting | NLP / Claude parsing |
| Nutrition estimates | USDA FoodData Central (static JSON fallback) | Real-time USDA with better matching |
| Grocery prices | `grocery-prices.json` flat file | Real grocery API |
| Taste Score | Formula based on substitution count | User rating feedback loop |
| Personalization from ratings | Not yet implemented | Feed ratings back to transformer |
| Why This? explanations | Dynamic per-recipe explanations | Claude-generated deep analysis |

---

## USDA FoodData Central Setup

Nutrition estimates use the [USDA FoodData Central API](https://fdc.nal.usda.gov/) when a key is available, and fall back to the built-in `nutrition-rules.json` table automatically.

1. Get a free API key at [fdc.nal.usda.gov/api-guide.html](https://fdc.nal.usda.gov/api-guide.html).

2. Add to `.env.local` (do **not** commit this file):
   ```
   USDA_API_KEY=your_key_here
   ```

3. The app uses USDA data when available and silently falls back to the static JSON if the key is missing, USDA is unreachable, or fewer than 2 ingredients can be matched.

4. Looked-up ingredient nutrition is cached in `localStorage` (`bitebetter_usda_cache`) to avoid redundant API calls.

**Important:** `USDA_API_KEY` is read only in server-side API routes. Never use `NEXT_PUBLIC_` for this key.

---

## FatSecret Setup

FatSecret is an optional second-tier nutrition source. It is used only when USDA cannot match enough ingredients. Static `nutrition-rules.json` remains the final fallback.

1. Create a free developer account at [platform.fatsecret.com](https://platform.fatsecret.com/api/).

2. Add to `.env.local`:
   ```
   FATSECRET_CLIENT_ID=your_client_id
   FATSECRET_CLIENT_SECRET=your_client_secret
   ```

3. The app uses OAuth 2.0 client credentials flow automatically — no setup beyond adding the credentials.

4. FatSecret lookups are cached in `localStorage` (`bitebetter_fatsecret_cache`) to avoid redundant API calls.

**Nutrition source priority:** USDA → FatSecret → static `nutrition-rules.json`

**Important:** `FATSECRET_CLIENT_ID` and `FATSECRET_CLIENT_SECRET` are read only in server-side API routes. Never use `NEXT_PUBLIC_` for these values.
