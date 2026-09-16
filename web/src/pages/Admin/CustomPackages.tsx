import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Compass, MapPin } from 'lucide-react';
import { CustomPackagesManager } from '@/components/admin/CustomPackagesManager';
import { DestinationManager } from '@/components/admin/DestinationManager';
import { BangladeshDataManager } from '@/components/admin/BangladeshDataManager';
import { AdminNav } from '@/components/admin/AdminNav';
import { BuildPackageIcon } from '@/components/icons/BuildPackageIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type TableId = 'destinations' | 'regions';

interface DestinationTable {
  id: TableId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const destinationTables: DestinationTable[] = [
  {
    id: 'destinations',
    label: 'Package Builder Destinations',
    description: 'Categories, names and slugs',
    icon: Compass,
  },
  {
    id: 'regions',
    label: 'Bangladesh Regions',
    description: 'Divisions, districts and tour spots',
    icon: MapPin,
  },
];

export default function AdminCustomPackages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId: TableId = searchParams.get('table') === 'regions' ? 'regions' : 'destinations';
  const activeTable = destinationTables.find((table) => table.id === activeId) ?? destinationTables[0];
  const ActiveIcon = activeTable.icon;

  const selectTable = (id: TableId) =>
    setSearchParams(id === 'destinations' ? {} : { table: id }, { replace: true });

  return (
    <div className="px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BuildPackageIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Custom Packages</h1>
            <p className="text-sm text-muted-foreground">Manage package builder destinations and review requests</p>
          </div>
        </div>
        <AdminNav />
      </div>
      <div className="space-y-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Switch destination table"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <ActiveIcon className="size-4 text-muted-foreground" />
              {activeTable.label}
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4} className="w-72">
            {destinationTables.map((table) => {
              const Icon = table.icon;
              const isActive = table.id === activeId;
              return (
                <DropdownMenuItem
                  key={table.id}
                  onClick={() => selectTable(table.id)}
                  className={cn('flex items-start gap-2.5 cursor-pointer py-2', isActive && 'bg-accent text-accent-foreground')}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" />
                  <span className="flex flex-col">
                    <span className="font-medium">{table.label}</span>
                    <span className="text-xs text-muted-foreground">{table.description}</span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {activeId === 'destinations' ? <DestinationManager /> : <BangladeshDataManager />}
        <CustomPackagesManager />
      </div>
    </div>
  );
}
