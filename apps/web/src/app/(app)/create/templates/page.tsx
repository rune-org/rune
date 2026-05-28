"use client";

import { Suspense } from "react";
import { Container } from "@/components/shared/Container";
import { TemplateGallery } from "./_components/TemplateGallery";

export default function TemplatesPage() {
  return (
    <Container className="flex flex-col gap-8 py-10" widthClassName="max-w-6xl">
      <Suspense fallback={<GalleryFallback />}>
        <TemplateGallery />
      </Suspense>
    </Container>
  );
}

function GalleryFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-12 w-48 animate-pulse rounded-md bg-muted/40" />
      <div className="h-10 w-full animate-pulse rounded-md bg-muted/30" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-lg border border-input bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
