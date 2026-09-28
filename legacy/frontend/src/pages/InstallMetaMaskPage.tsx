import { useNavigate } from 'react-router-dom';

export default function InstallMetaMaskPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900">
            <svg className="h-8 w-8 text-white" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M32.9582 1L19.3021 10.9385L22.1011 5.03236L32.9582 1Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.04175 1L15.6221 11.0049L12.8989 5.03236L2.04175 1Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M28.2907 23.5615L25.2396 28.2781L32.2819 30.1718L34.2057 23.6495L28.2907 23.5615Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M0.833252 23.6495L2.73821 30.1718L9.78049 28.2781L6.72943 23.5615L0.833252 23.6495Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.37598 14.511L7.49084 17.5639L14.4634 17.8878L14.1991 10.396L9.37598 14.511Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M25.624 14.511L20.7632 10.3291L20.5566 17.8878L27.5092 17.5639L25.624 14.511Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.78049 28.2781L14.0655 26.1388L10.3605 23.2101L9.78049 28.2781Z" fill="#D7BFE0" stroke="#D7BFE0" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.9345 26.1388L25.2396 28.2781L24.6395 23.2101L20.9345 26.1388Z" fill="#D7BFE0" stroke="#D7BFE0" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M25.2396 28.2781L20.9345 26.1388L21.2858 28.9382L21.247 30.0146L25.2396 28.2781Z" fill="#233447" stroke="#233447" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.78049 28.2781L13.773 30.0146L13.7532 28.9382L14.0655 26.1388L9.78049 28.2781Z" fill="#233447" stroke="#233447" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.8514 19.1393L10.3027 18.0151L12.7224 16.7491L13.8514 19.1393Z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21.1486 19.1393L22.2776 16.7491L24.7163 18.0151L21.1486 19.1393Z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.0655 26.1388L13.3239 21.3419L10.3605 23.2101L14.0655 26.1388Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21.676 21.3419L20.9345 26.1388L24.6395 23.2101L21.676 21.3419Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24.6395 23.2101L20.9345 26.1388L21.2858 28.9382L24.6395 23.2101Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.3605 23.2101L13.7532 28.9382L14.0655 26.1388L10.3605 23.2101Z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">MetaMask required</h1>
        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          This application requires MetaMask, a browser extension for managing Ethereum wallets and interacting with the blockchain.
        </p>

        <div className="mt-8 space-y-4">
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:bg-slate-800 active:scale-[0.98]"
          >
            Install MetaMask
          </a>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-400 mb-3">After installing MetaMask, refresh this page.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 ease-out hover:bg-slate-50 active:scale-[0.98]"
            >
              Refresh page
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-sm font-medium text-slate-500 transition-all duration-200 ease-out hover:text-slate-700"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}