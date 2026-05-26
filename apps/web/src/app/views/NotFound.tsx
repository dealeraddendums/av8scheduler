import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Home, Plane } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="flex items-center justify-center mb-6">
          <div className="p-4 bg-blue-600 rounded-lg">
            <Plane className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page not found</p>
        <Link to="/">
          <Button className="gap-2">
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
