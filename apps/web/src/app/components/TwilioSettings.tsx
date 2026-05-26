import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { MessageSquare, Save, CheckCircle, XCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface TwilioSettingsProps {
  apiBase: string;
  authToken: string;
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export function TwilioSettings({ apiBase, authToken }: TwilioSettingsProps) {
  const [config, setConfig] = useState<TwilioConfig>({
    accountSid: '',
    authToken: '',
    phoneNumber: ''
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/twilio-config`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Twilio config');
      }

      const data = await response.json();
      
      if (data.config) {
        // Show masked values for security
        setConfig({
          accountSid: data.config.accountSid || '',
          authToken: data.config.authToken ? '••••••••••••••••' : '',
          phoneNumber: data.config.phoneNumber || ''
        });
        setIsConfigured(true);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching Twilio config:', error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate fields
      if (!config.accountSid || !config.authToken || !config.phoneNumber) {
        toast.error('Please fill in all fields');
        setSaving(false);
        return;
      }

      // Validate phone number format (should start with +)
      if (!config.phoneNumber.startsWith('+')) {
        toast.error('Phone number must start with + (e.g., +1234567890)');
        setSaving(false);
        return;
      }

      const response = await fetch(`${apiBase}/twilio-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      toast.success('Twilio configuration saved successfully');
      setIsConfigured(true);
      await fetchConfig();
      setSaving(false);
    } catch (error: any) {
      console.error('Error saving Twilio config:', error);
      toast.error(error.message || 'Failed to save configuration');
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      
      const response = await fetch(`${apiBase}/twilio-test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Test failed');
      }

      const data = await response.json();
      toast.success(data.message || 'Test SMS sent successfully!');
      setTesting(false);
    } catch (error: any) {
      console.error('Error testing Twilio:', error);
      toast.error(error.message || 'Failed to send test SMS');
      setTesting(false);
    }
  };

  const handleClear = async () => {
    try {
      const response = await fetch(`${apiBase}/twilio-config`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to clear configuration');
      }

      setConfig({
        accountSid: '',
        authToken: '',
        phoneNumber: ''
      });
      setIsConfigured(false);
      toast.success('Twilio configuration cleared');
    } catch (error) {
      console.error('Error clearing Twilio config:', error);
      toast.error('Failed to clear configuration');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <CardTitle>SMS Notifications (Twilio)</CardTitle>
          </div>
          <CardDescription>
            Loading configuration...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <CardTitle>SMS Notifications (Twilio)</CardTitle>
        </div>
        <CardDescription>
          Configure Twilio to send SMS notifications when bookings are created
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConfigured && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Twilio is configured and ready to send SMS notifications
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountSid">Account SID</Label>
            <Input
              id="accountSid"
              type="text"
              value={config.accountSid}
              onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <p className="text-xs text-gray-500">
              Find this in your Twilio Console dashboard
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="authToken">Auth Token</Label>
            <Input
              id="authToken"
              type="password"
              value={config.authToken}
              onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
              placeholder="Enter your Twilio Auth Token"
            />
            <p className="text-xs text-gray-500">
              Your Twilio authentication token (keep this secret!)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Twilio Phone Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={config.phoneNumber}
              onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
              placeholder="+1234567890"
            />
            <p className="text-xs text-gray-500">
              The phone number from your Twilio account (include country code with +)
            </p>
          </div>
        </div>

        <Alert>
          <Phone className="h-4 w-4" />
          <AlertDescription>
            <strong>Setup Instructions:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Sign up for a free Twilio account at <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">twilio.com/try-twilio</a></li>
              <li>Get a phone number from the Twilio Console</li>
              <li>Copy your Account SID and Auth Token from the Console</li>
              <li>Paste the credentials above and click Save</li>
              <li>Pilots can opt-in to SMS notifications in their profile settings</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button 
            onClick={handleSave}
            disabled={saving || !config.accountSid || !config.authToken || !config.phoneNumber}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>

          {isConfigured && (
            <>
              <Button 
                onClick={handleTest}
                disabled={testing}
                variant="outline"
                className="gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                {testing ? 'Testing...' : 'Send Test SMS'}
              </Button>

              <Button 
                onClick={handleClear}
                variant="outline"
                className="gap-2 text-red-600 hover:text-red-700"
              >
                <XCircle className="w-4 h-4" />
                Clear Config
              </Button>
            </>
          )}
        </div>

        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertDescription className="text-yellow-800 text-sm">
            <strong>Note:</strong> Twilio free trial accounts can only send SMS to verified phone numbers. 
            To send to any number, you'll need to upgrade your Twilio account.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
