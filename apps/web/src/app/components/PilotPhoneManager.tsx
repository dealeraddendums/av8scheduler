import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Phone, Plus, Trash2, Bell, BellOff } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface PhoneNumber {
  number: string;
  smsEnabled: boolean;
}

interface PilotPhoneManagerProps {
  primaryPhone: string;
  primaryPhoneSmsEnabled?: boolean;
  secondaryPhones: PhoneNumber[];
  onChange: (data: { 
    phone: string; 
    primaryPhoneSmsEnabled: boolean;
    secondaryPhones: PhoneNumber[];
  }) => void;
}

export function PilotPhoneManager({ 
  primaryPhone, 
  primaryPhoneSmsEnabled = false,
  secondaryPhones = [], 
  onChange 
}: PilotPhoneManagerProps) {
  const [newPhone, setNewPhone] = useState('');

  const handleAddSecondaryPhone = () => {
    if (newPhone.trim()) {
      const updatedSecondaryPhones = [...secondaryPhones, { number: newPhone.trim(), smsEnabled: false }];
      onChange({
        phone: primaryPhone,
        primaryPhoneSmsEnabled,
        secondaryPhones: updatedSecondaryPhones
      });
      setNewPhone('');
    }
  };

  const handleRemoveSecondaryPhone = (index: number) => {
    const updatedSecondaryPhones = secondaryPhones.filter((_, i) => i !== index);
    onChange({
      phone: primaryPhone,
      primaryPhoneSmsEnabled,
      secondaryPhones: updatedSecondaryPhones
    });
  };

  const handleTogglePrimarySms = (enabled: boolean) => {
    onChange({
      phone: primaryPhone,
      primaryPhoneSmsEnabled: enabled,
      secondaryPhones
    });
  };

  const handleToggleSecondarySms = (index: number, enabled: boolean) => {
    const updatedSecondaryPhones = secondaryPhones.map((phone, i) =>
      i === index ? { ...phone, smsEnabled: enabled } : phone
    );
    onChange({
      phone: primaryPhone,
      primaryPhoneSmsEnabled,
      secondaryPhones: updatedSecondaryPhones
    });
  };

  const totalPhonesWithSms = (primaryPhone && primaryPhoneSmsEnabled ? 1 : 0) + 
    secondaryPhones.filter(p => p.smsEnabled).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4" />
          <CardTitle className="text-base">Phone Numbers & SMS Preferences</CardTitle>
        </div>
        <CardDescription>
          Manage phone numbers and configure SMS notifications for each number
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Phone SMS Toggle */}
        {primaryPhone && (
          <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">Primary Phone</span>
                </div>
                <p className="text-sm text-gray-700 mt-1">{primaryPhone}</p>
              </div>
              <div className="flex items-center gap-2">
                {primaryPhoneSmsEnabled ? (
                  <Bell className="w-4 h-4 text-green-600" />
                ) : (
                  <BellOff className="w-4 h-4 text-gray-400" />
                )}
                <Switch
                  checked={primaryPhoneSmsEnabled}
                  onCheckedChange={handleTogglePrimarySms}
                />
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {primaryPhoneSmsEnabled ? 'Receiving SMS notifications' : 'SMS notifications disabled'}
            </p>
          </div>
        )}

        {!primaryPhone && (
          <Alert>
            <AlertDescription className="text-sm">
              Add a primary phone number above to enable SMS notifications
            </AlertDescription>
          </Alert>
        )}

        {/* Secondary Phones List */}
        {secondaryPhones.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Secondary Phone Numbers</Label>
            {secondaryPhones.map((phone, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-2 p-3 border rounded-lg bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span className="text-sm truncate">{phone.number}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 ml-6">
                    {phone.smsEnabled ? 'Receiving SMS notifications' : 'SMS notifications disabled'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {phone.smsEnabled ? (
                    <Bell className="w-4 h-4 text-green-600" />
                  ) : (
                    <BellOff className="w-4 h-4 text-gray-400" />
                  )}
                  <Switch
                    checked={phone.smsEnabled}
                    onCheckedChange={(enabled) => handleToggleSecondarySms(index, enabled)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSecondaryPhone(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Secondary Phone */}
        <div className="space-y-2">
          <Label htmlFor="new-phone" className="text-sm font-medium">Add Secondary Phone</Label>
          <div className="flex gap-2">
            <Input
              id="new-phone"
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSecondaryPhone();
                }
              }}
              placeholder="+1 (555) 987-6543"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleAddSecondaryPhone}
              disabled={!newPhone.trim()}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Additional phone numbers for SMS notifications
          </p>
        </div>

        {/* Summary */}
        {(primaryPhone || secondaryPhones.length > 0) && (
          <Alert className={totalPhonesWithSms > 0 ? "bg-green-50 border-green-200" : "bg-gray-50"}>
            <AlertDescription className="text-sm">
              <strong>SMS Summary:</strong> {totalPhonesWithSms} of {(primaryPhone ? 1 : 0) + secondaryPhones.length} phone number(s) will receive notifications
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}