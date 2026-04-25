import type { ParsedIngredient, ParsedRecipe } from "@/types/recipe";

// ─── Amount parsing ────────────────────────────────────────────────────────

function parseAmount(s: string): number {
  const t = s.trim();
  // "1 1/2"
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  // "1/2"
  const fraction = t.match(/^(\d+)\/(\d+)$/);
  if (fraction) return parseInt(fraction[1]) / parseInt(fraction[2]);
  return parseFloat(t) || 0;
}

// ─── Unit normalization ────────────────────────────────────────────────────

const UNIT_ALIASES: Record<string, string> = {
  cups: "cup",
  tbsps: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsps: "tsp",
  ounces: "oz",
  ounce: "oz",
  pounds: "lb",
  pound: "lb",
  lbs: "lb",
  grams: "g",
  gram: "g",
  kilograms: "kg",
  kilogram: "kg",
  milliliters: "ml",
  milliliter: "ml",
  liters: "l",
  liter: "l",
  litres: "l",
  litre: "l",
  cloves: "clove",
  slices: "slice",
  pieces: "piece",
  cans: "can",
  stalks: "stalk",
  sprigs: "sprig",
  bunches: "bunch",
  heads: "head",
};

function normalizeUnit(u: string): string {
  const lower = u.toLowerCase();
  return UNIT_ALIASES[lower] ?? lower;
}

// ─── Ingredient line parser ────────────────────────────────────────────────

const UNIT_PATTERN =
  /^(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|lbs?|pounds?|grams?|g|kgs?|kilograms?|ml|milliliters?|liters?|litres?|l|cloves?|slices?|pieces?|cans?|stalks?|sprigs?|bunches?|heads?)\s*/i;

const AMOUNT_PATTERN =
  /^(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s*/;

const VAGUE_PREFIXES =
  /^(some|a handful|to taste|as needed|a pinch|a bit|a dash|several|a few|optional|garnish)/i;

export function parseIngredientLine(raw: string): ParsedIngredient {
  // Strip bullets, numbers, leading punctuation
  const line = raw.replace(/^[\s\-•*–\d.):]+/, "").trim();
  if (!line) return { raw, amount: undefined, unit: undefined, item: raw, isVague: true };

  let remaining = line;
  let amount: number | undefined;
  let unit: string | undefined;

  // Try to parse amount
  const numMatch = remaining.match(AMOUNT_PATTERN);
  if (numMatch) {
    amount = parseAmount(numMatch[1]);
    remaining = remaining.slice(numMatch[0].length);
  }

  // Try to parse unit
  const unitMatch = remaining.match(UNIT_PATTERN);
  if (unitMatch) {
    unit = normalizeUnit(unitMatch[1]);
    remaining = remaining.slice(unitMatch[0].length);
  }

  // What's left is the item name — strip trailing prep notes after comma
  const item = remaining
    .replace(/,.*$/, "")
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase();

  const isVague =
    VAGUE_PREFIXES.test(line) ||
    (!amount && !line.match(/^\d/)) ||
    item.length === 0;

  return {
    raw: raw.trim(),
    amount,
    unit,
    item: item || line,
    isVague,
  };
}

// ─── Section detection ─────────────────────────────────────────────────────

const INGREDIENT_HEADER =
  /^(ingredients?|what you.?ll need|shopping list|you will need)[:\s]*$/i;

const INSTRUCTION_HEADER =
  /^(instructions?|directions?|method|steps?|how to make|how to prepare|preparation|to make|to prepare|procedure)[:\s]*$/i;

const SERVING_PATTERN =
  /(?:serves?|makes?|yields?|servings?|portions?)[:\s]+(\d+)/i;

function isBlankOrHeader(line: string): boolean {
  return (
    line.length === 0 ||
    INGREDIENT_HEADER.test(line) ||
    INSTRUCTION_HEADER.test(line)
  );
}

// Heuristic: lines that look like instructions (long sentences, start with verb, numbered steps)
function looksLikeInstruction(line: string): boolean {
  const stripped = line.replace(/^\d+[\.\)]\s*/, "").trim();
  // Long lines or lines starting with action verbs are instructions
  if (stripped.length > 60) return true;
  const actionVerbs =
    /^(heat|add|mix|stir|cook|bake|fry|sauté|saute|boil|simmer|combine|season|place|pour|remove|serve|let|bring|reduce|whisk|fold|drain|rinse|chop|dice|slice|mince|preheat|prepare|transfer|spread|cover|cool|set|allow|top|garnish|sprinkle|toss|coat|brush|baste|roast|grill|steam|blend|puree|strain|squeeze|marinate|rest)/i;
  return actionVerbs.test(stripped);
}

// ─── Main parser ───────────────────────────────────────────────────────────

export function parseRecipe(text: string): ParsedRecipe {
  const rawLines = text.split("\n").map((l) => l.trim());
  const lines = rawLines.filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      recipeName: "Unnamed Recipe",
      servings: 4,
      ingredients: [],
      instructions: [],
      missingInfoQuestions: ["Recipe appears to be empty. Please paste the full recipe."],
    };
  }

  // ── Recipe name: first non-blank line that doesn't look like a section header
  let recipeName = "Your Recipe";
  for (const line of lines) {
    if (!INGREDIENT_HEADER.test(line) && !INSTRUCTION_HEADER.test(line) && !SERVING_PATTERN.test(line)) {
      recipeName = line;
      break;
    }
  }

  // ── Servings
  let servings = 4;
  for (const line of lines) {
    const m = line.match(SERVING_PATTERN);
    if (m) {
      servings = Math.max(1, parseInt(m[1]));
      break;
    }
  }

  // ── Find section boundaries
  const ingHeaderIdx = lines.findIndex((l) => INGREDIENT_HEADER.test(l));
  const instHeaderIdx = lines.findIndex((l) => INSTRUCTION_HEADER.test(l));

  let ingredientLines: string[] = [];
  let instructionLines: string[] = [];

  if (ingHeaderIdx >= 0 && instHeaderIdx > ingHeaderIdx) {
    // Clean split between Ingredients and Instructions
    ingredientLines = lines
      .slice(ingHeaderIdx + 1, instHeaderIdx)
      .filter((l) => !isBlankOrHeader(l) && !SERVING_PATTERN.test(l));
    instructionLines = lines
      .slice(instHeaderIdx + 1)
      .filter((l) => !isBlankOrHeader(l));
  } else if (ingHeaderIdx >= 0) {
    // Only found ingredients header
    ingredientLines = lines
      .slice(ingHeaderIdx + 1)
      .filter((l) => !isBlankOrHeader(l) && !looksLikeInstruction(l));
    instructionLines = lines
      .slice(ingHeaderIdx + 1)
      .filter((l) => looksLikeInstruction(l));
  } else if (instHeaderIdx >= 0) {
    // Only found instructions header
    instructionLines = lines.slice(instHeaderIdx + 1).filter((l) => !isBlankOrHeader(l));
    ingredientLines = lines
      .slice(1, instHeaderIdx)
      .filter((l) => !isBlankOrHeader(l) && !SERVING_PATTERN.test(l));
  } else {
    // No headers — heuristic split
    const body = lines.slice(1).filter((l) => !SERVING_PATTERN.test(l));
    for (const line of body) {
      if (looksLikeInstruction(line) || line.match(/^\d+[\.\)]\s+[A-Z]/)) {
        instructionLines.push(line);
      } else {
        ingredientLines.push(line);
      }
    }
  }

  // ── Parse ingredients
  const ingredients = ingredientLines
    .map((l) => parseIngredientLine(l))
    .filter((i) => i.item.length > 1);

  // ── Parse instructions (strip leading numbers/bullets)
  const instructions = instructionLines
    .map((l) => l.replace(/^\d+[\.\)]\s*/, "").replace(/^[-•*]\s*/, "").trim())
    .filter((l) => l.length > 4);

  // ── Missing info questions for vague ingredients
  const missingInfoQuestions = ingredients
    .filter((i) => i.isVague && i.item.length > 1)
    .slice(0, 4)
    .map((i) => `How much ${i.item}? (e.g., "1 cup" or "100g")`);

  return { recipeName, servings, ingredients, instructions, missingInfoQuestions };
}
