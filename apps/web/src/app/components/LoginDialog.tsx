import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Lock, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  phone?: string;
  pin?: string;
}

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onLogin: (userId: string) => void;
}

export function LoginDialog({ open, onOpenChange, users, onLogin }: LoginDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!selectedUserId) {
      toast.error('Please select a pilot');
      return;
    }

    if (pin.length !== 4) {
      toast.error('PIN must be 4 digits');
      return;
    }

    setLoading(true);

    const user = users.find(u => u.id === selectedUserId);
    
    if (!user) {
      toast.error('Pilot not found');
      setLoading(false);
      return;
    }

    // Check if user has a PIN set
    if (!user.pin) {
      toast.error('This pilot has not set up a PIN yet', {
        description: 'Please contact an administrator to set up your PIN in Settings'
      });
      setLoading(false);
      return;
    }

    // Verify PIN
    if (user.pin !== pin) {
      toast.error('Incorrect PIN', {
        description: 'Please try again'
      });
      setLoading(false);
      setPin('');
      return;
    }

    // Successful login
    toast.success(`Welcome back, ${user.name}!`);
    onLogin(selectedUserId);
    setPin('');
    setSelectedUserId('');
    onOpenChange(false);
    setLoading(false);
  };

  const handlePinChange = (value: string) => {
    // Only allow numbers and max 4 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setPin(numericValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedUserId && pin.length === 4) {
      handleLogin();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Pilot Login
          </DialogTitle>
          <DialogDescription>
            Please log in to create or modify bookings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pilot-select">Select Pilot</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="pilot-select">
                <SelectValue placeholder="Choose your pilot name" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: user.color }}
                      />
                      {user.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin-input">4-Digit PIN</Label>
            <Input
              id="pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="••••"
              className="text-center text-2xl tracking-widest"
              autoComplete="off"
            />
            <p className="text-xs text-gray-500">
              Enter your 4-digit PIN to continue
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setPin('');
              setSelectedUserId('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLogin}
            disabled={!selectedUserId || pin.length !== 4 || loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
