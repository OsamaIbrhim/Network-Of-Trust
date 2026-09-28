import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWallet } from '../web3/useWallet';
import { getIdentityContractReadOnly } from '../web3/contracts';

type UserRole = 'admin' | 'institution' | 'student' | 'employer' | 'unknown';

const ROLE_ROUTES: Record<UserRole, string> = {
  admin: '/',
  institution: '/institution',
  student: '/student',
  employer: '/employer',
  unknown: '/apply',
};

function mapRoleFromContract(roleUint: number): UserRole {
  switch (roleUint) {
    case 1: return 'student';
    case 2: return 'institution';
    case 3: return 'employer';
    case 4: return 'admin';
    default: return 'unknown';
  }
}

export default function RoleRouter({ children }: { children: React.ReactNode }) {
  const { account, isConnected, isMetaMaskInstalled, connect } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<UserRole | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkRole() {
      if (!isConnected || !account) {
        setChecking(false);
        return;
      }

      try {
        const contract = getIdentityContractReadOnly();
        const roleUint = Number(await contract.getUserRole(account));

        if (cancelled) return;

        const resolvedRole = mapRoleFromContract(roleUint);
        setRole(resolvedRole);

        if (location.pathname === '/') {
          const targetPath = ROLE_ROUTES[resolvedRole];
          if (targetPath) {
            navigate(targetPath, { replace: true });
          }
        }
        
      } catch {
        if (cancelled) return;
        setRole('unknown');
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    checkRole();
    return () => { cancelled = true; };
  }, [account, isConnected, navigate]);

  // Not connected — show landing with connect prompt
  if (!isConnected) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-12 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900 mb-6">
              <svg className="h-8 w-8 text-white" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32.9582 1L19.3021 10.9385L22.1011 5.03236L32.9582 1Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.04175 1L15.6221 11.0049L12.8989 5.03236L2.04175 1Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M28.2907 23.5615L25.2396 28.2781L32.2819 30.1718L34.2057 23.6495L28.2907 23.5615Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M0.833252 23.6495L2.73821 30.1718L9.78049 28.2781L6.72943 23.5615L0.833252 23.6495Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.37598 14.511L7.49084 17.5639L14.4634 17.8878L14.1991 10.396L9.37598 14.511Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M25.624 14.511L20.7632 10.3291L20.5566 17.8878L27.5092 17.5639L25.624 14.511Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.78049 28.2781L14.0655 26.1388L10.3605 23.2101L9.78049 28.2781Z" fill="#D7BFE0" stroke="#D7BFE0" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20.9345 26.1388L25.2396 28.2781L24.6395 23.2101L20.9345 26.1388Z" fill="#D7BFE0" stroke="#D7BFE0" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M25.2396 28.2781L20.9345 26.1388L21.2858 28.9382L21.247 30.0146L25.2396 28.2781Z" fill="#233447" stroke="#233447" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.78049 28.2781L13.773 30.0146L13.7532 28.9382L14.0655 26.1388L9.78049 28.2781Z" fill="#233447" stroke="#233447" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.8514 19.1393L10.3027 18.0151L12.7224 16.7491L13.8514 19.1393Z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21.1486 19.1393L22.2776 16.7491L24.7163 18.0151L21.1486 19.1393Z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14.0655 26.1388L13.3239 21.3419L10.3605 23.2101L14.0655 26.1388Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21.676 21.3419L20.9345 26.1388L24.6395 23.2101L21.676 21.3419Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M24.6395 23.2101L20.9345 26.1388L21.2858 28.9382L24.6395 23.2101Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.3605 23.2101L13.7532 28.9382L14.0655 26.1388L10.3605 23.2101Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Network of Trust</h1>
            <p className="mt-3 max-w-md text-sm text-slate-500">Decentralized credential issuance and verification platform. Connect your wallet to get started.</p>
            <button
              type="button"
              onClick={() => {
                if (!isMetaMaskInstalled) {
                  navigate('/install-metamask');
                  return;
                }
                connect();
              }}
              className="mt-8 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:bg-slate-800 active:scale-[0.98]"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Still checking role — show minimal loading state
  if (checking || role === null) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-12 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <p className="mt-4 text-sm text-slate-500">Verifying access…</p>
          </div>
        </div>
      </div>
    );
  }

  // Role resolved — render children (the dashboard page will handle its own data loading)
  return <>{children}</>;
}