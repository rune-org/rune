"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/cn";

type LogoVariant = "wordmark" | "glyph";

interface LogoProps {
  href?: string;
  variant?: LogoVariant;
  className?: string;
  wrapperClassName?: string;
  priority?: boolean;
}

const lightAsset: Record<LogoVariant, string> = {
  wordmark: "/icons/logo-white.svg",
  glyph: "/icons/logo-compact.svg",
};

const darkAsset: Record<LogoVariant, string> = {
  wordmark: "/icons/logo-white.svg",
  glyph: "/icons/logo-compact-white.svg",
};

export function Logo({
  href = "/",
  variant = "wordmark",
  className,
  wrapperClassName,
  priority,
}: LogoProps) {
  const alt = variant === "glyph" ? "Rune compact logo" : "Rune logo";
  const width = variant === "glyph" ? 36 : 124;
  const height = variant === "glyph" ? 36 : 32;

  const content =
    variant === "wordmark" ? (
      <Image
        src={darkAsset.wordmark}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn("block h-auto w-auto invert dark:invert-0", className)}
      />
    ) : (
      <>
        <Image
          src={lightAsset.glyph}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className={cn("block h-auto w-auto dark:hidden", className)}
        />
        <Image
          src={darkAsset.glyph}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className={cn("hidden h-auto w-auto dark:block", className)}
        />
      </>
    );

  if (!href) {
    return (
      <span className={cn("inline-flex items-center leading-none", wrapperClassName)}>
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={cn("inline-flex items-center leading-none", wrapperClassName)}>
      {content}
    </Link>
  );
}
