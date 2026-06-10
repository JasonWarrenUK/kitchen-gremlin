/** Date helpers for the meal planner. All dates are local-time YYYY-MM-DD keys. */

export function toDateKey(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y!, m! - 1, d!);
}

/** Monday-start week containing the given date. */
export function startOfWeek(date: Date): Date {
	const result = new Date(date);
	const day = result.getDay(); // 0 = Sunday
	const diff = day === 0 ? -6 : 1 - day;
	result.setDate(result.getDate() + diff);
	result.setHours(0, 0, 0, 0);
	return result;
}

export function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

/** The 7 date keys of the week starting at weekStart. */
export function weekDateKeys(weekStart: Date): string[] {
	return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(weekStart, i)));
}

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const RANGE_FORMAT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

export function formatDay(key: string): string {
	return DAY_FORMAT.format(fromDateKey(key));
}

export function formatWeekRange(weekStart: Date): string {
	return `${RANGE_FORMAT.format(weekStart)} – ${RANGE_FORMAT.format(addDays(weekStart, 6))}`;
}
