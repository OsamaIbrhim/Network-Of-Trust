import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from '../../../web3/useWallet';

interface CredentialItem {
  credentialId: string;
  ipfsHash: string;
}

interface CredentialDetail {
  student: string;
  institution: string;
  isValid: boolean;
  issuedAt: string;
  degree: string;
}

const PAGE_SIZE = 20;

function safeParseMetadata(ipfsHash: string) {
  try {
    const parsed = JSON.parse(ipfsHash) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function truncateText(text: string, length = 14) {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}…`;
}

export default function InstitutionCredentialsPage() {
  const { account, ensureReady, getCertificate, isConnected, connect, sendTx, txPending, error: walletError } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();

  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [details, setDetails] = useState<Record<string, CredentialDetail>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('all');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueResult, setIssueResult] = useState<{ credentialId: string; txHash: string } | null>(null);
  const [studentAddress, setStudentAddress] = useState('');
  const [degreeName, setDegreeName] = useState('');
  const [metadataOpen, setMetadataOpen] = useState(false);
  const loadingRef = useRef(false);

  const openPanelFromState = useMemo(() => {
    return (location.state as any)?.openIssuePanel === true;
  }, [location.state]);

  const loadCredentials = useCallback(async () => {
    if (!account) {
      setCredentials([]);
      setDetails({});
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Please connect MetaMask and switch to Ganache');

      const contract = getCertificate();
      const rawCerts = await contract.getUserCertificates(account);
      const parsed: CredentialItem[] = (Array.isArray(rawCerts) ? rawCerts : [])
        .map((item: any) => ({
          credentialId: String(item.certificate),
          ipfsHash: String(item.ipfsHash || ''),
        }))
        .filter((item) => item.credentialId && item.credentialId !== '0x0000000000000000000000000000000000000000000000000000000000000000')
        .reverse();

      setCredentials(parsed);
      setPage(1);
      setDetails({});

      const verifyResults = await Promise.allSettled(
        parsed.map((item) => contract.verifyCertificate(item.credentialId)),
      );

      const resolvedDetails: Record<string, CredentialDetail> = {};
      verifyResults.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const [student, institution, ipfsHash, issuedAt, isValid] = result.value;
        const metadata = safeParseMetadata(String(ipfsHash ?? parsed[index].ipfsHash));
        let degree = String(ipfsHash ?? parsed[index].ipfsHash);
        if (metadata?.degree && typeof metadata.degree === 'string') degree = metadata.degree;
        else if (metadata?.program && typeof metadata.program === 'string') degree = metadata.program;

        resolvedDetails[parsed[index].credentialId] = {
          student: String(student),
          institution: String(institution),
          isValid: Boolean(isValid),
          issuedAt: String(issuedAt?.toString?.() ?? issuedAt ?? ''),
          degree,
        };
      });

      setDetails(resolvedDetails);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [account]);

  useEffect(() => {
    if (!account) return;
    loadCredentials();
  }, [account]);

  useEffect(() => {
    if (openPanelFromState) {
      setPanelOpen(true);
    }
  }, [openPanelFromState]);

  useEffect(() => {
    if (!panelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanelOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [panelOpen]);

  const filteredCredentials = useMemo(() => {
    return credentials.filter((item) => {
      const detail = details[item.credentialId];
      const student = detail?.student ?? '';
      const matchesSearch = student.toLowerCase().includes(search.trim().toLowerCase());
      const status = detail ? (detail.isValid ? 'active' : 'revoked') : 'active';
      const matchesStatus = statusFilter === 'all' || statusFilter === status;
      return matchesSearch && matchesStatus;
    });
  }, [credentials, details, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCredentials.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredCredentials.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const issuedCount = credentials.length;
  const revokedCount = Object.values(details).filter((detail) => detail.isValid === false).length;
  const verifiedCount = '—';

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const handleRevoke = async (credentialId: string) => {
    setError(null);
    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Please connect MetaMask and switch to Ganache');
      const contract = getCertificate();
      await sendTx(contract.revokeCertificate(credentialId));
      await loadCredentials();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke credential');
    }
  };

  const openIssuePanel = () => {
    setPanelOpen(true);
    setIssueResult(null);
    setIssueError(null);
    setStudentAddress('');
    setDegreeName('');
  };

  const handleIssueSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIssueLoading(true);
    setIssueError(null);
    setIssueResult(null);

    try {
      const ready = await ensureReady();
      if (!ready) throw new Error(walletError || 'Please connect MetaMask and switch to Ganache');
      const contract = getCertificate();
      const ipfsHash = JSON.stringify({ degree: degreeName.trim() });
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
          // ignore
        }
      }

      if (!credentialId) {
        throw new Error('Credential issued but ID could not be retrieved');
      }

      setIssueResult({ credentialId, txHash: receipt.hash });
      await loadCredentials();
      setTimeout(() => setPanelOpen(false), 3500);
    } catch (err: unknown) {
      setIssueError(err instanceof Error ? err.message : 'Failed to issue credential');
    } finally {
      setIssueLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Credentials</h1>
          <p className="text-sm text-slate-600 mt-1">Manage institutional credentials and issue new certificates.</p>
        </div>
        <button
          type="button"
          onClick={openIssuePanel}
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          + Issue Credential
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Issued</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{issuedCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Verified</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{verifiedCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Revoked</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{revokedCount}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Active validation mode: <span className="font-semibold text-slate-900">Basic</span>
          </div>
          <div className="text-xs text-slate-500">Verification count is not available from the current backend contract API.</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900">Search and filter</h2>
            <p className="text-sm text-slate-500">Filter student addresses and credential status.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openIssuePanel}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Issue Credential
            </button>
            <button
              type="button"
              onClick={() => navigate('/institution')}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Overview
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student address"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'revoked')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
            Sorted by newest
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Credential ID</th>
                  <th className="px-4 py-4 font-semibold">Student</th>
                  <th className="px-4 py-4 font-semibold">Degree</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Verifications</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading credentials…</td>
                  </tr>
                ) : filteredCredentials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No credentials found.</td>
                  </tr>
                ) : (
                  pageItems.map((item) => {
                    const detail = details[item.credentialId];
                    const metadata = safeParseMetadata(item.ipfsHash);
                    const degree = detail?.degree || (metadata?.degree as string) || (metadata?.program as string) || item.ipfsHash;
                    return (
                      <tr key={item.credentialId}>
                        <td className="px-4 py-4 align-top text-sm text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{truncateText(item.credentialId, 20)}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.credentialId)}
                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">{detail?.student ? formatAddress(detail.student) : 'Loading…'}</td>
                        <td className="px-4 py-4 align-top">{degree}</td>
                        <td className="px-4 py-4 align-top">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${detail?.isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {detail ? (detail.isValid ? 'Active' : 'Revoked') : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">—</td>
                        <td className="px-4 py-4 align-top">
                          {detail?.isValid ? (
                            <button
                              type="button"
                              onClick={() => handleRevoke(item.credentialId)}
                              disabled={txPending}
                              className="rounded-md bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">No action</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 md:hidden">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-500">Loading credentials…</div>
          ) : filteredCredentials.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-500">No credentials found.</div>
          ) : (
            pageItems.map((item) => {
              const detail = details[item.credentialId];
              const metadata = safeParseMetadata(item.ipfsHash);
              const degree = detail?.degree || (metadata?.degree as string) || (metadata?.program as string) || item.ipfsHash;
              return (
                <div key={item.credentialId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Credential ID</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{truncateText(item.credentialId, 18)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.credentialId)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <div>
                      <div className="text-xs text-slate-400">Student</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{detail?.student ? formatAddress(detail.student) : 'Loading…'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Degree</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{degree}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${detail?.isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {detail ? (detail.isValid ? 'Active' : 'Revoked') : 'Pending'}
                      </span>
                      <span className="text-xs text-slate-500">Verifications: —</span>
                    </div>
                    <div>
                      {detail?.isValid ? (
                        <button
                          type="button"
                          onClick={() => handleRevoke(item.credentialId)}
                          disabled={txPending}
                          className="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      ) : (
                        <div className="text-sm text-slate-500">No action available</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        <button
          type="button"
          onClick={() => setPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 disabled:opacity-50"
        >
          Previous
        </button>
        <div>Page {currentPage} of {totalPages}</div>
        <button
          type="button"
          onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/50 px-4 py-6 backdrop-blur-sm md:items-center">
          <div className="fixed inset-0" onClick={() => setPanelOpen(false)} />
          <div className="relative z-10 w-full max-w-[480px] rounded-t-3xl bg-white shadow-2xl transition-transform duration-200 md:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Issue Credential</h2>
                <p className="text-sm text-slate-500">Issue a new certificate to a verified student.</p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {issueResult ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                    <p className="text-sm font-semibold text-emerald-800">Credential issued successfully</p>
                    <p className="mt-2 text-sm text-slate-700">ID: <span className="font-mono break-all text-slate-900">{issueResult.credentialId}</span></p>
                    <p className="text-sm text-slate-500">Transaction: <span className="font-mono text-slate-700">{issueResult.txHash}</span></p>
                  </div>
                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={() => handleCopy(issueResult.credentialId)}
                      className="rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Copy Credential ID
                    </button>
                    <Link
                      to={`/verify/${issueResult.credentialId}`}
                      className="rounded-md border border-slate-300 px-4 py-3 text-sm font-medium text-slate-900 text-center"
                    >
                      View Verification Page
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleIssueSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Student Wallet Address</label>
                    <input
                      value={studentAddress}
                      onChange={(e) => setStudentAddress(e.target.value)}
                      required
                      placeholder="0x..."
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Degree / Program</label>
                    <input
                      value={degreeName}
                      onChange={(e) => setDegreeName(e.target.value)}
                      required
                      placeholder="Bachelor of Science in Computer Science"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <button
                      type="button"
                      onClick={() => setMetadataOpen(!metadataOpen)}
                      className="flex w-full items-center justify-between text-sm font-medium text-slate-700"
                    >
                      <span>Optional metadata</span>
                      <span>{metadataOpen ? '−' : '+'}</span>
                    </button>
                    {metadataOpen && (
                      <p className="mt-3 text-sm text-slate-500">Additional metadata support is coming soon. You may include JSON metadata in the IPFS payload later.</p>
                    )}
                  </div>
                  {issueError && <p className="text-sm text-rose-600">{issueError}</p>}
                  <button
                    type="submit"
                    disabled={issueLoading}
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {issueLoading ? 'Issuing…' : 'Issue Credential'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {!isConnected && (
        <button
          type="button"
          onClick={connect}
          className="rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          Connect MetaMask
        </button>
      )}
    </div>
  );
}
