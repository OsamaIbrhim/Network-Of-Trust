import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { identityService } from '../../../services/identity.service';
import { useWallet } from '../../../web3/useWallet';
import Button from '../../../ui/Button/Button';
import Card from '../../../ui/Card/Card';
import Badge from '../../../ui/Badge';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function formatMetric(value: number | string | null) {
  return value === null ? '—' : value;
}

const metricLabels = [
  'Total Credentials Issued',
  'Total Verifications',
  'Revoked Certificates',
  'Active Validation Mode',
];

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

  const statusBadgeVariant = useMemo(() => {
    if (isVerified === null) return 'pending' as const;
    return isVerified ? 'verified' as const : 'unverified' as const;
  }, [isVerified]);

  const activeAccountRef = useRef<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!account) {
      setIssuedCount(null);
      setRevokedCount(null);
      setIsVerified(null);
      setLoading(false);
      return;
    }

    if (activeAccountRef.current === account && loading) return;

    activeAccountRef.current = account;
    setLoading(true);
    setError(null);

    try {
      const backendInstitution = await identityService.getInstitutionData(account).then((res) => res.data).catch(() => null);

      if (activeAccountRef.current !== account) return;

      if (backendInstitution?.name) {
        setInstitutionName(backendInstitution.name);
        setIsVerified(Boolean(backendInstitution.isVerified));
      }

      const ready = await ensureReady();
      if (!ready) {
        if (activeAccountRef.current !== account) return;
        setError(walletError || 'Please connect MetaMask and switch to Ganache (chain 1337)');
        setLoading(false);
        return;
      }

      const contract = getCertificate();
      const rawCerts = await contract.getUserCertificates(account);
      if (activeAccountRef.current !== account) return;

      const validItems = Array.isArray(rawCerts) ? rawCerts.filter((item: any) => item.certificate) : [];
      const certificateIds = validItems.map((item: any) => String(item.certificate));

      let issued = validItems.length;
      let revoked = 0;

      if (certificateIds.length > 0) {
        const verifyResults = await Promise.allSettled(
          certificateIds.map((id: string) => contract.verifyCertificate(id)),
        );

        verifyResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            const [, , , , isValid] = result.value;
            if (!isValid) revoked += 1;
          }
        });
      }

      const validationAddress = await contract.validationContract();
      if (activeAccountRef.current !== account) return;

      const mode = validationAddress === ZERO_ADDRESS ? 'Basic' : 'Academic';

      setIssuedCount(issued);
      setRevokedCount(revoked);
      setValidationMode(mode);
      if (!institutionName && backendInstitution?.name) {
        setInstitutionName(backendInstitution.name);
      }
    } catch (err: unknown) {
      if (activeAccountRef.current !== account) return;
      setError(err instanceof Error ? err.message : 'Failed to load institution overview');
    } finally {
      if (activeAccountRef.current === account) {
        setLoading(false);
      }
    }
  }, [account, ensureReady, getCertificate, walletError, loading, institutionName]);

  useEffect(() => {
    loadOverview();
  }, [account]);

  const handleConnect = useCallback(() => {
    if (!window.ethereum?.isMetaMask) {
      navigate('/install-metamask');
      return;
    }
    connect();
  }, [connect, navigate]);

  const metricValues = useMemo(() => [
    formatMetric(issuedCount),
    '—',
    formatMetric(revokedCount),
    validationMode,
  ], [issuedCount, revokedCount, validationMode]);

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-12 px-4 py-6 sm:px-6 lg:px-8">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[26px] font-semibold text-slate-900">{institutionName}</h1>
              {isVerified !== null && (
                <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
              )}
            </div>
            <p className="mt-3 max-w-2xl text-sm text-slate-500">Institution trust surface for credential issuance and verification. Use the credentials page to manage issued certificates and revoke when needed.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/institution/credentials')}>
              View Credentials
            </Button>
            <Button variant="secondary" onClick={() => navigate('/institution/issue')}>
              Issue Credential
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} padding="sm">
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200" />
              </Card>
            ))}
          </>
        ) : (
          <>
            {metricLabels.map((label, i) => (
              <Card key={label} padding="sm" hoverable>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-[22px] font-semibold text-slate-900">{metricValues[i]}</p>
              </Card>
            ))}
          </>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Institution trust summary</h2>
            <p className="mt-2 text-sm text-slate-500">A clean view of your current credential issuance and validation status.</p>
          </div>
          <div className="text-sm text-slate-500">{loading ? 'Refreshing…' : 'Updated recently'}</div>
        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <svg className="h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
            <span>{error}</span>
          </div>
        )}
      </Card>

      {!isConnected && (
        <Card>
          <p className="text-sm text-slate-600">Connect your institution wallet to view credential issuance metrics and manage certificates.</p>
          <div className="mt-4">
            <Button onClick={handleConnect}>Connect MetaMask</Button>
          </div>
        </Card>
      )}
    </div>
  );
}