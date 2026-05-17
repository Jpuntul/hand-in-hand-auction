"use client";

import { Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

export function ImageUpload({
  value,
  onChange,
  max = 3,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList) => {
    const slots = max - value.length;
    if (slots <= 0) {
      toast.error(`Maximum ${max} images per item`);
      return;
    }
    const toUpload = Array.from(files).slice(0, slots);

    setUploading(true);
    const supabase = createClient();
    const newUrls: string[] = [];

    for (const file of toUpload) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("item-images")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadErr) {
        toast.error(`${file.name}: ${uploadErr.message}`);
        continue;
      }

      const { data } = supabase.storage
        .from("item-images")
        .getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (newUrls.length > 0) {
      onChange([...value, ...newUrls]);
    }
  };

  const remove = (url: string) => {
    onChange(value.filter((u) => u !== url));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {value.map((url) => (
          <div
            key={url}
            className="group relative aspect-square overflow-hidden rounded-md border"
          >
            <Image
              src={url}
              alt=""
              fill
              sizes="(max-width: 640px) 33vw, 200px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <label
            className={`flex aspect-square cursor-pointer items-center justify-center rounded-md border-2 border-dashed transition-colors ${
              uploading
                ? "bg-muted/40 cursor-wait"
                : "hover:bg-muted/40"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  void handleFiles(e.target.files);
                }
              }}
            />
            <Upload
              className={`h-6 w-6 ${uploading ? "animate-pulse" : "text-muted-foreground"}`}
            />
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Up to {max} images · JPEG, PNG, WebP, or GIF · max 5MB each
      </p>
    </div>
  );
}
