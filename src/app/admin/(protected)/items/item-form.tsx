"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Item } from "@/lib/types";
import { createItem, deleteItem, updateItem } from "./actions";
import {
  defaultItemValues,
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  type ItemFormValues,
} from "./schema";

const NONE = "__none__";

type FormRaw = {
  item_no: string;
  name: string;
  description: string;
  sponsor: string;
  categories: string;
  retail_value: string;
  starting_bid: string;
  bid_increment: string;
  start_time: string;
  end_time: string;
  status: (typeof ITEM_STATUSES)[number];
  image_urls: string[];
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function itemToRaw(item: Item | null): FormRaw {
  if (!item) {
    return {
      item_no: "",
      name: "",
      description: "",
      sponsor: "",
      categories: NONE,
      retail_value: "",
      starting_bid: String(defaultItemValues.starting_bid),
      bid_increment: String(defaultItemValues.bid_increment),
      start_time: "",
      end_time: "",
      status: defaultItemValues.status,
      image_urls: [],
    };
  }
  return {
    item_no: item.item_no?.toString() ?? "",
    name: item.name,
    description: item.description ?? "",
    sponsor: item.sponsor ?? "",
    categories: item.categories ?? NONE,
    retail_value: item.retail_value?.toString() ?? "",
    starting_bid: String(item.starting_bid),
    bid_increment: String(item.bid_increment),
    start_time: toDatetimeLocal(item.start_time),
    end_time: toDatetimeLocal(item.end_time),
    status: item.status,
    image_urls: item.image_urls ?? [],
  };
}

function rawToValues(raw: FormRaw): ItemFormValues {
  return {
    item_no: raw.item_no ? Number(raw.item_no) : null,
    name: raw.name.trim(),
    description: raw.description.trim() || null,
    sponsor: raw.sponsor.trim() || null,
    categories:
      raw.categories && raw.categories !== NONE
        ? (raw.categories as ItemFormValues["categories"])
        : null,
    retail_value: raw.retail_value ? Number(raw.retail_value) : null,
    starting_bid: Number(raw.starting_bid),
    bid_increment: Number(raw.bid_increment),
    start_time: raw.start_time ? new Date(raw.start_time).toISOString() : null,
    end_time: raw.end_time ? new Date(raw.end_time).toISOString() : null,
    status: raw.status,
    image_urls: raw.image_urls,
  };
}

export function ItemForm({ item }: { item?: Item | null }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormRaw>({
    defaultValues: itemToRaw(item ?? null),
  });

  const onSubmit = async (raw: FormRaw) => {
    setSubmitting(true);
    const values = rawToValues(raw);
    const result = item
      ? await updateItem(item.id, values)
      : await createItem(values);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(item ? "Item updated" : "Item created");
    router.push("/admin/items");
    router.refresh();
  };

  const onDelete = async () => {
    if (!item) return;
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setSubmitting(true);
    const result = await deleteItem(item.id);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Delete failed");
      return;
    }
    toast.success("Item deleted");
    router.push("/admin/items");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{item ? "Edit item" : "New item"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="name" {...register("name", { required: true })} />
              {errors.name && (
                <p className="text-sm text-destructive">Name is required</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item_no">Item number</Label>
              <Input id="item_no" type="number" {...register("item_no")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sponsor">Sponsor</Label>
              <Input id="sponsor" {...register("sponsor")} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                {...register("description")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categories">Category</Label>
              <Controller
                control={control}
                name="categories"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="categories" className="w-full">
                      <SelectValue placeholder="No category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No category</SelectItem>
                      {ITEM_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retail_value">Retail value (USD)</Label>
              <Input
                id="retail_value"
                type="number"
                step="0.01"
                {...register("retail_value")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="starting_bid">
                Starting bid <span className="text-destructive">*</span>
              </Label>
              <Input
                id="starting_bid"
                type="number"
                step="0.01"
                {...register("starting_bid", { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bid_increment">
                Bid increment <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bid_increment"
                type="number"
                step="0.01"
                {...register("bid_increment", { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_time">Start time</Label>
              <Input
                id="start_time"
                type="datetime-local"
                {...register("start_time")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">End time</Label>
              <Input
                id="end_time"
                type="datetime-local"
                {...register("end_time")}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Images</Label>
              <Controller
                control={control}
                name="image_urls"
                render={({ field }) => (
                  <ImageUpload
                    value={field.value}
                    onChange={field.onChange}
                    max={3}
                  />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-3">
        {item ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={submitting}
          >
            Delete
          </Button>
        ) : (
          <div />
        )}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/items")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Saving…"
              : item
                ? "Save changes"
                : "Create item"}
          </Button>
        </div>
      </div>
    </form>
  );
}
