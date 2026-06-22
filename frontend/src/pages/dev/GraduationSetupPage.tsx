import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keccak256, toUtf8Bytes } from 'ethers';
import { getGraduationContractReadOnly } from '../../web3/contracts';
import { useWallet } from '../../web3/useWallet';

const GRADUATION_STATUS: Record<number, string> = {
  0: 'Not Eligible',
  1: 'Eligible',
  2: 'Approved',
  3: 'Graduated',
};

function departmentKey(department: string): string {
  return keccak256(toUtf8Bytes(department));
}

export default function GraduationSetupPage() {
  const { ensureReady, getIdentity, getGraduation, sendTx, txPending, error: walletError } = useWallet();
  const [studentAddress, setStudentAddress] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [graduationStatus, setGraduationStatus] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadGraduationStatus = useCallback(async () => {
    if (!studentAddress.trim()) {
      setGraduationStatus(null);
      return;
    }

    setLoadingStatus(true);
    setError(null);
    try {
      const contract = getGraduationContractReadOnly();
      const statusValue = Number(await contract.getGraduationStatus(studentAddress.trim()));
      setGraduationStatus(GRADUATION_STATUS[statusValue] ?? `Unknown (${statusValue})`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load graduation status');
      setGraduationStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, [studentAddress]);

  useEffect(() => {
    const timer = setTimeout(loadGraduationStatus, 300);
    return () => clearTimeout(timer);
  }, [loadGraduationStatus]);

  const runTx = async (label: string, action: () => Promise<unknown>) => {
    setError(null);
    setMessage(null);
    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Connect MetaMask on Ganache (chain 1337)');

      if (!studentAddress.trim()) throw new Error('Student address is required');

      const txHash = await sendTx(action());
      setMessage(`${label} confirmed. Tx: ${txHash}`);
      await loadGraduationStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    }
  };

  const handleEnrollStudent = () => {
    runTx('Enroll student', () => getIdentity().addStudents([studentAddress.trim()]));
  };

  const handleSetRequirements = () => {
    runTx('Set requirements', () =>
      getGraduation().setRequirements(department, 0, 0, [], false, false, 0)
    );
  };

  const handleCheckEligibility = () => {
    const deptKey = departmentKey(department);
    runTx('Check eligibility', () =>
      getGraduation().checkEligibility(studentAddress.trim(), deptKey)
    );
  };

  const handleApproveGraduation = () => {
    runTx('Approve graduation', () => getGraduation().approveGraduation(studentAddress.trim()));
  };

  const isSubmitting = txPending;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dev Graduation Setup</h1>
        <p className="text-sm text-gray-600 mt-1">
          Prepare a student for credential issuance (institution wallet required for actions)
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded p-5 space-y-4 text-sm">
        <div>
          <label className="block text-gray-700 mb-1">Student Address</label>
          <input
            type="text"
            value={studentAddress}
            onChange={(e) => setStudentAddress(e.target.value)}
            placeholder="0x..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1">Department</label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <p className="text-gray-500">Graduation Status</p>
          {loadingStatus && <p className="text-gray-600 mt-0.5">Loading…</p>}
          {!loadingStatus && graduationStatus && (
            <p className="font-medium text-gray-900 mt-0.5">{graduationStatus}</p>
          )}
          {!loadingStatus && !graduationStatus && studentAddress.trim() && (
            <p className="text-gray-600 mt-0.5">—</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded p-5 space-y-2 text-sm">
        <p className="text-gray-600 mb-2">Run in order (verified institution wallet):</p>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleEnrollStudent}
          className="w-full border border-gray-300 py-2 rounded disabled:opacity-50"
        >
          1. Enroll Student (addStudents)
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSetRequirements}
          className="w-full border border-gray-300 py-2 rounded disabled:opacity-50"
        >
          2. Set Requirements (setRequirements)
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleCheckEligibility}
          className="w-full border border-gray-300 py-2 rounded disabled:opacity-50"
        >
          3. Check Eligibility (checkEligibility)
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleApproveGraduation}
          className="w-full bg-gray-900 text-white py-2 rounded disabled:opacity-50"
        >
          4. Approve Graduation (approveGraduation)
        </button>
      </div>

      {(error || walletError) && <p className="text-sm text-red-700">{error || walletError}</p>}
      {message && <p className="text-sm text-green-800 break-all">{message}</p>}

      <Link to="/dev/setup" className="text-sm text-blue-700 underline">
        ← Back to Dev Setup
      </Link>
    </div>
  );
}
