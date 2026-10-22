/** The volt ball and the wordmark. */
export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden
        className="h-[26px] w-[26px] rounded-full bg-ball shadow-[inset_0_0_0_2px_#00000014,inset_-4px_-5px_0_#00000014]"
      />
      <span className="font-serif text-lg font-semibold tracking-[-0.01em]">Pickleball Desk</span>
    </span>
  );
}
