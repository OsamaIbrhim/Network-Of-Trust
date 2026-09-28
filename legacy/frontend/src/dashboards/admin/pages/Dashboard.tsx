import { useEffect, useState } from 'react';
import { healthService } from '../../../services/health.service';
import { identityService } from '../../../services/identity.service';
import { useWallet } from '../../../web3/useWallet';

export default function Dashboard() {
  const [health, setHealth] = useState<any>(null);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { ensureReady, getIdentity } = useWallet();

  useEffect(() => {
    const fetch = async () => {
      try {
        const h = await healthService.get();
        setHealth(h);

        const ready = await ensureReady();
        let instData: any[] = [];
        if (ready) {
          try {
            const contract = getIdentity();
            instData = await contract.getAllInstitutions();
          } catch {
            // MetaMask not connected — skip institutions count
          }
        }
        setInstitutions(Array.isArray(instData) ? instData : []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [ensureReady, getIdentity]);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Backend</div>
          <div className="text-lg font-semibold mt-1">{health?.status === 'ok' ? 'Online' : 'Offline'}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Chain ID</div>
          <div className="text-lg font-semibold mt-1">{health?.chainId}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Block Number</div>
          <div className="text-lg font-semibold mt-1">{health?.blockNumber}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-2">Registered Institutions</div>
          <div className="text-3xl font-bold">{institutions.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-2">Deployed Contracts</div>
          <div className="text-3xl font-bold">{health?.contractsDeployed ? Object.keys(health.contractsDeployed).length : 0}</div>
        </div>
      </div>

      {health?.contractsDeployed && (
        <div className="bg-white rounded-lg shadow p-4 overflow-auto">
          <h3 className="font-semibold mb-3">Contract Addresses</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Contract</th>
                <th className="py-2">Address</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(health.contractsDeployed).map(([name, addr]) => (
                <tr key={name} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{name}</td>
                  <td className="py-2 text-gray-600 font-mono text-xs">{addr as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
