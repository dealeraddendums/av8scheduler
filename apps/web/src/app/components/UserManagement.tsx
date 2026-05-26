import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { UserPlus, Mail, Phone, Pencil, Trash2, User, Bell, BellOff } from 'lucide-react';
import { PilotPhoneManager } from './PilotPhoneManager';

interface PhoneNumber {
  number: string;
  smsEnabled: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  phone?: string;
  pin?: string;
  primaryPhoneSmsEnabled?: boolean;
  secondaryPhones?: { number: string; smsEnabled: boolean }[];
  timeFormat?: '12h' | '24h';
  timezone?: string;
  userType?: 'pilot' | 'spouse';
  linkedPilotId?: string;
}

interface UserManagementProps {
  users: User[];
  onUpdateUser: (userId: string, userData: Partial<User>) => void;
  onAddUser: (userData: { name: string; email: string; phone?: string; color: string; pin?: string; userType?: 'pilot' | 'spouse'; linkedPilotId?: string }) => void;
  onDeleteUser: (userId: string) => void;
}

const colorOptions = [
  { name: 'Navy', value: '#4E5166' },
  { name: 'Blue Gray', value: '#7C90A0' },
  { name: 'Tan', value: '#B5AA9D' },
  { name: 'Sage', value: '#B9B7A7' },
  { name: 'Charcoal', value: '#747274' },
];

const timezoneOptions = [
  { name: 'Pacific Time', value: 'America/Los_Angeles' },
  { name: 'Mountain Time', value: 'America/Denver' },
  { name: 'Central Time', value: 'America/Chicago' },
  { name: 'Eastern Time', value: 'America/New_York' },
  { name: 'Alaska Time', value: 'America/Anchorage' },
  { name: 'Hawaii Time', value: 'Pacific/Honolulu' },
  { name: 'UTC', value: 'UTC' },
];

export function UserManagement({ users, onUpdateUser, onAddUser, onDeleteUser }: UserManagementProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    primaryPhoneSmsEnabled: boolean;
    secondaryPhones: PhoneNumber[];
    color: string;
    pin: string;
    timeFormat: '12h' | '24h';
    timezone: string;
    userType: 'pilot' | 'spouse';
    linkedPilotId: string;
  }>({
    name: '',
    email: '',
    phone: '',
    primaryPhoneSmsEnabled: false,
    secondaryPhones: [],
    color: '#4E5166',
    pin: '',
    timeFormat: '12h',
    timezone: 'America/Los_Angeles',
    userType: 'pilot',
    linkedPilotId: ''
  });

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      primaryPhoneSmsEnabled: user.primaryPhoneSmsEnabled || false,
      secondaryPhones: user.secondaryPhones || [],
      color: user.color,
      pin: user.pin || '',
      timeFormat: user.timeFormat || '12h',
      timezone: user.timezone || 'America/Los_Angeles',
      userType: user.userType || 'pilot',
      linkedPilotId: user.linkedPilotId || ''
    });
    setEditDialogOpen(true);
  };

  const handleAddClick = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      primaryPhoneSmsEnabled: false,
      secondaryPhones: [],
      color: '#4E5166',
      pin: '',
      timeFormat: '12h',
      timezone: 'America/Los_Angeles',
      userType: 'pilot',
      linkedPilotId: ''
    });
    setAddDialogOpen(true);
  };

  const handleUpdateSubmit = () => {
    if (selectedUser) {
      onUpdateUser(selectedUser.id, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        primaryPhoneSmsEnabled: formData.primaryPhoneSmsEnabled,
        secondaryPhones: formData.secondaryPhones,
        color: formData.color,
        pin: formData.pin,
        timeFormat: formData.timeFormat,
        timezone: formData.timezone,
        userType: formData.userType,
        linkedPilotId: formData.linkedPilotId
      });
      setEditDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const handleAddSubmit = () => {
    if (formData.name && formData.email) {
      // Validation for spouse accounts
      if (formData.userType === 'spouse' && !formData.linkedPilotId) {
        alert('Please select a linked pilot for this spouse account');
        return;
      }
      
      onAddUser({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        primaryPhoneSmsEnabled: formData.primaryPhoneSmsEnabled,
        secondaryPhones: formData.secondaryPhones,
        color: formData.color,
        pin: formData.pin,
        timeFormat: formData.timeFormat,
        timezone: formData.timezone,
        userType: formData.userType,
        linkedPilotId: formData.linkedPilotId
      });
      setAddDialogOpen(false);
    }
  };

  // Get linked pilot name for display
  const getLinkedPilotName = (linkedPilotId?: string) => {
    if (!linkedPilotId) return '';
    const pilot = users.find(u => u.id === linkedPilotId);
    return pilot ? pilot.name : '';
  };

  // Organize users hierarchically: pilots with their spouses underneath
  const organizeUsers = () => {
    const pilots = users.filter(u => u.userType !== 'spouse');
    const spouses = users.filter(u => u.userType === 'spouse');
    
    const organized: Array<{ user: User; isSpouse: boolean }> = [];
    
    pilots.forEach(pilot => {
      // Add the pilot
      organized.push({ user: pilot, isSpouse: false });
      
      // Add any spouses linked to this pilot
      const linkedSpouses = spouses.filter(spouse => spouse.linkedPilotId === pilot.id);
      linkedSpouses.forEach(spouse => {
        organized.push({ user: spouse, isSpouse: true });
      });
    });
    
    // Add any orphaned spouses (not linked to any pilot) at the end
    const orphanedSpouses = spouses.filter(spouse => 
      !pilots.some(pilot => pilot.id === spouse.linkedPilotId)
    );
    orphanedSpouses.forEach(spouse => {
      organized.push({ user: spouse, isSpouse: true });
    });
    
    return organized;
  };

  const organizedUsers = organizeUsers();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage pilots and spouse accounts
            </CardDescription>
          </div>
          <Button onClick={handleAddClick} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {organizedUsers.map(({ user, isSpouse }) => (
            <div
              key={user.id}
              className={`flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors ${
                isSpouse ? 'ml-8 border-l-4 border-l-purple-300 bg-purple-50/30' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`${isSpouse ? 'w-10 h-10' : 'w-12 h-12'} rounded-full flex items-center justify-center`}
                  style={{ backgroundColor: user.color }}
                >
                  <User className={`${isSpouse ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
                </div>
                <div>
                  <h3 className={`${isSpouse ? 'text-base' : 'font-semibold text-gray-900'} flex items-center gap-2`}>
                    {user.name}
                    {user.userType === 'spouse' && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        Spouse
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-3 h-3" />
                      {user.email}
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-3 h-3" />
                        {user.phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditClick(user)}
                  className="gap-2"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {user.name}? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDeleteUser(user.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit User Information</DialogTitle>
            <DialogDescription>
              Update user details, phone numbers, and SMS preferences
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <div className="space-y-2">
              <Label>Account Type</Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, userType: 'pilot', linkedPilotId: '' })}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-all ${
                    formData.userType === 'pilot'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  Pilot
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, userType: 'spouse' })}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-all ${
                    formData.userType === 'spouse'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  Spouse
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {formData.userType === 'pilot' ? 'Pilots can book the aircraft for themselves' : 'Spouses can book the aircraft for their pilot'}
              </p>
            </div>

            {formData.userType === 'spouse' && (
              <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Label htmlFor="edit-linked-pilot">Linked Pilot *</Label>
                <select
                  id="edit-linked-pilot"
                  value={formData.linkedPilotId}
                  onChange={(e) => setFormData({ ...formData, linkedPilotId: e.target.value, color: users.find(u => u.id === e.target.value)?.color || '#4E5166' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select the pilot...</option>
                  {users.filter(u => u.userType !== 'spouse').map((pilot) => (
                    <option key={pilot.id} value={pilot.id}>
                      {pilot.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  This spouse will be able to create, edit, and delete bookings for the selected pilot.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Primary Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            {/* Phone Manager */}
            <PilotPhoneManager
              primaryPhone={formData.phone}
              primaryPhoneSmsEnabled={formData.primaryPhoneSmsEnabled}
              secondaryPhones={formData.secondaryPhones}
              onChange={(data) => setFormData({ ...formData, ...data })}
            />

            <div className="space-y-2">
              <Label htmlFor="edit-color">Calendar Color</Label>
              <Input
                id="edit-color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-pin">4-Digit PIN (Optional)</Label>
              <Input
                id="edit-pin"
                type="password"
                maxLength={4}
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                placeholder="Enter 4-digit PIN"
              />
              <p className="text-xs text-gray-500">
                Set a 4-digit PIN for secure booking authentication
              </p>
            </div>

            <div className="space-y-2">
              <Label>Time Format (Calendar & SMS)</Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, timeFormat: '12h' })}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-all ${
                    formData.timeFormat === '12h'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  12-Hour (3:00 PM)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, timeFormat: '24h' })}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-all ${
                    formData.timeFormat === '24h'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  24-Hour (15:00)
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Choose how times are displayed in the calendar and SMS notifications
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-timezone">Timezone (for SMS notifications)</Label>
              <select
                id="edit-timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                SMS notifications will show times in this timezone
              </p>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Add a new pilot or spouse to the scheduling system
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <div className="space-y-2">
              <Label>Account Type</Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, userType: 'pilot', linkedPilotId: '' })}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-all ${
                    formData.userType === 'pilot'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  Pilot
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, userType: 'spouse' })}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-all ${
                    formData.userType === 'spouse'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  Spouse
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {formData.userType === 'pilot' ? 'Pilots can book the aircraft for themselves' : 'Spouses can book the aircraft for their pilot'}
              </p>
            </div>

            {formData.userType === 'spouse' && (
              <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Label htmlFor="linked-pilot">Linked Pilot *</Label>
                <select
                  id="linked-pilot"
                  value={formData.linkedPilotId}
                  onChange={(e) => setFormData({ ...formData, linkedPilotId: e.target.value, color: users.find(u => u.id === e.target.value)?.color || '#4E5166' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select the pilot...</option>
                  {users.filter(u => u.userType !== 'spouse').map((pilot) => (
                    <option key={pilot.id} value={pilot.id}>
                      {pilot.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  This spouse will be able to create, edit, and delete bookings for the selected pilot.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="add-name">Name *</Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.userType === 'spouse' ? "Spouse name" : "Pilot name"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email Address *</Label>
              <Input
                id="add-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-phone">Primary Phone / SMS</Label>
              <Input
                id="add-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            {/* Phone Manager */}
            <PilotPhoneManager
              primaryPhone={formData.phone}
              primaryPhoneSmsEnabled={formData.primaryPhoneSmsEnabled}
              secondaryPhones={formData.secondaryPhones}
              onChange={(data) => setFormData({ ...formData, ...data })}
            />

            {formData.userType !== 'spouse' && (
              <div className="space-y-2">
                <Label htmlFor="add-color">Calendar Color</Label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: option.value })}
                      className={`h-10 rounded-md border-2 transition-all ${
                        formData.color === option.value
                          ? 'border-gray-900 scale-110'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: option.value }}
                      title={option.name}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Spouse accounts inherit their pilot's color
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="add-pin">4-Digit PIN (for login)</Label>
              <Input
                id="add-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={formData.pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setFormData({ ...formData, pin: value });
                }}
                placeholder="••••"
                className="text-center tracking-widest"
              />
              <p className="text-xs text-gray-500">
                {formData.pin ? `PIN set (${formData.pin.length}/4 digits)` : 'No PIN set - user cannot log in'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Time Format (Calendar & SMS)</Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, timeFormat: '12h' })}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-all ${
                    formData.timeFormat === '12h'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  12-Hour (3:00 PM)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, timeFormat: '24h' })}
                  className={`flex-1 py-2 px-4 rounded-md border-2 transition-all ${
                    formData.timeFormat === '24h'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  24-Hour (15:00)
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Choose how times are displayed in the calendar and SMS notifications
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-timezone">Timezone (for SMS notifications)</Label>
              <select
                id="add-timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                SMS notifications will show times in this timezone
              </p>
            </div>
          </div>
          
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddSubmit}
              disabled={!formData.name || !formData.email || (formData.userType === 'spouse' && !formData.linkedPilotId)}
            >
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}