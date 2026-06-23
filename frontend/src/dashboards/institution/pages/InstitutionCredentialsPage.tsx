import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from '../../../web3/useWallet';
import Button from '../../../ui/Button/Button';
import Card from '../../../ui/Card/Card';
import Badge from '../../../ui/Badge';
import Input from '../../../ui/Input';
import Select from '../../../ui/Select';
import { getCertificateContractReadOnly } from '../../../web3/contracts';

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
  const { account, ensureReady, isConnected, connect, sendTx, txPending, error: walletError } = useWallet();
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

  const activeAccountRef = useRef<string | null>(null);

  const openPanelFromState = useMemo(() => {
    return (location.state as any)?.openIssuePanel === true;
  }, [location.state]);

  const loadCredentials = useCallback(async () => {
    if (!account) {
      return;
    }

    if (activeAccountRef.current === account && loading) return;

    activeAccountRef.current = account;
    setLoading(true);
    setError(null);

    try {
      const ready = await ensureReady();
      if (!ready) {
        if (activeAccountRef.current !== account) return;
        setError(walletError || 'Please connect MetaMask and switch to Ganache');
        setLoading(false);
        return;
      }

      const contract = getCertificateContractReadOnly();
      const rawCerts = await contract.getUserCertificates(account);
      if (activeAccountRef.current !== account) return;

      const parsed: CredentialItem[] = (Array.isArray(rawCerts) ? rawCerts : [])
        .map((item: any) => ({
          credentialId: String(item.certificate),
          ipfsHash: String(item.ipfsHash || ''),
        }))
        .filter((item) => item.credentialId && item.credentialId !== '0x0000000000000000000000000000000000000000000000000000000000000000')
        .reverse();

      if (activeAccountRef.current !== account) return;
      setCredentials(parsed);
      setPage(1);
      setDetails({});

      const verifyResults = await Promise.allSettled(
        parsed.map((item) => contract.verifyCertificate(item.credentialId)),
      );

      if (activeAccountRef.current !== account) return;

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
      if (activeAccountRef.current !== account) return;
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      if (activeAccountRef.current === account) {
        setLoading(false);
      }
    }
  }, [account]);

  useEffect(() => {
    let active = true;

    async function init() {
      if (!account || !isConnected) return;

      const ready = await ensureReady();
      if (!ready) return;

      if (active) {
        loadCredentials();
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [account, isConnected]);

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

  const handleConnect = useCallback(() => {
    if (!window.ethereum?.isMetaMask) {
      navigate('/install-metamask');
      return;
    }
    connect();
  }, [connect, navigate]);

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
      const contract = getCertificateContractReadOnly();
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

  const getStatusBadgeVariant = (detail: CredentialDetail | undefined): 'active' | 'revoked' | 'pending' => {
    if (!detail) return 'pending';
    return detail.isValid ? 'active' : 'revoked';
  };

  const getStatusLabel = (detail: CredentialDetail | undefined): string => {
    if (!detail) return 'Pending';
    return detail.isValid ? 'Active' : 'Revoked';
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-12 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold text-slate-900">Credentials</h1>
          <p className="text-sm text-slate-500 mt-1">Manage institutional credentials and issue new certificates.</p>
        </div>
        <Button onClick={openIssuePanel}>+ Issue Credential</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {loading ? (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} padding="sm">
                <div className="h-4 w-14 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-7 w-12 animate-pulse rounded bg-slate-200" />
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card padding="sm" hoverable>
              <div className="text-sm font-medium text-slate-500">Issued</div>
              <div className="mt-2 text-[22px] font-semibold text-slate-900">{issuedCount}</div>
            </Card>
            <Card padding="sm" hoverable>
              <div className="text-sm font-medium text-slate-500">Verified</div>
              <div className="mt-2 text-[22px] font-semibold text-slate-900">{verifiedCount}</div>
            </Card>
            <Card padding="sm" hoverable>
              <div className="text-sm font-medium text-slate-500">Revoked</div>
              <div className="mt-2 text-[22px] font-semibold text-slate-900">{revokedCount}</div>
            </Card>
          </>
        )}
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Active validation mode: <span className="font-semibold text-slate-900">Basic</span>
          </div>
          <div className="text-xs text-slate-500">Verification count is not available from the current backend contract API.</div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <h2 className="text-[16px] font-semibold text-slate-900">Search and filter</h2>
            <p className="text-sm text-slate-500 mt-1">Filter student addresses and credential status.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={openIssuePanel}>Issue Credential</Button>
            <Button variant="secondary" onClick={() => navigate('/institution')}>Back to Overview</Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student address"
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition-all duration-200 ease-out focus:border-[#1F5EFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'revoked')}
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition-all duration-200 ease-out focus:border-[#1F5EFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
            Sorted by newest
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold text-slate-600">Credential ID</th>
                  <th className="px-4 py-4 font-semibold text-slate-600">Student</th>
                  <th className="px-4 py-4 font-semibold text-slate-600">Degree</th>
                  <th className="px-4 py-4 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-4 font-semibold text-slate-600">Verifications</th>
                  <th className="px-4 py-4 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading credentials…</td>
                  </tr>
                ) : filteredCredentials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No credentials found.</td>
                  </tr>
                ) : (
                  pageItems.map((item) => {
                    const detail = details[item.credentialId];
                    const metadata = safeParseMetadata(item.ipfsHash);
                    const degree = detail?.degree || (metadata?.degree as string) || (metadata?.program as string) || item.ipfsHash;
                    return (
                      <tr key={item.credentialId} className="transition-colors duration-150 hover:bg-slate-50">
                        <td className="px-4 py-4 align-top text-sm text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{truncateText(item.credentialId, 20)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(item.credentialId)}
                            >
                              Copy
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span>{detail?.student ? formatAddress(detail.student) : 'Loading…'}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(detail.student)}
                          >
                            Copy
                          </Button>
                        </td>
                        <td className="px-4 py-4 align-top">{degree}</td>
                        <td className="px-4 py-4 align-top">
                          <Badge variant={getStatusBadgeVariant(detail)}>{getStatusLabel(detail)}</Badge>
                        </td>
                        <td className="px-4 py-4 align-top">—</td>
                        <td className="px-4 py-4 align-top">
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
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400">Loading credentials…</div>
          ) : filteredCredentials.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400">No credentials found.</div>
          ) : (
            pageItems.map((item) => {
              const detail = details[item.credentialId];
              const metadata = safeParseMetadata(item.ipfsHash);
              const degree = detail?.degree || (metadata?.degree as string) || (metadata?.program as string) || item.ipfsHash;
              return (
                <Card key={item.credentialId} padding="sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Credential ID</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{truncateText(item.credentialId, 18)}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(item.credentialId)}>
                      Copy
                    </Button>
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
                      <Badge variant={getStatusBadgeVariant(detail)}>{getStatusLabel(detail)}</Badge>
                      <span className="text-xs text-slate-400">Verifications: —</span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500 shadow-sm">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <div className="text-slate-500">Page {currentPage} of {totalPages}</div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40 px-4 py-6 backdrop-blur-sm md:items-center">
          <div className="fixed inset-0" onClick={() => setPanelOpen(false)} />
          <div className="relative z-10 w-full max-w-[480px] rounded-t-xl bg-white shadow-md transition-transform duration-200 ease-out md:rounded-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-[16px] font-semibold text-slate-900">Issue Credential</h2>
                <p className="text-sm text-slate-500 mt-1">Issue a new certificate to a verified student.</p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-500 transition-all duration-200 ease-out hover:bg-slate-200 hover:text-slate-700 active:scale-[0.97]"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              {issueResult ? (
                <div className="space-y-4">
                  <Card padding="sm" className="border-emerald-100 bg-emerald-50">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                      <p className="text-sm font-semibold text-emerald-800">Credential issued successfully</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">ID: <span className="font-mono break-all text-slate-900">{issueResult.credentialId}</span></p>
                    <p className="mt-1 text-sm text-slate-500">Transaction: <span className="font-mono text-slate-700">{issueResult.txHash}</span></p>
                  </Card>
                  <div className="grid gap-3">
                    <Button onClick={() => handleCopy(issueResult.credentialId)}>Copy Credential ID</Button>
                    <Link
                      to={`/verify/${issueResult.credentialId}`}
                      className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm text-center transition-all duration-200 ease-out hover:bg-slate-50 active:scale-[0.98]"
                    >
                      View Verification Page
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleIssueSubmit} className="space-y-4">
                  <Input
                    value={studentAddress}
                    onChange={(e) => setStudentAddress(e.target.value)}
                    required
                    placeholder="0x..."
                    label="Student Wallet Address"
                  />
                  <Input
                    value={degreeName}
                    onChange={(e) => setDegreeName(e.target.value)}
                    required
                    placeholder="Bachelor of Science in Computer Science"
                    label="Degree / Program"
                  />
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-all duration-200 ease-out">
                    <button
                      type="button"
                      onClick={() => setMetadataOpen(!metadataOpen)}
                      className="flex w-full items-center justify-between text-sm font-medium text-slate-600 transition-all duration-200 ease-out hover:text-slate-900"
                    >
                      <span>Optional metadata</span>
                      <span className="transition-transform duration-200 ease-out" style={{ transform: metadataOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
                    </button>
                    {metadataOpen && (
                      <p className="mt-3 text-sm text-slate-500 transition-all duration-200 ease-out">Additional metadata support is coming soon. You may include JSON metadata in the IPFS payload later.</p>
                    )}
                  </div>
                  {issueError && (
                    <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 transition-all duration-200 ease-out">
                      <svg className="h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                      <span>{issueError}</span>
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={issueLoading}
                    className="w-full"
                  >
                    {issueLoading ? 'Issuing…' : 'Issue Credential'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 transition-all duration-200 ease-out">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
            <span>{error}</span>
          </div>
        </div>
      )}
      {!isConnected && (
        <Button onClick={handleConnect}>Connect MetaMask</Button>
      )}
    </div>
  );
}