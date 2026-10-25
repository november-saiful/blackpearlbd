import { UsersTable } from '@/components/admin/UsersTable';
import { AdminNav } from '@/components/admin/AdminNav';
import { Users } from '@/components/ui/icons';

export default function AdminUsers() {
  return (
    <div className="px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">Manage user accounts</p>
          </div>
        </div>
        <AdminNav />
      </div>
      <UsersTable />
    </div>
  );
}
