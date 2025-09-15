import { CheckCircle, Clock, Play } from 'lucide-react';

export function getStatusIcon(status: 'pending' | 'running' | 'completed') {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'running':
      return <Play className="w-5 h-5 text-blue-600" />;
    case 'pending':
      return <Clock className="w-5 h-5 text-gray-500" />;
    default:
      return <Clock className="w-5 h-5 text-red-500" />;
  }
}
