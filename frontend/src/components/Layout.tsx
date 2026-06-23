import { ReactNode } from 'react';
import { useWallet } from '../web3/useWallet';

const navItems = [
  { path: '/', label: 'Admin Dashboard' },
  { path: '/identity', label: 'Identity' },
  { path: '/certificates', label: 'Certificates' },
  { path: '/health', label: 'System Health' },
  { path: '/institution', label: 'Institution Dashboard' },
  { path: '/student', label: 'Student Dashboard' },
  { path: '/employer', label: 'Employer Dashboard' },
  { path: '/dev/setup', label: 'Dev Setup' },
  { path: '/dev/graduation', label: 'Dev Graduation' },
];

export default function Layout({ children, currentPath, navigate }: {
  children: ReactNode;
  currentPath: string;
  navigate: (path: string) => void;
}) {
  const { account, chainId, isConnected, isCorrectChain, error, connect, txPending } = useWallet();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">LMS Admin</h1>
          <p className="text-xs text-gray-400 mt-1">Blockchain Dashboard</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                currentPath === item.path
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {navItems.find((i) => i.path === currentPath)?.label || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
            {error && <span className="text-xs text-red-600">{error}</span>}
            {txPending && <span className="text-xs text-blue-600 animate-pulse">Transaction pending...</span>}
            {!isCorrectChain && isConnected && (
              <span className="text-xs text-red-600 font-medium">⚠ Please switch MetaMask to Ganache (1337)</span>
            )}
            {isConnected ? (
              <>
                <span className="text-xs text-gray-500">
                  {account?.slice(0, 6)}...{account?.slice(-4)}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  isCorrectChain ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {chainId === '0x539' ? 'Ganache 1337' : `Chain ${parseInt(chainId || '0', 16)}`}
                </span>
              </>
            ) : (
              <button
                onClick={connect}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}