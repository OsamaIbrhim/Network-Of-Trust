import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { certificateService } from '../../../services/certificate.service';

export default function CertificatePage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [certData, setCertData] = useState<any>(null);
  const verifyForm = useForm();

  const msg = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleVerify = async (formData: any) => {
    setLoading(true);
    try {
      const response = await certificateService.verifyCertificate(formData.certificateId);
      setCertData(response.data);
    } catch (err: any) {
      msg('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {message.text && (
        <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={verifyForm.handleSubmit(handleVerify)} className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3">Verify Certificate</h3>
        <input {...verifyForm.register('certificateId', { required: true })} placeholder="Certificate ID (bytes32 hex)" className="w-full border rounded px-3 py-2 mb-2 text-sm" />
        <button disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">Verify</button>
        {certData && (
          <div className="mt-3 text-xs space-y-1 bg-gray-50 p-3 rounded">
            <p>Student: {certData.student}</p>
            <p>Institution: {certData.institution}</p>
            <p>IPFS: {certData.ipfsHash}</p>
            <p>Issued: {certData.issuedAt ? new Date(Number(certData.issuedAt) * 1000).toLocaleDateString() : 'N/A'}</p>
            <p>Valid: {certData.isValid ? 'Yes' : 'No'}</p>
          </div>
        )}
      </form>
    </div>
  );
}
