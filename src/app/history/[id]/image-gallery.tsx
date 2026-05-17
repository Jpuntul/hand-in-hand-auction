"use client";

import Image from "next/image";
import { useState } from "react";

export function ImageGallery({ urls, name }: { urls: string[]; name: string }) {
  const [active, setActive] = useState(0);

  if (!urls.length) return null;

  return (
    <div className="space-y-3">
      {/* Hero */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-muted shadow-xl">
        <div className="aspect-4/3 sm:aspect-video lg:aspect-video">
          <Image
            src={urls[active]}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 90vw"
            className="object-cover transition-opacity duration-300"
            priority
          />
        </div>
      </div>

      {/* Thumbnails */}
      {urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                i === active
                  ? "border-[#DAA520] opacity-100 shadow-md"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <Image
                src={url}
                alt={`View ${i + 1}`}
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
