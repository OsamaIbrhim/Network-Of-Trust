import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { identityService } from '../../../services/identity.service';
import { useWallet } from '../../../web3/useWallet';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function formatMetric(value: number | string | null) {
  return value === null ? '—' : value;
}

export default function InstitutionDashboard() {
  const { account, ensureReady, getCertificate, isConnected, connect, error: walletError } = useWallet();
  const navigate = useNavigate();

  const [institutionName, setInstitutionName] = useState<string>('Institution');
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [validationMode, setValidationMode] = useState<'Basic' | 'Academic'>('Basic');
  const [issuedCount, setIssuedCount] = useState<number | null>(null);
  const [revokedCount, setRevokedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = useMemo(() => {
    if (isVerified === null) return 'Checking…';
    return isVerified ? 'Verified institution' : 'Unverified institution';
  }, [isVerified]);

  useEffect(() => {
    if (!account) {
      setIssuedCount(null);
      setRevokedCount(null);
      setIsVerified(null);
      return;
    }

    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError(null);

      try {
        const backendInstitution = await identityService.getInstitutionData(account).then((res) => res.data).catch(() => null);
        if (backendInstitution?.name) {
          setInstitutionName(backendInstitution.name);
          setIsVerified(Boolean(backendInstitution.isVerified));
        }

        const ready = await ensureReady();
        if (!ready) {
          throw new Error(walletError || 'Please connect MetaMask and switch to Ganache (chain 1337)');
        }

        const contract = getCertificate();
        const rawCerts = await contract.getUserCertificates(account);
        const validItems = Array.isArray(rawCerts) ? rawCerts.filter((item: any) => item.certificate) : [];
        const certificateIds = validItems.map((item: any) => String(item.certificate));

        let issued = validItems.length;
        let revoked = 0;

        if (certificateIds.length > 0) {
          const verifyResults = await Promise.allSettled(
            certificateIds.map((id) => contract.verifyCertificate(id)),
          );

          verifyResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              const [, , , , isValid] = result.value;
              if (!isValid) revoked += 1;
            }
          });
        }

        const validationAddress = await contract.validationContract();
        const mode = validationAddress === ZERO_ADDRESS ? 'Basic' : 'Academic';

        if (!cancelled) {
          setIssuedCount(issued);
          setRevokedCount(revoked);
          setValidationMode(mode);
          if (!institutionName && backendInstitution?.name) {
            setInstitutionName(backendInstitution.name);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load institution overview');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [account, ensureReady, getCertificate, walletError]);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900">{institutionName}</h1>
              {isVerified !== null && (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {statusLabel}
                </span>
              )}
            </div>
            <p className="mt-3 max-w-2xl text-sm text-slate-500">Institution trust surface for credential issuance and verification. Use the credentials page to manage issued certificates and revoke when needed.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/institution/credentials')}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              View Credentials
            </button>
            <button
              type="button"
              onClick={() => navigate('/institution/issue')}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Issue Credential
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Credentials Issued</p>
          <p className="mt-4 text-3xl font-semibold text-slate-900">{formatMetric(issuedCount)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Verifications</p>
          <p className="mt-4 text-3xl font-semibold text-slate-900">—</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Revoked Certificates</p>
          <p className="mt-4 text-3xl font-semibold text-slate-900">{formatMetric(revokedCount)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Active Validation Mode</p>
          <p className="mt-4 text-3xl font-semibold text-slate-900">{validationMode}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Institution trust summary</h2>
            <p className="mt-2 text-sm text-slate-500">A clean view of your current credential issuance and validation status.</p>
          </div>
          <div className="text-sm text-slate-500">{loading ? 'Refreshing…' : 'Updated recently'}</div>
        </div>
        {error && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      </div>

      {!isConnected && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Connect your institution wallet to view credential issuance metrics and manage certificates.</p>
          <button
            type="button"
            onClick={connect}
            className="mt-4 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Connect MetaMask
          </button>
        </div>
      )}
    </div>
  );
}
