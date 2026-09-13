import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

const actionColor: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	"auth.signup": "secondary",
	"auth.signin": "secondary",
	"auth.signout": "outline",
	"auth.admin.signin.failed": "destructive",
	"auth.admin.signin.denied": "destructive",
	"admin.item": "default",
};

function getBadgeVariant(action: string) {
	for (const [key, variant] of Object.entries(actionColor)) {
		if (action.startsWith(key)) return variant;
	}
	return "outline" as const;
}

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
	const supabase = await createClient();
	const { data: logs } = await supabase
		.from("audit_log")
		.select("*")
		.order("created_at", { ascending: false })
		.limit(200);

	return (
		<AdminShell size="wide">
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
						Audit log
					</h1>
					<p className="text-sm text-muted-foreground">
						All admin actions and security events. Most recent first.
					</p>
				</div>

				<div className="overflow-hidden rounded-xl border border-border/60 bg-card">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/30">
								<TableHead className="text-xs uppercase tracking-wider">
									Time
								</TableHead>
								<TableHead className="text-xs uppercase tracking-wider">
									Action
								</TableHead>
								<TableHead className="text-xs uppercase tracking-wider">
									Actor
								</TableHead>
								<TableHead className="hidden text-xs uppercase tracking-wider lg:table-cell">
									Target
								</TableHead>
								<TableHead className="hidden text-xs uppercase tracking-wider xl:table-cell">
									Details
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{!logs?.length ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="py-8 text-center text-sm text-muted-foreground"
									>
										No log entries yet.
									</TableCell>
								</TableRow>
							) : (
								logs.map((entry) => (
									<TableRow
										key={entry.id}
										className="border-b border-border/40"
									>
										<TableCell className="whitespace-nowrap text-xs text-muted-foreground">
											{new Date(entry.created_at).toLocaleString()}
										</TableCell>
										<TableCell>
											<Badge
												variant={getBadgeVariant(entry.action)}
												className="font-mono text-[10px]"
											>
												{entry.action}
											</Badge>
										</TableCell>
										<TableCell className="text-sm">
											{entry.actor_email ?? "—"}
										</TableCell>
										<TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
											{entry.target_type && entry.target_id
												? `${entry.target_type}:${entry.target_id.slice(0, 8)}…`
												: "—"}
										</TableCell>
										<TableCell className="hidden max-w-xs truncate text-xs text-muted-foreground xl:table-cell">
											{Object.keys(entry.metadata ?? {}).length > 0
												? JSON.stringify(entry.metadata)
												: "—"}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</AdminShell>
	);
}
