import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { identityService } from '../../../services/identity.service';
import { useWallet } from '../../../web3/useWallet';

export default function IdentityPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const verify = useForm();
  const query = useForm();

  const { ensureReady, sendTx, getIdentity, error: walletError, txPending } = useWallet();

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleVerifyUser = async (data: any) => {
    setLoading(true);
    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Wallet not ready');
      const contract = getIdentity();
      const tx = await sendTx(contract.verifyUser(data.userAddress));
      showMessage('success', `User verified. Tx: ${tx.slice(0, 20)}...`);
      verify.reset();
    } catch (err: any) {
      showMessage('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async (data: any) => {
    setLoading(true);
    try {
      const addr = data.queryAddress;
      const [admin, inst, exists, role, instData, studentData] = await Promise.all([
        identityService.isAdmin(addr).catch(() => null),
        identityService.isInstitution(addr).catch(() => null),
        identityService.userExists(addr).catch(() => null),
        identityService.getUserRole(addr).catch(() => null),
        identityService.getInstitutionData(addr).catch(() => null),
        identityService.getStudentData(addr).catch(() => null),
      ]);
      setResults({ admin, institution: inst, exists, role, institutionData: instData, studentData });
    } catch (err: any) {
      showMessage('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInstitutions = async () => {
    setLoading(true);
    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Wallet not ready');
      const contract = getIdentity();
      const data = await contract.getAllInstitutions();
      setInstitutions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showMessage('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Wallet not ready');
      const contract = getIdentity();
      const data = await contract.getAllAdmins();
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showMessage('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {message.text && (
        <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={verify.handleSubmit(handleVerifyUser)} className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">Verify User</h3>
          <input {...verify.register('userAddress', { required: true })} placeholder="User Address" className="w-full border rounded px-3 py-2 mb-2 text-sm" />
          <button disabled={loading || txPending} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50">Verify</button>
        </form>

        <form onSubmit={query.handleSubmit(handleQuery)} className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">Query Address</h3>
          <input {...query.register('queryAddress', { required: true })} placeholder="Ethereum Address" className="w-full border rounded px-3 py-2 mb-2 text-sm" />
          <button disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">Query</button>
          {results && (
            <div className="mt-3 text-xs space-y-1">
              <p>Admin: {String(results.admin)}</p>
              <p>Institution: {String(results.institution)}</p>
              <p>Exists: {String(results.exists)}</p>
              <p>Role: {results.role}</p>
              {results.institutionData && <p>Inst Name: {results.institutionData.name}</p>}
              {results.studentData && <p>Student: {results.studentData.firstName} {results.studentData.lastName}</p>}
            </div>
          )}
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Administrators</h3>
            <button onClick={loadAdmins} className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700">Refresh</button>
          </div>
          {admins.length > 0 ? (
            <ul className="text-sm space-y-2">
              {admins.map((admin, idx) => {
                const address =
                  typeof admin === "string"
                    ? admin
                    : admin.userAddress || admin[0] || "";

                const email =
                  typeof admin === "object" && admin !== null
                    ? admin.email || admin[1] || ""
                    : "";

                return (
                  <li key={idx} className="font-mono text-xs text-gray-700">
                    {address}
                    {email ? ` - ${email}` : ""}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">Click Refresh to load admins</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Institutions</h3>
            <button onClick={loadInstitutions} className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700">Refresh</button>
          </div>
          {institutions.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Name</th>
                  <th className="py-2">Location</th>
                  <th className="py-2">Address</th>
                  <th className="py-2">Verified</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((inst, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2">{inst.name}</td>
                    <td className="py-2">{inst.location}</td>
                    <td className="py-2 font-mono text-xs">{inst.userAddress}</td>
                    <td className="py-2">{inst.isVerified ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-400 text-sm">Click Refresh to load institutions</p>
          )}
        </div>
      </div>
    </div>
  );
}
