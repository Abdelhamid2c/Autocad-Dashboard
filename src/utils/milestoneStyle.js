export const MILESTONE_TYPES = ['EOP', 'SOP', 'VS', 'DOC', 'PRE_SERIAL', 'TR', 'CF', 'OTHER'];
export const PLANTS = ['YMM1', 'YMM2', 'YMOK', 'YMK', 'YMOT', 'SATELLITES'];

const FALLBACK = { color: '#F4B183', textColor: '#000000' };

export function typeMeta(types, type) {
  return (types ?? []).find((t) => t.type === type) ?? FALLBACK;
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Bar colours: user override > stored sourceColor > type colour. SOP on navy keeps yellow text as in the sheet. */
export function milestoneColors(ms, types) {
  const meta = typeMeta(types, ms.type);
  const bg = ms.colorOverride || ms.sourceColor || meta.color;
  const lower = bg.toLowerCase();
  if (meta.altColor && lower === meta.altColor.toLowerCase()) return { bg, fg: meta.altTextColor };
  if (!/^#[0-9a-f]{6}$/i.test(bg)) return { bg, fg: meta.textColor };
  return { bg, fg: luminance(bg) > 0.55 ? '#000000' : '#ffffff' };
}
