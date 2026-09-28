import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../../../web3/useWallet';

function buildIpfsHash(degree: string, graduationDate: string): string {
  return JSON.stringify({ degree, graduationDate });
}

export default function IssueCredentialPage() {
  const { ensureReady, getCertificate, error: walletError, txPending, isConnected, connect } = useWallet();
  const [studentAddress, setStudentAddress] = useState('');
  const [degreeName, setDegreeName] = useState('');
  const [graduationDate, setGraduationDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ txHash: string; credentialId: string } | null>(null);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Connect MetaMask on Ganache (chain 1337)');

      const ipfsHash = buildIpfsHash(degreeName.trim(), graduationDate);
      const contract = getCertificate();
      const tx = await contract.issueCertificate(studentAddress.trim(), ipfsHash);
      const receipt = await tx.wait();

      let credentialId: string | null = null;
      const contractAddress = String(contract.target).toLowerCase();
      for (const log of receipt.logs) {
        if (String(log.address).toLowerCase() !== contractAddress) continue;
        try {
          const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'CertificateIssued') {
            credentialId = String(parsed.args.certificateId);
            break;
          }
        } catch {
          // not a Certificates event
        }
      }

      if (!credentialId) {
        throw new Error('Transaction confirmed but credential ID was not found in logs');
      }

      setResult({ txHash: receipt.hash, credentialId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to issue credential';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitting = loading || txPending;

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Issue Credential</h1>
      <p className="text-sm text-gray-600 mb-6">Issue an on-chain certificate to a verified student.</p>

      {!isConnected && (
        <button
          type="button"
          onClick={connect}
          className="mb-4 px-4 py-2 bg-gray-900 text-white text-sm rounded"
        >
          Connect MetaMask
        </button>
      )}

      <form onSubmit={handleIssue} className="bg-white border border-gray-200 rounded p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Student Wallet Address</label>
          <input
            type="text"
            value={studentAddress}
            onChange={(e) => setStudentAddress(e.target.value)}
            placeholder="0x..."
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Degree Name</label>
          <input
            type="text"
            value={degreeName}
            onChange={(e) => setDegreeName(e.target.value)}
            placeholder="Bachelor of Science in Computer Science"
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Graduation Date</label>
          <input
            type="date"
            value={graduationDate}
            onChange={(e) => setGraduationDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gray-900 text-white py-2 rounded text-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Issuing…' : 'Issue Credential'}
        </button>
      </form>

      {(error || walletError) && (
        <p className="mt-4 text-sm text-red-700">{error || walletError}</p>
      )}

      {result && (
        <div className="mt-6 bg-white border border-gray-200 rounded p-5 space-y-2 text-sm">
          <p className="font-medium text-gray-900">Credential issued successfully</p>
          <p><span className="text-gray-600">Transaction:</span> {result.txHash}</p>
          <p className="break-all"><span className="text-gray-600">Credential ID:</span> {result.credentialId}</p>
          <p>
            <span className="text-gray-600">Verification link:</span>{' '}
            <Link to={`/verify/${result.credentialId}`} className="text-blue-700 underline break-all">
              /verify/{result.credentialId}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
