export function ScreenHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="m-0 font-display font-extrabold text-[40px] leading-[1.05] tracking-tight">
        {title}
      </h1>
    </div>
  );
}
