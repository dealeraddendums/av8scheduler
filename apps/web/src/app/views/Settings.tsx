import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, Users, RefreshCw, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { UserManagement } from '../components/UserManagement';
import { TwilioSettings } from '../components/TwilioSettings';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-82b8c834`;

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  phone?: string;
  primaryPhoneSmsEnabled?: boolean;
  secondaryPhones?: Array<{ number: string; smsEnabled: boolean }>;
  smsNotifications?: boolean;
  pin?: string;
  userType?: 'pilot' | 'spouse';
  linkedPilotId?: string;
}

export default function Settings() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/users`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string, userData: Partial<User>) => {
    try {
      const response = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to update user');
        return;
      }

      toast.success('User updated successfully');
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleAddUser = async (userData: { name: string; email: string; phone?: string; color: string; pin?: string }) => {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to add user');
        return;
      }

      toast.success('User added successfully');
      await fetchUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Failed to add user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete user');
        return;
      }

      toast.success('User deleted successfully');
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="mottled-blue-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-white" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mottled-blue-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="gap-2 mb-4 text-white hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              Back to Calendar
            </Button>
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <span style={{ color: '#4E5166', fontWeight: 500, letterSpacing: '0.1em' }}>N4368V</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-white">Manage users and integrations</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full max-w-2xl grid-cols-2">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Pilots
            </TabsTrigger>
            <TabsTrigger value="twilio" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              SMS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement
              users={users}
              onUpdateUser={handleUpdateUser}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
            />
          </TabsContent>

          <TabsContent value="twilio">
            <TwilioSettings 
              apiBase={API_BASE}
              authToken={publicAnonKey}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}