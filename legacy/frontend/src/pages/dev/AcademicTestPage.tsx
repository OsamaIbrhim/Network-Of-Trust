import { useState } from 'react';
import { keccak256, toUtf8Bytes } from 'ethers';
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
  const { account, isConnected, connect, ensureReady, sendTx, txPending, getCourse, getAcademic, getGraduation, getCertificate, error: walletError } = useWallet();

  // Department
  const [deptName, setDeptName] = useState('');
  const [deptState, setDeptState] = useState<ActionState>(initState);

  // Course — courseId, name, credits, department (string name, not numeric ID)
  const [courseId, setCourseId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCredits, setCourseCredits] = useState('');
  const [courseDept, setCourseDept] = useState('');
  const [courseState, setCourseState] = useState<ActionState>(initState);

  // Enrollment — student address, courseId string, semester string
  const [enrollAddress, setEnrollAddress] = useState('');
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrollSemester, setEnrollSemester] = useState('');
  const [enrollState, setEnrollState] = useState<ActionState>(initState);

  // Grade — student address, courseId string, semester string, grade number
  const [gradeAddress, setGradeAddress] = useState('');
  const [gradeCourseId, setGradeCourseId] = useState('');
  const [gradeSemester, setGradeSemester] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [gradeState, setGradeState] = useState<ActionState>(initState);

  // Graduation — student address, department string (for computing deptKey)
  const [gradAddress, setGradAddress] = useState('');
  const [gradDept, setGradDept] = useState('');
  const [eligibilityState, setEligibilityState] = useState<{ eligible: boolean | null; message: string | null }>({ eligible: null, message: null });
  const [approveGradState, setApproveGradState] = useState<ActionState>(initState);

  // Certificate
  const [certAddress, setCertAddress] = useState('');
  const [certState, setCertState] = useState<ActionState>(initState);

  async function runAction(
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

  // 1. Add Department — CourseManagement.addDepartment(name)
  async function handleAddDepartment() {
    await runAction(setDeptState, async () => {
      const contract = getCourse();
      const txHash = await sendTx(contract.addDepartment(deptName.trim()));
      setDeptState({ loading: false, error: null, success: `Department added. Tx: ${txHash}` });
    });
  }

  // 2. Add Course — CourseManagement.addCourse(courseId, name, credits, department)
  async function handleAddCourse() {
    await runAction(setCourseState, async () => {
      const contract = getCourse();
      const txHash = await sendTx(
        contract.addCourse(courseId.trim(), courseName.trim(), Number(courseCredits), courseDept.trim())
      );
      setCourseState({ loading: false, error: null, success: `Course added. Tx: ${txHash}` });
    });
  }

  // 3. Enroll Student — StudentAcademicManager.enrollStudent(address, courseId, semester)
  async function handleEnrollStudent() {
    await runAction(setEnrollState, async () => {
      const contract = getAcademic();
      const txHash = await sendTx(
        contract.enrollStudent(enrollAddress.trim(), enrollCourseId.trim(), enrollSemester.trim())
      );
      setEnrollState({ loading: false, error: null, success: `Student enrolled. Tx: ${txHash}` });
    });
  }

  // 4. Update Grade — StudentAcademicManager.updateGrade(address, courseId, semester, grade)
  async function handleUpdateGrade() {
    await runAction(setGradeState, async () => {
      const contract = getAcademic();
      const txHash = await sendTx(
        contract.updateGrade(gradeAddress.trim(), gradeCourseId.trim(), gradeSemester.trim(), Number(gradeValue))
      );
      setGradeState({ loading: false, error: null, success: `Grade updated. Tx: ${txHash}` });
    });
  }

  // 5a. Check Eligibility — GraduationManager.checkEligibility(student, deptKey) — this is a TX
  async function handleCheckEligibility() {
    setEligibilityState({ eligible: null, message: null });
    try {
      const ready = await ensureReady();
      if (!ready) {
        setEligibilityState({ eligible: false, message: walletError || 'Wallet not ready' });
        return;
      }
      const deptKey = keccak256(toUtf8Bytes(gradDept.trim() || 'Computer Science'));
      const contract = getGraduation();
      const txHash = await sendTx(contract.checkEligibility(gradAddress.trim(), deptKey));
      setEligibilityState({ eligible: true, message: `✅ Eligibility checked. Tx: ${txHash}` });
    } catch (err: unknown) {
      setEligibilityState({
        eligible: false,
        message: `⚠️ Error: ${err instanceof Error ? err.message : 'Eligibility check failed'}`,
      });
    }
  }

  // 5b. Approve Graduation — GraduationManager.approveGraduation(student)
  async function handleApproveGraduation() {
    await runAction(setApproveGradState, async () => {
      const contract = getGraduation();
      const txHash = await sendTx(contract.approveGraduation(gradAddress.trim()));
      setApproveGradState({ loading: false, error: null, success: `Graduation approved. Tx: ${txHash}` });
    });
  }

  // 6. Issue Certificate — Certificates.issueCertificate(student, ipfsHash)
  async function handleIssueCertificate() {
    await runAction(setCertState, async () => {
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
        <h2 className="text-sm font-semibold text-gray-900 mb-3">1. Add Department</h2>
        <p className="text-xs text-gray-500 mb-3">
          Calls <code>CourseManagement.addDepartment(name)</code>
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            placeholder="Department name (e.g. Computer Science)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <Button onClick={handleAddDepartment} disabled={actionDisabled || !deptName.trim()}>
            Add Department
          </Button>
          {deptState.error && <p className="text-sm text-red-700">{deptState.error}</p>}
          {deptState.success && <p className="text-sm text-green-800 break-all">{deptState.success}</p>}
        </div>
      </Card>

      {/* Section 2 — Course */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">2. Add Course</h2>
        <p className="text-xs text-gray-500 mb-3">
          Calls <code>CourseManagement.addCourse(courseId, name, credits, department)</code>
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            placeholder="Course ID (e.g. CS101)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="Course name (e.g. Data Structures)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={courseCredits}
            onChange={(e) => setCourseCredits(e.target.value)}
            placeholder="Credits (e.g. 3)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={courseDept}
            onChange={(e) => setCourseDept(e.target.value)}
            placeholder="Department name (must match an existing dept)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <Button
            onClick={handleAddCourse}
            disabled={actionDisabled || !courseId.trim() || !courseName.trim() || !courseCredits.trim() || !courseDept.trim()}
          >
            Add Course
          </Button>
          {courseState.error && <p className="text-sm text-red-700">{courseState.error}</p>}
          {courseState.success && <p className="text-sm text-green-800 break-all">{courseState.success}</p>}
        </div>
      </Card>

      {/* Section 3 — Enrollment */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">3. Enroll Student</h2>
        <p className="text-xs text-gray-500 mb-3">
          Calls <code>StudentAcademicManager.enrollStudent(address, courseId, semester)</code>
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={enrollAddress}
            onChange={(e) => setEnrollAddress(e.target.value)}
            placeholder="Student wallet address (0x...)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={enrollCourseId}
            onChange={(e) => setEnrollCourseId(e.target.value)}
            placeholder="Course ID (e.g. CS101)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={enrollSemester}
            onChange={(e) => setEnrollSemester(e.target.value)}
            placeholder="Semester (e.g. Fall2025)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <Button
            onClick={handleEnrollStudent}
            disabled={actionDisabled || !enrollAddress.trim() || !enrollCourseId.trim() || !enrollSemester.trim()}
          >
            Enroll Student
          </Button>
          {enrollState.error && <p className="text-sm text-red-700">{enrollState.error}</p>}
          {enrollState.success && <p className="text-sm text-green-800 break-all">{enrollState.success}</p>}
        </div>
      </Card>

      {/* Section 4 — Grade */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">4. Update Grade</h2>
        <p className="text-xs text-gray-500 mb-3">
          Calls <code>StudentAcademicManager.updateGrade(address, courseId, semester, grade)</code>
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={gradeAddress}
            onChange={(e) => setGradeAddress(e.target.value)}
            placeholder="Student wallet address (0x...)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={gradeCourseId}
            onChange={(e) => setGradeCourseId(e.target.value)}
            placeholder="Course ID (e.g. CS101)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={gradeSemester}
            onChange={(e) => setGradeSemester(e.target.value)}
            placeholder="Semester (e.g. Fall2025)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={gradeValue}
            onChange={(e) => setGradeValue(e.target.value)}
            placeholder="Grade (0–100)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <Button
            onClick={handleUpdateGrade}
            disabled={actionDisabled || !gradeAddress.trim() || !gradeCourseId.trim() || !gradeSemester.trim() || !gradeValue.trim()}
          >
            Update Grade
          </Button>
          {gradeState.error && <p className="text-sm text-red-700">{gradeState.error}</p>}
          {gradeState.success && <p className="text-sm text-green-800 break-all">{gradeState.success}</p>}
        </div>
      </Card>

      {/* Section 5 — Graduation */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">5. Graduation</h2>
        <p className="text-xs text-gray-500 mb-3">
          Calls <code>GraduationManager.checkEligibility(student, deptKey)</code> then{' '}
          <code>approveGraduation(student)</code>
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={gradAddress}
            onChange={(e) => setGradAddress(e.target.value)}
            placeholder="Student wallet address (0x...)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={gradDept}
            onChange={(e) => setGradDept(e.target.value)}
            placeholder="Department name (e.g. Computer Science)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleCheckEligibility}
              disabled={actionDisabled || !gradAddress.trim() || !gradDept.trim()}
              variant="secondary"
            >
              Check Eligibility
            </Button>
            <Button
              onClick={handleApproveGraduation}
              disabled={actionDisabled || !gradAddress.trim()}
            >
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
        <p className="text-xs text-gray-500 mb-3">
          Calls <code>Certificates.issueCertificate(student, ipfsHash)</code> with a signer-bound contract.
        </p>
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

      {walletError && (
        <p className="text-sm text-red-700">{walletError}</p>
      )}
    </div>
  );
}