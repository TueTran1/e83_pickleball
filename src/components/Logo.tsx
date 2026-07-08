import Image from "next/image";

interface LogoProps {
  /** Pixel size of the logo square (default 36) */
  size?: number;
  /** Extra Tailwind classes on the outer wrapper */
  className?: string;
  /** Show the text "E83 / Câu lạc bộ Pickleball" beside the mark (default true) */
  showText?: boolean;
  /** Text size variant */
  textSize?: "sm" | "md" | "lg";
}

export default function Logo({
  size = 36,
  className = "",
  showText = true,
  textSize = "sm",
}: LogoProps) {
  const textStyles = {
    sm: { name: "text-xs font-bold text-white tracking-widest uppercase leading-none",  sub: "text-[10px] text-jade/70 mt-0.5 leading-none" },
    md: { name: "text-sm font-bold text-white tracking-widest uppercase leading-none",  sub: "text-[11px] text-jade/70 mt-0.5 leading-none" },
    lg: { name: "text-base font-bold text-white tracking-widest uppercase leading-none", sub: "text-xs text-jade/70 mt-1 leading-none" },
  }[textSize];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo.png"
        alt="E83 Pickleball Logo"
        width={size}
        height={size}
        className="rounded-xl shrink-0"
        style={{ width: size, height: size }}
        priority
      />
      {showText && (
        <div>
          <p className={textStyles.name}>E83</p>
          <p className={textStyles.sub}>Câu lạc bộ Pickleball</p>
        </div>
      )}
    </div>
  );
}
