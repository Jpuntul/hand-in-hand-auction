"use client";

import { Bell, LogOut, Shield, Star, User as UserIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";

export type UserMenuProps = {
	email: string | null;
	displayName: string | null;
	isAdmin: boolean;
};

export function UserMenu({ email, displayName, isAdmin }: UserMenuProps) {
	const label = displayName || email || "Guest";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={`${buttonVariants({ variant: "ghost", size: "sm" })} gap-2`}
			>
				<UserIcon className="h-4 w-4" />
				<span className="hidden sm:inline">{label}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="font-normal">
						<div className="flex flex-col">
							<span className="font-medium">{displayName || "Guest"}</span>
							{email && (
								<span className="text-xs text-muted-foreground">{email}</span>
							)}
						</div>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem render={<Link href="/account/profile" />}>
						<UserIcon className="mr-2 h-4 w-4" />
						Profile
					</DropdownMenuItem>
					<DropdownMenuItem render={<Link href="/account/watchlist" />}>
						<Star className="mr-2 h-4 w-4" />
						Watchlist
					</DropdownMenuItem>
					<DropdownMenuItem render={<Link href="/account/notifications" />}>
						<Bell className="mr-2 h-4 w-4" />
						Notifications
					</DropdownMenuItem>
				</DropdownMenuGroup>
				{isAdmin && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem render={<Link href="/admin" />}>
								<Shield className="mr-2 h-4 w-4" />
								Admin dashboard
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						onClick={(e) => {
							e.preventDefault();
							void signOut();
						}}
					>
						<LogOut className="mr-2 h-4 w-4" />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
