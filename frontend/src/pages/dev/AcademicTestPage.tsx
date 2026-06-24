import { useState } from 'react';
import { useWallet } from '../../web3/useWallet';
import Button from '../../ui/Button/Button';
import Card from '../../ui/Card/Card';

interface ActionState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

function initState(): ActionState {
  return { loading: false, error: null, success: null };
}

export default function AcademicTestPage() {
  const { account, isConnected, connect, ensureReady, sendTx, txPending, getIdentity, getCourse, getAcademic, getGraduation, getCertificate, error: walletError } = useWallet();
  const [pageError, setPageError] = useState<string | null>(null);

  // Department
  const [deptName, setDeptName] = useState('');
  const [deptState, setDeptState] = useState<ActionState>(initState);

  // Course
  const [courseDeptId, setCourseDeptId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseState, setCourseState] = useState<ActionState>(initState);

  // Enrollment
  const [enrollAddress, setEnrollAddress] = useState('');
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrollState, setEnrollState] = useState<ActionState>(initState);

  // Grade
  const [gradeAddress, setGradeAddress] = useState('');
  const [gradeCourseId, setGradeCourseId] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [gradeState, setGradeState] = useState<ActionState>(initState);

  // Graduation
  const [gradAddress, setGradAddress] = useState('');
  const [eligibilityState, setEligibilityState] = useState<{ eligible: boolean | null; message: string | null }>({ eligible: null, message: null });
  const [approveGradState, setApproveGradState] = useState<ActionState>(initState);

  // Certificate
  const [certAddress, setCertAddress] = useState('');
  const [certState, setCertState] = useState<ActionState>(initState);

  async function runAction(
    label: string,
    setState: (s: ActionState) => void,
    action: () => Promise<void>
  ) {
    setState({ loading: true, error: null, success: null });
    try {
      const ready = await ensureReady();
      if (!ready) {
        setState({ loading: false, error: walletError || 'Wallet not ready', success: null });
        return;
      }
      await action();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setState({ loading: false, error: msg, success: null });
    }
  }

  async function handleCreateDepartment() {
    await runAction('Create Department', setDeptState, async () => {
      const contract = getIdentity();
      const txHash = await sendTx(contract.createDepartment(deptName.trim()));
      setDeptState({ loading: false, error: null, success: `Department created. Tx: ${txHash}` });
    });
  }

  async function handleAddCourse() {
    await runAction('Add Course', setCourseState, async () => {
      const contract = getCourse();
      const txHash = await sendTx(contract.addCourse(Number(courseDeptId), courseName.trim()));
      setCourseState({ loading: false, error: null, success: `Course added. Tx: ${txHash}` });
    });
  }

  async function handleEnrollStudent() {
    await runAction('Enroll Student', setEnrollState, async () => {
      const contract = getAcademic();
      const txHash = await sendTx(contract.enrollStudent(enrollAddress.trim(), Number(enrollCourseId)));
      setEnrollState({ loading: false, error: null, success: `Student enrolled. Tx: ${txHash}` });
    });
  }

  async function handleAssignGrade() {
    await runAction('Assign Grade', setGradeState, async () => {
      const contract = getAcademic();
      const txHash = await sendTx(contract.assignGrade(gradeAddress.trim(), Number(gradeCourseId), Number(gradeValue)));
      setGradeState({ loading: false, error: null, success: `Grade assigned. Tx: ${txHash}` });
    });
  }

  async function handleCheckEligibility() {
    setEligibilityState({ eligible: null, message: null });
    try {
      const ready = await ensureReady();
      if (!ready) return;
      const contract = getGraduation();
      const eligible = await contract.checkGraduationEligibility(gradAddress.trim());
      setEligibilityState({
        eligible: Boolean(eligible),
        message: eligible ? '✅ Student is eligible for graduation' : '❌ Student is NOT eligible for graduation',
      });
    } catch (err: unknown) {
      setEligibilityState({
        eligible: false,
        message: `⚠️ Error: ${err instanceof Error ? err.message : 'Eligibility check failed'}`,
      });
    }
  }

  async function handleApproveGraduation() {
    await runAction('Approve Graduation', setApproveGradState, async () => {
      const contract = getGraduation();
      const txHash = await sendTx(contract.approveGraduation(gradAddress.trim()));
      setApproveGradState({ loading: false, error: null, success: `Graduation approved. Tx: ${txHash}` });
    });
  }

  async function handleIssueCertificate() {
    await runAction('Issue Certificate', setCertState, async () => {
      const contract = getCertificate();
      const txHash = await sendTx(contract.issueCertificate(certAddress.trim(), '{"degree":"Bachelor of Science"}'));
      setCertState({ loading: false, error: null, success: `Certificate issued. Tx: ${txHash}` });
    });
  }

  const actionDisabled = txPending;

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8 px-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Academic Activation</h1>
        <p className="text-sm text-gray-500 mt-1">Runtime verification for the full Academic lifecycle</p>
      </div>

      {!isConnected && (
        <Button onClick={connect}>Connect MetaMask</Button>
      )}

      {isConnected && account && (
        <p className="text-xs text-gray-400 font-mono break-all">Connected: {account}</p>
      )}

      {/* Section 1 — Department */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">1. Create Department</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            placeholder="Department name (e.g. Computer Science)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <Button onClick={handleCreateDepartment} disabled={actionDisabled || !deptName.trim()}>
            Create Department
          </Button>
          {deptState.error && <p className="text-sm text-red-700">{deptState.error}</p>}
          {deptState.success && <p className="text-sm text-green-800 break-all">{deptState.success}</p>}
        </div>
      </Card>

      {/* Section 2 — Course */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">2. Add Course</h2>
        <div className="space-y-3">
          <input
            type="number"
            value={courseDeptId}
            onChange={(e) => setCourseDeptId(e.target.value)}
            placeholder="Department ID (from create above)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="Course name (e.g. Data Structures)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <Button onClick={handleAddCourse} disabled={actionDisabled || !courseDeptId.trim() || !courseName.trim()}>
            Add Course
          </Button>
          {courseState.error && <p className="text-sm text-red-700">{courseState.error}</p>}
          {courseState.success && <p className="text-sm text-green-800 break-all">{courseState.success}</p>}
        </div>
      </Card>

      {/* Section 3 — Enrollment */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">3. Enroll Student</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={enrollAddress}
            onChange={(e) => setEnrollAddress(e.target.value)}
            placeholder="Student wallet address (0x...)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={enrollCourseId}
            onChange={(e) => setEnrollCourseId(e.target.value)}
            placeholder="Course ID"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <Button onClick={handleEnrollStudent} disabled={actionDisabled || !enrollAddress.trim() || !enrollCourseId.trim()}>
            Enroll Student
          </Button>
          {enrollState.error && <p className="text-sm text-red-700">{enrollState.error}</p>}
          {enrollState.success && <p className="text-sm text-green-800 break-all">{enrollState.success}</p>}
        </div>
      </Card>

      {/* Section 4 — Grade */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">4. Assign Grade</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={gradeAddress}
            onChange={(e) => setGradeAddress(e.target.value)}
            placeholder="Student wallet address (0x...)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={gradeCourseId}
            onChange={(e) => setGradeCourseId(e.target.value)}
            placeholder="Course ID"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={gradeValue}
            onChange={(e) => setGradeValue(e.target.value)}
            placeholder="Grade (e.g. 85)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <Button onClick={handleAssignGrade} disabled={actionDisabled || !gradeAddress.trim() || !gradeCourseId.trim() || !gradeValue.trim()}>
            Assign Grade
          </Button>
          {gradeState.error && <p className="text-sm text-red-700">{gradeState.error}</p>}
          {gradeState.success && <p className="text-sm text-green-800 break-all">{gradeState.success}</p>}
        </div>
      </Card>

      {/* Section 5 — Graduation */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">5. Graduation</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={gradAddress}
            onChange={(e) => setGradAddress(e.target.value)}
            placeholder="Student wallet address (0x...)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCheckEligibility} disabled={!gradAddress.trim()} variant="secondary">
              Check Eligibility
            </Button>
            <Button onClick={handleApproveGraduation} disabled={actionDisabled || !gradAddress.trim()}>
              Approve Graduation
            </Button>
          </div>
          {eligibilityState.message && (
            <p className={`text-sm ${eligibilityState.eligible ? 'text-green-800' : 'text-amber-700'}`}>
              {eligibilityState.message}
            </p>
          )}
          {approveGradState.error && <p className="text-sm text-red-700">{approveGradState.error}</p>}
          {approveGradState.success && <p className="text-sm text-green-800 break-all">{approveGradState.success}</p>}
        </div>
      </Card>

      {/* Section 6 — Certificate */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">6. Issue Certificate</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={certAddress}
            onChange={(e) => setCertAddress(e.target.value)}
            placeholder="Student wallet address (0x...)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <Button onClick={handleIssueCertificate} disabled={actionDisabled || !certAddress.trim()}>
            Issue Certificate
          </Button>
          {certState.error && <p className="text-sm text-red-700">{certState.error}</p>}
          {certState.success && <p className="text-sm text-green-800 break-all">{certState.success}</p>}
        </div>
      </Card>

      {(pageError || walletError) && (
        <p className="text-sm text-red-700">{pageError || walletError}</p>
      )}
    </div>
  );
}