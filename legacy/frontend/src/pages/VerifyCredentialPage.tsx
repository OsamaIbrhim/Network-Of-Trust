import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getCertificateContractReadOnly, getIdentityContractReadOnly } from '../web3/contracts';

interface CredentialDetails {
  universityName: string;
  graduateName: string;
  degree: string;
  issuedDate: string;
  graduationDate: string;
  isValid: boolean;
  blockTimestamp: string;
  credentialId: string;
}

function parseMetadata(ipfsHash: string): { degree: string; graduationDate: string } {
  try {
    const parsed = JSON.parse(ipfsHash) as { degree?: string; graduationDate?: string };
    return {
      degree: parsed.degree ?? ipfsHash,
      graduationDate: parsed.graduationDate ?? '',
    };
  } catch {
    return { degree: ipfsHash, graduationDate: '' };
  }
}

function formatTimestamp(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toLocaleString();
}

export default function VerifyCredentialPage() {
  const { credentialId } = useParams<{ credentialId: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<CredentialDetails | null>(null);

  useEffect(() => {
    if (!credentialId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function verify() {
      setLoading(true);
      setNotFound(false);
      setError(null);
      setDetails(null);

      try {
        const certContract = getCertificateContractReadOnly();
        const identityContract = getIdentityContractReadOnly();

        let certData: [string, string, string, bigint, boolean];
        try {
          certData = await certContract.verifyCertificate(credentialId);
        } catch {
          if (!cancelled) {
            setNotFound(true);
          }
          return;
        }

        const [student, institution, ipfsHash, issuedAt, isValid] = certData;
        const metadata = parseMetadata(ipfsHash);

        let universityName = institution;
        let graduateName = student;

        try {
          const inst = await identityContract.getInstitutionData(institution);
          if (inst.name) universityName = inst.name;
        } catch {
          // institution data unavailable
        }

        try {
          const studentData = await identityContract.getStudentData(student);
          const fullName = [studentData.firstName, studentData.lastName].filter(Boolean).join(' ');
          if (fullName) graduateName = fullName;
        } catch {
          // student data unavailable
        }

        if (!cancelled) {
          setDetails({
            universityName,
            graduateName,
            degree: metadata.degree,
            graduationDate: metadata.graduationDate,
            issuedDate: formatTimestamp(issuedAt),
            isValid,
            blockTimestamp: issuedAt.toString(),
            credentialId: credentialId!,
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Verification failed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [credentialId]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-300 rounded shadow-sm p-8">
        <header className="border-b border-gray-200 pb-4 mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Credential Verification</h1>
          <p className="text-xs text-gray-500 mt-1">Official blockchain record</p>
        </header>

        {loading && <p className="text-sm text-gray-600">Verifying credential…</p>}

        {!loading && error && (
          <p className="text-sm text-red-700">{error}</p>
        )}

        {!loading && notFound && (
          <div className="text-center py-4">
            <p className="text-base font-medium text-gray-900">Credential Not Found</p>
            <p className="text-sm text-gray-600 mt-2">
              No valid credential exists for this ID on the blockchain.
            </p>
          </div>
        )}

        {!loading && details && (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium text-gray-900 mt-0.5">
                {details.isValid ? '✅ Verified' : 'Revoked'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">University</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{details.universityName}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Graduate</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{details.graduateName}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Degree</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{details.degree}</dd>
            </div>
            {details.graduationDate && (
              <div>
                <dt className="text-gray-500">Graduation Date</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{details.graduationDate}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">Issued Date</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{details.issuedDate}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Block Timestamp</dt>
              <dd className="font-mono text-xs text-gray-700 mt-0.5">{details.blockTimestamp}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Credential ID</dt>
              <dd className="font-mono text-xs text-gray-700 mt-0.5 break-all">{details.credentialId}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
