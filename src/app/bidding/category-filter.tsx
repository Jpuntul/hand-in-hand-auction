"use client";

import { Button } from "@/components/ui/button";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/types";

export function CategoryFilter({
	value,
	onChange,
}: {
	value: ItemCategory | null;
	onChange: (v: ItemCategory | null) => void;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			<Button
				type="button"
				variant={value === null ? "default" : "outline"}
				size="sm"
				onClick={() => onChange(null)}
			>
				All
			</Button>
			{ITEM_CATEGORIES.map((c) => (
				<Button
					key={c}
					type="button"
					variant={value === c ? "default" : "outline"}
					size="sm"
					className="capitalize"
					onClick={() => onChange(c)}
				>
					{c}
				</Button>
			))}
		</div>
	);
}
