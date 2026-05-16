export const MAX_MAIN_ACTIONS = 3;
export const MAX_VISIBLE_ITEMS = 5;

export function takeVisible<T>(items: T[], limit = MAX_VISIBLE_ITEMS) {
  return items.slice(0, limit);
}

export function takeHidden<T>(items: T[], limit = MAX_VISIBLE_ITEMS) {
  return items.slice(limit);
}
