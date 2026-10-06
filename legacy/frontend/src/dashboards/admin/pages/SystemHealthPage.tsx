import { useEffect, useState } from 'react';
import { healthService } from '../../../services/health.service';

export default function SystemHealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const h = await healthService.get();
      setHealth(h);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 text-red-800 p-3 rounded text-sm">
          Connection Error: {error}
          <button onClick={load} className="ml-3 underline">Retry</button>
        </div>
      )}

      {health && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Backend Status</div>
              <div className={`text-lg font-semibold mt-1 ${health.status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                {health.status?.toUpperCase()}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Chain ID</div>
              <div className="text-lg font-semibold mt-1">{health.chainId}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Block Number</div>
              <div className="text-lg font-semibold mt-1">{health.blockNumber}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 overflow-auto">
            <h3 className="font-semibold mb-3">Deployed Contracts</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Contract</th>
                  <th className="py-2">Address</th>
                </tr>
              </thead>
              <tbody>
                {health.contractsDeployed && Object.entries(health.contractsDeployed).map(([name, addr]) => (
                  <tr key={name} className="border-b border-gray-100 font-mono text-xs">
                    <td className="py-2 font-medium">{name}</td>
                    <td className="py-2 text-gray-600">{addr as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Full Response</h3>
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-60">
              {JSON.stringify(health, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
