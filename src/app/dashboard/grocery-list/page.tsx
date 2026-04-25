"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getAggregatedGroceryItems,
  setGroceryItemChecked,
} from "@/lib/saved-recipes";
import type { GroceryChecklistItem } from "@/types/recipe";

export default function GroceryListPage() {
  const [items, setItems] = useState<GroceryChecklistItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(getAggregatedGroceryItems());
    setLoaded(true);
  }, []);

  function handleToggle(key: string, checked: boolean) {
    setGroceryItemChecked(key, checked);
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, checked } : item))
    );
  }

  if (!loaded) return null;

  const totalCost = items.reduce((sum, item) => sum + item.estimatedPrice, 0);
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grocery List</h1>
          <p className="text-gray-500 mt-1 text-sm">Ingredients from your saved recipes.</p>
        </div>
        {items.length > 0 && (
          <div className="text-right">
            <span className="block text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
              Est. ${totalCost.toFixed(2)}
            </span>
            <span className="block text-xs text-gray-400 mt-1">
              {checkedCount}/{items.length} checked
            </span>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 space-y-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-700">Your grocery list is empty</h2>
            <p className="text-sm text-gray-400 mt-1">Save a recipe to add ingredients here.</p>
          </div>
          <Link
            href="/dashboard/chef"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Go to Chef
          </Link>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>{checkedCount} of {items.length} items checked</span>
              <span>{Math.round((checkedCount / items.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(checkedCount / items.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {items.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleToggle(item.key, !item.checked)}
              >
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    item.checked
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-gray-300"
                  }`}
                >
                  {item.checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Name + source */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium transition-colors ${
                      item.checked ? "line-through text-gray-400" : "text-gray-800"
                    }`}
                  >
                    {item.name}
                  </p>
                  {item.recipeNames.length > 0 && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {item.recipeNames.join(", ")}
                    </p>
                  )}
                </div>

                {/* Amounts */}
                <div className="text-right shrink-0">
                  {item.amounts.length === 1 ? (
                    <span className="text-sm text-gray-500">{item.amounts[0]}</span>
                  ) : (
                    <span className="text-xs text-gray-400">{item.amounts.length} recipes</span>
                  )}
                </div>

                {/* Price */}
                <span className="text-sm font-medium text-gray-600 w-14 text-right shrink-0">
                  ${item.estimatedPrice.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Total row */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Estimated Total</p>
            <p className="text-lg font-bold text-gray-900">${totalCost.toFixed(2)}</p>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Prices are rough estimates for demo purposes only.
          </p>
        </>
      )}
    </div>
  );
}
