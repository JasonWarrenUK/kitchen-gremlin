/**
 * Per-user view preferences (SPEC §4.1): formatting & readability only.
 * The library is shared; rendering is per-user — so these live in
 * localStorage on each device, not in the shared recipe data.
 */

export interface ViewPrefs {
	/** Multiplier applied to recipe body text. */
	textScale: number;
	/** Extra line height for easier scanning. */
	relaxedLineHeight: boolean;
	/** Render method steps as a tickable checklist (ADHD-friendly mode). */
	stepsAsChecklist: boolean;
}

const STORAGE_KEY = 'kg:viewPrefs';

const DEFAULTS: ViewPrefs = {
	textScale: 1,
	relaxedLineHeight: false,
	stepsAsChecklist: false,
};

function load(): ViewPrefs {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ViewPrefs>) };
	} catch {
		return { ...DEFAULTS };
	}
}

class PrefsStore {
	current = $state<ViewPrefs>(load());

	update(patch: Partial<ViewPrefs>) {
		this.current = { ...this.current, ...patch };
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current));
		} catch {
			// Storage unavailable (private mode etc.) — prefs stay session-only
		}
	}

	reset() {
		this.update({ ...DEFAULTS });
	}
}

export const viewPrefs = new PrefsStore();

export const TEXT_SCALES = [
	{ value: 1, label: 'Normal' },
	{ value: 1.15, label: 'Large' },
	{ value: 1.3, label: 'Extra large' },
];
