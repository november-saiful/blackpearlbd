import { DealsManager } from '@/components/admin/DealsManager';
import { AdminNav } from '@/components/admin/AdminNav';
import { Package } from '@/components/ui/icons';

export default function AdminDeals() {
  return (
    <div className="px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Deals</h1>
            <p className="text-sm text-muted-foreground">Manage tour deals</p>
          </div>
        </div>
        <AdminNav />
      </div>
      <DealsManager />
    </div>
  );
}
