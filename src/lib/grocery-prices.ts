import priceData from "@/data/grocery-prices.json";
import type { GroceryItem, TransformedIngredient } from "@/types/recipe";

interface PriceEntry {
  id: string;
  keywords: string[];
  price_per_100g: number;
}

// ─── Unit → grams conversion (same as in transformer) ─────────────────────

const UNIT_GRAMS: Record<string, number> = {
  cup: 240, tbsp: 15, tsp: 5,
  oz: 28, lb: 454, g: 1, kg: 1000,
  ml: 1, l: 1000,
  clove: 5, slice: 25, piece: 100, can: 400,
  stalk: 40, sprig: 5, bunch: 80, head: 400,
};

function estimateGramsFromText(transformedText: string): number {
  const amountPattern = /^(\d+(?:\.\d+)?(?:\/\d+)?)/;
  const unitPattern =
    /\b(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|lbs?|grams?|g|kgs?|ml|liters?|litres?|l|cloves?|slices?|pieces?|cans?|stalks?|sprigs?|bunches?|heads?)\b/i;

  const amountMatch = transformedText.match(amountPattern);
  const unitMatch = transformedText.match(unitPattern);

  const amount = amountMatch ? parseFloat(amountMatch[1]) : 1;
  const unit = unitMatch ? unitMatch[1].toLowerCase().replace(/s$/, "") : "";
  const gramMult = UNIT_GRAMS[unit] ?? 100;

  return amount * gramMult;
}

function findPriceEntry(text: string): PriceEntry {
  const lower = text.toLowerCase();
  let best: PriceEntry | null = null;
  let bestLen = 0;

  for (const entry of priceData as PriceEntry[]) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase()) && kw.length > bestLen) {
        best = entry;
        bestLen = kw.length;
      }
    }
  }

  // Fallback to "default" entry
  if (!best) {
    best = (priceData as PriceEntry[]).find((e) => e.id === "default")!;
  }
  return best!;
}

// ─── Public API ────────────────────────────────────────────────────────────

export function estimateGroceryCost(
  transformedIngredients: TransformedIngredient[],
  servings: number
): { groceryItems: GroceryItem[]; totalCost: number; costPerServing: number } {
  const groceryItems: GroceryItem[] = [];
  let totalCost = 0;

  for (const ing of transformedIngredients) {
    const displayText = ing.transformed;
    const grams = estimateGramsFromText(displayText);
    const priceEntry = findPriceEntry(displayText);
    const price = (grams / 100) * priceEntry.price_per_100g;

    // Extract a clean item name (remove amount/unit from start)
    const nameClean = displayText
      .replace(/^[\d.\s\/]+/, "")
      .replace(/^(cup|tbsp|tsp|oz|lb|g|kg|ml|l|clove|slice|piece|can|stalk|head)s?\s+/i, "")
      .trim();

    groceryItems.push({
      name: nameClean || displayText,
      amount: displayText,
      estimatedPrice: Math.round(price * 100) / 100,
    });

    totalCost += price;
  }

  const rounded = Math.round(totalCost * 100) / 100;
  const perServing = servings > 0 ? Math.round((rounded / servings) * 100) / 100 : rounded;

  return { groceryItems, totalCost: rounded, costPerServing: perServing };
}
