import Link from "next/link";

type LogoProps = {
  href?: string;
  size?: "md" | "lg";
};

export function Logo({ href = "/", size = "md" }: LogoProps) {
  const markSize = size === "lg" ? "h-14 w-14" : "h-9 w-9";
  const titleSize = size === "lg" ? "text-4xl sm:text-5xl md:text-7xl" : "text-base sm:text-lg";
  const subtitleSize = size === "lg" ? "text-sm" : "text-[0.6rem]";

  const content = (
    <span className="inline-flex min-w-0 items-center gap-3 text-foreground">
      <span className={`${markSize} relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-ink shadow-panel`}>
        <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(47,125,109,0.95),rgba(63,95,127,0.85)_46%,rgba(202,92,70,0.9))]" />
        <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-white/85" />
        <span className="absolute bottom-1.5 right-1.5 h-2.5 w-5 rounded-sm border border-white/80" />
        <span className="relative font-black tracking-tight text-white">LT</span>
      </span>
      <span className="grid min-w-0 leading-none">
        <span className={`${titleSize} truncate font-black tracking-normal`}>
          LT Slide Editor
        </span>
        <span className={`${subtitleSize} mt-1 truncate font-black uppercase tracking-[0.22em] text-mint`}>
          Markdown Deck Studio
        </span>
      </span>
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link aria-label="LT Slide Editor" href={href}>
      {content}
    </Link>
  );
}
