import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function GoogleCalendarSetup() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Google Calendar Integration</CardTitle>
        <CardDescription>
          How to connect your aircraft schedule with Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup Required</AlertTitle>
          <AlertDescription>
            To enable Google Calendar sync, you'll need to configure the Google Calendar API.
          </AlertDescription>
        </Alert>

        <div className="space-y-3 text-sm">
          <div>
            <h4 className="font-semibold mb-2">Setup Steps:</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
              <li>Create a new project or select an existing one</li>
              <li>Enable the Google Calendar API</li>
              <li>Create OAuth 2.0 credentials</li>
              <li>Add the credentials to your backend environment variables</li>
              <li>Implement the sync logic in the server code</li>
            </ol>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="font-semibold mb-2">What the sync will do:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Create calendar events for each booking</li>
              <li>Update events when bookings are modified</li>
              <li>Delete calendar events when bookings are cancelled</li>
              <li>Sync across all three pilots' calendars</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
