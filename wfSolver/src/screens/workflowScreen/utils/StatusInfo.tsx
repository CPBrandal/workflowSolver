import { Play, CheckCircle, Clock, AlertCircle, Pause } from 'lucide-react';


export function StatusInfo (){
    return(
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-semibold mb-3 text-gray-800">Node Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-700">Running</span>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-gray-700">Error</span>
                </div>
                <div className="flex items-center gap-2">
                    <Pause className="w-4 h-4 text-yellow-600" />
                    <span className="text-gray-700">Paused</span>
                </div>
            </div>
        </div>
    );
}