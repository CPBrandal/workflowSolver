import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const navigate = useNavigate();

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-gray-800 text-white transition-all duration-300 z-50 ${
        isOpen ? 'w-96' : 'w-20'
      }`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Menu Items */}
      <div className="pt-16 px-4 space-y-3">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-gray-700 transition-colors text-left text-base"
        >
          <svg
            className="w-7 h-7 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span
            className={`whitespace-nowrap transition-opacity duration-300 ${
              isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}
          >
            Home
          </span>
        </button>

        <button
          onClick={() => navigate('/db-workflows')}
          className="w-full flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-gray-700 transition-colors text-left text-base"
        >
          <svg
            className="w-7 h-7 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
            />
          </svg>
          <span
            className={`whitespace-nowrap transition-opacity duration-300 ${
              isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}
          >
            Run simulations
          </span>
        </button>

        <button
          onClick={() => navigate('/db-simulations')}
          className="w-full flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-gray-700 transition-colors text-left text-base"
        >
          <svg
            className="w-7 h-7 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span
            className={`whitespace-nowrap transition-opacity duration-300 ${
              isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}
          >
            Simulation Results
          </span>
        </button>

        <button
          onClick={() => navigate('/db-view-workflow')}
          className="w-full flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-gray-700 transition-colors text-left text-base"
        >
          <svg
            className="w-7 h-7 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="6" cy="6" r="2" strokeWidth={2} />
            <circle cx="18" cy="6" r="2" strokeWidth={2} />
            <circle cx="12" cy="18" r="2" strokeWidth={2} />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7.5 7.5L10.5 16.5M16.5 7.5L13.5 16.5"
            />
          </svg>
          <span
            className={`whitespace-nowrap transition-opacity duration-300 ${
              isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}
          >
            View Workflows
          </span>
        </button>
        <button
          onClick={() => navigate('/edit-database')}
          className="w-full flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-gray-700 transition-colors text-left text-base"
        >
          <svg
            className="w-7 h-7 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>

          <span
            className={`whitespace-nowrap transition-opacity duration-300 ${
              isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}
          >
            Edit Database
          </span>
        </button>
      </div>
    </div>
  );
}
