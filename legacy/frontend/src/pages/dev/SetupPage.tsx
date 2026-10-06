import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestAccounts } from '../../web3/provider';
import { getIdentityContractReadOnly } from '../../web3/contracts';
import { useWallet } from '../../web3/useWallet';
import Button from '../../ui/Button/Button';
import Card from '../../ui/Card/Card';

const ROLE_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Student',
  2: 'Institution',
  3: 'Employer',
  4: 'Admin',
};

interface WalletStatus {
  role: string;
  roleValue: number;
  verified: boolean;
  exists: boolean;
}

export default function SetupPage() {
  const { account, isConnected, connect, ensureReady, getIdentity, sendTx, txPending, error: walletError } = useWallet();
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [instName, setInstName] = useState('Dev University');
  const [studentInstitution, setStudentInstitution] = useState('');
  const [studentFirstName, setStudentFirstName] = useState('Dev');
  const [studentLastName, setStudentLastName] = useState('Student');
  const [verifyAddress, setVerifyAddress] = useState('');

  const refreshStatus = useCallback(async () => {
    if (!account) {
      setStatus(null);
      setIsAdmin(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const identity = getIdentityContractReadOnly();
      const exists = await identity.userExists(account);
      if (!exists) {
        setStatus({ role: 'None', roleValue: 0, verified: false, exists: false });
        setIsAdmin(await identity.isAdmin(account));
        return;
      }

      const roleValue = Number(await identity.getUserRole(account));
      const verified = await identity.isVerifiedUser(account);
      setStatus({
        role: ROLE_LABELS[roleValue] ?? 'Unknown',
        roleValue,
        verified,
        exists: true,
      });
      setIsAdmin(await identity.isAdmin(account));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet status');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSwitchWallet = async () => {
    setError(null);
    try {
      await requestAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to switch wallet');
    }
  };

  const handleRegisterInstitution = async () => {
    setError(null);
    setMessage(null);
    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Connect MetaMask on Ganache (chain 1337)');

      const contract = getIdentity();
      const txHash = await sendTx(
        contract.registerInstitution(instName, 'Dev City', '0000000000', 'dev@university.test', 'https://dev.test')
      );
      setMessage(`Institution registered. Tx: ${txHash}`);
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const handleRegisterStudent = async () => {
    setError(null);
    setMessage(null);
    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Connect MetaMask on Ganache (chain 1337)');

      if (!studentInstitution.trim()) {
        throw new Error('Institution address is required for student registration');
      }

      const contract = getIdentity();
      const txHash = await sendTx(
        contract.registerStudent(
          studentInstitution.trim(),
          'DEV-001',
          studentFirstName,
          studentLastName,
          '0000000000',
          'dev@student.test'
        )
      );
      setMessage(`Student registered. Tx: ${txHash}`);
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const handleVerifyUser = async () => {
    setError(null);
    setMessage(null);
    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Connect MetaMask on Ganache (chain 1337)');

      const target = verifyAddress.trim() || account;
      if (!target) throw new Error('Address required');

      const contract = getIdentity();
      const txHash = await sendTx(contract.verifyUser(target));
      setMessage(`User verified. Tx: ${txHash}`);
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const hasNoRole = status && (!status.exists || status.roleValue === 0);
  const isSubmitting = txPending;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dev Setup</h1>
        <p className="text-sm text-gray-600 mt-1">On-chain role bootstrapping for Trust Loop testing</p>
      </div>

      {!isConnected && (
        <button type="button" onClick={connect} className="px-4 py-2 bg-gray-900 text-white text-sm rounded">
          Connect MetaMask
        </button>
      )}

      {isConnected && (
        <Card>
          <div className="bg-white p-5 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-gray-500">Connected Wallet</p>
                <p className="font-mono text-xs break-all mt-0.5">{account}</p>
              </div>
              <Button onClick={handleSwitchWallet}>
                Switch Wallet
              </Button>
            </div>

            {loading && <p className="text-gray-600">Loading role…</p>}

            {status && !loading && (
              <>
                <div>
                  <p className="text-gray-500">On-Chain Role</p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {status.role === 'Institution' || status.role === 'Student' ? status.role : 'None'}
                    {status.role !== 'None' && status.role !== 'Institution' && status.role !== 'Student' && (
                      <span className="text-gray-500 font-normal"> ({status.role})</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Verified</p>
                  <p className="font-medium text-gray-900 mt-0.5">{status.verified ? 'Yes' : 'No'}</p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {hasNoRole && isConnected && (
        <Card>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded p-5 space-y-3">
              <h2 className="text-sm font-medium text-gray-900">Register as Institution</h2>
              <input
                type="text"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                placeholder="Institution name"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleRegisterInstitution}
              >
                Register as Institution
              </Button>
            </div>

            <div className="bg-white border border-gray-200 rounded p-5 space-y-3">
              <h2 className="text-sm font-medium text-gray-900">Register as Student</h2>
              <input
                type="text"
                value={studentInstitution}
                onChange={(e) => setStudentInstitution(e.target.value)}
                placeholder="Institution wallet address (0x...)"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={studentFirstName}
                  onChange={(e) => setStudentFirstName(e.target.value)}
                  placeholder="First name"
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={studentLastName}
                  onChange={(e) => setStudentLastName(e.target.value)}
                  placeholder="Last name"
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleRegisterStudent}
              >
                Register as Student
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isAdmin && isConnected && (
        <Card>

          <div className="bg-white border border-gray-200 rounded p-5 space-y-3">
            <h2 className="text-sm font-medium text-gray-900">Admin: Verify User</h2>
            <p className="text-xs text-gray-600">Required before institution/student can issue or graduate.</p>
            <input
              type="text"
              value={verifyAddress}
              onChange={(e) => setVerifyAddress(e.target.value)}
              placeholder={account ? `Leave empty to verify ${account.slice(0, 10)}…` : 'User address'}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleVerifyUser}
            >
              Verify User
            </Button>
          </div>
        </Card>
      )}

      {(error || walletError) && <p className="text-sm text-red-700">{error || walletError}</p>}
      {message && <p className="text-sm text-green-800">{message}</p>}

      <Card>
        <div className="text-sm space-y-1">
          <p className="text-gray-600">Next steps:</p>
          <Link to="/dev/graduation" className="block text-blue-700 underline">Graduation setup →</Link>
          <Link to="/institution/issue" className="block text-blue-700 underline">Issue credential →</Link>
        </div>
      </Card>
    </div>
  );
}
