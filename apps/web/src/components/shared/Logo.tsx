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

const assetByVariant: Record<LogoVariant, string> = {
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
  const src = assetByVariant[variant];
  const alt = variant === "glyph" ? "Rune compact logo" : "Rune logo";
  const width = variant === "glyph" ? 36 : 124;
  const height = variant === "glyph" ? 36 : 32;

  const content = (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={cn("block h-auto w-auto", className)}
    />
  );

  if (!href) {
    return (
      <span
        className={cn(
          "inline-flex items-center leading-none",
          wrapperClassName,
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center leading-none", wrapperClassName)}
    >
      {content}
    </Link>
  );
}
