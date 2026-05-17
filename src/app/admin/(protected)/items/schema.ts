import { z } from "zod";

import { ITEM_CATEGORIES, ITEM_STATUSES } from "@/lib/types";

export { ITEM_CATEGORIES, ITEM_STATUSES };

export const itemSchema = z.object({
  item_no: z.number().int().positive().nullable(),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().nullable(),
  sponsor: z.string().nullable(),
  categories: z.enum(ITEM_CATEGORIES).nullable(),
  retail_value: z.number().nonnegative().nullable(),
  starting_bid: z.number().positive("Starting bid must be positive"),
  bid_increment: z.number().positive("Bid increment must be positive"),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  status: z.enum(ITEM_STATUSES),
});

export type ItemFormValues = z.infer<typeof itemSchema>;

export const defaultItemValues: ItemFormValues = {
  item_no: null,
  name: "",
  description: null,
  sponsor: null,
  categories: null,
  retail_value: null,
  starting_bid: 100,
  bid_increment: 10,
  start_time: null,
  end_time: null,
  status: "scheduled",
};
