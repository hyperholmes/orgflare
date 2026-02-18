import type { ColumnDef } from "@tanstack/react-table";
import {
	createColumnHelper,
	getCoreRowModel,
	useReactTable,
	flexRender,
} from "@tanstack/react-table";

export type Tenant = {
	id: string;
	name: string;
	tier: string;
	status: string;
	email: string;
	created_at: string;
	updated_at: string;
	stats: {
		total_operations: number;
		total_atoms_created: number;
		total_inferences: number;
	};
};

const columnHelper = createColumnHelper<Tenant>();

const columns: ColumnDef<Tenant>[] = [
	columnHelper.accessor("id", {
		header: "ID",
		cell: (info) => (
			<a
				className="text-primary underline font-mono text-sm"
				href={`/admin/tenants/${info.getValue()}`}
			>
				{info.getValue().substring(0, 8)}...
			</a>
		),
	}),
	columnHelper.accessor("name", {
		header: "Name",
		cell: (info) => (
			<span className="font-medium">{info.getValue()}</span>
		),
	}),
	columnHelper.accessor("tier", {
		header: "Tier",
		cell: (info) => {
			const tier = info.getValue();
			const colors = {
				free: "bg-gray-100 text-gray-800",
				pro: "bg-blue-100 text-blue-800",
				enterprise: "bg-purple-100 text-purple-800",
			};
			return (
				<span
					className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[tier] || colors.free}`}
				>
					{tier.toUpperCase()}
				</span>
			);
		},
	}),
	columnHelper.accessor("status", {
		header: "Status",
		cell: (info) => {
			const status = info.getValue();
			const colors = {
				active: "bg-green-100 text-green-800",
				suspended: "bg-yellow-100 text-yellow-800",
				deleted: "bg-red-100 text-red-800",
			};
			return (
				<span
					className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || colors.active}`}
				>
					{status.toUpperCase()}
				</span>
			);
		},
	}),
	columnHelper.accessor("stats.total_operations", {
		header: "Operations",
		cell: (info) => (
			<span className="font-mono text-sm">
				{info.getValue().toLocaleString()}
			</span>
		),
	}),
	columnHelper.accessor("stats.total_atoms_created", {
		header: "Atoms",
		cell: (info) => (
			<span className="font-mono text-sm">
				{info.getValue().toLocaleString()}
			</span>
		),
	}),
	columnHelper.accessor("stats.total_inferences", {
		header: "Inferences",
		cell: (info) => (
			<span className="font-mono text-sm">
				{info.getValue().toLocaleString()}
			</span>
		),
	}),
	columnHelper.accessor("created_at", {
		header: "Created",
		cell: (info) => (
			<span className="text-sm text-muted-foreground">
				{new Date(info.getValue()).toLocaleDateString()}
			</span>
		),
	}),
];

interface TenantsTableProps {
	data: Tenant[];
}

export function TenantsTable({ data }: TenantsTableProps) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="rounded-md border">
			<table className="w-full">
				<thead className="bg-muted/50">
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<th
									key={header.id}
									className="px-4 py-3 text-left text-sm font-medium"
								>
									{header.isPlaceholder
										? null
										: flexRender(
												header.column.columnDef
													.header,
												header.getContext(),
											)}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody>
					{table.getRowModel().rows.map((row) => (
						<tr
							key={row.id}
							className="border-t hover:bg-muted/50 transition-colors"
						>
							{row.getVisibleCells().map((cell) => (
								<td key={cell.id} className="px-4 py-3">
									{flexRender(
										cell.column.columnDef.cell,
										cell.getContext(),
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			{table.getRowModel().rows.length === 0 && (
				<div className="text-center py-8 text-muted-foreground">
					No tenants found
				</div>
			)}
		</div>
	);
}
