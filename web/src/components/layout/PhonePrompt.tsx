import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone } from '@/components/ui/icons';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

export function PhonePrompt() {
  const { user, profile, isAuthenticated, isLoading } = useAuth();
  const { setProfile } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Decide whether to show the prompt
  useEffect(() => {
    if (isLoading || !isAuthenticated || !profile) return;
    // Already has phone → no need
    if (profile.phone && profile.phone.trim()) return;
    setOpen(true);
  }, [isLoading, isAuthenticated, profile]);

  const handleSave = async () => {
    const trimmed = phone.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const { profile: updated } = await api.updateProfile({ phone: trimmed });
      setProfile(updated);
      setOpen(false);
      toast.success('Phone number saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save phone number');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    setOpen(false);
  };

  // Don't render anything if not applicable
  if (!isAuthenticated || !profile || (profile.phone && profile.phone.trim())) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-2">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>Add Your Phone Number</DialogTitle>
          <DialogDescription>
            Please provide your phone number so we can reach you regarding bookings and travel updates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="phone-prompt">Phone Number</Label>
            <Input
              id="phone-prompt"
              type="tel"
              placeholder="+880 1XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDismiss}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={saving || !phone.trim()}>
            {saving ? 'Saving…' : 'Save Number'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
