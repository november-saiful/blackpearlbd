/**
 * The alignments a deal's description section can be set to.
 *
 * Values must stay in sync with the CHECK constraint in
 * `supabase/migrations/013_add_deal_description_align.sql` and with
 * `worker/src/lib/validators.ts` (DEAL_DESCRIPTION_ALIGN_VALUES).
 */
export const TEXT_ALIGN_VALUES = ['left', 'center', 'right', 'justify'] as const;

export type TextAlign = (typeof TEXT_ALIGN_VALUES)[number];

/** The default alignment for all body and content text in posts. */
export const DEFAULT_TEXT_ALIGN: TextAlign = 'justify';

/** Whether a value off the wire is one this build can draw. */
export function isTextAlign(value: unknown): value is TextAlign {
  return typeof value === 'string' && (TEXT_ALIGN_VALUES as readonly string[]).includes(value);
}

/**
 * The class for a stored alignment, or `undefined` for the default.
 *
 * Written out per value rather than built from a template: Tailwind only emits
 * a class it can SEE in the source, so `` `text-${align}` `` would ship four
 * classes that do not exist.
 *
 * `left` returns nothing on purpose. The text is already left by inheritance, so
 * a `text-left` utility would be DOM noise on every deal that never chose an
 * alignment - and one of the four has to be the one a missing value means.
 */
export function textAlignClass(align: unknown): string | undefined {
  switch (align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'left':
      return 'text-left';
    case 'justify':
    default:
      return undefined;
  }
}
